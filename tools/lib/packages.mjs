// Deploy / release logic shared by the CLIs and the `pnpm dev` bootstrap (ADR-0003).
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET, CDN_BASE, UserError } from "./s3.mjs";

const PACKAGES_DIR = join(import.meta.dirname, "..", "..", "packages");
const MANIFEST_KEY = "manifest.json";
const SEMVER = /^\d+\.\d+\.\d+$/;

const CONTENT_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const entryKey = (name, version) => `${name}/${version}/${name}.js`;

export async function listPackages() {
  const dirs = await readdir(PACKAGES_DIR, { withFileTypes: true });
  return dirs.filter((d) => d.isDirectory()).map((d) => d.name);
}

export async function localVersion(name) {
  const pkgJson = join(PACKAGES_DIR, name, "package.json");
  const { version } = JSON.parse(await readFile(pkgJson, "utf8").catch(() => {
    throw new UserError(`Unknown package "${name}"`);
  }));
  if (!SEMVER.test(version)) throw new UserError(`Invalid version "${version}" in ${name}/package.json`);
  return version;
}

export async function isDeployed(name, version) {
  return s3
    .send(new HeadObjectCommand({ Bucket: BUCKET, Key: entryKey(name, version) }))
    .then(() => true)
    .catch((e) => (e.$metadata?.httpStatusCode === 404 ? false : Promise.reject(e)));
}

/** Uploads packages/<name>/dist/* to <name>/<version>/. Never overwrites (ADR-0002, decision 3). */
export async function deployPackage(name, log = console.log) {
  const version = await localVersion(name);
  const distDir = join(PACKAGES_DIR, name, "dist");
  const files = await readdir(distDir).catch(() => {
    throw new UserError(`No dist/ in ${name} – run pnpm build first`);
  });
  const entry = `${name}.js`;
  if (!files.includes(entry)) throw new UserError(`Missing ${name}/dist/${entry}`);
  if (await isDeployed(name, version)) {
    throw new UserError(`${name}/${version} already exists – bump "version" in ${name}/package.json`);
  }

  // Entry file last: until it exists the version counts as "not deployed",
  // so an interrupted upload can simply be retried.
  for (const file of [...files.filter((f) => f !== entry), entry]) {
    const contentType = CONTENT_TYPES[extname(file)];
    if (!contentType) throw new UserError(`Unexpected file type: ${name}/dist/${file}`);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${name}/${version}/${file}`,
        Body: await readFile(join(distDir, file)),
        ContentType: contentType,
        // Versioned files never change (ADR-0003, decision 6).
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    log(`  ↑ ${name}/${version}/${file}`);
  }
  return { version, url: `${CDN_BASE}/${entryKey(name, version)}` };
}

export async function readManifest() {
  return s3
    .send(new GetObjectCommand({ Bucket: BUCKET, Key: MANIFEST_KEY }))
    .then(async (res) => JSON.parse(await res.Body.transformToString()))
    .catch((e) => (e.name === "NoSuchKey" ? { imports: {} } : Promise.reject(e)));
}

/** Points the manifest at a deployed version. Rollback = release an older version. */
export async function releasePackage(name, version) {
  if (!SEMVER.test(version)) throw new UserError(`"${version}" is not a semver version (x.y.z)`);
  if (!(await isDeployed(name, version))) {
    throw new UserError(`${name}@${version} is not deployed – run pnpm pkg:deploy ${name}`);
  }

  const manifest = await readManifest();
  const specifier = `@gw/${name}`;
  const previous = manifest.imports[specifier];
  const next = `${CDN_BASE}/${entryKey(name, version)}`;
  manifest.imports[specifier] = next;
  // Lets the host build preview URLs without knowing the bucket layout (ADR-0003, decision 7).
  manifest.previewUrlTemplate = `${CDN_BASE}/{name}/{version}/{name}.js`;

  // Last write wins: no locking between concurrent releases (accepted in ADR-0003).
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: MANIFEST_KEY,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-cache", // ADR-0003, decision 6
    }),
  );
  return { specifier, previous, next };
}

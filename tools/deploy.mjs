// Usage: pnpm pkg:deploy <package>
// Uploads packages/<package>/dist/* to s3://<bucket>/<package>/<version>/ (ADR-0003, decision 1).
// Deploy does NOT make the version live – that is `pkg:release` (ADR-0003, decision 2).
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET, CDN_BASE, fail } from "./s3.mjs";

const name = process.argv[2];
if (!name) fail("Usage: pnpm pkg:deploy <package>");

const pkgDir = join(import.meta.dirname, "..", "packages", name);
const { version } = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Invalid version "${version}" in ${name}/package.json`);

const distDir = join(pkgDir, "dist");
const files = await readdir(distDir).catch(() => fail(`No dist/ in ${name} – run pnpm build first`));
const entry = `${name}.js`;
if (!files.includes(entry)) fail(`Missing dist/${entry}`);

const prefix = `${name}/${version}`;

// Immutability: a published version is never overwritten (ADR-0002, decision 3).
const exists = await s3
  .send(new HeadObjectCommand({ Bucket: BUCKET, Key: `${prefix}/${entry}` }))
  .then(() => true)
  .catch((e) => (e.$metadata?.httpStatusCode === 404 ? false : Promise.reject(e)));
if (exists) fail(`${prefix} already exists – bump "version" in ${name}/package.json`);

const CONTENT_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

// Upload the entry file last: until it exists, the version is invisible to the HEAD check
// above and can be re-deployed, so a half-finished upload never blocks a retry.
const ordered = [...files.filter((f) => f !== entry), entry];

for (const file of ordered) {
  const contentType = CONTENT_TYPES[extname(file)];
  if (!contentType) fail(`Unexpected file type: dist/${file}`);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${prefix}/${file}`,
      Body: await readFile(join(distDir, file)),
      ContentType: contentType,
      // Versioned files never change, so every cache may keep them for a year (ADR-0003, decision 6).
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  console.log(`  ↑ ${prefix}/${file}`);
}

console.log(`✔ Deployed ${name}@${version} (not live yet)`);
console.log(`  URL:     ${CDN_BASE}/${prefix}/${entry}`);
console.log(`  Release: pnpm pkg:release ${name} ${version}`);

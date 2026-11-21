// Usage: pnpm pkg:release <package> <version>
// Points the manifest at an already deployed version (ADR-0003, decisions 2–4).
// Rollback is the same command with an older version.
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET, CDN_BASE, fail } from "./s3.mjs";

const [name, version] = process.argv.slice(2);
if (!name || !version) fail("Usage: pnpm pkg:release <package> <version>");
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`"${version}" is not a semver version (x.y.z)`);

const MANIFEST_KEY = "manifest.json";
const key = `${name}/${version}/${name}.js`;

// Never point users at a version that is not in the bucket.
await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).catch((e) => {
  if (e.$metadata?.httpStatusCode === 404) fail(`${name}@${version} is not deployed – run pnpm pkg:deploy ${name}`);
  throw e;
});

// Read the current manifest, or start a new one on the very first release.
const manifest = await s3
  .send(new GetObjectCommand({ Bucket: BUCKET, Key: MANIFEST_KEY }))
  .then(async (res) => JSON.parse(await res.Body.transformToString()))
  .catch((e) => (e.name === "NoSuchKey" ? { imports: {} } : Promise.reject(e)));

const specifier = `@gw/${name}`;
const previous = manifest.imports[specifier];
const next = `${CDN_BASE}/${key}`;

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
    // Always revalidate, so a release/rollback is visible on the next page load (ADR-0003, decision 6).
    CacheControl: "no-cache",
  }),
);

console.log(`✔ Released ${specifier}`);
console.log(`  was: ${previous ?? "(not released before)"}`);
console.log(`  now: ${next}`);

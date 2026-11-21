// Usage: pnpm dev
// One command from a fresh clone to a running local platform:
// install → infra (LocalStack S3 + nginx CDN) → build → deploy → release.
// Idempotent: safe to run again, never overrides a manual release or rollback.
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit" });
const step = (msg) => console.log(`\n▶ ${msg}`);

// 0. The one manual prerequisite (ADR-0002): a LocalStack auth token in .env.
const envFile = join(ROOT, ".env");
const hasToken =
  existsSync(envFile) && /^LOCALSTACK_AUTH_TOKEN=\S+/m.test(readFileSync(envFile, "utf8"));
if (!hasToken) {
  console.error(`✖ Missing LocalStack auth token.
  1. Create a free account at https://app.localstack.cloud and copy your auth token
  2. cp .env.example .env
  3. Paste the token after LOCALSTACK_AUTH_TOKEN= in .env
  4. Run pnpm dev again`);
  process.exit(1);
}

try {
  step("Installing dependencies");
  run("pnpm install --frozen-lockfile");

  step("Starting infrastructure (LocalStack S3 + nginx CDN)");
  run("docker compose up -d --wait");

  step("Building packages");
  run("pnpm -r build");
} catch {
  process.exit(1); // the failing command already printed its error
}

// Imported only now: the AWS SDK exists after `pnpm install`.
const { listPackages, localVersion, isDeployed, deployPackage, readManifest, releasePackage } =
  await import("./lib/packages.mjs");

step("Deploying and releasing packages");
const manifest = await readManifest();
for (const name of await listPackages()) {
  const version = await localVersion(name);

  if (await isDeployed(name, version)) {
    console.log(`  ${name}@${version}: already deployed`);
  } else {
    await deployPackage(name, () => {});
    console.log(`  ${name}@${version}: deployed`);
  }

  // Release only packages missing from the manifest – re-running pnpm dev
  // must not silently undo a manual release or rollback.
  const live = manifest.imports[`@gw/${name}`];
  if (live) {
    console.log(`  ${name}: live version kept (${live})`);
  } else {
    await releasePackage(name, version);
    console.log(`  ${name}@${version}: released`);
  }
}

console.log(`
✔ gw-engagement is running
  CDN:      http://localhost:4000
  Manifest: http://localhost:4000/manifest.json
  Next:     start gw-portal (pnpm dev there) and open http://localhost:3000
  Stop:     pnpm infra:down   (S3 is wiped – pnpm dev restores it)`);

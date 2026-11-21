// Usage: pnpm pkg:deploy <package>
// Uploads the built package as an immutable version. Does NOT make it live (ADR-0003, decision 2).
import { deployPackage } from "./lib/packages.mjs";
import { runCli, UserError } from "./lib/s3.mjs";

await runCli(async () => {
  const name = process.argv[2];
  if (!name) throw new UserError("Usage: pnpm pkg:deploy <package>");

  const { version, url } = await deployPackage(name);
  console.log(`✔ Deployed ${name}@${version} (not live yet)`);
  console.log(`  URL:     ${url}`);
  console.log(`  Release: pnpm pkg:release ${name} ${version}`);
});

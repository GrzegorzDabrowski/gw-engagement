// Usage: pnpm pkg:release <package> <version>
// Points the manifest at an already deployed version. Rollback = same command, older version.
import { releasePackage } from "./lib/packages.mjs";
import { runCli, UserError } from "./lib/s3.mjs";

await runCli(async () => {
  const [name, version] = process.argv.slice(2);
  if (!name || !version) throw new UserError("Usage: pnpm pkg:release <package> <version>");

  const { specifier, previous, next } = await releasePackage(name, version);
  console.log(`✔ Released ${specifier}`);
  console.log(`  was: ${previous ?? "(not released before)"}`);
  console.log(`  now: ${next}`);
});

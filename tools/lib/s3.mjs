// Shared S3 configuration for deploy/release scripts (ADR-0002).
// Defaults target local LocalStack; override via env to point at real AWS.
import { S3Client } from "@aws-sdk/client-s3";

export const BUCKET = process.env.GW_BUCKET ?? "gw-packages";
export const CDN_BASE = process.env.GW_CDN_BASE ?? "http://localhost:4000";

export const s3 = new S3Client({
  endpoint: process.env.GW_S3_ENDPOINT ?? "http://localhost:4566",
  region: process.env.AWS_REGION ?? "us-east-1",
  // LocalStack accepts any credentials; real AWS uses the default credential chain.
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? undefined
    : { accessKeyId: "test", secretAccessKey: "test" },
  // bucket in the path (host/bucket/key) instead of a subdomain (bucket.host/key),
  // which would need DNS for *.localhost
  forcePathStyle: true,
});

/** Expected, user-facing failure (bad input, version exists, …) – printed without a stack trace. */
export class UserError extends Error {}

/** Runs a CLI entry point: prints UserErrors nicely, exits with 1 on any failure. */
export async function runCli(main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof UserError) console.error(`✖ ${e.message}`);
    else console.error(e);
    process.exit(1);
  }
}

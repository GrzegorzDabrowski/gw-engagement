# gw-engagement

Engagement packages for gw-portal, built as native ES modules and served at runtime
through a local S3 (LocalStack) + nginx CDN. Architecture decisions: [`docs/adr`](docs/adr).

## Quick start

Prerequisites: Node 22+, pnpm 9+, Docker, a free [LocalStack](https://app.localstack.cloud) account.

```sh
cp .env.example .env   # once: paste your LocalStack auth token into .env
pnpm dev               # install → infra → build → deploy → release
```

Then start [gw-portal](https://github.com/GrzegorzDabrowski/gw-portal) and open http://localhost:3000.

| URL | What |
|---|---|
| http://localhost:4000/manifest.json | which version of each package is live |
| http://localhost:4000/hello/1.1.0/hello.js | an immutable package version (via CDN) |

`pnpm dev` is idempotent: it deploys versions missing from S3 and releases only packages
missing from the manifest, so it never undoes a manual release or rollback.

## Releasing a new version

```sh
# 1. bump "version" in packages/<name>/package.json, then:
pnpm build
pnpm pkg:deploy hello            # upload – not visible to users yet
# 2. preview on the real host: http://localhost:3000/?gw-hello=<version>
pnpm pkg:release hello <version> # make it live
pnpm pkg:release hello <older>   # rollback
```

## Scripts

| Script | What |
|---|---|
| `pnpm dev` | whole environment from scratch |
| `pnpm infra:up` / `pnpm infra:down` | start / stop LocalStack + nginx (down wipes S3) |
| `pnpm build` / `pnpm typecheck` | build / typecheck all packages |
| `pnpm pkg:deploy <name>` | upload the built version to S3 |
| `pnpm pkg:release <name> <version>` | point the manifest at a deployed version |

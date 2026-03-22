# Releasing

## Prerequisites

- `NPM_TOKEN` secret configured in GitHub repo Settings → Secrets and variables → Actions

## How to Release

1. Bump the version in `package.json`
2. Commit the version bump
3. Tag and push:

```bash
git tag v0.1.0
git push && git push --tags
```

GitHub Actions (`.github/workflows/release.yml`) will automatically:

1. **Build** standalone tarballs for 4 platforms (macOS arm64/x64, Linux x64, Windows x64)
2. **Create GitHub Release** with the tarballs attached and auto-generated release notes
3. **Publish to npm** as `better-remote-control`

## What Gets Published

### npm (`npx better-remote-control`)

Only `dist/` and `public/` directories (defined in `package.json` `files` field). Requires Node.js >= 18 on the user's machine.

### GitHub Releases (standalone)

Self-contained tarballs bundling:

- Node.js v22 runtime (no Node.js install required)
- Server code (`dist/`)
- Client build (`public/`)
- Production dependencies (including native `node-pty` prebuild)

### Install script

```bash
curl -fsSL https://raw.githubusercontent.com/custardcream98/better-remote-control/main/install.sh | sh
```

Downloads the correct tarball for the user's OS/arch from GitHub Releases.

## Packaging Script

`scripts/package.mjs` creates a standalone tarball for the current platform. It runs in CI on each platform's runner but can also be tested locally:

```bash
pnpm run build
node scripts/package.mjs
# Output: release/brc-v{version}-{platform}-{arch}.tar.gz
```

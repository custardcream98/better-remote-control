#!/usr/bin/env node

/**
 * Creates a standalone tarball for the current platform.
 * Bundles Node.js runtime + production deps so no prerequisites are needed.
 *
 * Designed to run in CI on each target platform's runner.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const NODE_VERSION = "22.14.0";
const ROOT = path.resolve(import.meta.dirname, "..");
const RELEASE_DIR = path.join(ROOT, "release");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const VERSION = pkg.version;

const platform = process.platform;
const arch = process.arch;
const isWindows = platform === "win32";

const archiveName = `brc-v${VERSION}-${platform}-${arch}`;
const stageDir = path.join(RELEASE_DIR, archiveName);

console.log(`\nPackaging brc v${VERSION} for ${platform}-${arch}\n`);

// ── 1. Clean & create staging directory ──────────────────────────────

if (fs.existsSync(RELEASE_DIR)) fs.rmSync(RELEASE_DIR, { recursive: true });
fs.mkdirSync(path.join(stageDir, "bin"), { recursive: true });
fs.mkdirSync(path.join(stageDir, "lib"), { recursive: true });

// ── 2. Copy application files ────────────────────────────────────────

console.log("Copying application files...");
fs.cpSync(path.join(ROOT, "dist"), path.join(stageDir, "lib", "dist"), {
  recursive: true,
});
fs.cpSync(path.join(ROOT, "public"), path.join(stageDir, "lib", "public"), {
  recursive: true,
});

// ── 3. Install production dependencies ───────────────────────────────

console.log("Installing production dependencies...");

// Minimal package.json for production install
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  type: pkg.type,
  dependencies: pkg.dependencies,
};
fs.writeFileSync(
  path.join(stageDir, "lib", "package.json"),
  JSON.stringify(prodPkg, null, 2),
);

// npm install (not pnpm — we need real files, not symlinks)
// Scripts are NOT ignored: node-pty may need to compile on Linux
execSync("npm install --omit=dev", {
  cwd: path.join(stageDir, "lib"),
  stdio: "inherit",
});

// ── 4. Prune node-pty (keep only current platform's prebuild) ────────

const prebuildsDir = path.join(
  stageDir,
  "lib",
  "node_modules",
  "node-pty",
  "prebuilds",
);
if (fs.existsSync(prebuildsDir)) {
  const keep = `${platform}-${arch}`;
  for (const dir of fs.readdirSync(prebuildsDir)) {
    if (dir !== keep) {
      fs.rmSync(path.join(prebuildsDir, dir), { recursive: true });
    }
  }
}

// Remove .pdb debug symbols on Windows (~30 MB savings)
function removePdbFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) removePdbFiles(fp);
    else if (entry.name.endsWith(".pdb")) fs.rmSync(fp);
  }
}
if (isWindows) {
  removePdbFiles(path.join(stageDir, "lib", "node_modules"));
}

// Fix spawn-helper permissions (macOS/Linux)
if (!isWindows) {
  const spawnHelper = path.join(
    prebuildsDir,
    `${platform}-${arch}`,
    "spawn-helper",
  );
  if (fs.existsSync(spawnHelper)) {
    fs.chmodSync(spawnHelper, 0o755);
  }
}

// ── 5. Remove unnecessary files from node_modules ────────────────────

function pruneDir(dir, patterns) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (patterns.includes(entry.name)) {
        fs.rmSync(fp, { recursive: true });
      } else {
        pruneDir(fp, patterns);
      }
    }
  }
}
pruneDir(path.join(stageDir, "lib", "node_modules"), [
  "test",
  "tests",
  "__tests__",
  "example",
  "examples",
  "docs",
  ".github",
]);

// Remove generated lockfile (not needed at runtime)
const lockfile = path.join(stageDir, "lib", "package-lock.json");
if (fs.existsSync(lockfile)) fs.rmSync(lockfile);
const hiddenLock = path.join(stageDir, "lib", "node_modules", ".package-lock.json");
if (fs.existsSync(hiddenLock)) fs.rmSync(hiddenLock);

// ── 6. Download Node.js binary ───────────────────────────────────────

const nodePlatform =
  platform === "darwin" ? "darwin" : platform === "win32" ? "win" : "linux";
const nodeArchiveName = `node-v${NODE_VERSION}-${nodePlatform}-${arch}`;
const nodeArchiveExt = isWindows ? "zip" : "tar.gz";
const nodeUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${nodeArchiveName}.${nodeArchiveExt}`;

const tmpDir = path.join(RELEASE_DIR, "_tmp");
fs.mkdirSync(tmpDir, { recursive: true });

console.log(`Downloading Node.js v${NODE_VERSION}...`);
const archivePath = path.join(tmpDir, `node.${nodeArchiveExt}`);
execSync(`curl -fsSL -o "${archivePath}" "${nodeUrl}"`, { stdio: "inherit" });

if (isWindows) {
  execSync(
    `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}'"`,
  );
  fs.copyFileSync(
    path.join(tmpDir, nodeArchiveName, "node.exe"),
    path.join(stageDir, "bin", "node.exe"),
  );
} else {
  execSync(`tar -xzf "${archivePath}" -C "${tmpDir}"`);
  fs.copyFileSync(
    path.join(tmpDir, nodeArchiveName, "bin", "node"),
    path.join(stageDir, "bin", "node"),
  );
  fs.chmodSync(path.join(stageDir, "bin", "node"), 0o755);
}

// ── 7. Create wrapper scripts ────────────────────────────────────────

if (isWindows) {
  fs.writeFileSync(
    path.join(stageDir, "bin", "brc.cmd"),
    '@echo off\r\n"%~dp0\\node.exe" "%~dp0\\..\\lib\\dist\\cli.js" %*\r\n',
  );
} else {
  fs.writeFileSync(
    path.join(stageDir, "bin", "brc"),
    [
      "#!/bin/sh",
      'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
      'exec "$SCRIPT_DIR/node" "$SCRIPT_DIR/../lib/dist/cli.js" "$@"',
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
}

// ── 8. Create archive ────────────────────────────────────────────────

console.log("Creating archive...");

if (isWindows) {
  execSync(
    `powershell -Command "Compress-Archive -Path '${stageDir}' -DestinationPath '${path.join(RELEASE_DIR, archiveName + ".zip")}'"`
  );
} else {
  execSync(
    `tar -czf "${path.join(RELEASE_DIR, archiveName + ".tar.gz")}" -C "${RELEASE_DIR}" "${archiveName}"`,
  );
}

// ── 9. Cleanup ───────────────────────────────────────────────────────

fs.rmSync(stageDir, { recursive: true });
fs.rmSync(tmpDir, { recursive: true });

const ext = isWindows ? "zip" : "tar.gz";
const archiveFile = `${archiveName}.${ext}`;
const size = (
  fs.statSync(path.join(RELEASE_DIR, archiveFile)).size /
  1024 /
  1024
).toFixed(1);
console.log(`\n✓ release/${archiveFile} (${size} MB)\n`);

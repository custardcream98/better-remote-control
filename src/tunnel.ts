import { spawn, execSync } from "node:child_process";
import { chmodSync, createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { ChildProcess } from "node:child_process";

const BRC_BIN_DIR = join(homedir(), ".brc", "bin");
const LOCAL_BINARY = join(
  BRC_BIN_DIR,
  process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
);

/** 시스템 PATH 또는 ~/.brc/bin/ 에서 cloudflared 바이너리 경로 반환 */
export function findCloudflared(): string | null {
  // 시스템 PATH 확인
  try {
    const cmd = process.platform === "win32" ? "where cloudflared" : "which cloudflared";
    execSync(cmd, { stdio: "ignore" });
    return "cloudflared";
  } catch {
    // not found in PATH
  }

  // 로컬 설치 확인
  if (existsSync(LOCAL_BINARY)) {
    return LOCAL_BINARY;
  }

  return null;
}

/** 현재 플랫폼에 맞는 다운로드 URL 반환 */
export function getDownloadInfo(): { url: string; compressed: boolean } {
  const archMap: Record<string, string> = { x64: "amd64", arm64: "arm64" };
  const arch = archMap[process.arch];
  if (!arch) throw new Error(`Unsupported architecture: ${process.arch}`);

  const base = "https://github.com/cloudflare/cloudflared/releases/latest/download";

  switch (process.platform) {
    case "darwin":
      return { url: `${base}/cloudflared-darwin-${arch}.tgz`, compressed: true };
    case "linux":
      return { url: `${base}/cloudflared-linux-${arch}`, compressed: false };
    case "win32":
      return { url: `${base}/cloudflared-windows-${arch}.exe`, compressed: false };
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/** cloudflared 바이너리를 ~/.brc/bin/ 에 다운로드 */
export async function downloadCloudflared(): Promise<string> {
  const { url, compressed } = getDownloadInfo();

  mkdirSync(BRC_BIN_DIR, { recursive: true });

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (HTTP ${res.status})`);
  }

  if (compressed) {
    // macOS: .tgz 파일 다운로드 후 압축 해제
    const tgzPath = join(BRC_BIN_DIR, "cloudflared.tgz");
    try {
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tgzPath));
      execSync(`tar xzf "${tgzPath}" -C "${BRC_BIN_DIR}"`, { stdio: "ignore" });
    } finally {
      if (existsSync(tgzPath)) unlinkSync(tgzPath);
    }
  } else {
    // Linux/Windows: 바이너리 직접 저장
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(LOCAL_BINARY));
  }

  if (process.platform !== "win32") {
    chmodSync(LOCAL_BINARY, 0o755);
  }

  return LOCAL_BINARY;
}

/** Cloudflare Quick Tunnel 시작. 생성된 URL과 함께 resolve. */
export function startTunnel(
  port: number,
  cloudflaredPath = "cloudflared",
): Promise<{ url: string; process: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cloudflaredPath, ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error("Tunnel timed out (30s). cloudflared is not responding."));
        child.kill();
      }
    }, 30_000);

    // cloudflared는 URL을 stderr로 출력
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: match[0], process: child });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to run cloudflared: ${err.message}`));
    });

    child.on("exit", (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited (code: ${code})`));
      }
    });
  });
}

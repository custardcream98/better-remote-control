import { spawn, execSync } from "node:child_process";

import type { ChildProcess } from "node:child_process";

/** cloudflared 설치 여부 확인 */
export function isCloudflaredInstalled(): boolean {
  try {
    execSync("which cloudflared", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Cloudflare Quick Tunnel 시작. 생성된 URL을 resolve. */
export function startTunnel(port: number): Promise<{ url: string; process: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error("Tunnel timed out (30s). cloudflared가 응답하지 않습니다."));
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
      reject(new Error(`cloudflared 실행 실패: ${err.message}`));
    });

    child.on("exit", (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`cloudflared가 종료됨 (code: ${code})`));
      }
    });
  });
}

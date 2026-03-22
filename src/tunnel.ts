import { spawn, execSync } from "node:child_process";

import type { ChildProcess } from "node:child_process";

/** Check if cloudflared is installed */
export function isCloudflaredInstalled(): boolean {
  try {
    execSync("which cloudflared", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Start Cloudflare Quick Tunnel. Resolves with the generated URL. */
export function startTunnel(port: number): Promise<{ url: string; process: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        reject(new Error("Tunnel timed out (30s). cloudflared is not responding."));
        child.kill();
      }
    }, 30_000);

    // cloudflared outputs the URL to stderr
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

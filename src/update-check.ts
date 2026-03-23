import { createRequire } from "node:module";
import { homedir } from "node:os";

const REPO = "custardcream98/better-remote-control";

/** 현재 설치된 버전 반환 */
function getCurrentVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json");
  return pkg.version;
}

/** GitHub API에서 최신 버전 태그 조회 (실패 시 null) */
async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string };
    return data.tag_name?.replace(/^v/, "") ?? null;
  } catch {
    return null;
  }
}

/** semver 비교: a < b이면 true */
function isOlder(current: string, latest: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const c = parse(current);
  const l = parse(latest);
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) < (l[i] ?? 0)) return true;
    if ((c[i] ?? 0) > (l[i] ?? 0)) return false;
  }
  return false;
}

/** standalone(curl) 설치인지 확인 */
function isStandaloneInstall(): boolean {
  const brcDir = homedir() + "/.brc/";
  return import.meta.url.includes(brcDir) || import.meta.filename?.includes(brcDir) || false;
}

/** 업데이트 확인 후 안내 메시지 출력 (비동기, 실패 시 무시) */
export async function checkForUpdate(): Promise<void> {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();
  if (!latest || !isOlder(current, latest)) return;

  const updateCmd = isStandaloneInstall()
    ? `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sh`
    : "npm update -g better-remote-control";

  console.log(`  \x1b[33m⚠ New version available: v${current} → v${latest}\x1b[0m`);
  console.log(`    ${updateCmd}`);
  console.log();
}

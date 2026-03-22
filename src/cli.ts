#!/usr/bin/env node

import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

import { generatePassword } from "./auth.js";
import { createServer } from "./server.js";
import { isCloudflaredInstalled, startTunnel } from "./tunnel.js";

import type { ChildProcess } from "node:child_process";

// QR 코드 생성 (dynamic import — CommonJS 패키지)
async function printQR(url: string) {
  try {
    const qrcode = await import("qrcode-terminal");
    qrcode.default.generate(url, { small: true }, (code: string) => {
      console.log(code);
    });
  } catch {
    // qrcode-terminal 없으면 무시
  }
}

/** macOS sleep 방지 (caffeinate) */
function preventSleep(): ChildProcess | null {
  try {
    const child = spawn("caffeinate", ["-dims"], { stdio: "ignore" });
    child.unref();
    return child;
  } catch {
    return null;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      port: { type: "string", short: "p", default: "4020" },
      password: { type: "string", default: "" },
      shell: { type: "string", short: "s", default: process.env.SHELL ?? "/bin/zsh" },
      cwd: { type: "string", short: "c", default: process.env.HOME ?? process.cwd() },
      command: { type: "string", default: "" },
      "no-tunnel": { type: "boolean", default: false },
      "no-caffeinate": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(`
  brc — Better Remote Control

  Usage: brc [options]

  Options:
    -p, --port <port>       포트 번호 (기본: 4020)
    --password <pw>         비밀번호 지정 (기본: 자동 생성)
    -s, --shell <shell>     쉘 경로 (기본: $SHELL)
    -c, --cwd <dir>         기본 작업 디렉토리 (기본: $HOME)
    --command <cmd>         세션 시작 시 자동 실행할 명령어
    --no-tunnel             Cloudflare Tunnel 비활성화 (로컬만)
    --no-caffeinate         sleep 방지 비활성화
    -h, --help              도움말
`);
    process.exit(0);
  }

  const port = parseInt(values.port!, 10);
  const password = values.password || generatePassword();
  const shell = values.shell!;
  const defaultCwd = values.cwd!;
  const defaultCommand = values.command!;
  const noTunnel = values["no-tunnel"]!;
  const noCaffeinate = values["no-caffeinate"]!;

  console.log();
  console.log("  \x1b[1m\x1b[35mbrc\x1b[0m — Better Remote Control");
  console.log();

  // Sleep 방지
  let caffeinateProc: ChildProcess | null = null;
  if (!noCaffeinate) {
    caffeinateProc = preventSleep();
    if (caffeinateProc) {
      console.log("  \x1b[32m✓\x1b[0m Sleep 방지 활성화 (caffeinate)");
    }
  }

  // 서버 시작
  createServer({ port, password, shell, defaultCwd, defaultCommand });

  // caffeinate cleanup 등록 (터널 유무와 관계없이)
  const cleanupCaffeinate = () => caffeinateProc?.kill();
  process.on("SIGINT", cleanupCaffeinate);
  process.on("SIGTERM", cleanupCaffeinate);
  process.on("exit", cleanupCaffeinate);

  if (noTunnel) {
    console.log();
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    if (defaultCommand) console.log(`  Command:  ${defaultCommand}`);
    console.log();
    return;
  }

  // Cloudflare Tunnel
  if (!isCloudflaredInstalled()) {
    console.log();
    console.log("  \x1b[31m✗\x1b[0m cloudflared가 설치되지 않았습니다.");
    console.log("    brew install cloudflared");
    console.log();
    console.log(`  로컬에서만 사용하려면: brc --no-tunnel`);
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    console.log();
    return;
  }

  console.log("  Tunnel 연결 중...");

  try {
    const { url, process: tunnelProc } = await startTunnel(port);

    console.log(`  \x1b[32m✓\x1b[0m Tunnel ready`);
    console.log();
    console.log(`  URL:      \x1b[1m\x1b[36m${url}\x1b[0m`);
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    if (defaultCommand) console.log(`  Command:  ${defaultCommand}`);
    console.log();

    await printQR(url);

    console.log("  모바일에서 위 QR 코드를 스캔하세요.");
    console.log("  종료: Ctrl+C");
    console.log();

    // 정리
    const cleanup = () => {
      tunnelProc.kill();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (err) {
    console.error(`  \x1b[31m✗\x1b[0m ${(err as Error).message}`);
    console.log();
    console.log(`  로컬에서만 사용하려면: brc --no-tunnel`);
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    console.log();
  }
}

main();

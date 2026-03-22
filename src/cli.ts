#!/usr/bin/env node

import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

import { generatePassword } from "./auth.js";
import { createServer } from "./server.js";
import { isCloudflaredInstalled, startTunnel } from "./tunnel.js";

import type { ChildProcess } from "node:child_process";

// QR code generation (dynamic import — CommonJS package)
async function printQR(url: string) {
  try {
    const qrcode = await import("qrcode-terminal");
    qrcode.default.generate(url, { small: true }, (code: string) => {
      console.log(code);
    });
  } catch {
    // Ignore if qrcode-terminal is not installed
  }
}

/** Prevent macOS sleep (caffeinate) */
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
    -p, --port <port>       Port number (default: 4020)
    --password <pw>         Set password (default: auto-generated)
    -s, --shell <shell>     Shell path (default: $SHELL)
    -c, --cwd <dir>         Default working directory (default: $HOME)
    --command <cmd>         Command to auto-run on session start
    --no-tunnel             Disable Cloudflare Tunnel (local only)
    --no-caffeinate         Disable sleep prevention
    -h, --help              Show this help
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

  // Prevent sleep
  let caffeinateProc: ChildProcess | null = null;
  if (!noCaffeinate) {
    caffeinateProc = preventSleep();
    if (caffeinateProc) {
      console.log("  \x1b[32m✓\x1b[0m Sleep prevention enabled (caffeinate)");
    }
  }

  // Start server
  createServer({ port, password, shell, defaultCwd, defaultCommand });

  // Register caffeinate cleanup (regardless of tunnel)
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
    console.log("  \x1b[31m✗\x1b[0m cloudflared is not installed.");
    console.log("    brew install cloudflared");
    console.log();
    console.log(`  For local-only use: brc --no-tunnel`);
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    console.log();
    return;
  }

  console.log("  Connecting tunnel...");

  try {
    const { url, process: tunnelProc } = await startTunnel(port);

    console.log(`  \x1b[32m✓\x1b[0m Tunnel ready`);
    console.log();
    console.log(`  URL:      \x1b[1m\x1b[36m${url}\x1b[0m`);
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    if (defaultCommand) console.log(`  Command:  ${defaultCommand}`);
    console.log();

    await printQR(url);

    console.log("  Scan the QR code above from your mobile device.");
    console.log("  Press Ctrl+C to quit.");
    console.log();

    // Cleanup
    const cleanup = () => {
      tunnelProc.kill();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (err) {
    console.error(`  \x1b[31m✗\x1b[0m ${(err as Error).message}`);
    console.log();
    console.log(`  For local-only use: brc --no-tunnel`);
    console.log(`  Password: \x1b[1m\x1b[33m${password}\x1b[0m`);
    console.log();
  }
}

main();

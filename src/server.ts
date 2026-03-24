import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { spawn as ptySpawn } from "node-pty";
import { WebSocketServer, WebSocket } from "ws";

import {
  authMiddleware,
  verifyWsToken,
  hashPassword,
  verifyPassword,
  checkRateLimit,
} from "./auth.js";

import type { IPty } from "node-pty";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Output buffer size (keeps recent output per session, sent on reconnect)
const OUTPUT_BUFFER_SIZE = 50_000;

interface Session {
  id: string;
  name: string;
  cwd: string;
  pty: IPty;
  outputBuffer: string;
}

export interface ServerOptions {
  port: number;
  password: string;
  shell: string;
  defaultCwd: string;
  defaultCommand: string;
}

/** Remove undefined values from env */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/** Validate WebSocket message */
function validateMessage(msg: unknown): msg is {
  type: string;
  sessionId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  name?: string;
  command?: string;
} {
  if (typeof msg !== "object" || msg === null) return false;
  if (!("type" in msg) || typeof (msg as Record<string, unknown>).type !== "string") return false;
  return true;
}

function requireSessionId(msg: Record<string, unknown>): string | null {
  if (typeof msg.sessionId !== "string" || !msg.sessionId) return null;
  return msg.sessionId;
}

export function createServer({ port, password, shell, defaultCwd, defaultCommand }: ServerOptions) {
  const app = express();

  // Register image upload before body parser (to prevent stream consumption)
  const UPLOAD_DIR = path.join(os.homedir(), ".brc", "uploads");
  const UPLOAD_MAX_AGE_MS = 24 * 60 * 60_000;
  const UPLOAD_MAX_SIZE = 10 * 1024 * 1024;

  async function cleanupOldUploads() {
    try {
      const files = await fs.readdir(UPLOAD_DIR);
      const now = Date.now();
      for (const file of files) {
        const fp = path.join(UPLOAD_DIR, file);
        const stat = await fs.stat(fp);
        if (now - stat.mtimeMs > UPLOAD_MAX_AGE_MS) await fs.unlink(fp);
      }
    } catch {
      /* Ignore if directory doesn't exist */
    }
  }

  app.post("/api/upload", async (req, res) => {
    try {
      // Auth check (can't use authMiddleware since this is before body parser)
      const cookie = req.headers.cookie ?? "";
      if (!verifyWsToken(cookie, password)) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const contentType = req.headers["content-type"] ?? "";
      if (!contentType.startsWith("image/")) {
        res.status(400).json({ error: "Only image files are supported" });
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > UPLOAD_MAX_SIZE) {
          req.destroy();
          res.status(413).json({ error: "Image must be 10MB or less" });
          return;
        }
        chunks.push(chunk as Buffer);
      }

      const body = Buffer.concat(chunks);
      if (body.length === 0) {
        res.status(400).json({ error: "Image data is required" });
        return;
      }

      const extMap: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/heic": ".heic",
        "image/heif": ".heif",
      };
      const ext = extMap[contentType] ?? ".png";
      const filename = `img_${Date.now()}_${crypto.randomBytes(3).toString("hex")}${ext}`;

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const filePath = path.join(UPLOAD_DIR, filename);
      await fs.writeFile(filePath, body);

      cleanupOldUploads();
      res.json({ filePath });
    } catch (err) {
      console.error("  Upload error:", (err as Error).message);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Body parser (registered after upload route)
  app.use(express.json({ type: "application/json" }));
  app.use(express.urlencoded({ extended: true, type: "application/x-www-form-urlencoded" }));

  const sessions = new Map<string, Session>();
  const clients = new Set<WebSocket>();

  function broadcast(msg: Record<string, unknown>) {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  function sendTo(ws: WebSocket, msg: Record<string, unknown>) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  /** Build cookie string (adds Secure flag for HTTPS) */
  function makeCookie(token: string, secure: boolean): string {
    let cookie = `brc_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
    if (secure) cookie += "; Secure";
    return cookie;
  }

  /** Create a new terminal session */
  function createSession(cwd?: string, name?: string, command?: string): Session | null {
    const id = crypto.randomUUID();
    const sessionCwd = cwd || defaultCwd;
    const sessionName = name || `Terminal ${id.slice(0, 4)}`;

    let pty: IPty;
    try {
      pty = ptySpawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: sessionCwd,
        env: cleanEnv(),
      });
    } catch (err) {
      console.error("  Failed to create PTY:", (err as Error).message);
      return null;
    }

    const session: Session = { id, name: sessionName, cwd: sessionCwd, pty, outputBuffer: "" };
    sessions.set(id, session);

    // PTY output -> buffer + broadcast
    pty.onData((data) => {
      // Update output buffer (keep only the last OUTPUT_BUFFER_SIZE chars)
      session.outputBuffer += data;
      if (session.outputBuffer.length > OUTPUT_BUFFER_SIZE) {
        session.outputBuffer = session.outputBuffer.slice(-OUTPUT_BUFFER_SIZE);
      }
      broadcast({ type: "output", sessionId: id, data });
    });

    pty.onExit(({ exitCode }) => {
      if (!sessions.has(id)) return;
      broadcast({ type: "exited", sessionId: id, code: exitCode });
      sessions.delete(id);
    });

    // Auto-execute command
    const cmd = command ?? defaultCommand;
    if (cmd) {
      setTimeout(() => pty.write(cmd + "\r"), 300);
    }

    return session;
  }

  // CSRF token store
  const csrfTokens = new Set<string>();

  // Login page (with embedded CSRF token)
  app.get("/login", (_req, res) => {
    const csrfToken = crypto.randomBytes(16).toString("hex");
    csrfTokens.add(csrfToken);
    // Expire after 5 minutes
    setTimeout(() => csrfTokens.delete(csrfToken), 5 * 60_000);

    res.send(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">
  <title>brc — login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #17141f; color: #eee; font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100dvh; }
    .card { background: #1e1b28; border: 1px solid rgba(255,255,255,0.06); padding: 2.5rem 2rem; border-radius: 16px; width: min(360px, 90vw); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .logo { text-align: center; margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .logo span { color: #9d8bf7; }
    input { width: 100%; padding: 12px 14px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; background: rgba(255,255,255,0.04); color: #fff; font-size: 16px; margin-bottom: 1rem; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #9d8bf7; }
    button { width: 100%; padding: 12px; border: none; border-radius: 10px; background: #8b5cf6; color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
    button:active { opacity: 0.8; }
    .error { color: #f87171; text-align: center; margin-bottom: 0.75rem; font-size: 0.85rem; }
  </style>
</head><body>
  <div class="card">
    <div class="logo"><span>&gt;_</span> brc</div>
    <div class="error" id="error"></div>
    <form id="form">
      <input type="hidden" id="csrf" value="${csrfToken}">
      <input type="password" id="pw" placeholder="Password" autofocus autocomplete="off">
      <button type="submit">Connect</button>
    </form>
  </div>
  <script>
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const pw = document.getElementById('pw').value;
      const csrf = document.getElementById('csrf').value;
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw, csrf })
      });
      if (res.ok) { location.href = '/'; }
      else {
        const data = await res.json().catch(() => ({}));
        document.getElementById('error').textContent = data.error || 'Wrong password';
      }
    };
  </script>
</body></html>`);
  });

  // Login API (rate limit + CSRF + timing-safe)
  app.post("/api/login", (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "too many attempts, try again later" });
      return;
    }

    const { password: inputPw, csrf } = req.body as { password?: string; csrf?: string };

    // CSRF verification
    if (!csrf || !csrfTokens.has(csrf)) {
      res.status(403).json({ error: "invalid request" });
      return;
    }
    csrfTokens.delete(csrf);

    if (inputPw && verifyPassword(inputPw, password)) {
      const token = hashPassword(password);
      const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
      res.setHeader("Set-Cookie", makeCookie(token, isSecure));
      res.json({ ok: true });
    } else {
      res.status(401).json({ error: "wrong password" });
    }
  });

  // Auth middleware
  app.use(authMiddleware(password));

  // Config API
  app.get("/api/config", (_req, res) => {
    res.json({ defaultCwd, defaultCommand });
  });

  // Directory listing API
  app.get("/api/dirs", async (req, res) => {
    const dirPath = req.query.path;

    // Validation
    if (typeof dirPath !== "string" || !dirPath) {
      res.status(400).json({ error: "path parameter is required" });
      return;
    }
    if (!dirPath.startsWith("/")) {
      res.status(400).json({ error: "absolute path required" });
      return;
    }
    if (dirPath.includes("\0")) {
      res.status(400).json({ error: "invalid path" });
      return;
    }
    if (dirPath.length > 4096) {
      res.status(400).json({ error: "path too long" });
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({ name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({ path: dirPath, dirs });
    } catch {
      res.status(404).json({ error: "Directory not found" });
    }
  });

  // Static file serving (long-term cache for Vite hashed assets)
  app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "public", "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use(express.static(path.join(__dirname, "..", "public")));

  // SPA fallback — TanStack Router handles client-side routing
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/login") return next();
    res.sendFile("index.html", { root: path.join(__dirname, "..", "public") });
  });

  // Start HTTP server
  const server = app.listen(port, () => {
    console.log(`  Local: http://localhost:${port}`);
  });

  // WebSocket server
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    if (!verifyWsToken(req.headers.cookie, password)) {
      ws.close(4001, "Unauthorized");
      return;
    }

    clients.add(ws);

    // Send existing session list + buffered output (reconnect restore)
    const sessionList = [...sessions.values()].map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
    }));
    sendTo(ws, { type: "sessions", sessions: sessionList });

    // Send buffered output for each session
    for (const s of sessions.values()) {
      if (s.outputBuffer) {
        sendTo(ws, { type: "output", sessionId: s.id, data: s.outputBuffer });
      }
    }

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (!validateMessage(parsed)) return;

        const msg = parsed as Record<string, unknown>;

        switch (msg.type) {
          case "create": {
            const session = createSession(
              msg.cwd as string | undefined,
              msg.name as string | undefined,
              msg.command as string | undefined,
            );
            if (session) {
              broadcast({
                type: "created",
                sessionId: session.id,
                name: session.name,
                cwd: session.cwd,
              });
            } else {
              sendTo(ws, { type: "error", message: "Failed to create session" });
            }
            break;
          }

          case "input": {
            const sessionId = requireSessionId(msg);
            if (!sessionId || typeof msg.data !== "string") break;
            const session = sessions.get(sessionId);
            if (session) session.pty.write(msg.data);
            break;
          }

          case "resize": {
            const sessionId = requireSessionId(msg);
            if (!sessionId || typeof msg.cols !== "number" || typeof msg.rows !== "number") break;
            const session = sessions.get(sessionId);
            if (session) session.pty.resize(msg.cols, msg.rows);
            break;
          }

          case "rename": {
            const sessionId = requireSessionId(msg);
            if (!sessionId || typeof msg.name !== "string") break;
            const session = sessions.get(sessionId);
            if (session) {
              session.name = msg.name;
              broadcast({ type: "renamed", sessionId, name: msg.name });
            }
            break;
          }

          case "close": {
            const sessionId = requireSessionId(msg);
            if (!sessionId) break;
            const session = sessions.get(sessionId);
            if (session) {
              session.pty.kill();
              sessions.delete(sessionId);
              broadcast({ type: "closed", sessionId });
            }
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  return server;
}

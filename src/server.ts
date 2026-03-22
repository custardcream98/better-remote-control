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

// 출력 버퍼 크기 (세션 당 최근 출력 보관, 재연결 시 전송)
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

/** env에서 undefined 값 제거 */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  return env;
}

/** WebSocket 메시지 검증 */
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

  // 이미지 업로드는 body parser보다 먼저 등록 (stream 소비 방지)
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
      /* 디렉토리 없으면 무시 */
    }
  }

  app.post("/api/upload", async (req, res) => {
    try {
      // 인증 확인 (body parser 전이라 authMiddleware 사용 불가)
      const cookie = req.headers.cookie ?? "";
      if (!verifyWsToken(cookie, password)) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const contentType = req.headers["content-type"] ?? "";
      if (!contentType.startsWith("image/")) {
        res.status(400).json({ error: "이미지 파일만 지원합니다" });
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > UPLOAD_MAX_SIZE) {
          req.destroy();
          res.status(413).json({ error: "10MB 이하 이미지만 업로드 가능합니다" });
          return;
        }
        chunks.push(chunk as Buffer);
      }

      const body = Buffer.concat(chunks);
      if (body.length === 0) {
        res.status(400).json({ error: "이미지 데이터가 필요합니다" });
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
      res.status(500).json({ error: "업로드 실패" });
    }
  });

  // body parser (upload 이후에 등록)
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

  /** 쿠키 문자열 생성 (HTTPS 시 Secure 플래그 추가) */
  function makeCookie(token: string, secure: boolean): string {
    let cookie = `brc_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
    if (secure) cookie += "; Secure";
    return cookie;
  }

  /** 세션 생성 */
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
      console.error("  PTY 생성 실패:", (err as Error).message);
      return null;
    }

    const session: Session = { id, name: sessionName, cwd: sessionCwd, pty, outputBuffer: "" };
    sessions.set(id, session);

    // PTY 출력 → 버퍼 + 브로드캐스트
    pty.onData((data) => {
      // 출력 버퍼 갱신 (최근 OUTPUT_BUFFER_SIZE 문자만 유지)
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

    // 자동 명령어 실행
    const cmd = command ?? defaultCommand;
    if (cmd) {
      setTimeout(() => pty.write(cmd + "\r"), 300);
    }

    return session;
  }

  // CSRF 토큰 저장소
  const csrfTokens = new Set<string>();

  // 로그인 페이지 (CSRF 토큰 내장)
  app.get("/login", (_req, res) => {
    const csrfToken = crypto.randomBytes(16).toString("hex");
    csrfTokens.add(csrfToken);
    // 5분 후 만료
    setTimeout(() => csrfTokens.delete(csrfToken), 5 * 60_000);

    res.send(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">
  <title>brc — login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100dvh; }
    .card { background: #16213e; padding: 2rem; border-radius: 12px; width: min(360px, 90vw); }
    h1 { font-size: 1.2rem; margin-bottom: 1rem; text-align: center; }
    input { width: 100%; padding: 12px; border: 1px solid #333; border-radius: 8px; background: #0f3460; color: #fff; font-size: 16px; margin-bottom: 1rem; }
    button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #e94560; color: #fff; font-size: 16px; cursor: pointer; }
    button:active { opacity: 0.8; }
    .error { color: #e94560; text-align: center; margin-bottom: 0.5rem; font-size: 0.9rem; }
  </style>
</head><body>
  <div class="card">
    <h1>brc</h1>
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

  // 로그인 API (rate limit + CSRF + timing-safe)
  app.post("/api/login", (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "too many attempts, try again later" });
      return;
    }

    const { password: inputPw, csrf } = req.body as { password?: string; csrf?: string };

    // CSRF 검증
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

  // 인증 미들웨어
  app.use(authMiddleware(password));

  // 설정 API
  app.get("/api/config", (_req, res) => {
    res.json({ defaultCwd, defaultCommand });
  });

  // 디렉토리 목록 API
  app.get("/api/dirs", async (req, res) => {
    const dirPath = req.query.path;

    // 유효성 검사
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

  // 정적 파일 서빙 (Vite 해시된 에셋에 장기 캐시)
  app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "public", "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
  app.use(express.static(path.join(__dirname, "..", "public")));

  // SPA fallback — TanStack Router가 클라이언트에서 라우팅 처리
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/login") return next();
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  // HTTP 서버 시작
  const server = app.listen(port, () => {
    console.log(`  Local: http://localhost:${port}`);
  });

  // WebSocket 서버
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    if (!verifyWsToken(req.headers.cookie, password)) {
      ws.close(4001, "Unauthorized");
      return;
    }

    clients.add(ws);

    // 기존 세션 목록 + 버퍼된 출력 전송 (재연결 복원)
    const sessionList = [...sessions.values()].map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
    }));
    sendTo(ws, { type: "sessions", sessions: sessionList });

    // 각 세션의 버퍼된 출력 전송
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
              sendTo(ws, { type: "error", message: "세션 생성 실패" });
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
        // 잘못된 메시지 무시
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  return server;
}

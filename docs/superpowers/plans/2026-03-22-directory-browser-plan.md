# Directory Browser & Navigation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "instant terminal" flow with a Home → Directory Browser → Terminal navigation using TanStack Router, plus UI design refresh.

**Architecture:** TanStack Router (file-based) with 3 routes. WebSocket + session state managed via React Context in root layout. New server API `GET /api/dirs` for directory listing. Existing components refactored into route pages.

**Tech Stack:** TanStack Router, React 19, Express 5, xterm.js, Tailwind CSS 4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-22-directory-browser-design.md`

---

### Task 1: Server — Add `GET /api/dirs` endpoint

**Files:**

- Modify: `src/server.ts:290-296` (after `authMiddleware`, before static serving)

- [ ] **Step 1: Add the `/api/dirs` endpoint**

After `app.get("/api/config", ...)` (line 296), add the directory listing endpoint:

```typescript
// 디렉토리 목록 API
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
```

- [ ] **Step 2: Test manually with curl**

Run: `curl -s 'http://localhost:4020/api/dirs?path=/Users' -H 'Cookie: brc_token=...'`
Expected: JSON with `path` and `dirs` array

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): add GET /api/dirs endpoint for directory browsing"
```

---

### Task 2: Server — Remove auto-session creation & add SPA fallback

**Files:**

- Modify: `src/server.ts:339-345` (WebSocket connection handler)
- Modify: `src/server.ts:306` (after static file serving)

- [ ] **Step 1: Remove auto-session creation**

In `server.ts`, remove lines 339-345 (the `if (sessions.size === 0)` block):

```typescript
// 삭제할 코드:
// if (sessions.size === 0) {
//   const session = createSession();
//   if (session) {
//     broadcast({ type: "created", sessionId: session.id, name: session.name, cwd: session.cwd });
//   }
// }
```

- [ ] **Step 2: Add SPA fallback route**

After the `express.static` middleware (line 306), add a catch-all that serves `index.html` for non-API routes. This must go after all API routes and static file serving:

```typescript
// SPA fallback — TanStack Router가 클라이언트에서 라우팅 처리
app.get("*", (req, res, next) => {
  // API나 login 경로는 제외
  if (req.path.startsWith("/api/") || req.path === "/login") return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
```

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): remove auto-session creation, add SPA fallback route"
```

---

### Task 3: Client — Install TanStack Router & configure Vite plugin

**Files:**

- Modify: `client/package.json`
- Modify: `client/vite.config.ts`
- Modify: `client/tsconfig.app.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/shiwoo/dev/better-remote-control/client
pnpm add @tanstack/react-router
pnpm add -D @tanstack/router-plugin @tanstack/react-router-devtools
```

- [ ] **Step 2: Update vite.config.ts**

Add TanStack Router plugin to vite config. The plugin auto-generates route tree from file-based routes:

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:4020",
      "/login": "http://localhost:4020",
      "/ws": {
        target: "ws://localhost:4020",
        ws: true,
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
```

- [ ] **Step 3: Update tsconfig.app.json include to exclude generated route tree**

No change needed — `routeTree.gen.ts` is in `src/` and already included. The generated file will have `// @ts-nocheck` at the top.

- [ ] **Step 4: Commit**

```bash
git add client/package.json client/pnpm-lock.yaml client/vite.config.ts
git commit -m "feat(client): install TanStack Router and configure Vite plugin"
```

---

### Task 4: Client — Create SocketProvider context

This is the shared state layer. All routes will consume session state and WebSocket `send` from this context.

**Files:**

- Create: `client/src/contexts/socket-context.tsx`
- Modify: `client/src/hooks/use-socket.ts` (no changes needed — reuse as-is)

- [ ] **Step 1: Create socket-context.tsx**

```typescript
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/use-socket";

import type { ReactNode } from "react";
import type { SessionInfo, ServerMessage, ClientMessage } from "@/hooks/use-socket";

interface SocketContextValue {
  sessions: SessionInfo[];
  send: (msg: ClientMessage) => void;
  status: "connected" | "disconnected" | "reconnecting";
  config: { defaultCwd: string; defaultCommand: string };
  /** 세션 생성 후 콜백 등록 (created 메시지 수신 시 호출) */
  onceCreated: (cb: (sessionId: string) => void) => void;
  /** 터미널 output 리스너 등록/해제 */
  addOutputListener: (cb: (sessionId: string, data: string) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function useSessionContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSessionContext must be used within SocketProvider");
  return ctx;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [config, setConfig] = useState({ defaultCwd: "", defaultCommand: "" });
  const createdCallbackRef = useRef<((sessionId: string) => void) | null>(null);
  const outputListenersRef = useRef<Set<(sessionId: string, data: string) => void>>(new Set());
  // 리스너 등록 전에 도착한 output 메시지를 버퍼링
  const outputBufferRef = useRef<{ sessionId: string; data: string }[]>([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "sessions":
        setSessions(msg.sessions);
        break;
      case "created":
        setSessions((prev) => [
          ...prev,
          { id: msg.sessionId, name: msg.name, cwd: msg.cwd },
        ]);
        if (createdCallbackRef.current) {
          createdCallbackRef.current(msg.sessionId);
          createdCallbackRef.current = null;
        }
        break;
      case "output":
        if (outputListenersRef.current.size > 0) {
          for (const listener of outputListenersRef.current) {
            listener(msg.sessionId, msg.data);
          }
        } else {
          // 리스너 없으면 버퍼에 저장 (재연결 시 터미널 마운트 전 도착하는 output 대비)
          outputBufferRef.current.push({ sessionId: msg.sessionId, data: msg.data });
        }
        break;
      case "exited":
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.sessionId ? { ...s, exited: true } : s)),
        );
        // 터미널에 "[Session ended]" 표시
        for (const listener of outputListenersRef.current) {
          listener(msg.sessionId, "\r\n\x1b[90m[Session ended]\x1b[0m\r\n");
        }
        break;
      case "closed":
        setSessions((prev) => prev.filter((s) => s.id !== msg.sessionId));
        break;
      case "renamed":
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.sessionId ? { ...s, name: msg.name } : s)),
        );
        break;
      case "error":
        // 세션 생성 실패 시 콜백 정리
        if (createdCallbackRef.current) {
          createdCallbackRef.current = null;
        }
        break;
    }
  }, []);

  const { send, status } = useSocket(handleMessage);

  const onceCreated = useCallback((cb: (sessionId: string) => void) => {
    createdCallbackRef.current = cb;
  }, []);

  const addOutputListener = useCallback((cb: (sessionId: string, data: string) => void) => {
    outputListenersRef.current.add(cb);
    // 버퍼에 쌓인 output 플러시
    if (outputBufferRef.current.length > 0) {
      for (const { sessionId, data } of outputBufferRef.current) {
        cb(sessionId, data);
      }
      outputBufferRef.current = [];
    }
    return () => { outputListenersRef.current.delete(cb); };
  }, []);

  return (
    <SocketContext.Provider value={{ sessions, send, status, config, onceCreated, addOutputListener }}>
      {children}
    </SocketContext.Provider>
  );
}
```

**Key design decisions:**

- `onceCreated` callback pattern: 탐색기에서 세션 생성 → created 응답의 sessionId를 받아서 navigate하는 비동기 흐름 처리
- `addOutputListener` pattern: 터미널 라우트에서 output 리스너를 등록하여 xterm에 데이터 전달
- output 버퍼링: 리스너 등록 전 도착한 output은 버퍼에 저장, 리스너 등록 시 플러시 (재연결 시 타이밍 문제 해결)
- `error` 메시지 수신 시 `createdCallbackRef` 정리 (세션 생성 실패 처리)
- `exited` 메시지 수신 시 "[Session ended]" 텍스트를 output 리스너로 전달

- [ ] **Step 2: Commit**

```bash
git add client/src/contexts/socket-context.tsx
git commit -m "feat(client): add SocketProvider context for shared session state"
```

---

### Task 5: Client — Create root layout & router setup

**Files:**

- Create: `client/src/routes/__root.tsx`
- Create: `client/src/router.tsx`
- Modify: `client/src/main.tsx`
- Create: `client/src/components/config-bar.tsx`
- Create: `client/src/components/settings-dialog.tsx`

- [ ] **Step 1: Create ConfigBar component**

`client/src/components/config-bar.tsx`:

```typescript
import { useState } from "react";
import { Home, Settings } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useSessionContext } from "@/contexts/socket-context";
import { SettingsDialog } from "@/components/settings-dialog";
import { cn } from "@/lib/utils";

export function ConfigBar() {
  const { status } = useSessionContext();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showHome = location.pathname !== "/";

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2">
        {showHome ? (
          <Link to="/" className="flex items-center gap-1.5 text-[var(--muted-foreground)] transition-colors active:text-[var(--foreground)]">
            <Home size={16} />
            <span className="text-sm font-medium">brc</span>
          </Link>
        ) : (
          <span className="text-sm font-medium text-[var(--foreground)]">brc</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* 연결 상태 인디케이터 */}
        <div className={cn(
          "h-2 w-2 rounded-full transition-colors",
          status === "connected" && "bg-green-500",
          status === "disconnected" && "bg-red-500",
          status === "reconnecting" && "bg-yellow-500 animate-pulse",
        )} />

        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors active:text-[var(--foreground)]"
        >
          <Settings size={16} />
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
```

- [ ] **Step 2: Create SettingsDialog component**

`client/src/components/settings-dialog.tsx`:

```typescript
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "brc_auto_command";

export function getAutoCommand(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [command, setCommand] = useState("");

  useEffect(() => {
    if (open) setCommand(getAutoCommand());
  }, [open]);

  function handleSave() {
    if (command.trim()) {
      localStorage.setItem(STORAGE_KEY, command.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="auto-cmd">Auto Command</Label>
            <Input
              id="auto-cmd"
              placeholder="새 터미널에서 자동 실행할 명령어"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              새 터미널 세션 시작 시 자동으로 입력됩니다
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create root layout**

`client/src/routes/__root.tsx`:

```typescript
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SocketProvider } from "@/contexts/socket-context";
import { ConfigBar } from "@/components/config-bar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <SocketProvider>
      <div className="flex h-dvh flex-col">
        <ConfigBar />
        <Outlet />
      </div>
    </SocketProvider>
  );
}
```

- [ ] **Step 4: Create router.tsx**

`client/src/router.tsx`:

```typescript
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 5: Update main.tsx**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/router";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- [ ] **Step 6: Add routeTree.gen.ts to .gitignore**

`routeTree.gen.ts`는 TanStack Router가 자동 생성하는 파일이므로 `.gitignore`에 추가:

```bash
echo "client/src/routeTree.gen.ts" >> /Users/shiwoo/dev/better-remote-control/.gitignore
```

- [ ] **Step 7: Run dev server to generate route tree**

```bash
cd /Users/shiwoo/dev/better-remote-control/client && pnpm dev
```

Expected: `src/routeTree.gen.ts` auto-generated. Dev server starts (may show errors because routes don't have components yet — that's OK).

- [ ] **Step 8: Commit**

```bash
git add client/src/routes/__root.tsx client/src/router.tsx client/src/main.tsx client/src/components/config-bar.tsx client/src/components/settings-dialog.tsx .gitignore
git commit -m "feat(client): set up TanStack Router with root layout, ConfigBar, and SettingsDialog"
```

---

### Task 6: Client — Create Home route (`/`)

**Files:**

- Create: `client/src/routes/index.tsx`
- Create: `client/src/components/session-card.tsx`

- [ ] **Step 1: Create SessionCard component**

`client/src/components/session-card.tsx`:

```typescript
import { X, Terminal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

import type { SessionInfo } from "@/hooks/use-socket";

interface SessionCardProps {
  session: SessionInfo;
  onClose: (id: string) => void;
}

export function SessionCard({ session, onClose }: SessionCardProps) {
  return (
    <Link
      to="/terminal/$sessionId"
      params={{ sessionId: session.id }}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors active:bg-[var(--accent)]",
        session.exited && "opacity-50",
      )}
    >
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        session.exited ? "bg-[var(--muted)]" : "bg-[var(--primary)]/10",
      )}>
        <Terminal size={20} className={session.exited ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]"} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", session.exited && "line-through")}>
          {session.name}
        </p>
        <p className="truncate text-xs text-[var(--muted-foreground)]">{session.cwd}</p>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose(session.id);
        }}
        className="rounded-md p-1.5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-active:opacity-100 active:text-[var(--primary)]"
        style={{ opacity: undefined }} // 모바일에서는 항상 보이게 하려면 CSS로 조정
      >
        <X size={16} />
      </button>
    </Link>
  );
}
```

- [ ] **Step 2: Create Home route**

`client/src/routes/index.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Terminal } from "lucide-react";
import { useSessionContext } from "@/contexts/socket-context";
import { SessionCard } from "@/components/session-card";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { sessions, send } = useSessionContext();

  function handleClose(id: string) {
    send({ type: "close", sessionId: id });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-lg flex-1 p-4">
        {sessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
              <Terminal size={28} className="text-[var(--muted-foreground)]" />
            </div>
            <p className="mb-1 text-sm font-medium text-[var(--foreground)]">세션 없음</p>
            <p className="mb-6 text-xs text-[var(--muted-foreground)]">
              새 세션을 시작해서 터미널을 열어보세요
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onClose={handleClose} />
            ))}
          </div>
        )}
      </div>

      {/* 하단 고정 새 세션 버튼 */}
      <div className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--background)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link
          to="/browse"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80"
        >
          <Plus size={18} />
          새 세션 시작
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run dev server, navigate to `http://localhost:5173/`. Expected: Home page with empty state message and "새 세션 시작" button.

- [ ] **Step 4: Commit**

```bash
git add client/src/routes/index.tsx client/src/components/session-card.tsx
git commit -m "feat(client): add Home route with session cards and empty state"
```

---

### Task 7: Client — Create Browse route (`/browse`)

**Files:**

- Create: `client/src/routes/browse.tsx`
- Create: `client/src/components/directory-list.tsx`
- Create: `client/src/components/breadcrumb-nav.tsx`

- [ ] **Step 1: Create BreadcrumbNav component**

`client/src/components/breadcrumb-nav.tsx`:

```typescript
import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";

interface BreadcrumbNavProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function BreadcrumbNav({ path, onNavigate }: BreadcrumbNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 마지막 세그먼트가 보이도록 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [path]);

  const segments = path.split("/").filter(Boolean);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm scrollbar-none"
    >
      <button
        onClick={() => onNavigate("/")}
        className="shrink-0 rounded px-1.5 py-0.5 text-[var(--muted-foreground)] transition-colors active:text-[var(--foreground)]"
      >
        /
      </button>
      {segments.map((seg, i) => {
        const segPath = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={segPath} className="flex shrink-0 items-center gap-1">
            <ChevronRight size={12} className="text-[var(--muted-foreground)]" />
            <button
              onClick={() => onNavigate(segPath)}
              className={`rounded px-1.5 py-0.5 transition-colors active:text-[var(--foreground)] ${
                isLast ? "font-medium text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
              }`}
            >
              {seg}
            </button>
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create DirectoryList component**

`client/src/components/directory-list.tsx`:

```typescript
import { Folder, ChevronRight, ArrowUp } from "lucide-react";

interface DirectoryListProps {
  dirs: { name: string }[];
  loading: boolean;
  error: string | null;
  onNavigate: (dirName: string) => void;
  onGoUp: () => void;
  showParent: boolean;
  onRetry: () => void;
}

export function DirectoryList({ dirs, loading, error, onNavigate, onGoUp, showParent, onRetry }: DirectoryListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] transition-opacity active:opacity-80"
        >
          재시도
        </button>
      </div>
    );
  }

  // 숨김 디렉토리 필터링
  const visibleDirs = dirs.filter((d) => !d.name.startsWith("."));

  return (
    <div className="flex flex-col">
      {showParent && (
        <button
          onClick={onGoUp}
          className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-sm transition-colors active:bg-[var(--accent)]"
        >
          <ArrowUp size={18} className="text-[var(--muted-foreground)]" />
          <span className="text-[var(--muted-foreground)]">..</span>
        </button>
      )}
      {visibleDirs.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--muted-foreground)]">
          하위 디렉토리 없음
        </p>
      ) : (
        visibleDirs.map((d) => (
          <button
            key={d.name}
            onClick={() => onNavigate(d.name)}
            className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-sm transition-colors active:bg-[var(--accent)]"
          >
            <Folder size={18} className="shrink-0 text-[var(--primary)]" />
            <span className="min-w-0 flex-1 truncate text-left">{d.name}</span>
            <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)]" />
          </button>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create Browse route**

`client/src/routes/browse.tsx`:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSessionContext } from "@/contexts/socket-context";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { DirectoryList } from "@/components/directory-list";
import { getAutoCommand } from "@/components/settings-dialog";

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>) => ({
    path: typeof search.path === "string" ? search.path : "",
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { path: searchPath } = Route.useSearch();
  const { config, send, onceCreated } = useSessionContext();
  const navigate = useNavigate();

  const currentPath = searchPath || config.defaultCwd || "/";
  const [dirs, setDirs] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDirs = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dirs?path=${encodeURIComponent(dirPath)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load directories");
      }
      const data = await res.json();
      setDirs(data.dirs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirs(currentPath);
  }, [currentPath, fetchDirs]);

  function navigateToDir(dirPath: string) {
    navigate({ to: "/browse", search: { path: dirPath } });
  }

  function handleDirClick(dirName: string) {
    const newPath = currentPath === "/" ? `/${dirName}` : `${currentPath}/${dirName}`;
    navigateToDir(newPath);
  }

  function handleGoUp() {
    const parent = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
    navigateToDir(parent);
  }

  function handleOpenTerminal() {
    setCreating(true);
    setError(null);
    const autoCommand = getAutoCommand();
    send({
      type: "create",
      cwd: currentPath,
      ...(autoCommand ? { command: autoCommand } : {}),
    });
    onceCreated((sessionId) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCreating(false);
      navigate({ to: "/terminal/$sessionId", params: { sessionId } });
    });
    // 타임아웃: 5초 내 응답 없으면 복원 + 에러 표시
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setCreating(false);
      setError("세션 생성 시간 초과");
    }, 5000);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <BreadcrumbNav path={currentPath} onNavigate={navigateToDir} />

      <div className="flex-1 overflow-y-auto">
        <DirectoryList
          dirs={dirs}
          loading={loading}
          error={error}
          onNavigate={handleDirClick}
          onGoUp={handleGoUp}
          showParent={currentPath !== "/"}
          onRetry={() => fetchDirs(currentPath)}
        />
      </div>

      {/* 하단 고정 "여기서 터미널 열기" 버튼 */}
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={handleOpenTerminal}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {creating ? "생성 중..." : "여기서 터미널 열기"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:5173/browse`. Expected: Directory listing of `$HOME`, breadcrumb, "여기서 터미널 열기" button.

- [ ] **Step 5: Commit**

```bash
git add client/src/routes/browse.tsx client/src/components/breadcrumb-nav.tsx client/src/components/directory-list.tsx
git commit -m "feat(client): add Browse route with directory listing and breadcrumb navigation"
```

---

### Task 8: Client — Create Terminal route (`/terminal/$sessionId`)

The terminal route manages its own xterm instance and listens for `output` messages for its session. The key challenge: `output` messages are handled in the SocketProvider context, so we need to expose a way for the terminal to register for output events.

**Files:**

- Create: `client/src/routes/terminal.$sessionId.tsx`
- Modify: `client/src/components/terminal-pane.tsx` (simplify — no longer multi-instance, callback 기반으로 변경)

**Note:** `addOutputListener`와 output 버퍼링은 이미 Task 4의 SocketProvider에 포함되어 있음.

- [ ] **Step 1: Simplify TerminalPane**

`client/src/components/terminal-pane.tsx` — remove the imperative handle pattern. The terminal route will call `write` directly via the output listener. Simplify props:

```typescript
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

import type { ClientMessage } from "@/hooks/use-socket";

function safeFit(term: Terminal, fit: FitAddon) {
  const buf = term.buffer.active;
  const wasScrolledUp = buf.viewportY < buf.baseY;
  const savedY = buf.viewportY;
  fit.fit();
  if (wasScrolledUp) {
    term.scrollToLine(savedY);
  }
}

interface TerminalPaneProps {
  sessionId: string;
  send: (msg: ClientMessage) => void;
  stickyCtrl: boolean;
  stickyAlt: boolean;
  onStickyReset: () => void;
  /** 외부에서 데이터를 write하기 위한 콜백 등록 */
  onReady: (write: (data: string) => void) => void;
}

export function TerminalPane({ sessionId, send, stickyCtrl, stickyAlt, onStickyReset, onReady }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const stickyRef = useRef({ ctrl: stickyCtrl, alt: stickyAlt });
  const sendRef = useRef(send);
  const sessionIdRef = useRef(sessionId);
  const onStickyResetRef = useRef(onStickyReset);

  stickyRef.current = { ctrl: stickyCtrl, alt: stickyAlt };
  sendRef.current = send;
  sessionIdRef.current = sessionId;
  onStickyResetRef.current = onStickyReset;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
      fontSize: 14,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: {
        background: "#1a1a2e",
        foreground: "#e0e0e0",
        cursor: "#e94560",
        selectionBackground: "rgba(233, 69, 96, 0.25)",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // write 함수를 외부에 전달
    onReady((data: string) => {
      const buf = term.buffer.active;
      const wasScrolledUp = buf.viewportY < buf.baseY;
      const savedY = buf.viewportY;
      term.write(data, () => {
        if (wasScrolledUp) term.scrollToLine(savedY);
      });
    });

    term.onData((data) => {
      let modified = data;
      const { ctrl, alt } = stickyRef.current;
      if (ctrl && data.length === 1) {
        const code = data.toLowerCase().charCodeAt(0);
        if (code >= 97 && code <= 122) modified = String.fromCharCode(code - 96);
        onStickyResetRef.current();
      }
      if (alt) {
        modified = "\x1b" + modified;
        onStickyResetRef.current();
      }
      sendRef.current({ type: "input", sessionId: sessionIdRef.current, data: modified });
    });

    // 터치 스크롤
    const container = containerRef.current;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      term.scrollLines(Math.round(deltaY / 10));
      e.preventDefault();
    };
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });

    const ro = new ResizeObserver(() => {
      safeFit(term, fit);
      sendRef.current({
        type: "resize",
        sessionId: sessionIdRef.current,
        cols: term.cols,
        rows: term.rows,
      });
    });
    ro.observe(container);

    // 초기 focus
    term.focus();

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="absolute inset-0" />;
}
```

- [ ] **Step 2: Create Terminal route**

`client/src/routes/terminal.$sessionId.tsx`:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSessionContext } from "@/contexts/socket-context";
import { TerminalPane } from "@/components/terminal-pane";
import { QuickKeys } from "@/components/quick-keys";

export const Route = createFileRoute("/terminal/$sessionId")({
  component: TerminalPage,
});

function TerminalPage() {
  const { sessionId } = Route.useParams();
  const { sessions, send, addOutputListener } = useSessionContext();
  const navigate = useNavigate();
  const [stickyCtrl, setStickyCtrl] = useState(false);
  const [stickyAlt, setStickyAlt] = useState(false);
  const writeRef = useRef<((data: string) => void) | null>(null);

  const session = sessions.find((s) => s.id === sessionId);

  // 세션이 없으면 홈으로 리다이렉트
  useEffect(() => {
    if (sessions.length > 0 && !session) {
      navigate({ to: "/" });
    }
  }, [sessions, session, navigate]);

  // output 리스너 등록
  useEffect(() => {
    const unsubscribe = addOutputListener((sid, data) => {
      if (sid === sessionId) {
        writeRef.current?.(data);
      }
    });
    return unsubscribe;
  }, [sessionId, addOutputListener]);

  const resetSticky = useCallback(() => {
    setStickyCtrl(false);
    setStickyAlt(false);
  }, []);

  const handleReady = useCallback((write: (data: string) => void) => {
    writeRef.current = write;
  }, []);

  if (!session && sessions.length === 0) {
    // 아직 세션 목록 로딩 중
    return null;
  }

  if (!session) {
    return null; // useEffect에서 리다이렉트 처리
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <TerminalPane
          sessionId={sessionId}
          send={send}
          stickyCtrl={stickyCtrl}
          stickyAlt={stickyAlt}
          onStickyReset={resetSticky}
          onReady={handleReady}
        />
        {/* 세션 종료 시 오버레이 */}
        {session.exited && (
          <div className="absolute inset-0 flex items-end justify-center bg-black/40 pb-20">
            <Link
              to="/"
              className="rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80"
            >
              홈으로 돌아가기
            </Link>
          </div>
        )}
      </div>
      <QuickKeys
        activeSessionId={sessionId}
        send={send}
        stickyCtrl={stickyCtrl}
        stickyAlt={stickyAlt}
        onToggleCtrl={() => setStickyCtrl((p) => !p)}
        onToggleAlt={() => setStickyAlt((p) => !p)}
        onStickyReset={resetSticky}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

1. Go to Home → 새 세션 시작 → Browse to a directory → "여기서 터미널 열기"
2. Expected: Terminal opens, can type commands, QuickKeys work
3. Kill the terminal process → "[Session ended]" text appears, "홈으로 돌아가기" overlay visible

- [ ] **Step 4: Commit**

```bash
git add client/src/routes/terminal.\$sessionId.tsx client/src/components/terminal-pane.tsx
git commit -m "feat(client): add Terminal route with output listener pattern and exited state overlay"
```

---

### Task 9: Client — Clean up old components & App.tsx

**Files:**

- Delete: `client/src/App.tsx`
- Delete: `client/src/components/session-tabs.tsx`
- Delete: `client/src/components/new-session-dialog.tsx`
- Delete: `client/src/components/rename-dialog.tsx`
- Delete: `client/src/components/status-badge.tsx`

- [ ] **Step 1: Remove unused files**

```bash
cd /Users/shiwoo/dev/better-remote-control/client
rm src/App.tsx
rm src/components/session-tabs.tsx
rm src/components/new-session-dialog.tsx
rm src/components/rename-dialog.tsx
rm src/components/status-badge.tsx
```

- [ ] **Step 2: Verify no broken imports**

```bash
cd /Users/shiwoo/dev/better-remote-control/client && pnpm build
```

Expected: Build succeeds with no import errors. If storybook stories reference deleted components, delete those stories too:

```bash
# 해당 stories가 삭제된 컴포넌트를 참조하면 삭제
rm -f src/components/__stories__/session-tabs.stories.tsx
rm -f src/components/__stories__/full-layout.stories.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(client): remove old App.tsx, SessionTabs, NewSessionDialog, RenameDialog, StatusBadge"
```

---

### Task 10: UI Design Refresh

Apply web-design-guidelines skill to modernize the overall look. Focus on the new components created in previous tasks.

**Files:**

- Modify: `client/src/index.css`
- Modify: `client/src/components/config-bar.tsx`
- Modify: `client/src/components/session-card.tsx`
- Modify: `client/src/components/directory-list.tsx`
- Modify: `client/src/components/breadcrumb-nav.tsx`
- Modify: `client/src/routes/index.tsx`
- Modify: `client/src/routes/browse.tsx`

- [ ] **Step 1: Invoke web-design-guidelines skill**

Use the `web-design-guidelines` skill to review and improve the UI across all new components. Focus areas:

- 색상 팔레트 일관성 (CSS variables 활용)
- 터치 타겟 크기 (최소 44px)
- 타이포그래피 계층
- 간격과 여백 일관성
- 전환 애니메이션
- 모바일 접근성

- [ ] **Step 2: Apply improvements**

Iterate on each component file based on the review findings. Key areas likely needing attention:

- ConfigBar: 높이, 패딩, 타이포그래피
- SessionCard: 카드 스타일, 그림자, 호버/액티브 상태
- DirectoryList: 항목 높이, 아이콘 색상
- BreadcrumbNav: 세그먼트 간격, 스크롤바 숨김
- 홈/탐색기 페이지: 전체 레이아웃 여백

- [ ] **Step 3: Verify in mobile viewport**

Open Chrome DevTools → Toggle device toolbar → iPhone 14 Pro (393×852).
Check all 3 screens for layout issues.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: modernize UI design across all screens"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Build server**

```bash
cd /Users/shiwoo/dev/better-remote-control && pnpm run build
```

Expected: No errors.

- [ ] **Step 2: Build client**

```bash
cd /Users/shiwoo/dev/better-remote-control/client && pnpm run build
```

Expected: Build output in `../public/`.

- [ ] **Step 3: Start server and test full flow**

```bash
cd /Users/shiwoo/dev/better-remote-control && node dist/cli.js --no-tunnel
```

1. Open `http://localhost:4020` → login
2. Home: empty state, "새 세션 시작" button visible
3. Click "새 세션 시작" → Browse: directory listing of $HOME
4. Navigate into a directory → breadcrumb updates, browser back works
5. Click "여기서 터미널 열기" → Terminal opens at selected path
6. Type `pwd` → confirms correct cwd
7. Click home button → back to Home, session card visible
8. Click session card → back to terminal, output preserved (from buffer)
9. Click X on session card → session closed
10. Settings: open settings, set auto command, create new session → command auto-executes

- [ ] **Step 4: Test SPA fallback**

Refresh browser on `/browse` and `/terminal/some-id`. Expected: page loads correctly (no 404).

- [ ] **Step 5: Test reconnection**

Kill and restart server while on terminal page. Expected: reconnects, session list restores, terminal output replays.

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "fix: address issues found during E2E verification"
```

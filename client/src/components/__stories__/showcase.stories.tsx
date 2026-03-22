/**
 * README 스크린샷용 쇼케이스 스토리
 *
 * 실제 사용 시나리오를 시뮬레이션하여 더 현실적인 스크린샷을 제공합니다.
 */
import { Plus, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ConfigBar } from "../config-bar";
import { QuickKeys } from "../quick-keys";
import { SessionCard } from "../session-card";
import { StoryProviders } from "./mock-providers";

import type { SessionInfo, ClientMessage } from "@/hooks/use-socket";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = {
  title: "Showcase",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
};

export default meta;
type Story = StoryObj;

const noop = () => {};
const noopSend = (() => {}) as (msg: ClientMessage) => void;

/* ─── 모의 터미널 출력 ─── */

const claudeOutput = [
  { type: "prompt" as const, text: "$ claude" },
  { type: "box-top" as const, text: "╭─────────────────────────────────────────╮" },
  { type: "box" as const, text: "│  ✻ Claude Code        REPL by Anthropic │" },
  { type: "box" as const, text: "│                                         │" },
  { type: "box" as const, text: "│    cwd: ~/my-project                    │" },
  { type: "box-bottom" as const, text: "╰─────────────────────────────────────────╯" },
  { type: "line" as const, text: "" },
  { type: "user" as const, text: "> Fix the login timeout bug" },
  { type: "line" as const, text: "" },
  { type: "assistant" as const, text: "I'll investigate the login timeout issue." },
  { type: "assistant" as const, text: "Let me check the auth middleware first." },
  { type: "line" as const, text: "" },
  { type: "tool" as const, text: "  Read src/middleware/auth.ts" },
  { type: "tool" as const, text: "  Read src/routes/login.ts" },
  { type: "line" as const, text: "" },
  { type: "assistant" as const, text: "Found it — the session TTL is set to 5s" },
  { type: "assistant" as const, text: "instead of 5 minutes. Fixing now..." },
  { type: "line" as const, text: "" },
  { type: "tool" as const, text: "  Edit src/middleware/auth.ts" },
  { type: "line" as const, text: "" },
  { type: "success" as const, text: "✓ Fixed: changed TTL from 5000ms to" },
  { type: "success" as const, text: "  300_000ms (5 minutes)" },
];

function MockTerminalLine({ line }: { line: (typeof claudeOutput)[number] }) {
  const colors: Record<string, string> = {
    prompt: "#50fa7b",
    "box-top": "#8be9fd",
    box: "#8be9fd",
    "box-bottom": "#8be9fd",
    user: "#f8f8f2",
    assistant: "#e0e0e0",
    tool: "#bd93f9",
    success: "#50fa7b",
    line: "transparent",
  };

  return (
    <div
      style={{
        fontFamily: "'SF Mono', 'Menlo', 'Consolas', monospace",
        fontSize: 11,
        lineHeight: 1.5,
        color: colors[line.type] || "#e0e0e0",
        fontWeight: line.type === "user" ? 600 : 400,
        whiteSpace: "pre",
        minHeight: line.type === "line" ? 8 : undefined,
      }}
    >
      {line.text}
    </div>
  );
}

/* ─── 터미널 + 퀵키 전체 화면 ─── */

export const TerminalWithClaude: Story = {
  render: () => (
    <StoryProviders
      socketOverrides={{
        sessions: [{ id: "s1", name: "claude-code", cwd: "~/my-project" }],
      }}
      initialPath="/terminal/s1"
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        <ConfigBar />
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            background: "#1a1a2e",
            padding: "8px 12px",
          }}
        >
          {claudeOutput.map((line, i) => (
            <MockTerminalLine key={i} line={line} />
          ))}
          <div
            style={{
              display: "inline-block",
              width: 8,
              height: 14,
              background: "#e94560",
              animation: "blink 1s step-end infinite",
              marginTop: 4,
            }}
          />
        </div>
        <QuickKeys
          activeSessionId="s1"
          send={noopSend}
          stickyCtrl={false}
          stickyAlt={false}
          onToggleCtrl={noop}
          onToggleAlt={noop}
          onStickyReset={noop}
        />
      </div>
    </StoryProviders>
  ),
};

/* ─── 멀티 세션 홈 ─── */

const realisticSessions: SessionInfo[] = [
  { id: "s1", name: "claude-code", cwd: "~/my-project" },
  { id: "s2", name: "dev-server", cwd: "~/my-project" },
  { id: "s3", name: "api-tests", cwd: "~/my-project/tests" },
];

export const MultiSession: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ sessions: realisticSessions }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        <ConfigBar />
        <MultiSessionHome sessions={realisticSessions} />
      </div>
    </StoryProviders>
  ),
};

function MultiSessionHome({ sessions }: { sessions: SessionInfo[] }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 512, margin: "0 auto", padding: 16 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onClose={noop} />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80">
          <Plus size={18} />
          {t("home.newSession")}
        </button>
      </div>
    </>
  );
}

/* ─── 빈 상태 (처음 접속) ─── */

export const EmptyState: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ sessions: [] }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
        <ConfigBar />
        <EmptyHome />
      </div>
    </StoryProviders>
  ),
};

function EmptyHome() {
  const { t } = useTranslation();
  return (
    <>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
          <Terminal size={28} className="text-[var(--muted-foreground)]" />
        </div>
        <p className="mb-1 text-sm font-medium text-[var(--foreground)]">{t("home.noSessions")}</p>
        <p className="mb-6 text-xs text-[var(--muted-foreground)]">
          {t("home.noSessionsDescription")}
        </p>
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80">
          <Plus size={18} />
          {t("home.newSession")}
        </button>
      </div>
    </>
  );
}

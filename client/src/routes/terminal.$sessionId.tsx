import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { QuickKeys } from "@/components/quick-keys";
import { TerminalPane } from "@/components/terminal-pane";
import { useSessionContext } from "@/contexts/socket-context";

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
              className="rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:opacity-80"
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

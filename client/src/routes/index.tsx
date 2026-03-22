import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Terminal } from "lucide-react";

import { SessionCard } from "@/components/session-card";
import { useSessionContext } from "@/contexts/socket-context";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { sessions, send } = useSessionContext();

  // 세션 종료 메시지 전송
  function handleClose(id: string) {
    send({ type: "close", sessionId: id });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-lg flex-1 p-4">
        {sessions.length === 0 ? (
          // 세션 없을 때 빈 상태 화면
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
          // 세션 목록 카드 그리드
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
          search={{ path: "" }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:opacity-80"
        >
          <Plus size={18} />새 세션 시작
        </Link>
      </div>
    </div>
  );
}

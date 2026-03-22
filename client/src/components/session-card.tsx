import { Link } from "@tanstack/react-router";
import { X, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SessionInfo } from "@/hooks/use-socket";

interface SessionCardProps {
  session: SessionInfo;
  onClose: (id: string) => void;
}

export function SessionCard({ session, onClose }: SessionCardProps) {
  return (
    <Link
      // @ts-expect-error -- /terminal/$sessionId 라우트는 Task 8에서 추가됨
      to="/terminal/$sessionId"
      params={{ sessionId: session.id }}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors active:bg-[var(--accent)]",
        session.exited && "opacity-50",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          session.exited ? "bg-[var(--muted)]" : "bg-[var(--primary)]/10",
        )}
      >
        <Terminal
          size={20}
          className={session.exited ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]"}
        />
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
        className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-opacity active:text-[var(--primary)]"
      >
        <X size={16} />
      </button>
    </Link>
  );
}

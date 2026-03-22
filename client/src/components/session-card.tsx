import { Link } from "@tanstack/react-router";
import { X, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { SessionInfo } from "@/hooks/use-socket";

interface SessionCardProps {
  session: SessionInfo;
  onClose: (id: string) => void;
}

export function SessionCard({ session, onClose }: SessionCardProps) {
  const { t } = useTranslation();
  return (
    <Link
      to="/terminal/$sessionId"
      params={{ sessionId: session.id }}
      className={cn(
        "border-border bg-card active:bg-accent group relative flex items-center gap-3 rounded-xl border p-4 transition-colors",
        session.exited && "opacity-50",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          session.exited ? "bg-muted" : "bg-primary/10",
        )}
      >
        <Terminal
          size={20}
          aria-hidden="true"
          className={session.exited ? "text-muted-foreground" : "text-primary"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", session.exited && "line-through")}>
          {session.name}
        </p>
        <p className="text-muted-foreground truncate text-xs">{session.cwd}</p>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose(session.id);
        }}
        aria-label={t("session.close")}
        className="text-muted-foreground focus-visible:ring-ring active:text-primary rounded-md p-1.5 transition-opacity focus-visible:outline-none focus-visible:ring-2"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </Link>
  );
}

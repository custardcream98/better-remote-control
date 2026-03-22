import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SessionCard } from "@/components/session-card";
import { useSessionContext } from "@/contexts/socket-context";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { sessions, send } = useSessionContext();
  const { t } = useTranslation();

  // Send session close message
  function handleClose(id: string) {
    send({ type: "close", sessionId: id });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col p-4">
        {sessions.length === 0 ? (
          // Empty state screen when there are no sessions
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
              <Terminal size={28} className="text-[var(--muted-foreground)]" />
            </div>
            <p className="mb-1 text-sm font-medium text-[var(--foreground)]">
              {t("home.noSessions")}
            </p>
            <p className="mb-6 text-xs text-[var(--muted-foreground)]">
              {t("home.noSessionsDescription")}
            </p>
          </div>
        ) : (
          // Session list card grid
          <div className="grid gap-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onClose={handleClose} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom-pinned new session button */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Link
          to="/browse"
          search={{ path: "" }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:opacity-80"
        >
          <Plus size={18} />
          {t("home.newSession")}
        </Link>
      </div>
    </div>
  );
}

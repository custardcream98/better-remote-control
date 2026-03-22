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
            <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
              <Terminal size={28} className="text-muted-foreground" />
            </div>
            <p className="text-foreground mb-1 text-sm font-medium">{t("home.noSessions")}</p>
            <p className="text-muted-foreground mb-6 text-xs">{t("home.noSessionsDescription")}</p>
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
      <div className="border-border bg-background shrink-0 border-t p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Link
          to="/browse"
          search={{ path: "" }}
          className="bg-primary text-primary-foreground focus-visible:ring-ring flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 active:opacity-80"
        >
          <Plus size={18} />
          {t("home.newSession")}
        </Link>
      </div>
    </div>
  );
}

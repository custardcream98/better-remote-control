import { Link, useLocation, useParams } from "@tanstack/react-router";
import { Check, Home, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrcLogo } from "@/components/brc-logo";
import { SettingsDialog } from "@/components/settings-dialog";
import { useSessionContext } from "@/contexts/socket-context";
import { cn } from "@/lib/utils";

export function ConfigBar() {
  const { status, sessions, send } = useSessionContext();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const isHome = location.pathname === "/";

  // Get session info when on terminal page
  const params = useParams({ strict: false }) as { sessionId?: string };
  const session = params.sessionId ? sessions.find((s) => s.id === params.sessionId) : undefined;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    if (!session) return;
    setEditName(session.name);
    setEditing(true);
  }

  function submitRename() {
    if (!session) return;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      send({ type: "rename", sessionId: session.id, name: trimmed });
    }
    setEditing(false);
  }

  return (
    <header className="border-border bg-card flex h-11 shrink-0 items-center justify-between border-b px-3 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {isHome ? (
          <BrcLogo />
        ) : (
          <Link
            to="/"
            className="text-muted-foreground active:text-foreground flex shrink-0 items-center gap-1.5 transition-colors"
          >
            <Home size={16} aria-hidden="true" />
          </Link>
        )}
        {session &&
          (editing ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitRename();
              }}
            >
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                }}
                onBlur={submitRename}
                className="bg-background border-border min-w-0 flex-1 rounded px-1.5 py-0.5 text-sm font-medium focus:outline-none"
              />
              <button
                type="submit"
                className="text-muted-foreground active:text-primary shrink-0 rounded-md p-1"
              >
                <Check size={14} />
              </button>
            </form>
          ) : (
            <button
              onClick={startEditing}
              className="text-foreground truncate text-sm font-medium active:opacity-70"
            >
              {session.name}
            </button>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Connection status indicator */}
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            status === "connected" && "bg-green-500",
            status === "disconnected" && "bg-red-500",
            status === "reconnecting" && "animate-pulse bg-yellow-500",
          )}
        />
        <span className="sr-only">
          {status === "connected"
            ? t("config.connected")
            : status === "disconnected"
              ? t("config.disconnected")
              : t("config.reconnecting")}
        </span>

        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={t("config.settings")}
          className="text-muted-foreground focus-visible:ring-ring active:text-foreground rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <Settings size={16} />
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}

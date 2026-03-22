import { Link, useLocation } from "@tanstack/react-router";
import { Home, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BrcLogo } from "@/components/brc-logo";
import { SettingsDialog } from "@/components/settings-dialog";
import { useSessionContext } from "@/contexts/socket-context";
import { cn } from "@/lib/utils";

export function ConfigBar() {
  const { status } = useSessionContext();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useTranslation();
  const showHome = location.pathname !== "/";

  return (
    <header className="border-border bg-card flex h-11 shrink-0 items-center justify-between border-b px-3 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2">
        {showHome ? (
          <Link
            to="/"
            className="text-muted-foreground active:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Home size={16} aria-hidden="true" />
            <BrcLogo />
          </Link>
        ) : (
          <BrcLogo />
        )}
      </div>

      <div className="flex items-center gap-2">
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

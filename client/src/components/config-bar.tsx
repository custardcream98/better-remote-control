import { Link, useLocation } from "@tanstack/react-router";
import { Home, Settings } from "lucide-react";
import { useState } from "react";

import { SettingsDialog } from "@/components/settings-dialog";
import { useSessionContext } from "@/contexts/socket-context";
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
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[var(--muted-foreground)] transition-colors active:text-[var(--foreground)]"
          >
            <Home size={16} />
            <span className="text-sm font-medium">brc</span>
          </Link>
        ) : (
          <span className="text-sm font-medium text-[var(--foreground)]">brc</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* 연결 상태 인디케이터 */}
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            status === "connected" && "bg-green-500",
            status === "disconnected" && "bg-red-500",
            status === "reconnecting" && "animate-pulse bg-yellow-500",
          )}
        />

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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { QuickKeys } from "@/components/quick-keys";
import { getFontSize } from "@/components/settings-dialog";
import { TerminalPane } from "@/components/terminal-pane";
import { TerminalSearchBar } from "@/components/terminal-search-bar";
import { useSessionContext } from "@/contexts/socket-context";
import { useBellNotification } from "@/hooks/use-bell-notification";
import { useIsMobile } from "@/hooks/use-is-mobile";

import type { TerminalSearchHandle } from "@/components/terminal-pane";

export const Route = createFileRoute("/terminal/$sessionId")({
  component: TerminalPage,
});

function TerminalPage() {
  const { sessionId } = Route.useParams();
  const { sessions, send, addOutputListener, getSessionOutput } = useSessionContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [stickyCtrl, setStickyCtrl] = useState(false);
  const [stickyAlt, setStickyAlt] = useState(false);
  const [stickyShift, setStickyShift] = useState(false);
  const [fontSize, setFontSize] = useState(getFontSize);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchQueryRef = useRef("");
  const writeRef = useRef<((data: string) => void) | null>(null);
  const searchRef = useRef<TerminalSearchHandle | null>(null);
  const { notify } = useBellNotification();

  const session = sessions.find((s) => s.id === sessionId);

  // Redirect to home if session does not exist
  useEffect(() => {
    if (sessions.length > 0 && !session) {
      navigate({ to: "/" });
    }
  }, [sessions, session, navigate]);

  // Register output listener
  useEffect(() => {
    const unsubscribe = addOutputListener((sid, data) => {
      if (sid === sessionId) {
        writeRef.current?.(data);
      }
    });
    return unsubscribe;
  }, [sessionId, addOutputListener]);

  // Detect settings changes (font size)
  useEffect(() => {
    const handler = () => setFontSize(getFontSize());
    window.addEventListener("brc:settings-changed", handler);
    return () => window.removeEventListener("brc:settings-changed", handler);
  }, []);

  // Desktop Ctrl+F / Cmd+F keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const resetSticky = useCallback(() => {
    setStickyCtrl(false);
    setStickyAlt(false);
    setStickyShift(false);
  }, []);

  const handleReady = useCallback(
    (write: (data: string) => void) => {
      writeRef.current = write;
      // Replay accumulated session output history to restore previous content
      const history = getSessionOutput(sessionId);
      for (const chunk of history) {
        write(chunk);
      }
    },
    [sessionId, getSessionOutput],
  );

  const handleSearchReady = useCallback((handle: TerminalSearchHandle) => {
    searchRef.current = handle;
  }, []);

  const handleBell = useCallback(() => {
    notify(session?.name);
  }, [notify, session?.name]);

  function handleSearch(query: string) {
    searchQueryRef.current = query;
    if (query) searchRef.current?.findNext(query);
    else searchRef.current?.clearSearch();
  }

  function closeSearch() {
    searchQueryRef.current = "";
    searchRef.current?.clearSearch();
    setSearchOpen(false);
  }

  if (!session && sessions.length === 0) {
    return null;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <TerminalPane
          sessionId={sessionId}
          send={send}
          fontSize={fontSize}
          stickyCtrl={stickyCtrl}
          stickyAlt={stickyAlt}
          stickyShift={stickyShift}
          onStickyReset={resetSticky}
          onReady={handleReady}
          onSearchReady={handleSearchReady}
          onBell={handleBell}
        />
        {/* Search bar */}
        {searchOpen && (
          <TerminalSearchBar
            onSearch={handleSearch}
            onNext={() => searchRef.current?.findNext(searchQueryRef.current)}
            onPrevious={() => searchRef.current?.findPrevious(searchQueryRef.current)}
            onClose={closeSearch}
          />
        )}
        {/* Mobile search toggle button */}
        {isMobile && !searchOpen && (
          <button
            onClick={() => setSearchOpen(true)}
            className="bg-card/80 text-muted-foreground active:text-foreground absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg shadow-md backdrop-blur-sm"
            aria-label={t("terminal.search")}
          >
            <Search size={14} />
          </button>
        )}
        {/* Overlay when session has exited */}
        {session.exited && (
          <div className="absolute inset-0 flex items-end justify-center bg-black/40 pb-20">
            <Link
              to="/"
              className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-xl px-6 py-3 text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 active:opacity-80"
            >
              {t("terminal.goHome")}
            </Link>
          </div>
        )}
      </div>
      {isMobile && (
        <QuickKeys
          activeSessionId={sessionId}
          send={send}
          stickyCtrl={stickyCtrl}
          stickyAlt={stickyAlt}
          stickyShift={stickyShift}
          onToggleCtrl={() => setStickyCtrl((p) => !p)}
          onToggleAlt={() => setStickyAlt((p) => !p)}
          onToggleShift={() => setStickyShift((p) => !p)}
          onStickyReset={resetSticky}
        />
      )}
    </div>
  );
}

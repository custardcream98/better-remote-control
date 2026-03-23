import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardCopy, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { QuickKeys } from "@/components/quick-keys";
import { getFontSize } from "@/components/settings-dialog";
import { TerminalPane } from "@/components/terminal-pane";
import { TerminalSearchBar } from "@/components/terminal-search-bar";
import { useSessionContext } from "@/contexts/socket-context";
import { useBellNotification } from "@/hooks/use-bell-notification";
import { useIsMobile } from "@/hooks/use-is-mobile";

import type { TerminalBufferHandle, TerminalSearchHandle } from "@/components/terminal-pane";

export const Route = createFileRoute("/terminal/$sessionId")({
  component: TerminalPage,
});

function TerminalPage() {
  const { sessionId } = Route.useParams();
  const { sessions, send, addOutputListener, getSessionOutput } = useSessionContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [fontSize, setFontSize] = useState(getFontSize);
  const [searchOpen, setSearchOpen] = useState(false);
  const [textViewOpen, setTextViewOpen] = useState(false);
  const [textViewContent, setTextViewContent] = useState("");
  const searchQueryRef = useRef("");
  const writeRef = useRef<((data: string) => void) | null>(null);
  const searchRef = useRef<TerminalSearchHandle | null>(null);
  const bufferRef = useRef<TerminalBufferHandle | null>(null);
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

  const handleBufferReady = useCallback((handle: TerminalBufferHandle) => {
    bufferRef.current = handle;
  }, []);

  function openTextView() {
    if (bufferRef.current) {
      setTextViewContent(bufferRef.current.getText());
      setTextViewOpen(true);
    }
  }

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
          onReady={handleReady}
          onSearchReady={handleSearchReady}
          onBufferReady={handleBufferReady}
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
        {/* Mobile toolbar buttons */}
        {isMobile && !searchOpen && (
          <div className="absolute right-2 top-2 z-10 flex gap-1.5">
            <button
              onClick={openTextView}
              className="bg-card/80 text-muted-foreground active:text-foreground flex h-8 w-8 items-center justify-center rounded-lg shadow-md backdrop-blur-sm"
              aria-label={t("terminal.copyText")}
            >
              <ClipboardCopy size={14} />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="bg-card/80 text-muted-foreground active:text-foreground flex h-8 w-8 items-center justify-center rounded-lg shadow-md backdrop-blur-sm"
              aria-label={t("terminal.search")}
            >
              <Search size={14} />
            </button>
          </div>
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
      {isMobile && <QuickKeys activeSessionId={sessionId} send={send} />}

      {/* Text view overlay for mobile text selection */}
      {textViewOpen && (
        <div className="bg-background/95 fixed inset-0 z-50 flex flex-col backdrop-blur-sm">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">{t("terminal.textView")}</span>
            <button
              onClick={() => setTextViewOpen(false)}
              className="text-muted-foreground active:text-foreground flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
          <pre className="flex-1 select-text overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs leading-relaxed">
            {textViewContent}
          </pre>
        </div>
      )}
    </div>
  );
}

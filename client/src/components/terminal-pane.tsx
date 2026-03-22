import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";

import type { ClientMessage } from "@/hooks/use-socket";

function safeFit(term: Terminal, fit: FitAddon) {
  const buf = term.buffer.active;
  const wasScrolledUp = buf.viewportY < buf.baseY;
  const savedY = buf.viewportY;
  fit.fit();
  if (wasScrolledUp) {
    term.scrollToLine(savedY);
  }
}

export interface TerminalSearchHandle {
  findNext: (query: string) => void;
  findPrevious: (query: string) => void;
  clearSearch: () => void;
}

interface TerminalPaneProps {
  sessionId: string;
  send: (msg: ClientMessage) => void;
  fontSize: number;
  /** Register callback for writing data from outside */
  onReady: (write: (data: string) => void) => void;
  /** Register search handle */
  onSearchReady?: (handle: TerminalSearchHandle) => void;
  /** Callback when terminal bell occurs */
  onBell?: () => void;
}

export function TerminalPane({
  sessionId,
  send,
  fontSize,
  onReady,
  onSearchReady,
  onBell,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sendRef = useRef(send);
  const sessionIdRef = useRef(sessionId);
  const onBellRef = useRef(onBell);
  const fontSizeRef = useRef(fontSize);

  // Sync latest prop values to refs (prevent stale closures in event handlers)
  useEffect(() => {
    sendRef.current = send;
    sessionIdRef.current = sessionId;
    onBellRef.current = onBell;
    fontSizeRef.current = fontSize;
  });

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
      fontSize: fontSizeRef.current,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: {
        background: "#17141f",
        foreground: "#e8e6ed",
        cursor: "#8b5cf6",
        cursorAccent: "#17141f",
        selectionBackground: "rgba(139, 92, 246, 0.25)",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Expose write function to the outside
    onReady((data: string) => {
      const buf = term.buffer.active;
      const wasScrolledUp = buf.viewportY < buf.baseY;
      const savedY = buf.viewportY;
      term.write(data, () => {
        if (wasScrolledUp) term.scrollToLine(savedY);
      });
    });

    // Expose search handle
    onSearchReady?.({
      findNext: (q) => search.findNext(q),
      findPrevious: (q) => search.findPrevious(q),
      clearSearch: () => search.clearDecorations(),
    });

    // Bell event
    term.onBell(() => onBellRef.current?.());

    term.onData((data) => {
      sendRef.current({ type: "input", sessionId: sessionIdRef.current, data });
    });

    // Touch scroll
    const container = containerRef.current;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      term.scrollLines(Math.round(deltaY / 10));
      e.preventDefault();
    };
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });

    const ro = new ResizeObserver(() => {
      safeFit(term, fit);
      sendRef.current({
        type: "resize",
        sessionId: sessionIdRef.current,
        cols: term.cols,
        rows: term.rows,
      });
    });
    ro.observe(container);

    // Initial focus
    term.focus();

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamically apply font size changes
  useEffect(() => {
    if (termRef.current && fitRef.current) {
      termRef.current.options.fontSize = fontSize;
      safeFit(termRef.current, fitRef.current);
      sendRef.current({
        type: "resize",
        sessionId: sessionIdRef.current,
        cols: termRef.current.cols,
        rows: termRef.current.rows,
      });
    }
  }, [fontSize]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

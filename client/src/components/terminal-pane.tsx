import { FitAddon } from "@xterm/addon-fit";
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

interface TerminalPaneProps {
  sessionId: string;
  send: (msg: ClientMessage) => void;
  stickyCtrl: boolean;
  stickyAlt: boolean;
  onStickyReset: () => void;
  /** 외부에서 데이터를 write하기 위한 콜백 등록 */
  onReady: (write: (data: string) => void) => void;
}

export function TerminalPane({
  sessionId,
  send,
  stickyCtrl,
  stickyAlt,
  onStickyReset,
  onReady,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const stickyRef = useRef({ ctrl: stickyCtrl, alt: stickyAlt });
  const sendRef = useRef(send);
  const sessionIdRef = useRef(sessionId);
  const onStickyResetRef = useRef(onStickyReset);

  // 최신 prop 값을 ref에 동기화 (이벤트 핸들러에서 stale closure 방지)
  useEffect(() => {
    stickyRef.current = { ctrl: stickyCtrl, alt: stickyAlt };
    sendRef.current = send;
    sessionIdRef.current = sessionId;
    onStickyResetRef.current = onStickyReset;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      scrollback: 5000,
      fontSize: 14,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: {
        background: "#1a1a2e",
        foreground: "#e0e0e0",
        cursor: "#e94560",
        selectionBackground: "rgba(233, 69, 96, 0.25)",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // write 함수를 외부에 전달
    onReady((data: string) => {
      const buf = term.buffer.active;
      const wasScrolledUp = buf.viewportY < buf.baseY;
      const savedY = buf.viewportY;
      term.write(data, () => {
        if (wasScrolledUp) term.scrollToLine(savedY);
      });
    });

    term.onData((data) => {
      let modified = data;
      const { ctrl, alt } = stickyRef.current;
      if (ctrl && data.length === 1) {
        const code = data.toLowerCase().charCodeAt(0);
        if (code >= 97 && code <= 122) modified = String.fromCharCode(code - 96);
        onStickyResetRef.current();
      }
      if (alt) {
        modified = "\x1b" + modified;
        onStickyResetRef.current();
      }
      sendRef.current({ type: "input", sessionId: sessionIdRef.current, data: modified });
    });

    // 터치 스크롤
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

    // 초기 focus
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

  return <div ref={containerRef} className="absolute inset-0" />;
}

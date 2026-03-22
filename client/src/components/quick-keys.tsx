import {
  ImagePlus,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { ClientMessage } from "@/hooks/use-socket";

interface QuickKeysProps {
  activeSessionId: string | null;
  send: (msg: ClientMessage) => void;
  stickyCtrl: boolean;
  stickyAlt: boolean;
  stickyShift: boolean;
  onToggleCtrl: () => void;
  onToggleAlt: () => void;
  onToggleShift: () => void;
  onStickyReset: () => void;
}

const key = cn(
  "flex flex-1 items-center justify-center rounded-[10px] font-mono text-[11px] font-medium h-9",
  "bg-gradient-to-b from-[#2a3055] to-[#222845] text-[#9ba3c0]",
  "border border-[#363d65]/60",
  "active:from-[#222845] active:to-[#1e2340] active:text-white",
  "transition-all duration-75 touch-manipulation select-none",
  "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
  "active:shadow-none active:translate-y-px",
);

const modKeyActive = cn(
  "from-[#e94560]/30 to-[#e94560]/20 border-[#e94560]/60 text-[#e94560]",
  "shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_12px_rgba(233,69,96,0.15)]",
);

const enterKey = cn(
  key,
  "from-[#e94560]/90 to-[#c93a52]/90 text-white/90 border-[#e94560]/40",
  "active:from-[#c93a52] active:to-[#b0324a]",
  "shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_8px_rgba(233,69,96,0.2)]",
);

// Shift + Arrow: add ;2 modifier, Shift + Tab: back-tab
const shiftArrowMap: Record<string, string> = {
  "\x1b[A": "\x1b[1;2A",
  "\x1b[B": "\x1b[1;2B",
  "\x1b[C": "\x1b[1;2C",
  "\x1b[D": "\x1b[1;2D",
  "\t": "\x1b[Z",
};

export function QuickKeys({
  activeSessionId,
  send,
  stickyCtrl,
  stickyAlt,
  stickyShift,
  onToggleCtrl,
  onToggleAlt,
  onToggleShift,
  onStickyReset,
}: QuickKeysProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation();
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendKey = useCallback(
    (seq: string) => {
      if (!activeSessionId) return;
      let data = stickyShift && shiftArrowMap[seq] ? shiftArrowMap[seq] : seq;
      if (stickyAlt) data = "\x1b" + data;
      if (stickyCtrl || stickyAlt || stickyShift) onStickyReset();
      send({ type: "input", sessionId: activeSessionId, data });
    },
    [activeSessionId, send, stickyCtrl, stickyAlt, stickyShift, onStickyReset],
  );

  function startRepeat(seq: string) {
    stopRepeat();
    repeatTimerRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => {
        if (activeSessionId) send({ type: "input", sessionId: activeSessionId, data: seq });
      }, 80);
    }, 300);
  }

  function stopRepeat() {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }

  const rp = (seq: string) => ({
    onTouchStart: () => startRepeat(seq),
    onTouchEnd: stopRepeat,
    onTouchCancel: stopRepeat,
    onMouseDown: () => startRepeat(seq),
    onMouseUp: stopRepeat,
    onMouseLeave: stopRepeat,
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeSessionId) return;
    if (file.size > 10 * 1024 * 1024) {
      alert(t("upload.maxSize"));
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      if (!res.ok) throw new Error("fail");
      const { filePath } = await res.json();
      send({ type: "input", sessionId: activeSessionId, data: filePath + " " });
    } catch {
      alert(t("upload.failed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="shrink-0 border-t border-[#1a1f38]/50 bg-[#0c0e1a] px-[10px] pb-[max(10px,env(safe-area-inset-bottom))] pt-[10px]">
      {/* Row 1: Ctrl Alt Shift Tab Esc Enter */}
      <div className="flex gap-[6px]">
        <button className={cn(key, stickyCtrl && modKeyActive)} onClick={onToggleCtrl}>
          Ctrl
        </button>
        <button className={cn(key, stickyAlt && modKeyActive)} onClick={onToggleAlt}>
          Alt
        </button>
        <button className={cn(key, stickyShift && modKeyActive)} onClick={onToggleShift}>
          Shift
        </button>
        <button className={key} onClick={() => sendKey("\t")}>
          Tab
        </button>
        <button className={key} onClick={() => sendKey("\x1b")}>
          Esc
        </button>
        <button className={enterKey} onClick={() => sendKey("\r")}>
          <CornerDownLeft size={12} className="mr-1 opacity-70" />
          Enter
        </button>
      </div>

      {/* Row 2: Left Down Up Right Opt+Enter — 5 keys (same ratio as row 1) */}
      <div className="mt-[8px] flex gap-[6px]">
        <button className={key} onClick={() => sendKey("\x1b[D")} {...rp("\x1b[D")}>
          <ChevronLeft size={16} />
        </button>
        <button className={key} onClick={() => sendKey("\x1b[B")} {...rp("\x1b[B")}>
          <ChevronDown size={16} />
        </button>
        <button className={key} onClick={() => sendKey("\x1b[A")} {...rp("\x1b[A")}>
          <ChevronUp size={16} />
        </button>
        <button className={key} onClick={() => sendKey("\x1b[C")} {...rp("\x1b[C")}>
          <ChevronRight size={16} />
        </button>
        <button className={cn(key, "text-[10px]")} onClick={() => sendKey("\x1b\r")}>
          Opt↵
        </button>
      </div>

      {/* Row 3: Symbols + Upload — 6 keys (plenty of horizontal space) */}
      <div className="mt-[8px] flex gap-[6px]">
        {["|", "/", "~", "$", "_"].map((c) => (
          <button key={c} className={cn(key, "text-xs")} onClick={() => sendKey(c)}>
            {c}
          </button>
        ))}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          className={key}
          disabled={uploading || !activeSessionId}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        </button>
      </div>
    </div>
  );
}

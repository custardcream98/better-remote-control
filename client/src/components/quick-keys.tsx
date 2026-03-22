import {
  ImagePlus,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { ClientMessage } from "@/hooks/use-socket";

interface QuickKeysProps {
  activeSessionId: string | null;
  send: (msg: ClientMessage) => void;
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

const smallKey = cn(key, "h-7 text-[10px]");

export function QuickKeys({ activeSessionId, send }: QuickKeysProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation();
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function sendKey(seq: string) {
    if (!activeSessionId) return;
    send({ type: "input", sessionId: activeSessionId, data: seq });
  }

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
      {/* Row 1 (top, less accessible): auxiliary keys */}
      <div className="flex gap-[6px]">
        <button className={smallKey} onClick={() => sendKey("\x03")}>
          Ctrl+C
        </button>
        <button className={smallKey} onClick={() => sendKey("\x1b[Z")}>
          ⇧Tab
        </button>
        <button className={smallKey} onClick={() => sendKey("\x1b\r")}>
          Opt↵
        </button>
        <button className={smallKey} onClick={() => sendKey("/")}>
          /
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          className={smallKey}
          disabled={uploading || !activeSessionId}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        </button>
      </div>

      {/* Row 2 (bottom, thumb zone): arrows + Tab + Esc */}
      <div className="mt-[6px] flex gap-[6px]">
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
        <button className={key} onClick={() => sendKey("\t")}>
          Tab
        </button>
        <button className={key} onClick={() => sendKey("\x1b")}>
          Esc
        </button>
      </div>
    </div>
  );
}

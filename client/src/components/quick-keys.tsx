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
  "bg-secondary text-muted-foreground",
  "border border-border/60",
  "active:bg-accent active:text-foreground",
  "transition-all duration-75 touch-manipulation select-none",
  "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
  "active:shadow-none active:translate-y-px",
);

const smallKey = cn(key, "h-7 text-[10px]");

export function QuickKeys({ activeSessionId, send }: QuickKeysProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { t } = useTranslation();
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTouchRef = useRef(0);

  function sendKey(seq: string) {
    if (!activeSessionId) return;
    send({ type: "input", sessionId: activeSessionId, data: seq });
  }

  // 가상키보드가 내려가지 않도록 포커스 이동 방지
  function preventFocusLoss(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
  }

  function startRepeat(seq: string) {
    stopRepeat();
    repeatTimerRef.current = setTimeout(() => {
      repeatTimerRef.current = null;
      repeatIntervalRef.current = setInterval(() => {
        if (activeSessionId) send({ type: "input", sessionId: activeSessionId, data: seq });
      }, 80);
    }, 300);
  }

  function stopRepeat(seq?: string) {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
      // 리피트 시작 전 놓으면 단일 키 전송
      if (seq && !repeatIntervalRef.current) {
        sendKey(seq);
      }
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }

  // 반복 키 (화살표 등): 짧게 누르면 단일 입력, 길게 누르면 반복
  const rp = (seq: string) => ({
    onTouchStart: () => startRepeat(seq),
    onTouchEnd: () => stopRepeat(seq),
    onTouchCancel: () => stopRepeat(),
    onMouseDown: () => startRepeat(seq),
    onMouseUp: () => stopRepeat(seq),
    onMouseLeave: () => stopRepeat(),
  });

  // 단일 키: touchEnd(모바일) + click(데스크톱) 이중 처리
  const kp = (seq: string) => ({
    onTouchEnd: () => {
      lastTouchRef.current = Date.now();
      sendKey(seq);
    },
    onClick: () => {
      // 터치로 이미 처리된 경우 무시
      if (Date.now() - lastTouchRef.current < 500) return;
      sendKey(seq);
    },
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
    <div
      className="border-border/50 bg-background shrink-0 border-t px-[10px] pb-[max(10px,env(safe-area-inset-bottom))] pt-[10px]"
      onTouchStart={preventFocusLoss}
      onMouseDown={preventFocusLoss}
    >
      {/* Row 1 (top, less accessible): auxiliary keys */}
      <div className="flex gap-[6px]">
        <button className={smallKey} {...kp("\x03")}>
          Ctrl+C
        </button>
        <button className={smallKey} {...kp("\x1b[Z")}>
          Shift+Tab
        </button>
        <button className={smallKey} {...kp("\x1b\r")}>
          Opt+↩
        </button>
        <button className={smallKey} {...kp("/")}>
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
          onTouchEnd={() => {
            lastTouchRef.current = Date.now();
            fileInputRef.current?.click();
          }}
          onClick={() => {
            if (Date.now() - lastTouchRef.current < 500) return;
            fileInputRef.current?.click();
          }}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        </button>
      </div>

      {/* Row 2 (bottom, thumb zone): arrows + Tab + Esc */}
      <div className="mt-[6px] flex gap-[6px]">
        <button className={key} {...rp("\x1b[D")}>
          <ChevronLeft size={16} />
        </button>
        <button className={key} {...rp("\x1b[B")}>
          <ChevronDown size={16} />
        </button>
        <button className={key} {...rp("\x1b[A")}>
          <ChevronUp size={16} />
        </button>
        <button className={key} {...rp("\x1b[C")}>
          <ChevronRight size={16} />
        </button>
        <button className={key} {...kp("\t")}>
          Tab
        </button>
        <button className={key} {...kp("\x1b")}>
          Esc
        </button>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { X, Terminal, Pencil, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { SessionInfo, ClientMessage } from "@/hooks/use-socket";

interface SessionCardProps {
  session: SessionInfo;
  send: (msg: ClientMessage) => void;
  onClose: (id: string) => void;
}

export function SessionCard({ session, send, onClose }: SessionCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync name when session is renamed externally
  if (!editing && name !== session.name) {
    setName(session.name);
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function submitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== session.name) {
      send({ type: "rename", sessionId: session.id, name: trimmed });
    } else {
      setName(session.name);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        className={cn(
          "border-border bg-card flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border p-4",
          session.exited && "opacity-50",
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            session.exited ? "bg-muted" : "bg-primary/10",
          )}
        >
          <Terminal
            size={20}
            aria-hidden="true"
            className={session.exited ? "text-muted-foreground" : "text-primary"}
          />
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") {
              setName(session.name);
              setEditing(false);
            }
          }}
          onBlur={submitRename}
          className="bg-background border-border min-w-0 flex-1 rounded-md border px-2 py-1 text-sm font-medium focus:outline-none"
        />
        <button
          onClick={submitRename}
          className="text-muted-foreground active:text-primary rounded-md p-1.5"
        >
          <Check size={16} />
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/terminal/$sessionId"
      params={{ sessionId: session.id }}
      className={cn(
        "border-border bg-card active:bg-accent group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border p-4 transition-colors",
        session.exited && "opacity-50",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          session.exited ? "bg-muted" : "bg-primary/10",
        )}
      >
        <Terminal
          size={20}
          aria-hidden="true"
          className={session.exited ? "text-muted-foreground" : "text-primary"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", session.exited && "line-through")}>
          {session.name}
        </p>
        <p className="text-muted-foreground truncate text-xs">{session.cwd}</p>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }}
        aria-label={t("session.rename")}
        className="text-muted-foreground focus-visible:ring-ring active:text-primary rounded-md p-1.5 opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover:opacity-100 group-active:opacity-100"
      >
        <Pencil size={14} aria-hidden="true" />
      </button>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose(session.id);
        }}
        aria-label={t("session.close")}
        className="text-muted-foreground focus-visible:ring-ring active:text-primary rounded-md p-1.5 transition-opacity focus-visible:outline-none focus-visible:ring-2"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </Link>
  );
}

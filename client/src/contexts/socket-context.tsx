import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useSocket } from "@/hooks/use-socket";

import type { SessionInfo, ServerMessage, ClientMessage } from "@/hooks/use-socket";
import type { ReactNode } from "react";

export interface SocketContextValue {
  sessions: SessionInfo[];
  send: (msg: ClientMessage) => void;
  status: "connected" | "disconnected" | "reconnecting";
  config: { defaultCwd: string; defaultCommand: string };
  /** Register callback after session creation (called when 'created' message is received) */
  onceCreated: (cb: (sessionId: string) => void) => void;
  /** Register/unregister terminal output listener */
  addOutputListener: (cb: (sessionId: string, data: string) => void) => () => void;
  /** Get accumulated output history for a session (for restoring on terminal remount) */
  getSessionOutput: (sessionId: string) => string[];
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export function useSessionContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSessionContext must be used within SocketProvider");
  return ctx;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [config, setConfig] = useState({ defaultCwd: "", defaultCommand: "" });
  const createdCallbackRef = useRef<((sessionId: string) => void) | null>(null);
  const outputListenersRef = useRef<Set<(sessionId: string, data: string) => void>>(new Set());
  // Accumulate per-session output history (for restoring terminal after route navigation)
  const sessionOutputRef = useRef<Map<string, string[]>>(new Map());
  const sessionOutputSizeRef = useRef<Map<string, number>>(new Map());
  const SESSION_OUTPUT_LIMIT = 200_000;

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "sessions":
        setSessions(msg.sessions);
        // Clear client buffer on reconnect since server resends scrollback
        sessionOutputRef.current.clear();
        sessionOutputSizeRef.current.clear();
        break;
      case "created":
        setSessions((prev) => [...prev, { id: msg.sessionId, name: msg.name, cwd: msg.cwd }]);
        if (createdCallbackRef.current) {
          createdCallbackRef.current(msg.sessionId);
          createdCallbackRef.current = null;
        }
        break;
      case "output": {
        // Accumulate per-session output history
        let chunks = sessionOutputRef.current.get(msg.sessionId);
        if (!chunks) {
          chunks = [];
          sessionOutputRef.current.set(msg.sessionId, chunks);
        }
        chunks.push(msg.data);
        let size = (sessionOutputSizeRef.current.get(msg.sessionId) ?? 0) + msg.data.length;
        while (size > SESSION_OUTPUT_LIMIT && chunks.length > 0) {
          size -= chunks.shift()!.length;
        }
        sessionOutputSizeRef.current.set(msg.sessionId, size);
        // Dispatch to listeners
        for (const listener of outputListenersRef.current) {
          listener(msg.sessionId, msg.data);
        }
        break;
      }
      case "exited":
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.sessionId ? { ...s, exited: true } : s)),
        );
        // Display "[Session ended]" in the terminal
        for (const listener of outputListenersRef.current) {
          listener(msg.sessionId, "\r\n\x1b[90m[Session ended]\x1b[0m\r\n");
        }
        break;
      case "closed":
        sessionOutputRef.current.delete(msg.sessionId);
        sessionOutputSizeRef.current.delete(msg.sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== msg.sessionId));
        break;
      case "renamed":
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.sessionId ? { ...s, name: msg.name } : s)),
        );
        break;
      case "error":
        // Clean up callback on session creation failure
        if (createdCallbackRef.current) {
          createdCallbackRef.current = null;
        }
        break;
    }
  }, []);

  const { send, status } = useSocket(handleMessage);

  const onceCreated = useCallback((cb: (sessionId: string) => void) => {
    createdCallbackRef.current = cb;
  }, []);

  const addOutputListener = useCallback((cb: (sessionId: string, data: string) => void) => {
    outputListenersRef.current.add(cb);
    return () => {
      outputListenersRef.current.delete(cb);
    };
  }, []);

  const getSessionOutput = useCallback((sessionId: string): string[] => {
    return sessionOutputRef.current.get(sessionId) ?? [];
  }, []);

  return (
    <SocketContext.Provider
      value={{ sessions, send, status, config, onceCreated, addOutputListener, getSessionOutput }}
    >
      {children}
    </SocketContext.Provider>
  );
}

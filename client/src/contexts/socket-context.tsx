import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useSocket } from "@/hooks/use-socket";

import type { SessionInfo, ServerMessage, ClientMessage } from "@/hooks/use-socket";
import type { ReactNode } from "react";

interface SocketContextValue {
  sessions: SessionInfo[];
  send: (msg: ClientMessage) => void;
  status: "connected" | "disconnected" | "reconnecting";
  config: { defaultCwd: string; defaultCommand: string };
  /** 세션 생성 후 콜백 등록 (created 메시지 수신 시 호출) */
  onceCreated: (cb: (sessionId: string) => void) => void;
  /** 터미널 output 리스너 등록/해제 */
  addOutputListener: (cb: (sessionId: string, data: string) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

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
  // 리스너 등록 전에 도착한 output 메시지를 버퍼링
  const outputBufferRef = useRef<{ sessionId: string; data: string }[]>([]);

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
        break;
      case "created":
        setSessions((prev) => [...prev, { id: msg.sessionId, name: msg.name, cwd: msg.cwd }]);
        if (createdCallbackRef.current) {
          createdCallbackRef.current(msg.sessionId);
          createdCallbackRef.current = null;
        }
        break;
      case "output":
        if (outputListenersRef.current.size > 0) {
          for (const listener of outputListenersRef.current) {
            listener(msg.sessionId, msg.data);
          }
        } else {
          // 리스너 없으면 버퍼에 저장 (재연결 시 터미널 마운트 전 도착하는 output 대비)
          outputBufferRef.current.push({ sessionId: msg.sessionId, data: msg.data });
        }
        break;
      case "exited":
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.sessionId ? { ...s, exited: true } : s)),
        );
        // 터미널에 "[Session ended]" 표시
        for (const listener of outputListenersRef.current) {
          listener(msg.sessionId, "\r\n\x1b[90m[Session ended]\x1b[0m\r\n");
        }
        break;
      case "closed":
        setSessions((prev) => prev.filter((s) => s.id !== msg.sessionId));
        break;
      case "renamed":
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.sessionId ? { ...s, name: msg.name } : s)),
        );
        break;
      case "error":
        // 세션 생성 실패 시 콜백 정리
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
    // 버퍼에 쌓인 output 플러시
    if (outputBufferRef.current.length > 0) {
      for (const { sessionId, data } of outputBufferRef.current) {
        cb(sessionId, data);
      }
      outputBufferRef.current = [];
    }
    return () => {
      outputListenersRef.current.delete(cb);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{ sessions, send, status, config, onceCreated, addOutputListener }}
    >
      {children}
    </SocketContext.Provider>
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useSocket } from "@/hooks/use-socket";

import type { SessionInfo, ServerMessage, ClientMessage } from "@/hooks/use-socket";
import type { ReactNode } from "react";

export interface SocketContextValue {
  sessions: SessionInfo[];
  send: (msg: ClientMessage) => void;
  status: "connected" | "disconnected" | "reconnecting";
  config: { defaultCwd: string; defaultCommand: string };
  /** 세션 생성 후 콜백 등록 (created 메시지 수신 시 호출) */
  onceCreated: (cb: (sessionId: string) => void) => void;
  /** 터미널 output 리스너 등록/해제 */
  addOutputListener: (cb: (sessionId: string, data: string) => void) => () => void;
  /** 세션의 누적 출력 기록 조회 (터미널 재마운트 시 복원용) */
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
  // 세션별 출력 기록 누적 (라우트 이동 후 터미널 재마운트 시 복원용)
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
        // 재연결 시 서버가 스크롤백을 다시 전송하므로 클라이언트 버퍼 초기화
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
        // 세션별 출력 기록 누적
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
        // 리스너에 전달
        for (const listener of outputListenersRef.current) {
          listener(msg.sessionId, msg.data);
        }
        break;
      }
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

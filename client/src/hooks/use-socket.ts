import { useCallback, useEffect, useRef, useState } from "react";

export type SessionInfo = { id: string; name: string; cwd: string; exited?: boolean };

export type ServerMessage =
  | { type: "sessions"; sessions: SessionInfo[] }
  | { type: "created"; sessionId: string; name: string; cwd: string }
  | { type: "output"; sessionId: string; data: string }
  | { type: "exited"; sessionId: string; code: number }
  | { type: "closed"; sessionId: string }
  | { type: "renamed"; sessionId: string; name: string }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "create"; cwd?: string; name?: string; command?: string }
  | { type: "input"; sessionId: string; data: string }
  | { type: "resize"; sessionId: string; cols: number; rows: number }
  | { type: "rename"; sessionId: string; name: string }
  | { type: "close"; sessionId: string };

type Status = "connected" | "disconnected" | "reconnecting";

export function useSocket(onMessage: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Status>("disconnected");
  const reconnectDelay = useRef(1000);
  const onMessageRef = useRef(onMessage);

  // Keep latest onMessage reference
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  // Trigger reconnect via reconnectCount changes (avoid self-referencing recursion)
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as ServerMessage;
      onMessageRef.current(msg);
    };

    ws.onclose = (e) => {
      wsRef.current = null;
      if (e.code === 4001) {
        location.href = "/login";
        return;
      }
      setStatus("reconnecting");
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 1.5, 10000);
      setTimeout(() => setReconnectCount((n) => n + 1), delay);
    };

    ws.onerror = () => setStatus("disconnected");

    return () => {
      ws.onclose = null;
      ws.close();
    };
  }, [reconnectCount]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, status };
}

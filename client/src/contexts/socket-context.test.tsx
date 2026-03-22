import { renderHook, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SocketProvider, useSessionContext } from "./socket-context";

// useSocket 모킹 — handleMessage를 캡처
let capturedHandleMessage: ((msg: Record<string, unknown>) => void) | null = null;

vi.mock("@/hooks/use-socket", () => ({
  useSocket: (onMessage: (msg: Record<string, unknown>) => void) => {
    capturedHandleMessage = onMessage;
    return { send: vi.fn(), status: "connected" };
  },
}));

// fetch 모킹 (config 로드)
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ defaultCwd: "", defaultCommand: "" }) }),
  ),
);

function wrapper({ children }: { children: ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}

describe("SocketProvider 세션 출력 버퍼", () => {
  beforeEach(() => {
    capturedHandleMessage = null;
  });

  it("세션별 출력 누적 및 조회", () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    act(() => {
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "hello " });
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "world" });
      capturedHandleMessage!({ type: "output", sessionId: "s2", data: "other" });
    });

    expect(result.current.getSessionOutput("s1")).toEqual(["hello ", "world"]);
    expect(result.current.getSessionOutput("s2")).toEqual(["other"]);
    expect(result.current.getSessionOutput("s3")).toEqual([]);
  });

  it("세션 닫히면 버퍼 삭제", () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    act(() => {
      capturedHandleMessage!({
        type: "sessions",
        sessions: [{ id: "s1", name: "test", cwd: "/" }],
      });
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "data" });
    });

    expect(result.current.getSessionOutput("s1")).toEqual(["data"]);

    act(() => {
      capturedHandleMessage!({ type: "closed", sessionId: "s1" });
    });

    expect(result.current.getSessionOutput("s1")).toEqual([]);
  });

  it("sessions 메시지 수신 시 버퍼 초기화 (재연결 대비)", () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    act(() => {
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "old data" });
    });

    expect(result.current.getSessionOutput("s1")).toEqual(["old data"]);

    act(() => {
      capturedHandleMessage!({ type: "sessions", sessions: [] });
    });

    expect(result.current.getSessionOutput("s1")).toEqual([]);
  });

  it("출력 리스너에 데이터 전달", () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });
    const received: string[] = [];

    act(() => {
      result.current.addOutputListener((sid, data) => {
        if (sid === "s1") received.push(data);
      });
    });

    act(() => {
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "chunk1" });
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "chunk2" });
      capturedHandleMessage!({ type: "output", sessionId: "s2", data: "ignored" });
    });

    expect(received).toEqual(["chunk1", "chunk2"]);
  });

  it("리스너 해제 후 데이터 안 받음", () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });
    const received: string[] = [];
    let unsubscribe: () => void;

    act(() => {
      unsubscribe = result.current.addOutputListener((_sid, data) => {
        received.push(data);
      });
    });

    act(() => {
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "before" });
    });

    act(() => {
      unsubscribe();
    });

    act(() => {
      capturedHandleMessage!({ type: "output", sessionId: "s1", data: "after" });
    });

    expect(received).toEqual(["before"]);
  });
});

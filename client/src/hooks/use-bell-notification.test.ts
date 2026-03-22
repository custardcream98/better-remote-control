import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBellNotification } from "./use-bell-notification";

describe("useBellNotification", () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    // Notification API 모킹
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted" },
      writable: true,
      configurable: true,
    });
    // Service Worker 모킹
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          active: { postMessage: mockPostMessage },
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockPostMessage.mockClear();
  });

  it("설정 비활성화 시 알림 안 보냄", async () => {
    localStorage.setItem("brc_bell_notification", "false");
    const { result } = renderHook(() => useBellNotification());
    await result.current.notify("test-session");
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("권한 없으면 알림 안 보냄", async () => {
    localStorage.setItem("brc_bell_notification", "true");
    Object.defineProperty(window, "Notification", {
      value: { permission: "denied" },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useBellNotification());
    await result.current.notify("test-session");
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("포그라운드에서는 알림 안 보냄", async () => {
    localStorage.setItem("brc_bell_notification", "true");
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useBellNotification());
    await result.current.notify("test-session");
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("백그라운드 + 설정 활성 + 권한 있으면 알림 보냄", async () => {
    localStorage.setItem("brc_bell_notification", "true");
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useBellNotification());
    await result.current.notify("my-session");
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "BELL_NOTIFICATION",
      title: "brc",
      body: "Bell: my-session",
    });
  });

  it("세션 이름 없으면 기본 메시지", async () => {
    localStorage.setItem("brc_bell_notification", "true");
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useBellNotification());
    await result.current.notify();
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "BELL_NOTIFICATION",
      title: "brc",
      body: "Terminal bell",
    });
  });
});

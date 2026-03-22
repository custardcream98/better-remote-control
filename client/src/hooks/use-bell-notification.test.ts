import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBellNotification } from "./use-bell-notification";

describe("useBellNotification", () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    // Mock Notification API
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted" },
      writable: true,
      configurable: true,
    });
    // Mock Service Worker
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

  it("does not send notification when setting is disabled", async () => {
    localStorage.setItem("brc_bell_notification", "false");
    const { result } = renderHook(() => useBellNotification());
    await result.current.notify("test-session");
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("does not send notification without permission", async () => {
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

  it("does not send notification when in foreground", async () => {
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

  it("sends notification when in background with setting enabled and permission granted", async () => {
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

  it("uses default message when no session name is provided", async () => {
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

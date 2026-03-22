import { useCallback } from "react";

import { isBellNotificationEnabled } from "@/components/settings-dialog";

export function useBellNotification() {
  const notify = useCallback(async (sessionName?: string) => {
    if (!isBellNotificationEnabled()) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    // 포그라운드에서는 알림 불필요
    if (document.visibilityState === "visible") return;

    const reg = await navigator.serviceWorker?.ready;
    reg?.active?.postMessage({
      type: "BELL_NOTIFICATION",
      title: "brc",
      body: sessionName ? `Bell: ${sessionName}` : "Terminal bell",
    });
  }, []);

  return { notify };
}

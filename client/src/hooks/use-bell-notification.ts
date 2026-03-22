import { useCallback } from "react";

import { isBellNotificationEnabled } from "@/components/settings-dialog";

export function useBellNotification() {
  const notify = useCallback(async (sessionName?: string) => {
    if (!isBellNotificationEnabled()) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    // No notification needed when in foreground
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

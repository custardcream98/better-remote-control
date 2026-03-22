import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "brc_auto_command";
const FONT_SIZE_KEY = "brc_font_size";
const BELL_NOTIFICATION_KEY = "brc_bell_notification";
const DEFAULT_FONT_SIZE = 14;

export function getAutoCommand(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function getFontSize(): number {
  const val = localStorage.getItem(FONT_SIZE_KEY);
  return val ? Number(val) : DEFAULT_FONT_SIZE;
}

export function isBellNotificationEnabled(): boolean {
  return localStorage.getItem(BELL_NOTIFICATION_KEY) === "true";
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  // Re-mounts every time open changes, so read initial values from localStorage
  if (!open) return null;
  return <SettingsDialogContent onOpenChange={onOpenChange} />;
}

function SettingsDialogContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [command, setCommand] = useState(() => getAutoCommand());
  const [fontSize, setFontSize] = useState(() => getFontSize());
  const [bellEnabled, setBellEnabled] = useState(() => isBellNotificationEnabled());
  const { t, i18n } = useTranslation();

  const notificationSupported = "Notification" in window;
  const notificationDenied = notificationSupported && Notification.permission === "denied";

  async function handleBellToggle(checked: boolean) {
    if (checked && notificationSupported && Notification.permission !== "granted") {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        setBellEnabled(false);
        return;
      }
    }
    setBellEnabled(checked);
  }

  function handleSave() {
    if (command.trim()) {
      localStorage.setItem(STORAGE_KEY, command.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
    localStorage.setItem(BELL_NOTIFICATION_KEY, String(bellEnabled));
    window.dispatchEvent(new CustomEvent("brc:settings-changed"));
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="auto-cmd">{t("settings.autoCommand")}</Label>
            <Input
              id="auto-cmd"
              placeholder={t("settings.autoCommandPlaceholder")}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("settings.autoCommandDescription")}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="font-size">{t("settings.fontSize")}</Label>
            <div className="flex items-center gap-3">
              <input
                id="font-size"
                type="range"
                min={10}
                max={24}
                step={1}
                value={fontSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFontSize(val);
                  // Instant preview when adjusting the slider
                  localStorage.setItem(FONT_SIZE_KEY, String(val));
                  window.dispatchEvent(new CustomEvent("brc:settings-changed"));
                }}
                className="flex-1"
              />
              <span className="w-10 text-right text-sm tabular-nums text-[var(--foreground)]">
                {fontSize}px
              </span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bell-notification">{t("settings.bellNotification")}</Label>
              <button
                id="bell-notification"
                role="switch"
                aria-checked={bellEnabled}
                disabled={notificationDenied}
                onClick={() => handleBellToggle(!bellEnabled)}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: bellEnabled ? "var(--primary)" : "var(--muted)" }}
              >
                <span
                  className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: bellEnabled ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {notificationDenied
                ? t("settings.notificationDenied")
                : t("settings.bellNotificationDescription")}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lang">{t("settings.language")}</Label>
            <select
              id="lang"
              value={i18n.language.startsWith("ko") ? "ko" : "en"}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("settings.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("settings.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

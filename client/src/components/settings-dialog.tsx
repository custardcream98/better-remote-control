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

export function getAutoCommand(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  // open 될 때마다 새로 마운트되므로 초기값으로 localStorage 값을 읽음
  if (!open) return null;
  return <SettingsDialogContent onOpenChange={onOpenChange} />;
}

function SettingsDialogContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [command, setCommand] = useState(() => getAutoCommand());
  const { t, i18n } = useTranslation();

  function handleSave() {
    if (command.trim()) {
      localStorage.setItem(STORAGE_KEY, command.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
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

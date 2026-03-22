import { useState } from "react";

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
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="auto-cmd">Auto Command</Label>
            <Input
              id="auto-cmd"
              placeholder="새 터미널에서 자동 실행할 명령어"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              새 터미널 세션 시작 시 자동으로 입력됩니다
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

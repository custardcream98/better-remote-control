import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

interface TerminalSearchBarProps {
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

const iconBtn = cn(
  "flex h-7 w-7 items-center justify-center rounded-md",
  "text-[var(--muted-foreground)] transition-colors",
  "hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
  "active:bg-[var(--muted)] active:text-[var(--foreground)]",
);

export function TerminalSearchBar({
  onSearch,
  onNext,
  onPrevious,
  onClose,
}: TerminalSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrevious();
      else onNext();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 shadow-lg">
      <input
        ref={inputRef}
        type="text"
        placeholder={t("terminal.searchPlaceholder")}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-40 bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
      />
      <button className={iconBtn} onClick={onPrevious} aria-label={t("terminal.searchPrevious")}>
        <ChevronUp size={14} />
      </button>
      <button className={iconBtn} onClick={onNext} aria-label={t("terminal.searchNext")}>
        <ChevronDown size={14} />
      </button>
      <button className={iconBtn} onClick={onClose} aria-label={t("terminal.closeSearch")}>
        <X size={14} />
      </button>
    </div>
  );
}

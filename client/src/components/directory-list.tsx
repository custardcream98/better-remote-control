import { ArrowUp, ChevronRight, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DirectoryListProps {
  dirs: { name: string }[];
  loading: boolean;
  error: string | null;
  onNavigate: (dirName: string) => void;
  onGoUp: () => void;
  showParent: boolean;
  onRetry: () => void;
}

export function DirectoryList({
  dirs,
  loading,
  error,
  onNavigate,
  onGoUp,
  showParent,
  onRetry,
}: DirectoryListProps) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-muted-foreground text-sm">{error}</p>
        <button
          onClick={onRetry}
          className="bg-muted text-foreground focus-visible:ring-ring rounded-lg px-4 py-2 text-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 active:opacity-80"
        >
          {t("directory.retry")}
        </button>
      </div>
    );
  }

  // Filter out hidden directories
  const visibleDirs = dirs.filter((d) => !d.name.startsWith("."));

  return (
    <div className="flex flex-col">
      {showParent && (
        <button
          onClick={onGoUp}
          className="border-border focus-visible:ring-ring active:bg-accent flex items-center gap-3 border-b px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
        >
          <ArrowUp size={18} aria-hidden="true" className="text-muted-foreground" />
          <span className="text-muted-foreground">..</span>
        </button>
      )}
      {visibleDirs.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {t("directory.noSubdirectories")}
        </p>
      ) : (
        visibleDirs.map((d) => (
          <button
            key={d.name}
            onClick={() => onNavigate(d.name)}
            className="border-border focus-visible:ring-ring active:bg-accent flex items-center gap-3 border-b px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <Folder size={18} aria-hidden="true" className="text-primary shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{d.name}</span>
            <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground shrink-0" />
          </button>
        ))
      )}
    </div>
  );
}

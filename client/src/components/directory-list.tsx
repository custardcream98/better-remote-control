import { ArrowUp, ChevronRight, Folder } from "lucide-react";

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
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--muted)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] transition-opacity active:opacity-80"
        >
          재시도
        </button>
      </div>
    );
  }

  // 숨김 디렉토리 필터링
  const visibleDirs = dirs.filter((d) => !d.name.startsWith("."));

  return (
    <div className="flex flex-col">
      {showParent && (
        <button
          onClick={onGoUp}
          className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-sm transition-colors active:bg-[var(--accent)]"
        >
          <ArrowUp size={18} className="text-[var(--muted-foreground)]" />
          <span className="text-[var(--muted-foreground)]">..</span>
        </button>
      )}
      {visibleDirs.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--muted-foreground)]">
          하위 디렉토리 없음
        </p>
      ) : (
        visibleDirs.map((d) => (
          <button
            key={d.name}
            onClick={() => onNavigate(d.name)}
            className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-sm transition-colors active:bg-[var(--accent)]"
          >
            <Folder size={18} className="shrink-0 text-[var(--primary)]" />
            <span className="min-w-0 flex-1 truncate text-left">{d.name}</span>
            <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)]" />
          </button>
        ))
      )}
    </div>
  );
}

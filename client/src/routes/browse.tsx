import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { DirectoryList } from "@/components/directory-list";
import { getAutoCommand } from "@/components/settings-dialog";
import { useSessionContext } from "@/contexts/socket-context";

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>) => ({
    path: typeof search.path === "string" ? search.path : "",
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { path: searchPath } = Route.useSearch();
  const { config, send, onceCreated } = useSessionContext();
  const navigate = useNavigate();

  const currentPath = searchPath || config.defaultCwd || "/";
  const [dirs, setDirs] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDirs = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dirs?path=${encodeURIComponent(dirPath)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load directories");
      }
      const data = await res.json();
      setDirs(data.dirs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirs(currentPath);
  }, [currentPath, fetchDirs]);

  function navigateToDir(dirPath: string) {
    navigate({ to: "/browse", search: { path: dirPath } });
  }

  function handleDirClick(dirName: string) {
    const newPath = currentPath === "/" ? `/${dirName}` : `${currentPath}/${dirName}`;
    navigateToDir(newPath);
  }

  function handleGoUp() {
    const parent = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
    navigateToDir(parent);
  }

  function handleOpenTerminal() {
    setCreating(true);
    setError(null);
    const autoCommand = getAutoCommand();
    send({
      type: "create",
      cwd: currentPath,
      ...(autoCommand ? { command: autoCommand } : {}),
    });
    onceCreated((sessionId) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCreating(false);
      // @ts-expect-error -- /terminal/$sessionId 라우트는 Task 8에서 추가됨
      navigate({ to: "/terminal/$sessionId", params: { sessionId } });
    });
    // 타임아웃: 5초 내 응답 없으면 복원 + 에러 표시
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setCreating(false);
      setError("세션 생성 시간 초과");
    }, 5000);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <BreadcrumbNav path={currentPath} onNavigate={navigateToDir} />

      <div className="flex-1 overflow-y-auto">
        <DirectoryList
          dirs={dirs}
          loading={loading}
          error={error}
          onNavigate={handleDirClick}
          onGoUp={handleGoUp}
          showParent={currentPath !== "/"}
          onRetry={() => fetchDirs(currentPath)}
        />
      </div>

      {/* 하단 고정 "여기서 터미널 열기" 버튼 */}
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={handleOpenTerminal}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {creating ? "생성 중..." : "여기서 터미널 열기"}
        </button>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
      navigate({ to: "/terminal/$sessionId", params: { sessionId } });
    });
    // Timeout: restore state and show error if no response within 5 seconds
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setCreating(false);
      setError(t("browse.sessionTimeout"));
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

      {/* Bottom-pinned "Open terminal here" button */}
      <div className="border-border bg-background shrink-0 border-t p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={handleOpenTerminal}
          disabled={creating}
          className="bg-primary text-primary-foreground focus-visible:ring-ring flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 active:opacity-80 disabled:opacity-50"
        >
          {creating ? t("browse.creating") : t("browse.openTerminal")}
        </button>
      </div>
    </div>
  );
}

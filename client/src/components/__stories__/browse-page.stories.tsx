/**
 * BrowsePage 복합 스토리
 *
 * 실제 라우트 모듈(routes/browse.tsx)은 Route.useSearch, useNavigate 등
 * 파일 기반 라우트 훅에 의존하므로, 여기서는 BreadcrumbNav + DirectoryList를
 * 조합해 페이지 레이아웃을 시각적으로 재현합니다.
 */
import { useState } from "react";

import { BreadcrumbNav } from "../breadcrumb-nav";
import { DirectoryList } from "../directory-list";
import { StoryProviders } from "./mock-providers";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = {
  title: "Pages/BrowsePage",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
};

export default meta;

type Story = StoryObj;

/* ─── 모의 데이터 ─── */

const sampleDirs = [
  { name: "src" },
  { name: "public" },
  { name: "node_modules" },
  { name: "dist" },
  { name: "tests" },
  { name: "docs" },
  { name: ".git" },
];

/* ─── 페이지 레이아웃 재현 ─── */

function BrowsePageLayout({
  initialPath = "/home/user/project",
  dirs,
  loading = false,
  error = null,
}: {
  initialPath?: string;
  dirs: { name: string }[];
  loading?: boolean;
  error?: string | null;
}) {
  const [path, setPath] = useState(initialPath);
  const [creating, setCreating] = useState(false);

  function handleDirClick(dirName: string) {
    const newPath = path === "/" ? `/${dirName}` : `${path}/${dirName}`;
    setPath(newPath);
  }

  function handleGoUp() {
    const parent = path.substring(0, path.lastIndexOf("/")) || "/";
    setPath(parent);
  }

  function handleOpenTerminal() {
    setCreating(true);
    console.log("터미널 열기:", path);
    setTimeout(() => setCreating(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <BreadcrumbNav path={path} onNavigate={setPath} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        <DirectoryList
          dirs={dirs}
          loading={loading}
          error={error}
          onNavigate={handleDirClick}
          onGoUp={handleGoUp}
          showParent={path !== "/"}
          onRetry={() => console.log("retry")}
        />
      </div>

      {/* 하단 고정 "여기서 터미널 열기" 버튼 */}
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4">
        <button
          onClick={handleOpenTerminal}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-medium text-[var(--primary-foreground)] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {creating ? "생성 중\u2026" : "여기서 터미널 열기"}
        </button>
      </div>
    </div>
  );
}

/* ─── 스토리 ─── */

/** 기본 디렉토리 탐색 상태 */
export const Default: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={sampleDirs} />
    </StoryProviders>
  ),
};

/** 로딩 중 상태 */
export const Loading: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={[]} loading />
    </StoryProviders>
  ),
};

/** 에러 상태 */
export const Error: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={[]} error="디렉토리를 불러올 수 없습니다" />
    </StoryProviders>
  ),
};

/** 빈 디렉토리 */
export const EmptyDirectory: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={[]} />
    </StoryProviders>
  ),
};

/** 루트 경로에서 시작 */
export const RootPath: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout initialPath="/" dirs={sampleDirs} />
    </StoryProviders>
  ),
};

/** 깊은 경로 */
export const DeepPath: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout
        initialPath="/home/user/projects/better-remote-control/client/src"
        dirs={[{ name: "components" }, { name: "hooks" }, { name: "contexts" }, { name: "routes" }]}
      />
    </StoryProviders>
  ),
};

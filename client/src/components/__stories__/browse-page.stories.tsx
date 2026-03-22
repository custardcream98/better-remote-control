/**
 * BrowsePage composite stories
 *
 * Since the actual route module (routes/browse.tsx) depends on file-based route hooks
 * like Route.useSearch and useNavigate, we compose BreadcrumbNav + DirectoryList here
 * to visually reproduce the page layout.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

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

/* ─── Mock Data ─── */

const sampleDirs = [
  { name: "src" },
  { name: "public" },
  { name: "node_modules" },
  { name: "dist" },
  { name: "tests" },
  { name: "docs" },
  { name: ".git" },
];

/* ─── Page Layout Reproduction ─── */

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
  const { t } = useTranslation();
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
    console.log("open terminal:", path);
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

      {/* Bottom fixed button */}
      <div className="border-border bg-background border-t p-4">
        <button
          onClick={handleOpenTerminal}
          disabled={creating}
          className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {creating ? t("browse.creating") : t("browse.openTerminal")}
        </button>
      </div>
    </div>
  );
}

/* ─── Stories ─── */

/** Default directory browsing state */
export const Default: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={sampleDirs} />
    </StoryProviders>
  ),
};

/** Loading state */
export const Loading: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={[]} loading />
    </StoryProviders>
  ),
};

/** Error state */
export const Error: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={[]} error="Failed to load directory" />
    </StoryProviders>
  ),
};

/** Empty directory */
export const EmptyDirectory: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout dirs={[]} />
    </StoryProviders>
  ),
};

/** Starting from root path */
export const RootPath: Story = {
  render: () => (
    <StoryProviders>
      <BrowsePageLayout initialPath="/" dirs={sampleDirs} />
    </StoryProviders>
  ),
};

/** Deep path */
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

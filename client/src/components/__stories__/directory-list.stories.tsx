import { DirectoryList } from "../directory-list";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof DirectoryList> = {
  title: "Components/DirectoryList",
  component: DirectoryList,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
  decorators: [
    (Story) => (
      <div style={{ background: "#1a1a2e", minHeight: "100dvh" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DirectoryList>;

/* ─── 모의 데이터 ─── */

const sampleDirs = [
  { name: "src" },
  { name: "public" },
  { name: "node_modules" },
  { name: "dist" },
  { name: ".git" },
  { name: ".vscode" },
  { name: "tests" },
  { name: "docs" },
];

const noop = () => {};

/* ─── 스토리 ─── */

/** 기본 디렉토리 목록 (숨김 디렉토리 자동 필터링) */
export const Default: Story = {
  args: {
    dirs: sampleDirs,
    loading: false,
    error: null,
    onNavigate: (name: string) => console.log("navigate:", name),
    onGoUp: () => console.log("go up"),
    showParent: true,
    onRetry: noop,
  },
};

/** 로딩 상태 (스켈레톤 UI) */
export const Loading: Story = {
  args: {
    dirs: [],
    loading: true,
    error: null,
    onNavigate: noop,
    onGoUp: noop,
    showParent: false,
    onRetry: noop,
  },
};

/** 에러 상태 */
export const Error: Story = {
  args: {
    dirs: [],
    loading: false,
    error: "디렉토리를 불러올 수 없습니다",
    onNavigate: noop,
    onGoUp: noop,
    showParent: false,
    onRetry: () => console.log("retry"),
  },
};

/** 빈 디렉토리 (하위 폴더 없음) */
export const Empty: Story = {
  args: {
    dirs: [],
    loading: false,
    error: null,
    onNavigate: noop,
    onGoUp: noop,
    showParent: true,
    onRetry: noop,
  },
};

/** 루트 경로 (상위 이동 버튼 숨김) */
export const RootLevel: Story = {
  args: {
    dirs: sampleDirs.filter((d) => !d.name.startsWith(".")),
    loading: false,
    error: null,
    onNavigate: (name: string) => console.log("navigate:", name),
    onGoUp: noop,
    showParent: false,
    onRetry: noop,
  },
};

/** 숨김 디렉토리만 있는 경우 (모두 필터링됨) */
export const OnlyHidden: Story = {
  args: {
    dirs: [{ name: ".git" }, { name: ".vscode" }, { name: ".cache" }],
    loading: false,
    error: null,
    onNavigate: noop,
    onGoUp: noop,
    showParent: true,
    onRetry: noop,
  },
};

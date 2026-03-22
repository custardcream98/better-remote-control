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
      <div style={{ background: "#17141f", minHeight: "100dvh" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DirectoryList>;

/* ─── Mock Data ─── */

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

/* ─── Stories ─── */

/** Default directory list (hidden directories auto-filtered) */
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

/** Loading state (skeleton UI) */
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

/** Error state */
export const Error: Story = {
  args: {
    dirs: [],
    loading: false,
    error: "Failed to load directory",
    onNavigate: noop,
    onGoUp: noop,
    showParent: false,
    onRetry: () => console.log("retry"),
  },
};

/** Empty directory (no subdirectories) */
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

/** Root path (go-up button hidden) */
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

/** Only hidden directories (all filtered out) */
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

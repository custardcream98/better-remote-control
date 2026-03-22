import { useState } from "react";

import { BreadcrumbNav } from "../breadcrumb-nav";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof BreadcrumbNav> = {
  title: "Components/BreadcrumbNav",
  component: BreadcrumbNav,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
};

export default meta;

type Story = StoryObj<typeof BreadcrumbNav>;

/* ─── Interactive Wrapper (navigates on path click) ─── */

function BreadcrumbNavWithState({ initialPath }: { initialPath: string }) {
  const [path, setPath] = useState(initialPath);

  return (
    <div style={{ background: "#17141f" }}>
      <BreadcrumbNav path={path} onNavigate={setPath} />
      <p style={{ color: "#888", fontSize: 12, padding: "8px 16px" }}>Current path: {path}</p>
    </div>
  );
}

/* ─── Stories ─── */

/** Root path */
export const Root: Story = {
  render: () => <BreadcrumbNavWithState initialPath="/" />,
};

/** Short path */
export const ShortPath: Story = {
  render: () => <BreadcrumbNavWithState initialPath="/home/user" />,
};

/** Deep path (horizontal scroll test) */
export const DeepPath: Story = {
  render: () => (
    <BreadcrumbNavWithState initialPath="/home/user/projects/better-remote-control/client/src/components" />
  ),
};

/** Static (only logs events) */
export const Static: Story = {
  args: {
    path: "/home/user/project",
    onNavigate: (path: string) => console.log("navigate:", path),
  },
};

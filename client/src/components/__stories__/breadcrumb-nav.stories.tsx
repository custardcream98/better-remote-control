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

/* ─── 인터랙티브 래퍼 (경로 클릭 시 이동) ─── */

function BreadcrumbNavWithState({ initialPath }: { initialPath: string }) {
  const [path, setPath] = useState(initialPath);

  return (
    <div style={{ background: "#1a1a2e" }}>
      <BreadcrumbNav path={path} onNavigate={setPath} />
      <p style={{ color: "#888", fontSize: 12, padding: "8px 16px" }}>현재 경로: {path}</p>
    </div>
  );
}

/* ─── 스토리 ─── */

/** 루트 경로 */
export const Root: Story = {
  render: () => <BreadcrumbNavWithState initialPath="/" />,
};

/** 짧은 경로 */
export const ShortPath: Story = {
  render: () => <BreadcrumbNavWithState initialPath="/home/user" />,
};

/** 깊은 경로 (가로 스크롤 테스트) */
export const DeepPath: Story = {
  render: () => (
    <BreadcrumbNavWithState initialPath="/home/user/projects/better-remote-control/client/src/components" />
  ),
};

/** 정적 (이벤트 로그만 출력) */
export const Static: Story = {
  args: {
    path: "/home/user/project",
    onNavigate: (path: string) => console.log("navigate:", path),
  },
};

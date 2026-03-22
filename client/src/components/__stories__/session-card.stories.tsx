import { SessionCard } from "../session-card";
import { MockRouterProvider } from "./mock-providers";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SessionCard> = {
  title: "Components/SessionCard",
  component: SessionCard,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
  decorators: [
    (Story) => (
      <MockRouterProvider>
        <div style={{ padding: 16, background: "#1a1a2e" }}>
          <Story />
        </div>
      </MockRouterProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SessionCard>;

/* ─── 스토리 ─── */

/** 활성 세션 */
export const Active: Story = {
  args: {
    session: { id: "sess-1", name: "dev-server", cwd: "/home/user/project" },
    onClose: (id: string) => console.log("close:", id),
  },
};

/** 종료된 세션 (반투명 + 취소선) */
export const Exited: Story = {
  args: {
    session: { id: "sess-2", name: "build", cwd: "/home/user/project", exited: true },
    onClose: (id: string) => console.log("close:", id),
  },
};

/** 긴 이름 (텍스트 truncate 테스트) */
export const LongName: Story = {
  args: {
    session: {
      id: "sess-3",
      name: "very-long-session-name-that-should-be-truncated-in-the-ui",
      cwd: "/home/user/workspace/projects/some-very-deep-nested/directory/path",
    },
    onClose: (id: string) => console.log("close:", id),
  },
};

/** 여러 카드 함께 표시 */
export const Multiple: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <SessionCard
        session={{ id: "sess-1", name: "dev-server", cwd: "/home/user/project" }}
        onClose={(id) => console.log("close:", id)}
      />
      <SessionCard
        session={{ id: "sess-2", name: "build", cwd: "/home/user/project", exited: true }}
        onClose={(id) => console.log("close:", id)}
      />
      <SessionCard
        session={{ id: "sess-3", name: "test-runner", cwd: "/home/user/project/tests" }}
        onClose={(id) => console.log("close:", id)}
      />
    </div>
  ),
};

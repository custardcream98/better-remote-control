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
        <div style={{ padding: 16, background: "#17141f" }}>
          <Story />
        </div>
      </MockRouterProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SessionCard>;

/* ─── Stories ─── */

/** Active session */
export const Active: Story = {
  args: {
    session: { id: "sess-1", name: "dev-server", cwd: "/home/user/project" },
    send: (msg) => console.log("send:", msg),
    onClose: (id: string) => console.log("close:", id),
  },
};

/** Exited session (semi-transparent + strikethrough) */
export const Exited: Story = {
  args: {
    session: { id: "sess-2", name: "build", cwd: "/home/user/project", exited: true },
    send: (msg) => console.log("send:", msg),
    onClose: (id: string) => console.log("close:", id),
  },
};

/** Long name (text truncate test) */
export const LongName: Story = {
  args: {
    session: {
      id: "sess-3",
      name: "very-long-session-name-that-should-be-truncated-in-the-ui",
      cwd: "/home/user/workspace/projects/some-very-deep-nested/directory/path",
    },
    send: (msg) => console.log("send:", msg),
    onClose: (id: string) => console.log("close:", id),
  },
};

/** Multiple cards displayed together */
export const Multiple: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <SessionCard
        session={{ id: "sess-1", name: "dev-server", cwd: "/home/user/project" }}
        send={(msg) => console.log("send:", msg)}
        onClose={(id) => console.log("close:", id)}
      />
      <SessionCard
        session={{ id: "sess-2", name: "build", cwd: "/home/user/project", exited: true }}
        send={(msg) => console.log("send:", msg)}
        onClose={(id) => console.log("close:", id)}
      />
      <SessionCard
        session={{ id: "sess-3", name: "test-runner", cwd: "/home/user/project/tests" }}
        send={(msg) => console.log("send:", msg)}
        onClose={(id) => console.log("close:", id)}
      />
    </div>
  ),
};

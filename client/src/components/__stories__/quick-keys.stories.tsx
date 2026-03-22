import { QuickKeys } from "../quick-keys";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof QuickKeys> = {
  title: "Components/QuickKeys",
  component: QuickKeys,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
};

export default meta;

type Story = StoryObj<typeof QuickKeys>;

export const Default: Story = {
  render: () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a2e" }}>
      <QuickKeys activeSessionId="test-session" send={(msg) => console.log("send:", msg)} />
    </div>
  ),
};

export const NoSession: Story = {
  render: () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a2e" }}>
      <QuickKeys activeSessionId={null} send={() => {}} />
    </div>
  ),
};

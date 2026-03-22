import { ConfigBar } from "../config-bar";
import { StoryProviders } from "./mock-providers";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ConfigBar> = {
  title: "Components/ConfigBar",
  component: ConfigBar,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "iphone14" },
  },
};

export default meta;

type Story = StoryObj<typeof ConfigBar>;

/* ─── Stories ─── */

/** Connected state (home path — Home icon hidden) */
export const ConnectedAtHome: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "connected" }} initialPath="/">
      <ConfigBar />
    </StoryProviders>
  ),
};

/** Connected state (sub-page — Home link visible) */
export const ConnectedSubPage: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "connected" }} initialPath="/browse">
      <ConfigBar />
    </StoryProviders>
  ),
};

/** Disconnected state */
export const Disconnected: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "disconnected" }} initialPath="/">
      <ConfigBar />
    </StoryProviders>
  ),
};

/** Reconnecting state (blinking yellow indicator) */
export const Reconnecting: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "reconnecting" }} initialPath="/">
      <ConfigBar />
    </StoryProviders>
  ),
};

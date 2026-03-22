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

/* ─── 스토리 ─── */

/** 연결됨 상태 (홈 경로 — Home 아이콘 미노출) */
export const ConnectedAtHome: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "connected" }} initialPath="/">
      <ConfigBar />
    </StoryProviders>
  ),
};

/** 연결됨 상태 (하위 경로 — Home 링크 노출) */
export const ConnectedSubPage: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "connected" }} initialPath="/browse">
      <ConfigBar />
    </StoryProviders>
  ),
};

/** 연결 끊김 상태 */
export const Disconnected: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "disconnected" }} initialPath="/">
      <ConfigBar />
    </StoryProviders>
  ),
};

/** 재연결 중 상태 (깜빡이는 노란 인디케이터) */
export const Reconnecting: Story = {
  render: () => (
    <StoryProviders socketOverrides={{ status: "reconnecting" }} initialPath="/">
      <ConfigBar />
    </StoryProviders>
  ),
};

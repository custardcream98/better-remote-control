import { useState } from "react";

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

function QuickKeysWithState() {
  const [ctrl, setCtrl] = useState(false);
  const [alt, setAlt] = useState(false);
  const [shift, setShift] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#1a1a2e",
      }}
    >
      <QuickKeys
        activeSessionId="test-session"
        send={(msg) => console.log("send:", msg)}
        stickyCtrl={ctrl}
        stickyAlt={alt}
        stickyShift={shift}
        onToggleCtrl={() => setCtrl((p) => !p)}
        onToggleAlt={() => setAlt((p) => !p)}
        onToggleShift={() => setShift((p) => !p)}
        onStickyReset={() => {
          setCtrl(false);
          setAlt(false);
          setShift(false);
        }}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <QuickKeysWithState />,
};

export const CtrlActive: Story = {
  render: () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a2e" }}>
      <QuickKeys
        activeSessionId="test-session"
        send={(msg) => console.log("send:", msg)}
        stickyCtrl={true}
        stickyAlt={false}
        stickyShift={false}
        onToggleCtrl={() => {}}
        onToggleAlt={() => {}}
        onToggleShift={() => {}}
        onStickyReset={() => {}}
      />
    </div>
  ),
};

export const NoSession: Story = {
  render: () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a2e" }}>
      <QuickKeys
        activeSessionId={null}
        send={() => {}}
        stickyCtrl={false}
        stickyAlt={false}
        stickyShift={false}
        onToggleCtrl={() => {}}
        onToggleAlt={() => {}}
        onToggleShift={() => {}}
        onStickyReset={() => {}}
      />
    </div>
  ),
};

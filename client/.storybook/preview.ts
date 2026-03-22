import type { Preview } from "@storybook/react";
import "../src/i18n";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#121629" }],
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;

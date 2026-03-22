import { afterEach, describe, expect, it } from "vitest";

import { getAutoCommand, getFontSize, isBellNotificationEnabled } from "./settings-dialog";

describe("settings-dialog helpers", () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe("getAutoCommand", () => {
    it("returns empty string when no value is stored", () => {
      expect(getAutoCommand()).toBe("");
    });

    it("returns stored value", () => {
      localStorage.setItem("brc_auto_command", "claude --chat");
      expect(getAutoCommand()).toBe("claude --chat");
    });
  });

  describe("getFontSize", () => {
    it("returns default value 14 when no value is stored", () => {
      expect(getFontSize()).toBe(14);
    });

    it("returns stored value as a number", () => {
      localStorage.setItem("brc_font_size", "18");
      expect(getFontSize()).toBe(18);
    });

    it("returns NaN for invalid value (edge case)", () => {
      localStorage.setItem("brc_font_size", "abc");
      expect(getFontSize()).toBeNaN();
    });
  });

  describe("isBellNotificationEnabled", () => {
    it("returns false when no value is stored", () => {
      expect(isBellNotificationEnabled()).toBe(false);
    });

    it('returns true for "true" string', () => {
      localStorage.setItem("brc_bell_notification", "true");
      expect(isBellNotificationEnabled()).toBe(true);
    });

    it('returns false for "false" string', () => {
      localStorage.setItem("brc_bell_notification", "false");
      expect(isBellNotificationEnabled()).toBe(false);
    });
  });
});

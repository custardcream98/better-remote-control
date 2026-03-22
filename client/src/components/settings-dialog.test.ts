import { afterEach, describe, expect, it } from "vitest";

import { getAutoCommand, getFontSize, isBellNotificationEnabled } from "./settings-dialog";

describe("settings-dialog helpers", () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe("getAutoCommand", () => {
    it("값 없으면 빈 문자열 반환", () => {
      expect(getAutoCommand()).toBe("");
    });

    it("저장된 값 반환", () => {
      localStorage.setItem("brc_auto_command", "claude --chat");
      expect(getAutoCommand()).toBe("claude --chat");
    });
  });

  describe("getFontSize", () => {
    it("값 없으면 기본값 14 반환", () => {
      expect(getFontSize()).toBe(14);
    });

    it("저장된 값 숫자로 반환", () => {
      localStorage.setItem("brc_font_size", "18");
      expect(getFontSize()).toBe(18);
    });

    it("잘못된 값이면 NaN (엣지 케이스)", () => {
      localStorage.setItem("brc_font_size", "abc");
      expect(getFontSize()).toBeNaN();
    });
  });

  describe("isBellNotificationEnabled", () => {
    it("값 없으면 false", () => {
      expect(isBellNotificationEnabled()).toBe(false);
    });

    it('"true" 문자열이면 true', () => {
      localStorage.setItem("brc_bell_notification", "true");
      expect(isBellNotificationEnabled()).toBe(true);
    });

    it('"false" 문자열이면 false', () => {
      localStorage.setItem("brc_bell_notification", "false");
      expect(isBellNotificationEnabled()).toBe(false);
    });
  });
});

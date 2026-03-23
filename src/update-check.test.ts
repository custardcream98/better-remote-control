import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:os", () => ({
  homedir: () => "/mock/home",
}));

import { checkForUpdate } from "./update-check.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("checkForUpdate", () => {
  it("prints warning when newer version is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v99.0.0" }),
      }),
    );
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkForUpdate();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("New version available"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("v99.0.0"));
  });

  it("prints nothing when already on latest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v0.0.1" }),
      }),
    );
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkForUpdate();

    expect(spy).not.toHaveBeenCalled();
  });

  it("prints nothing on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkForUpdate();

    expect(spy).not.toHaveBeenCalled();
  });

  it("prints nothing on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await checkForUpdate();

    expect(spy).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn(() => ({ on: vi.fn() })),
  chmodSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock/home",
}));

vi.mock("node:stream/promises", () => ({
  pipeline: vi.fn(async () => {}),
}));

import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync } from "node:fs";

import { downloadCloudflared, findCloudflared, getDownloadInfo } from "./tunnel.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findCloudflared", () => {
  it("returns 'cloudflared' when found in system PATH", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("/usr/local/bin/cloudflared"));
    expect(findCloudflared()).toBe("cloudflared");
  });

  it("returns local path when not in PATH but exists in ~/.brc/bin/", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    vi.mocked(existsSync).mockReturnValue(true);
    expect(findCloudflared()).toMatch(/\.brc\/bin\/cloudflared/);
  });

  it("returns null when not found anywhere", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    vi.mocked(existsSync).mockReturnValue(false);
    expect(findCloudflared()).toBeNull();
  });

  it("prefers system PATH over local install", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(""));
    expect(findCloudflared()).toBe("cloudflared");
    expect(existsSync).not.toHaveBeenCalled();
  });
});

describe("getDownloadInfo", () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "arch", { value: originalArch });
  });

  it("returns compressed .tgz URL for macOS ARM64", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "arm64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-darwin-arm64.tgz");
    expect(info.compressed).toBe(true);
  });

  it("returns compressed .tgz URL for macOS x64", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "x64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-darwin-amd64.tgz");
    expect(info.compressed).toBe(true);
  });

  it("returns raw binary URL for Linux x64", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "x64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-linux-amd64");
    expect(info.url).not.toContain(".tgz");
    expect(info.compressed).toBe(false);
  });

  it("returns .exe URL for Windows x64", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    Object.defineProperty(process, "arch", { value: "x64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-windows-amd64.exe");
    expect(info.compressed).toBe(false);
  });

  it("throws on unsupported architecture", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "s390x" });
    expect(() => getDownloadInfo()).toThrow("Unsupported architecture");
  });

  it("throws on unsupported platform", () => {
    Object.defineProperty(process, "platform", { value: "freebsd" });
    Object.defineProperty(process, "arch", { value: "x64" });
    expect(() => getDownloadInfo()).toThrow("Unsupported platform");
  });
});

describe("downloadCloudflared", () => {
  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, body: null }));
    await expect(downloadCloudflared()).rejects.toThrow("Download failed (HTTP 404)");
  });

  it("creates ~/.brc/bin/ directory", async () => {
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0]));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: mockBody }));

    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "x64" });

    try {
      await downloadCloudflared();
    } catch {
      // may fail due to pipeline mock
    }

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining(".brc/bin"), {
      recursive: true,
    });
  });

  it("sets chmod 755 on non-Windows platforms", async () => {
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0]));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: mockBody }));

    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "x64" });

    await downloadCloudflared();

    expect(chmodSync).toHaveBeenCalledWith(expect.stringContaining("cloudflared"), 0o755);
  });
});

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
  it("시스템 PATH에 있으면 'cloudflared' 반환", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("/usr/local/bin/cloudflared"));
    expect(findCloudflared()).toBe("cloudflared");
  });

  it("PATH에 없고 ~/.brc/bin/에 있으면 로컬 경로 반환", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    vi.mocked(existsSync).mockReturnValue(true);
    expect(findCloudflared()).toMatch(/\.brc\/bin\/cloudflared/);
  });

  it("어디에도 없으면 null 반환", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    vi.mocked(existsSync).mockReturnValue(false);
    expect(findCloudflared()).toBeNull();
  });

  it("시스템 PATH에 있으면 로컬 경로 확인하지 않음", () => {
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

  it("macOS ARM64는 .tgz (compressed)", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "arm64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-darwin-arm64.tgz");
    expect(info.compressed).toBe(true);
  });

  it("macOS x64는 .tgz (compressed)", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "x64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-darwin-amd64.tgz");
    expect(info.compressed).toBe(true);
  });

  it("Linux x64는 raw binary (non-compressed)", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "x64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-linux-amd64");
    expect(info.url).not.toContain(".tgz");
    expect(info.compressed).toBe(false);
  });

  it("Windows x64는 .exe (non-compressed)", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    Object.defineProperty(process, "arch", { value: "x64" });
    const info = getDownloadInfo();
    expect(info.url).toContain("cloudflared-windows-amd64.exe");
    expect(info.compressed).toBe(false);
  });

  it("지원하지 않는 아키텍처면 에러", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "s390x" });
    expect(() => getDownloadInfo()).toThrow("Unsupported architecture");
  });

  it("지원하지 않는 플랫폼이면 에러", () => {
    Object.defineProperty(process, "platform", { value: "freebsd" });
    Object.defineProperty(process, "arch", { value: "x64" });
    expect(() => getDownloadInfo()).toThrow("Unsupported platform");
  });
});

describe("downloadCloudflared", () => {
  it("HTTP 에러 시 throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, body: null }));
    await expect(downloadCloudflared()).rejects.toThrow("Download failed (HTTP 404)");
  });

  it("~/.brc/bin/ 디렉토리 생성", async () => {
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0]));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: mockBody }));

    // non-compressed 플랫폼으로 설정
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "x64" });

    try {
      await downloadCloudflared();
    } catch {
      // pipeline mock으로 인해 실패할 수 있음
    }

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining(".brc/bin"), {
      recursive: true,
    });
  });

  it("Windows가 아니면 chmod 755 설정", async () => {
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

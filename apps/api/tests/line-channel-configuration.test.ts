import {afterEach,describe,expect,it,vi} from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("LINE Messaging API credentials preflight", () => {
  it("rejects channel ID accidentally supplied in the channel secret field", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_SECRET","2012381082");
    vi.stubEnv("LINE_OUTBOUND_MODE","disabled");
    vi.resetModules();
    await expect(import("../src/config.js")).rejects.toThrow();
  });

  it("accepts the correct 32-hex channel secret format", async () => {
    vi.stubEnv("LINE_MESSAGING_CHANNEL_SECRET","abcdef0123456789abcdef0123456789");
    vi.stubEnv("LINE_OUTBOUND_MODE","disabled");
    vi.resetModules();
    const {config} = await import("../src/config.js");
    expect(config.LINE_MESSAGING_CHANNEL_SECRET).toHaveLength(32);
  });
});

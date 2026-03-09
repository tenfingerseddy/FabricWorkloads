/**
 * Tests for the Scheduler — polling loop, cycle counting, and shutdown.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scheduler } from "../scheduler.ts";
import type { AppConfig } from "../config.ts";

// ── Helpers ─────────────────────────────────────────────────────────

function makeConfig(pollIntervalMs = 100): AppConfig {
  return {
    fabric: {
      tenantId: "t",
      clientId: "c",
      clientSecret: "s",
      apiBaseUrl: "https://api.test",
      tokenEndpoint: "https://login.test/token",
      scope: "https://api.test/.default",
      grantType: "client_credentials",
      kqlEndpoint: "https://kql.test",
    },
    kql: {
      queryEndpoint: "https://kql.test",
      ingestionEndpoint: "https://ingest.test",
      database: "TestDB",
      tokenScope: "https://kql.test/.default",
      tokenEndpoint: "https://login.test/token",
      enabled: false,
    },
    knownWorkspaces: [],
    dataDir: "/tmp/test-data",
    pollIntervalMs,
    slo: {
      minSuccessRate: 0.95,
      durationRegressionMultiplier: 2.0,
      maxFreshnessHours: 24,
    },
  };
}

describe("Scheduler", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an instance without starting", () => {
    const cycleFn = vi.fn();
    const scheduler = new Scheduler(makeConfig(), cycleFn);
    expect(scheduler).toBeDefined();
    expect(cycleFn).not.toHaveBeenCalled();
  });

  it("runs the cycle function on start and stops when cycleFn calls stop", async () => {
    let callCount = 0;
    const scheduler = new Scheduler(makeConfig(10), async () => {
      callCount++;
      // Stop after first cycle
      scheduler.stop();
    });

    await scheduler.start();
    expect(callCount).toBe(1);
  });

  it("runs multiple cycles before stopping", async () => {
    let callCount = 0;
    const scheduler = new Scheduler(makeConfig(10), async () => {
      callCount++;
      if (callCount >= 3) scheduler.stop();
    });

    await scheduler.start();
    expect(callCount).toBe(3);
  });

  it("continues running even when cycle throws", async () => {
    let callCount = 0;
    const scheduler = new Scheduler(makeConfig(10), async () => {
      callCount++;
      if (callCount === 1) throw new Error("Boom");
      if (callCount >= 2) scheduler.stop();
    });

    await scheduler.start();
    // Should have run at least 2 cycles despite first one throwing
    expect(callCount).toBe(2);
  });

  it("logs error when cycle throws", async () => {
    let callCount = 0;
    const scheduler = new Scheduler(makeConfig(10), async () => {
      callCount++;
      if (callCount === 1) throw new Error("Cycle failed");
      scheduler.stop();
    });

    await scheduler.start();
    expect(console.error).toHaveBeenCalled();
  });

  it("can be stopped before start", () => {
    const cycleFn = vi.fn();
    const scheduler = new Scheduler(makeConfig(), cycleFn);
    scheduler.stop();
    expect(cycleFn).not.toHaveBeenCalled();
  });

  it("logs scheduler start message", async () => {
    const scheduler = new Scheduler(makeConfig(10), async () => {
      scheduler.stop();
    });

    await scheduler.start();
    // Should have logged start message containing "Starting continuous monitoring"
    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const startMsg = logCalls.some((args: unknown[]) =>
      String(args[0]).includes("Starting continuous monitoring")
    );
    expect(startMsg).toBe(true);
  });

  it("logs cycle number and timing", async () => {
    const scheduler = new Scheduler(makeConfig(10), async () => {
      scheduler.stop();
    });

    await scheduler.start();
    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const cycleMsg = logCalls.some((args: unknown[]) =>
      String(args[0]).includes("Cycle #1")
    );
    expect(cycleMsg).toBe(true);
  });

  it("logs stopped message on exit", async () => {
    const scheduler = new Scheduler(makeConfig(10), async () => {
      scheduler.stop();
    });

    await scheduler.start();
    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const stopMsg = logCalls.some((args: unknown[]) =>
      String(args[0]).includes("Stopped")
    );
    expect(stopMsg).toBe(true);
  });
});

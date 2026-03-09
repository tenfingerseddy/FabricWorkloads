/**
 * Tests for src/store.ts -- ObservabilityStore
 *
 * Validates JSON file persistence, snapshot save/load, directory
 * creation, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ObservabilityStore } from "../store.ts";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CollectionResult } from "../collector.ts";

// ── Helpers ─────────────────────────────────────────────────────────

function makeResult(overrides?: Partial<CollectionResult>): CollectionResult {
  return {
    timestamp: new Date().toISOString(),
    workspaces: [],
    jobs: [],
    correlations: [],
    sloMetrics: [],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("ObservabilityStore", () => {
  let tempDir: string;
  let storeDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "obs-store-test-"));
    storeDir = join(tempDir, "data");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("init", () => {
    it("creates the data directory if it does not exist", async () => {
      const store = new ObservabilityStore(storeDir);
      await store.init();

      const files = await readdir(tempDir);
      expect(files).toContain("data");
    });

    it("succeeds if the directory already exists", async () => {
      const store = new ObservabilityStore(storeDir);
      await store.init();
      // Call again — should not throw
      await store.init();
    });
  });

  describe("save", () => {
    it("saves a snapshot to a timestamped file", async () => {
      const store = new ObservabilityStore(storeDir);
      const result = makeResult({
        timestamp: "2026-03-10T12:00:00.000Z",
      });

      const filepath = await store.save(result);

      expect(filepath).toContain("snapshot-");
      expect(filepath).toContain("2026-03-10T12-00-00-000Z");

      // Verify file contents
      const raw = await readFile(filepath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.timestamp).toBe("2026-03-10T12:00:00.000Z");
    });

    it("also writes a latest.json file", async () => {
      const store = new ObservabilityStore(storeDir);
      const result = makeResult({ timestamp: "2026-03-10T12:00:00.000Z" });

      await store.save(result);

      const latestPath = join(storeDir, "latest.json");
      const raw = await readFile(latestPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.timestamp).toBe("2026-03-10T12:00:00.000Z");
    });

    it("overwrites latest.json on each save", async () => {
      const store = new ObservabilityStore(storeDir);

      await store.save(makeResult({ timestamp: "2026-03-10T10:00:00.000Z" }));
      await store.save(makeResult({ timestamp: "2026-03-10T11:00:00.000Z" }));

      const latestPath = join(storeDir, "latest.json");
      const raw = await readFile(latestPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.timestamp).toBe("2026-03-10T11:00:00.000Z");
    });

    it("preserves full result data in the snapshot", async () => {
      const store = new ObservabilityStore(storeDir);
      const result = makeResult({
        timestamp: "2026-03-10T12:00:00.000Z",
        workspaces: [
          {
            workspace: {
              id: "ws-1",
              displayName: "Test Workspace",
              capacityId: "cap-1",
              state: "Active",
            } as any,
            items: [],
            collectedAt: "2026-03-10T12:00:00.000Z",
          },
        ],
      });

      const filepath = await store.save(result);
      const raw = await readFile(filepath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.workspaces).toHaveLength(1);
      expect(parsed.workspaces[0].workspace.displayName).toBe("Test Workspace");
    });
  });

  describe("loadLatest", () => {
    it("returns null when no data exists", async () => {
      const store = new ObservabilityStore(storeDir);
      await store.init();

      const result = await store.loadLatest();
      expect(result).toBeNull();
    });

    it("returns the most recently saved result", async () => {
      const store = new ObservabilityStore(storeDir);

      await store.save(makeResult({ timestamp: "2026-03-10T10:00:00.000Z" }));
      await store.save(makeResult({ timestamp: "2026-03-10T11:00:00.000Z" }));

      const latest = await store.loadLatest();
      expect(latest).not.toBeNull();
      expect(latest!.timestamp).toBe("2026-03-10T11:00:00.000Z");
    });
  });

  describe("loadAll", () => {
    it("returns empty array when no snapshots exist", async () => {
      const store = new ObservabilityStore(storeDir);
      await store.init();

      const all = await store.loadAll();
      expect(all).toEqual([]);
    });

    it("returns snapshots sorted oldest-first", async () => {
      const store = new ObservabilityStore(storeDir);

      await store.save(makeResult({ timestamp: "2026-03-10T12:00:00.000Z" }));
      await store.save(makeResult({ timestamp: "2026-03-10T10:00:00.000Z" }));
      await store.save(makeResult({ timestamp: "2026-03-10T11:00:00.000Z" }));

      const all = await store.loadAll();
      expect(all).toHaveLength(3);
      // Sorted by filename (which encodes timestamp) — oldest first
      expect(all[0].timestamp).toBe("2026-03-10T10:00:00.000Z");
      expect(all[1].timestamp).toBe("2026-03-10T11:00:00.000Z");
      expect(all[2].timestamp).toBe("2026-03-10T12:00:00.000Z");
    });

    it("ignores non-snapshot files (e.g., latest.json)", async () => {
      const store = new ObservabilityStore(storeDir);
      await store.save(makeResult({ timestamp: "2026-03-10T12:00:00.000Z" }));

      // latest.json also exists but loadAll should only return snapshot-* files
      const all = await store.loadAll();
      expect(all).toHaveLength(1);
    });
  });

  describe("loadRecent", () => {
    it("returns the last N snapshots", async () => {
      const store = new ObservabilityStore(storeDir);

      for (let i = 1; i <= 5; i++) {
        await store.save(
          makeResult({ timestamp: `2026-03-10T${String(i).padStart(2, "0")}:00:00.000Z` })
        );
      }

      const recent = await store.loadRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].timestamp).toBe("2026-03-10T04:00:00.000Z");
      expect(recent[1].timestamp).toBe("2026-03-10T05:00:00.000Z");
    });

    it("returns all snapshots if N exceeds count", async () => {
      const store = new ObservabilityStore(storeDir);
      await store.save(makeResult({ timestamp: "2026-03-10T12:00:00.000Z" }));

      const recent = await store.loadRecent(100);
      expect(recent).toHaveLength(1);
    });
  });

  describe("getDataDir", () => {
    it("returns the configured data directory path", () => {
      const store = new ObservabilityStore("/some/path");
      expect(store.getDataDir()).toBe("/some/path");
    });
  });
});

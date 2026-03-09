/**
 * Observability Workbench - Local JSON File Store
 *
 * Persists collection results to disk as JSON files.
 * Provides retrieval of historical snapshots for trend analysis.
 */

import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { CollectionResult } from "./collector.ts";

export class ObservabilityStore {
  private readonly dir: string;

  constructor(dataDir: string) {
    this.dir = dataDir;
  }

  /**
   * Ensure the data directory exists.
   */
  async init(): Promise<void> {
    try {
      await stat(this.dir);
    } catch {
      await mkdir(this.dir, { recursive: true });
    }
  }

  /**
   * Save a collection result. Filename encodes the ISO timestamp.
   */
  async save(result: CollectionResult): Promise<string> {
    await this.init();
    const safeTs = result.timestamp.replace(/[:.]/g, "-");
    const filename = `snapshot-${safeTs}.json`;
    const filepath = join(this.dir, filename);
    await writeFile(filepath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`[store] Saved snapshot to ${filepath}`);

    // Also write a "latest" symlink-like file
    const latestPath = join(this.dir, "latest.json");
    await writeFile(latestPath, JSON.stringify(result, null, 2), "utf-8");

    return filepath;
  }

  /**
   * Load the latest collection result.
   */
  async loadLatest(): Promise<CollectionResult | null> {
    try {
      const latestPath = join(this.dir, "latest.json");
      const raw = await readFile(latestPath, "utf-8");
      return JSON.parse(raw) as CollectionResult;
    } catch {
      return null;
    }
  }

  /**
   * Load all snapshots, sorted oldest-first.
   */
  async loadAll(): Promise<CollectionResult[]> {
    await this.init();
    const files = await readdir(this.dir);
    const snapshotFiles = files
      .filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
      .sort();

    const results: CollectionResult[] = [];
    for (const file of snapshotFiles) {
      try {
        const raw = await readFile(join(this.dir, file), "utf-8");
        results.push(JSON.parse(raw));
      } catch (err: any) {
        console.warn(`[store] Failed to parse ${file}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Load the last N snapshots (most recent last).
   */
  async loadRecent(n: number): Promise<CollectionResult[]> {
    const all = await this.loadAll();
    return all.slice(-n);
  }

  /**
   * Get the path to the data directory.
   */
  getDataDir(): string {
    return this.dir;
  }
}

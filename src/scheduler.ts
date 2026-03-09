/**
 * Observability Workbench - Polling Scheduler
 *
 * Runs the collection-analysis-dashboard cycle on a configurable interval.
 * Handles graceful shutdown on SIGINT/SIGTERM.
 */

import chalk from "chalk";
import type { AppConfig } from "./config.ts";

export type CycleFunction = () => Promise<void>;

export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private shuttingDown = false;
  private cycleCount = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly cycleFn: CycleFunction
  ) {}

  /**
   * Start the polling loop. Runs one cycle immediately, then repeats.
   */
  async start(): Promise<void> {
    this.running = true;
    this.registerShutdownHandlers();

    console.log(
      chalk.bold.blue(
        `\n[scheduler] Starting continuous monitoring (interval: ${this.config.pollIntervalMs / 1000}s)`
      )
    );
    console.log(chalk.gray("[scheduler] Press Ctrl+C to stop\n"));

    while (this.running && !this.shuttingDown) {
      this.cycleCount++;
      const cycleStart = Date.now();
      console.log(
        chalk.blue(
          `\n[scheduler] ── Cycle #${this.cycleCount} starting at ${new Date().toLocaleTimeString()} ──`
        )
      );

      try {
        await this.cycleFn();
      } catch (err: any) {
        console.error(
          chalk.red(`[scheduler] Cycle #${this.cycleCount} failed: ${err.message}`)
        );
        if (err.stack) {
          console.error(chalk.gray(err.stack));
        }
      }

      const elapsed = Date.now() - cycleStart;
      const waitMs = Math.max(0, this.config.pollIntervalMs - elapsed);
      console.log(
        chalk.gray(
          `[scheduler] Cycle completed in ${(elapsed / 1000).toFixed(1)}s. Next cycle in ${(waitMs / 1000).toFixed(0)}s`
        )
      );

      if (this.running && !this.shuttingDown) {
        await this.sleep(waitMs);
      }
    }

    console.log(chalk.blue("\n[scheduler] Stopped."));
  }

  /**
   * Stop the scheduler gracefully.
   */
  stop(): void {
    this.running = false;
    this.shuttingDown = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }

  private registerShutdownHandlers(): void {
    const handler = () => {
      console.log(
        chalk.yellow("\n[scheduler] Shutdown signal received, finishing current cycle...")
      );
      this.stop();
    };

    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
  }
}

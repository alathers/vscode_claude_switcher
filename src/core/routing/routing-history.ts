/**
 * Routing History - Persist routing decisions to GlobalStorage
 *
 * Tracks routing decisions with 30-day detailed retention and monthly rollups.
 * Partitioned storage by date for efficient cleanup.
 */

import * as vscode from 'vscode';

/**
 * GlobalStorage routing records directory path
 */
export const ROUTING_RECORDS_DIR = 'routing-records/';

/**
 * Generate a UUID v4 (simple implementation)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


/**
 * Model source for routing decision
 */
export type ModelSource = 'subscription' | 'api-credits' | 'ollama';

/**
 * Routing decision record
 */
export interface RoutingDecision {
  id: string; // UUID
  timestamp: string; // ISO 8601 string
  routedTo: ModelSource;
  taskType: string;
  requestId?: string;
  quotaBefore: number;
  quotaAfter: number;
  reason: string;
  performance?: {
    latencyMs: number;
    circuitBreakerState?: 'closed' | 'open' | 'half-open';
  };
}

/**
 * Monthly rollup structure
 */
export interface MonthlyRollup {
  month: string; // YYYY-MM
  totalRequests: number;
  usageBySource: {
    subscription: number;
    apiCredits: number;
    ollama: number;
  };
  usageByTaskType: Record<string, number>;
  totalLatencyMs: number;
  averageLatencyMs: number;
}

/**
 * Routing history manager
 */
export class RoutingHistoryManager {
  constructor(private readonly globalState: vscode.ExtensionContext['globalState']) {}

  /**
   * Get routing records directory path
   */
  private getRecordsDir(): string {
    return `${ROUTING_RECORDS_DIR}daily/`;
  }

  /**
   * Get daily file path
   */
  private getDailyFilePath(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return `${this.getRecordsDir()}/${dateStr}.json`;
  }

  /**
   * Get monthly rollup path
   */
  private getMonthlyRollupPath(year: number, month: number): string {
    return `${ROUTING_RECORDS_DIR}monthly/${year}-${String(month + 1).padStart(2, '0')}.json`;
  }

  /**
   * Write a routing decision to daily records
   */
  async writeDecision(decision: Omit<RoutingDecision, 'id' | 'timestamp'>): Promise<string> {
    const id = generateUUID();
    const timestamp = new Date().toISOString();
    const fullDecision: RoutingDecision = {
      id,
      timestamp,
      ...decision
    };

    const filePath = this.getDailyFilePath(new Date());

    // Read existing records for today
    const existingRecords = await this.readDailyRecords(filePath);

    // Add new decision
    existingRecords.push(fullDecision);

    // Write back to global state
    await this.globalState.update(filePath, existingRecords);

    return id;
  }

  /**
   * Read daily records for a specific date
   */
  async readDailyRecords(filePath: string): Promise<RoutingDecision[]> {
    const records = this.globalState.get<RoutingDecision[]>(filePath, []);
    return records;
  }

  /**
   * Read daily records for a specific date (by Date object)
   */
  async readDecision(date: Date): Promise<RoutingDecision[]> {
    const filePath = this.getDailyFilePath(date);
    return this.readDailyRecords(filePath);
  }

  /**
   * Create monthly rollup from daily records (T056)
   *
   * Aggregates all daily records for the specified month into a monthly summary.
   */
  async createMonthlyRollup(year: number, month: number): Promise<MonthlyRollup> {
    const rollup: MonthlyRollup = {
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      totalRequests: 0,
      usageBySource: {
        subscription: 0,
        apiCredits: 0,
        ollama: 0
      },
      usageByTaskType: {},
      totalLatencyMs: 0,
      averageLatencyMs: 0
    };

    // Aggregate daily records for the month
    // Day 1 to last day of month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const records = await this.readDecision(date);

      // Aggregate each record into rollup
      for (const record of records) {
        rollup.totalRequests++;

        // Count by source (note: record.routedTo uses kebab-case, rollup uses camelCase)
        if (record.routedTo === 'subscription') {
          rollup.usageBySource.subscription++;
        } else if (record.routedTo === 'api-credits') {
          rollup.usageBySource.apiCredits++;
        } else if (record.routedTo === 'ollama') {
          rollup.usageBySource.ollama++;
        }

        // Count by task type
        rollup.usageByTaskType[record.taskType] ??= 0;
        rollup.usageByTaskType[record.taskType]++;

        // Aggregate latency
        if (record.performance?.latencyMs) {
          rollup.totalLatencyMs += record.performance.latencyMs;
        }
      }
    }

    // Calculate average latency
    if (rollup.totalRequests > 0) {
      rollup.averageLatencyMs = Math.round(rollup.totalLatencyMs / rollup.totalRequests);
    }

    return rollup;
  }

  /**
   * Store monthly rollup to globalState (T056)
   */
  async storeMonthlyRollup(year: number, month: number, rollup: MonthlyRollup): Promise<void> {
    const key = this.getMonthlyRollupPath(year, month);
    await this.globalState.update(key, rollup);
  }

  /**
   * Delete daily records older than specified days (T056)
   * Called on extension startup
   */
  async deleteDailyFiles(olderThanDays: number = 30): Promise<void> {
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Track months that need rollups before deletion
    const monthsToRollup = new Set<string>();

    // Get all keys from globalState that match routing-records/daily pattern
    const allKeys = this.globalState.keys();
    const dailyKeys = allKeys.filter(key => key.startsWith(this.getRecordsDir()));

    for (const key of dailyKeys) {
      // Extract date from file path (e.g., routing-records/daily/2024-01-15.json)
      const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
      if (!dateMatch) {
        continue;
      }

      const fileDate = new Date(dateMatch[1]);

      // Check if file is older than cutoff date
      if (fileDate < cutoffDate) {
        // Track month for rollup
        const month = `${fileDate.getFullYear()}-${String(fileDate.getMonth() + 1).padStart(2, '0')}`;
        monthsToRollup.add(month);

        // Delete the old daily record
        await this.globalState.update(key, undefined);
        console.log(`[RoutingHistory] Deleted old daily record: ${key}`);
      }
    }

    // Create monthly rollups for cleaned up months
    for (const month of monthsToRollup) {
      const [year, monthStr] = month.split('-').map(Number);
      try {
        // Create and store the monthly rollup
        const rollup = await this.createMonthlyRollup(year, monthStr - 1);
        await this.storeMonthlyRollup(year, monthStr - 1, rollup);
        console.log(`[RoutingHistory] Created and stored monthly rollup for ${month}: ${rollup.totalRequests} requests`);
      } catch (error) {
        console.error(`[RoutingHistory] Failed to create monthly rollup for ${month}:`, error);
      }
    }
  }

  /**
   * Get recent routing decisions (last N)
   */
  async getRecentDecisions(count: number = 10): Promise<RoutingDecision[]> {
    const allDecisions: RoutingDecision[] = [];

    // Read last few days of records
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const records = await this.readDecision(date);
      allDecisions.push(...records);
    }

    // Sort by timestamp descending
    allDecisions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Return N most recent
    return allDecisions.slice(0, count);
  }

  /**
   * Get all decisions for export
   */
  async getAllDecisionsForExport(): Promise<RoutingDecision[]> {
    const allDecisions: RoutingDecision[] = [];

    // Read all daily records (30 days)
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const records = await this.readDecision(date);
      allDecisions.push(...records);
    }

    // Sort by timestamp ascending
    allDecisions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return allDecisions;
  }

  /**
   * Cleanup old records on extension startup (T056)
   *
   * Removes daily records older than 30 days and creates monthly rollups.
   */
  async cleanupOldRecords(olderThanDays: number = 30): Promise<void> {
    await this.deleteDailyFiles(olderThanDays);
  }
}

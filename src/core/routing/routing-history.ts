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
   * Create monthly rollup from 30-day records
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

    // TODO: Implement aggregation from daily records
    // This will read all daily records for the month and aggregate them

    return rollup;
  }

  /**
   * Delete daily records older than specified days
   * Called on extension startup
   */
  async deleteDailyFiles(_olderThanDays: number = 30): Promise<void> {
    // TODO: Implement cleanup of old daily records
    // This reads all keys matching routing-records/daily/*.json
    // and deletes files older than olderThanDays

    // Implementation will be completed in Phase 7 (T056, T057)
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
}

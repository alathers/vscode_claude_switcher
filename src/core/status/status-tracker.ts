/**
 * src/core/status/status-tracker.ts
 *
 * Status Tracker
 *
 * Endpoint connectivity status tracking, latency monitoring (no VS Code API imports).
 */

export type EndpointStatus = 'untested' | 'connected' | 'unreachable';

export interface ConnectivityCheck {
  (): Promise<ConnectivityResult>;
}

export interface ConnectivityResult {
  success: boolean;
  latency?: number;
  error?: string;
}

export interface EndpointStatusRecord {
  status: EndpointStatus;
  latency?: number;
  lastChecked?: Date;
  latencyHistory: number[];
}

export interface StatusTrackerSummary {
  total: number;
  connected: number;
  unreachable: number;
  untested: number;
}

export interface StatusTrackerConfig {
  historySize?: number;
  cacheTTL?: number;
}

export class StatusTracker {
  private statuses: Map<string, EndpointStatusRecord> = new Map();
  private historySize: number;
  private cacheTTL: number;

  constructor(config: StatusTrackerConfig = {}) {
    this.historySize = config.historySize ?? 10;
    this.cacheTTL = config.cacheTTL ?? 0;
  }

  /**
   * Initializes tracking for an endpoint.
   */
  public initialize(endpointId: string): void {
    if (!this.statuses.has(endpointId)) {
      this.statuses.set(endpointId, {
        status: 'untested',
        latencyHistory: [],
      });
    }
  }

  /**
   * Gets status for an endpoint.
   */
  public getStatus(endpointId: string): EndpointStatus {
    const record = this.statuses.get(endpointId);
    if (!record) {
      return 'untested';
    }

    if (this.cacheTTL > 0 && record.lastChecked) {
      const age = Date.now() - record.lastChecked.getTime();
      if (age > this.cacheTTL) {
        return 'untested';
      }
    }

    return record.status;
  }

  /**
   * Updates status for an endpoint.
   */
  public updateStatus(endpointId: string, status: EndpointStatus): void {
    const record = this.statuses.get(endpointId) ?? {
      status: 'untested',
      latencyHistory: [],
    };

    record.status = status;
    record.lastChecked = new Date();
    this.statuses.set(endpointId, record);
  }

  /**
   * Records latency for an endpoint and marks as connected.
   */
  public recordLatency(endpointId: string, latencyMs: number): void {
    let record = this.statuses.get(endpointId);
    if (!record) {
      this.initialize(endpointId);
      record = this.statuses.get(endpointId);
      if (!record) {
        // Should never happen, but type safety requires this check
        return;
      }
    }

    record.latency = latencyMs;
    record.latencyHistory.push(latencyMs);

    // Maintain history size limit
    while (record.latencyHistory.length > this.historySize) {
      record.latencyHistory.shift();
    }

    record.status = 'connected';
    record.lastChecked = new Date();
  }

  /**
   * Gets latency for an endpoint.
   */
  public getLatency(endpointId: string): number | undefined {
    return this.statuses.get(endpointId)?.latency;
  }

  /**
   * Gets latency history for an endpoint.
   */
  public getLatencyHistory(endpointId: string): number[] {
    const record = this.statuses.get(endpointId);
    return record ? [...record.latencyHistory] : [];
  }

  /**
   * Gets average latency for an endpoint.
   */
  public getAverageLatency(endpointId: string): number | undefined {
    const record = this.statuses.get(endpointId);
    if (!record || record.latencyHistory.length === 0) {
      return undefined;
    }

    const sum = record.latencyHistory.reduce((acc, val) => acc + val, 0);
    return sum / record.latencyHistory.length;
  }

  /**
   * Gets last checked timestamp.
   */
  public getLastChecked(endpointId: string): Date | undefined {
    return this.statuses.get(endpointId)?.lastChecked;
  }

  /**
   * Gets all statuses.
   */
  public getAllStatuses(): Record<string, EndpointStatus> {
    const result: Record<string, EndpointStatus> = {};
    for (const [id, record] of this.statuses.entries()) {
      result[id] = record.status;
    }
    return result;
  }

  /**
   * Performs connectivity check for an endpoint.
   */
  public async checkConnectivity(
    endpointId: string,
    check: ConnectivityCheck
  ): Promise<ConnectivityResult> {
    try {
      const result = await check();

      if (result.success) {
        this.recordLatency(endpointId, result.latency ?? 0);
      } else {
        this.updateStatus(endpointId, 'unreachable');
      }

      return result;
    } catch (error) {
      this.updateStatus(endpointId, 'unreachable');
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Checks connectivity for multiple endpoints.
   */
  public async checkAll(
    endpointIds: string[],
    check: ConnectivityCheck
  ): Promise<ConnectivityResult[]> {
    const promises = endpointIds.map((id) => this.checkConnectivity(id, check));
    return Promise.all(promises);
  }

  /**
   * Gets summary of all endpoints.
   */
  public getSummary(): StatusTrackerSummary {
    let connected = 0;
    let unreachable = 0;
    let untested = 0;

    for (const record of this.statuses.values()) {
      switch (record.status) {
        case 'connected':
          connected++;
          break;
        case 'unreachable':
          unreachable++;
          break;
        case 'untested':
          untested++;
          break;
      }
    }

    return {
      total: this.statuses.size,
      connected,
      unreachable,
      untested,
    };
  }

  /**
   * Checks if endpoint is connected.
   */
  public isConnected(endpointId: string): boolean {
    return this.getStatus(endpointId) === 'connected';
  }

  /**
   * Checks if endpoint is unreachable.
   */
  public isUnreachable(endpointId: string): boolean {
    return this.getStatus(endpointId) === 'unreachable';
  }

  /**
   * Checks if endpoint is untested.
   */
  public isUntested(endpointId: string): boolean {
    return this.statuses.has(endpointId) && this.getStatus(endpointId) === 'untested';
  }

  /**
   * Removes endpoint from tracking.
   */
  public remove(endpointId: string): void {
    this.statuses.delete(endpointId);
  }

  /**
   * Clears all tracked data.
   */
  public clear(): void {
    this.statuses.clear();
  }
}

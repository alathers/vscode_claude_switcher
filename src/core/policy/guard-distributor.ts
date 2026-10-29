/**
 * src/core/policy/guard-distributor.ts
 *
 * Guard Distributor
 *
 * Approval flow, timeout tracking, and multi-approver logic.
 * This file contains NO VS Code API imports - pure TypeScript logic.
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Request status enum.
 */
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired';

/**
 * Guard distributor configuration.
 */
export interface GuardDistributorConfig {
  defaultTimeoutMinutes?: number;
  requireSecondApprover?: boolean;
  resolvedRetentionMinutes?: number;
}

/**
 * Pending request registration data.
 */
export interface PendingRequestData {
  requestId: string;
  destination: string;
  sessionId: string;
  profileId: string;
  requestedAt: number;
}

/**
 * Approval metadata.
 */
export interface ApprovalMetadata {
  approvedBy: string;
  reason?: string;
  timestamp?: number;
}

/**
 * Denial metadata.
 */
export interface DenialMetadata {
  deniedBy: string;
  reason?: string;
}

/**
 * Approval history entry.
 */
export interface ApprovalHistoryEntry {
  approver: string;
  reason?: string;
  timestamp: number;
}

/**
 * Guarded request.
 */
export interface GuardedRequest {
  requestId: string;
  destination: string;
  sessionId: string;
  profileId: string;
  requestedAt: number;
  status: RequestStatus;
  approvedBy?: string;
  approvedAt?: number;
  deniedBy?: string;
  deniedAt?: number;
  reason?: string;
  approvers?: string[];
  approvalHistory?: ApprovalHistoryEntry[];
}

/**
 * Approve request result.
 */
export interface ApproveRequestResult {
  success: boolean;
  approved: {
    requestId: string;
    destination: string;
    approvedAt: number;
  };
  fullyApproved?: boolean;
}

/**
 * Deny request result.
 */
export interface DenyRequestResult {
  success: boolean;
  denied: {
    requestId: string;
    deniedAt: number;
  };
}

// ============================================================
// GUARD DISTRIBUTOR CLASS
// ============================================================

/**
 * Guard Distributor
 *
 * Manages approval flow, timeout tracking, and multi-approver logic for guarded mode requests.
 *
 * Key responsibilities:
 * - Register pending cloud model requests
 * - Track approval state and metadata
 * - Support auto-revert timeout
 * - Support requireSecondApprover when configured
 * - Query pending, expired, or session-specific requests
 * - Clean up expired and resolved requests
 *
 * Per-user visibility only - no cross-user tracking per FR-044 clarification.
 */
export class GuardDistributor {
  private config: Required<GuardDistributorConfig>;
  private pendingRequests: Map<string, GuardedRequest>;

  constructor(config: GuardDistributorConfig = {}) {
    this.config = {
      defaultTimeoutMinutes: config.defaultTimeoutMinutes ?? 5,
      requireSecondApprover: config.requireSecondApprover ?? false,
      resolvedRetentionMinutes: config.resolvedRetentionMinutes ?? 60,
    };

    this.pendingRequests = new Map();
  }

  // ============================================================
  // REQUEST REGISTRATION
  // ============================================================

  /**
   * Register a pending cloud model request.
   *
   * @param data - Request registration data
   * @throws Error if requestId is invalid or duplicate
   */
  registerRequest(data: PendingRequestData): void {
    if (!data.requestId || data.requestId.trim() === '') {
      throw new Error('Invalid requestId: cannot be empty');
    }

    if (this.pendingRequests.has(data.requestId)) {
      throw new Error(`Duplicate request ID: ${data.requestId}`);
    }

    const request: GuardedRequest = {
      requestId: data.requestId,
      destination: data.destination,
      sessionId: data.sessionId,
      profileId: data.profileId,
      requestedAt: data.requestedAt,
      status: 'pending',
    };

    this.pendingRequests.set(data.requestId, request);
  }

  // ============================================================
  // REQUEST APPROVAL
  // ============================================================

  /**
   * Approve a pending cloud model request.
   *
   * @param requestId - Request ID to approve
   * @param metadata - Approval metadata
   * @returns Approval result
   * @throws Error if request not found or not pending
   */
  approveRequest(requestId: string, metadata: ApprovalMetadata): ApproveRequestResult {
    const request = this.getRequestOrThrowForApproval(requestId);

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not in pending state`);
    }

    // Check if already approved by this user
    if (request.approvers?.includes(metadata.approvedBy)) {
      throw new Error(`User ${metadata.approvedBy} has already approved this request`);
    }

    // Track approval
    const timestamp = Date.now();
    request.approvers ??= [];
    request.approvers.push(metadata.approvedBy);

    request.approvalHistory ??= [];
    request.approvalHistory.push({
      approver: metadata.approvedBy,
      reason: metadata.reason,
      timestamp,
    });

    // Determine if fully approved
    let fullyApproved = !this.config.requireSecondApprover;
    if (this.config.requireSecondApprover && request.approvers.length >= 2) {
      fullyApproved = true;
      request.status = 'approved';
      request.approvedBy = metadata.approvedBy;
      request.approvedAt = timestamp;
      request.reason = metadata.reason;
    }

    if (!this.config.requireSecondApprover && request.approvers.length === 1) {
      request.status = 'approved';
      request.approvedBy = metadata.approvedBy;
      request.approvedAt = timestamp;
      request.reason = metadata.reason;
      fullyApproved = true;
    }

    this.pendingRequests.set(requestId, request);

    return {
      success: true,
      approved: {
        requestId,
        destination: request.destination,
        approvedAt: timestamp,
      },
      fullyApproved,
    };
  }

  /**
   * Deny a pending cloud model request.
   *
   * @param requestId - Request ID to deny
   * @param metadata - Denial metadata
   * @returns Denial result
   * @throws Error if request not found or not pending
   */
  denyRequest(requestId: string, metadata: DenialMetadata): DenyRequestResult {
    const request = this.getRequestOrThrowForApproval(requestId);

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not in pending state`);
    }

    const timestamp = Date.now();

    request.status = 'denied';
    request.deniedBy = metadata.deniedBy;
    request.deniedAt = timestamp;
    request.reason = metadata.reason;

    this.pendingRequests.set(requestId, request);

    return {
      success: true,
      denied: {
        requestId,
        deniedAt: timestamp,
      },
    };
  }

  // ============================================================
  // REQUEST QUERY
  // ============================================================

  /**
   * Get a specific request by ID.
   *
   * @param requestId - Request ID to retrieve
   * @returns Guarded request or undefined if not found
   */
  getRequest(requestId: string): GuardedRequest | undefined {
    this.cleanup(); // Auto-cleanup before query

    return this.pendingRequests.get(requestId);
  }

  /**
   * Get all pending requests.
   *
   * @returns Array of pending requests
   */
  getPendingRequests(): GuardedRequest[] {
    this.cleanup();

    const allRequests: GuardedRequest[] = [];

    for (const request of this.pendingRequests.values()) {
      if (request.status === 'pending') {
        allRequests.push(request);
      }
    }

    return allRequests;
  }

  /**
   * Get requests for a specific session.
   *
   * @param sessionId - Session ID
   * @returns Array of requests for the session
   */
  getRequestsBySession(sessionId: string): GuardedRequest[] {
    this.cleanup();

    const sessionRequests: GuardedRequest[] = [];

    for (const request of this.pendingRequests.values()) {
      if (request.sessionId === sessionId) {
        sessionRequests.push(request);
      }
    }

    return sessionRequests;
  }

  /**
   * Get expired requests.
   *
   * @returns Array of expired requests
   */
  getExpiredRequests(): GuardedRequest[] {
    this.cleanup();

    const expiredRequests: GuardedRequest[] = [];

    for (const request of this.pendingRequests.values()) {
      if (request.status === 'expired') {
        expiredRequests.push(request);
      }
    }

    return expiredRequests;
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /**
   * Remove expired pending requests.
   *
   * @returns Array of removed request IDs
   */
  cleanupExpired(): string[] {
    const now = Date.now();
    const removed: string[] = [];

    for (const [requestId, request] of this.pendingRequests.entries()) {
      // Cleanup expired requests
      const shouldCleanup =
        request.status === 'expired' ||
        (request.status === 'pending' &&
          (now - request.requestedAt) / (1000 * 60) > this.config.defaultTimeoutMinutes);

      if (shouldCleanup) {
        this.pendingRequests.delete(requestId);
        removed.push(requestId);
      }
    }

    return removed;
  }

  /**
   * Clean up expired and resolved requests.
   *
   * This method is called automatically before query operations.
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [requestId, request] of this.pendingRequests.entries()) {
      const ageMinutes = (now - request.requestedAt) / (1000 * 60);

      // Auto-expire pending requests
      if (request.status === 'pending') {
        const shouldExpire = ageMinutes > this.config.defaultTimeoutMinutes;

        if (shouldExpire) {
          request.status = 'expired';
          this.pendingRequests.set(requestId, request);
        }
      }

      // Cleanup resolved requests after retention period
      if (request.status === 'approved' || request.status === 'denied') {
        if (ageMinutes > this.config.resolvedRetentionMinutes) {
          toDelete.push(requestId);
        }
      }
    }

    for (const requestId of toDelete) {
      this.pendingRequests.delete(requestId);
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Get request or throw error (for approval operations where request must exist).
   *
   * @param requestId - Request ID
   * @returns Guarded request
   * @throws Error if request not found
   */
  private getRequestOrThrowForApproval(requestId: string): GuardedRequest {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }
    return request;
  }
}

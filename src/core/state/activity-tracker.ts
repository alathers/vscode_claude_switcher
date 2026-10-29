/**
 * src/core/state/activity-tracker.ts
 *
 * Activity Tracker
 *
 * Tracks concurrent sessions, detects conflicts, and manages activity ledger.
 * This file contains NO VS Code API imports - pure TypeScript logic.
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Session type enum.
 */
export type SessionType = 'managed' | 'external';

/**
 * Session state enum (shared with state-machine).
 */
export type SessionState = 'initializing' | 'active' | 'idle' | 'switching' | 'terminated';

/**
 * Conflict risk level enum.
 */
export type ConflictRisk = 'low' | 'medium' | 'high';

/**
 * Change type enum.
 */
export type ChangeType = 'create' | 'modify' | 'delete';

/**
 * Provider class enum.
 */
export type ProviderClass = 'local' | 'private-network' | 'cloud';

/**
 * Change record for recent modifications.
 */
export interface Change {
  id: string;
  filePath: string;
  changeType: ChangeType;
  timestamp: number;
}

/**
 * Session data.
 */
export interface Session {
  sessionId: string;
  profileId: string;
  sessionType: SessionType;
  state: SessionState;
  startTime: number;
  lastActivity: number;
  activeFiles: string[];
  activeCommands: string[];
  conflictRisk: ConflictRisk;
  recentChanges: Change[];
  providerClass: ProviderClass;
}

/**
 * Conflict detection result.
 */
export interface Conflict {
  sessions: string[];
  conflictingFiles: string[];
}

/**
 * Activity ledger entry.
 */
export interface ActivityLedgerEntry {
  sessionId: string;
  profileId: string;
  label: string;
  state: SessionState;
  knownFiles: string[];
  knownCommands: string[];
  recentChanges: Change[];
  conflictRisk: ConflictRisk;
  lastUpdated: number;
  providerClass: ProviderClass;
}

/**
 * Activity ledger filter options.
 */
export interface LedgerFilter {
  states?: SessionState[];
  profileIds?: string[];
  providerClasses?: ProviderClass[];
}

// ============================================================
// ACTIVITY TRACKER CLASS
// ============================================================

/**
 * Activity Tracker
 *
 * Tracks concurrent sessions, detects file/command conflicts, and generates activity ledger.
 *
 * Key responsibilities:
 * - Register and track concurrent sessions
 * - Monitor active files and commands per session
 * - Detect overlapping file paths across sessions
 * - Calculate conflict risk levels (low/medium/high)
 * - Generate activity ledger for display
 *
 * Per-user visibility only - no cross-user tracking per FR-062 clarification.
 */
export class ActivityTracker {
  private sessions = new Map<string, Session>();

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  /**
   * Register a new session.
   *
   * @param session - Session data to register
   * @throws Error if session ID already exists
   */
  registerSession(session: Session): void {
    if (this.sessions.has(session.sessionId)) {
      throw new Error(`Session '${session.sessionId}' already registered`);
    }

    // Validate required fields
    if (!session.activeFiles) {
      session.activeFiles = [];
    }
    if (!session.activeCommands) {
      session.activeCommands = [];
    }
    if (!session.conflictRisk) {
      session.conflictRisk = 'low';
    }
    if (!session.recentChanges) {
      session.recentChanges = [];
    }

    this.sessions.set(session.sessionId, { ...session });
  }

  /**
   * Get session data by session ID.
   *
   * @param sessionId - Session identifier
   * @returns Session data
   * @throws Error if session not found
   */
  getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Update session state.
   *
   * @param sessionId - Session identifier
   * @param newState - New session state
   * @throws Error if session not found
   */
  updateSessionState(sessionId: string, newState: SessionState): void {
    const session = this.getSession(sessionId);
    session.state = newState;
  }

  /**
   * Update active files for a session.
   *
   * @param sessionId - Session identifier
   * @param files - Array of active file paths
   * @throws Error if session not found
   */
  updateActiveFiles(sessionId: string, files: string[]): void {
    const session = this.getSession(sessionId);
    session.activeFiles = files;
  }

  /**
   * Update active commands for a session.
   *
   * @param sessionId - Session identifier
   * @param commands - Array of active commands
   * @throws Error if session not found
   */
  updateActiveCommands(sessionId: string, commands: string[]): void {
    const session = this.getSession(sessionId);
    session.activeCommands = commands;
  }

  /**
   * Update last activity timestamp for a session.
   *
   * @param sessionId - Session identifier
   * @param timestamp - Activity timestamp (defaults to current time)
   * @throws Error if session not found
   */
  updateActivity(sessionId: string, timestamp: number = Date.now()): void {
    const session = this.getSession(sessionId);
    session.lastActivity = timestamp;
  }

  /**
   * Update conflict risk level for a session.
   *
   * @param sessionId - Session identifier
   * @param risk - Conflict risk level
   * @throws Error if session not found
   */
  updateConflictRisk(sessionId: string, risk: ConflictRisk): void {
    const session = this.getSession(sessionId);
    session.conflictRisk = risk;
  }

  /**
   * Record a change for a session.
   *
   * @param sessionId - Session identifier
   * @param change - Change record
   * @throws Error if session not found
   */
  recordChange(sessionId: string, change: Omit<Change, 'id'>): void {
    const session = this.getSession(sessionId);
    const changeRecord: Change = {
      id: `${sessionId}-${change.filePath}-${change.timestamp}`,
      filePath: change.filePath,
      changeType: change.changeType,
      timestamp: change.timestamp,
    };
    session.recentChanges.push(changeRecord);

    // Limit recent changes to last 100 entries
    if (session.recentChanges.length > 100) {
      session.recentChanges = session.recentChanges.slice(-100);
    }
  }

  /**
   * Unregister a session.
   *
   * @param sessionId - Session identifier
   * @throws Error if session not found
   */
  unregisterSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Get all registered session IDs.
   *
   * @returns Array of session identifiers
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ============================================================
  // CONFLICT DETECTION
  // ============================================================

  /**
   * Detect conflicts across all active sessions.
   *
   * Only considers sessions in 'active' state. Idle and terminated sessions are ignored.
   *
   * @returns Array of conflicts found
   */
  detectConflicts(): Conflict[] {
    const conflicts: Conflict[] = [];
    const activeSessions = Array.from(this.sessions.values()).filter((s) => s.state === 'active');

    // Check all pairs of active sessions
    for (let i = 0; i < activeSessions.length; i++) {
      for (let j = i + 1; j < activeSessions.length; j++) {
        const session1 = activeSessions[i];
        const session2 = activeSessions[j];

        const overlappingFiles = this.findOverlappingFiles(session1.activeFiles, session2.activeFiles);

        if (overlappingFiles.length > 0) {
          conflicts.push({
            sessions: [session1.sessionId, session2.sessionId],
            conflictingFiles: overlappingFiles,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Find overlapping file paths between two arrays.
   *
   * @param files1 - First array of file paths
   * @param files2 - Second array of file paths
   * @returns Array of overlapping file paths
   */
  private findOverlappingFiles(files1: string[], files2: string[]): string[] {
    const set1 = new Set(files1);
    return files2.filter((f) => set1.has(f));
  }

  /**
   * Calculate conflict risk level for a session based on file overlaps.
   *
   * Risk levels:
   * - low: No file overlaps with other active sessions
   * - medium: Some file overlaps (< 50% of session's files overlap)
   * - high: Significant file overlaps (≥ 50% of session's files overlap)
   *
   * @param sessionId - Session identifier
   * @returns Conflict risk level
   */
  calculateConflictRisk(sessionId: string): ConflictRisk {
    const session = this.getSession(sessionId);

    if (session.state !== 'active' || session.activeFiles.length === 0) {
      return 'low';
    }

    const activeSessions = Array.from(this.sessions.values()).filter(
      (s) => s.state === 'active' && s.sessionId !== sessionId,
    );

    if (activeSessions.length === 0) {
      return 'low';
    }

    // Count overlapping files
    let overlappingCount = 0;
    const myFiles = new Set(session.activeFiles);

    for (const otherSession of activeSessions) {
      for (const file of otherSession.activeFiles) {
        if (myFiles.has(file)) {
          overlappingCount++;
          myFiles.delete(file); // Avoid double-counting
        }
      }
    }

    if (overlappingCount === 0) {
      return 'low';
    }

    const overlapRatio = overlappingCount / session.activeFiles.length;
    return overlapRatio >= 0.5 ? 'high' : 'medium';
  }

  // ============================================================
  // ACTIVITY LEDGER
  // ============================================================

  /**
   * Generate activity ledger for all sessions or filtered sessions.
   *
   * @param filter - Optional filter options
   * @returns Array of activity ledger entries
   */
  getActivityLedger(filter?: LedgerFilter): ActivityLedgerEntry[] {
    let sessions = Array.from(this.sessions.values());

    // Apply filters
    if (filter?.states) {
      sessions = sessions.filter((s) => filter.states!.includes(s.state));
    }

    if (filter?.profileIds) {
      sessions = sessions.filter((s) => filter.profileIds!.includes(s.profileId));
    }

    if (filter?.providerClasses) {
      sessions = sessions.filter((s) => filter.providerClasses!.includes(s.providerClass));
    }

    // Map to ledger entries
    // Note: profile label and providerClass would be resolved from ProfileRegistry
    // For now, use placeholder values
    return sessions.map((session) => ({
      sessionId: session.sessionId,
      profileId: session.profileId,
      label: session.profileId, // TODO: Resolve from ProfileConfig
      state: session.state,
      knownFiles: session.activeFiles,
      knownCommands: session.activeCommands,
      recentChanges: session.recentChanges,
      conflictRisk: session.conflictRisk,
      lastUpdated: session.lastActivity,
      providerClass: 'cloud', // TODO: Resolve from ProfileConfig
    }));
  }
}

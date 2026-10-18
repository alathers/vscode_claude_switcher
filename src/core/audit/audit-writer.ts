/**
 * src/core/audit/audit-writer.ts
 *
 * Audit Writer Module
 *
 * Writes audit logs for session tracking and compliance.
 * Never logs prohibited content (prompts, transcripts, code, tokens, secrets).
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 * File I/O is isolated to the vscode layer.
 */

// ============================================================
// AUDIT EVENT TYPES
// ============================================================

/**
 * Types of audit events that can be logged.
 */
export type AuditEventType =
  | 'profile_activation'
  | 'profile_deactivation'
  | 'command_execution'
  | 'tool_execution'
  | 'file_operation'
  | 'handoff'
  | 'policy_violation'
  | 'error'
  | 'security_event';

/**
 * Audit log entry.
 *
 * Prohibited content per FR-054:
 * - NO prompt content from user messages
 * - NO transcript conversation content
 * - NO code snippets or file contents
 * - NO token counts or billing information
 * - NO secret values or credential data
 */
export interface AuditEntry {
  /** Unique event identifier */
  eventId: string;

  /** Event type */
  eventType: AuditEventType;

  /** Timestamp when event occurred */
  timestamp: string;

  /** Profile ID for this event */
  profileId: string;

  /** Adapter type */
  adapterType: string;

  /** Event metadata (no prohibited content) */
  metadata: {
    /** Event source (user, system, adapter) */
    source: 'user' | 'system' | 'adapter';

    /** Event-specific data */
    data: Record<string, unknown>;

    /** Outcome of event (if applicable) */
    outcome?: 'success' | 'failure' | 'partial';

    /** Error message (if event failed) */
    error?: string;

    /** Related event IDs (for correlation) */
    relatedEvents?: string[];
  };

  /**
   * Security level classification.
   *
   * - low: Normal operations
   * - medium: Suspicious activity
   * - high: Security concern or violation
   */
  securityLevel: 'low' | 'medium' | 'high';

  /** Additional tags for filtering */
  tags?: string[];
}

/**
 * Audit log configuration.
 */
export interface AuditLogConfig {
  /** Whether audit logging is enabled */
  enabled: boolean;

  /** Retention period in days (0 = no deletion) */
  retentionDays: number;

  /** Maximum log file size in MB */
  maxFileSizeMb: number;

  /** Events to log */
  enabledEvents: Set<AuditEventType>;
}

// ============================================================
// AUDIT WRITER CONFIG
// ============================================================

/**
 * Configuration for prohibited content detection.
 *
 * Ensures audit logs never contain prohibited content per FR-054.
 */
export const PROHIBITED_PATTERNS = {
  /** Patterns that indicate user prompts */
  PROMPT_INDICATORS: [
    /user message/i,
    /user prompt/i,
    /user said/i,
    /user wrote/i,
  ],

  /** Patterns that indicate transcript content */
  TRANSCRIPT_INDICATORS: [
    /transcript content/i,
    /conversation:/i,
    /assistant output:/i,
  ],

  /** Patterns that indicate code content */
  CODE_INDICATORS: [
    /```typescript/i,
    /```javascript/i,
    /```python/i,
    /function\s+\w+\(/,
    /class\s+\w+\s*\{/,
  ],

  /** Patterns that indicate tokens or billing */
  TOKENS_INDICATORS: [
    /\d+\s*tokens/i,
    /token count/i,
    /billing/i,
    /cost/i,
    /estimated cost/i,
  ],

  /** Patterns that indicate secrets */
  SECRET_INDICATORS: [
    /api[_-]?key/i,
    /secret[_-]?key/i,
    /password/i,
    /token:\s*\S+/i,
    /sk-[a-zA-Z0-9]{20,}/i,
  ],
} as const;

// ============================================================
// AUDIT WRITER CLASS
// ============================================================

/**
 * Writes audit logs for security and compliance.
 *
 * Usage:
 * ```typescript
 * const writer = new AuditWriter(config);
 * const entry = writer.createEntry('profile_activation', profileId, adapterType, {metadata});
 * await writer.write(entry);
 * ```
 *
 * Audit logging rules (FR-054, KR-003):
 * 1. NEVER log prompt content from user messages
 * 2. NEVER log transcript conversation content
 * 3. NEVER log code snippets or file contents
 * 4. NEVER log token counts or billing information
 * 5. NEVER log secret values or credential data
 * 6. Log only metadata: timestamps, event types, outcomes, file paths (no content)
 *
 * NOTE: This module creates audit entries but does NOT write them to disk.
 * The vscode layer handles file I/O. This module ensures compliance
 * with prohibited content rules before entries are written.
 */
export class AuditWriter {
  private config: AuditLogConfig;
  private eventCounter: number = 0;

  /**
   * Audit log entries awaiting write.
   *
   * Accumulated entries are flushed by the vscode layer.
   */
  private pendingEntries: AuditEntry[] = [];

  constructor(config: Partial<AuditLogConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      retentionDays: config.retentionDays ?? 30,
      maxFileSizeMb: config.maxFileSizeMb ?? 10,
      enabledEvents: config.enabledEvents ?? new Set([
        'profile_activation',
        'profile_deactivation',
        'command_execution',
        'tool_execution',
        'file_operation',
        'handoff',
        'policy_violation',
        'error',
        'security_event',
      ]),
    };
  }

  /**
   * Create an audit entry for an event.
   *
   * Validates that entry does not contain prohibited content.
   *
   * @param eventType - Type of event
   * @param profileId - Profile ID
   * @param adapterType - Adapter type
   * @param metadata - Event metadata (must not contain prohibited content)
   * @returns Audit entry
   * @throws Error if metadata contains prohibited content
   */
  createEntry(
    eventType: AuditEventType,
    profileId: string,
    adapterType: string,
    metadata: {
      source: 'user' | 'system' | 'adapter';
      data: Record<string, unknown>;
      outcome?: 'success' | 'failure' | 'partial';
      error?: string;
      relatedEvents?: string[];
    },
  ): AuditEntry {
    // Prohibited content check
    const prohibitedContent = this.detectProhibitedContent(metadata);

    if (prohibitedContent.length > 0) {
      throw new Error(
        `Audit entry contains prohibited content: ${prohibitedContent.join(', ')}`,
      );
    }

    // Generate secure hash of metadata for security level
    const securityLevel = this.determineSecurityLevel(eventType, metadata);

    this.eventCounter++;

    const eventId = `aud-${Date.now().toString(36)}-${this.eventCounter.toString(16)}`;

    return {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      profileId,
      adapterType,
      metadata: {
        ...metadata,
      },
      securityLevel,
    };
  }

  /**
   * Log an event.
   *
   * Creates and queues audit entry for writing.
   *
   * @param eventType - Type of event
   * @param profileId - Profile ID
   * @param adapterType - Adapter type
   * @param metadata - Event metadata
   * @returns Audit entry ID if successful, null if disabled
   */
  log(
    eventType: AuditEventType,
    profileId: string,
    adapterType: string,
    metadata: {
      source: 'user' | 'system' | 'adapter';
      data: Record<string, unknown>;
      outcome?: 'success' | 'failure' | 'partial';
      error?: string;
      relatedEvents?: string[];
    },
  ): string | null {
    if (!this.config.enabled) {
      return null;
    }

    if (!this.config.enabledEvents.has(eventType)) {
      return null;
    }

    try {
      const entry = this.createEntry(eventType, profileId, adapterType, metadata);
      this.pendingEntries.push(entry);
      return entry.eventId;
    } catch (err) {
      console.error('Failed to create audit entry:', err);
      return null;
    }
  }

  /**
   * Get pending audit entries.
   *
   * Called by vscode layer to write entries to disk.
   *
   * @returns Array of pending audit entries
   */
  getPendingEntries(): AuditEntry[] {
    const entries = [...this.pendingEntries];
    this.pendingEntries = [];
    return entries;
  }

  /**
   * Clear pending audit entries without writing.
   *
   * Used when debugging or testing.
   */
  clearPending(): void {
    this.pendingEntries = [];
  }

  // ============================================================
  // PROHIBITED CONTENT DETECTION
  // ============================================================

  /**
   * Detect prohibited content in audit metadata.
   *
   * @param metadata - Metadata to check
   * @returns Array of prohibited content types found
   */
  private detectProhibitedContent(
    metadata: Record<string, unknown>,
  ): string[] {
    const prohibited: string[] = [];
    const metadataString = JSON.stringify(metadata);

    // Check for prompt indicators
    if (this.matchesAnyPattern(metadataString, PROHIBITED_PATTERNS.PROMPT_INDICATORS)) {
      prohibited.push('prompt content');
    }

    // Check for transcript indicators
    if (this.matchesAnyPattern(metadataString, PROHIBITED_PATTERNS.TRANSCRIPT_INDICATORS)) {
      prohibited.push('transcript content');
    }

    // Check for code indicators
    if (this.matchesAnyPattern(metadataString, PROHIBITED_PATTERNS.CODE_INDICATORS)) {
      prohibited.push('code content');
    }

    // Check for token/billing indicators
    if (this.matchesAnyPattern(metadataString, PROHIBITED_PATTERNS.TOKENS_INDICATORS)) {
      prohibited.push('token or billing information');
    }

    // Check for secret indicators
    if (this.matchesAnyPattern(metadataString, PROHIBITED_PATTERNS.SECRET_INDICATORS)) {
      prohibited.push('secret or credential data');
    }

    return prohibited;
  }

  /**
   * Check if string matches any of the patterns.
   */
  private matchesAnyPattern(str: string, patterns: readonly RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(str));
  }

  /**
   * Determine security level for an event.
   */
  private determineSecurityLevel(
    eventType: AuditEventType,
    metadata: Record<string, unknown>,
  ): 'low' | 'medium' | 'high' {
    // Policy violations are high security
    if (eventType === 'policy_violation') {
      return 'high';
    }

    // Security events are high
    if (eventType === 'security_event') {
      return 'high';
    }

    // Failed events are medium
    if (metadata.outcome === 'failure') {
      return 'medium';
    }

    // Command and tool executions are medium
    if (eventType === 'command_execution' || eventType === 'tool_execution') {
      return 'medium';
    }

    // Everything else is low
    return 'low';
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  /**
   * Get current audit configuration.
   */
  getConfig(): AuditLogConfig {
    return { ...this.config };
  }

  /**
   * Check if an event type is enabled for logging.
   */
  isEventEnabled(eventType: AuditEventType): boolean {
    return this.config.enabledEvents.has(eventType);
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Create an audit entry for an event.
 *
 * Validates that entry does not contain prohibited content.
 *
 * @param eventType - Type of event
 * @param profileId - Profile ID
 * @param adapterType - Adapter type
 * @param metadata - Event metadata
 * @returns Audit entry
 */
export function createAuditEntry(
  eventType: AuditEventType,
  profileId: string,
  adapterType: string,
  metadata: {
    source: 'user' | 'system' | 'adapter';
    data: Record<string, unknown>;
    outcome?: 'success' | 'failure' | 'partial';
    error?: string;
    relatedEvents?: string[];
  },
): AuditEntry {
  const writer = new AuditWriter();
  return writer.createEntry(eventType, profileId, adapterType, metadata);
}

/**
 * Log an audit event.
 *
 * @param eventType - Type of event
 * @param profileId - Profile ID
 * @param adapterType - Adapter type
 * @param metadata - Event metadata
 * @returns Audit entry ID or null
 */
export function logAuditEvent(
  eventType: AuditEventType,
  profileId: string,
  adapterType: string,
  metadata: {
    source: 'user' | 'system' | 'adapter';
    data: Record<string, unknown>;
    outcome?: 'success' | 'failure' | 'partial';
    error?: string;
    relatedEvents?: string[];
  },
): string | null {
  const writer = new AuditWriter();
  return writer.log(eventType, profileId, adapterType, metadata);
}

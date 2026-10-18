/**
 * src/core/handoff/handoff-serializer.ts
 *
 * Handoff Serializer Module
 *
 * Creates handoff packages for transferring context between agents.
 * Tracks handoff metadata without storing prohibited transcript content.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 */

import { ConversationSummary } from './summarizer.js';

// ============================================================
// HANDOFF PACKET TYPES
// ============================================================

/**
 * Handoff package for transferring context between agents.
 *
 * Contains minimal metadata about the handoff without full transcript content.
 * Actual summary or transcript is provided via a separate channel.
 */
export interface HandoffPacket {
  /**
   * Unique handoff package identifier.
   */
  packetId: string;

  /**
   * Handoff mode.
   *
   * - full: Complete transcript transfer (requires transcriptObservable)
   * - summary: Summary-only transfer
   * - export: User-mediated export/import
   * - none: No context transfer
   */
  mode: 'full' | 'summary' | 'export' | 'none';

  /**
   * Source profile information.
   */
  source: HandoffSource;

  /**
   * Destination profile information.
   */
  destination?: HandoffDestination;

  /**
   * Handoff metadata.
   */
  metadata: HandoffMetadata;

  /**
   * Attached content (summary or summary ID).
   *
   * Full transcripts are NOT stored in the packet due to FR-054.
   * Reference to transcript content is provided separately.
   */
  content?: {
    /** Kind of content attached */
    kind: 'summary' | 'summaryId';

    /** Summary content (if kind = 'summary') */
    summary?: ConversationSummary;

    /** Summary ID (if kind = 'summaryId') */
    summaryId?: string;

    /** Transcript ID (reference only, not actual content) */
    transcriptId?: string;
  };

  /**
   * Security and privacy information.
   */
  security: HandoffSecurity;
}

/**
 * Source profile information in handoff.
 */
export interface HandoffSource {
  /** Profile ID */
  profileId: string;

  /** Adapter type */
  adapterType: string;

  /** Model name (optional, may be redacted) */
  model?: string;

  /** Session start time */
  sessionStart: Date;

  /** Session end time */
  sessionEnd: Date;

  /** Number of conversation turns */
  turnCount: number;
}

/**
 * Destination profile information in handoff.
 */
export interface HandoffDestination {
  /** Profile ID */
  profileId: string;

  /** Adapter type */
  adapterType: string;

  /** Model name (optional) */
  model?: string;
}

/**
 * Handoff metadata tracking.
 */
export interface HandoffMetadata {
  /** Timestamp when handoff package was created */
  createdAt: Date;

  /**
   * Creator identifier.
   *
   * Could be user ID, extension version, or system identifier.
   */
  createdBy: string;

  /**
   * Handoff reason (optional).
   */
  reason?: string;

  /**
   * Tagging for organization (optional).
   */
  tags?: string[];

  /**
   * Whether this handoff was approved by user.
   */
  userApproved?: boolean;

  /**
   * User notes about the handoff (optional).
   */
  userNotes?: string;
}

/**
 * Security and privacy information for handoff.
 */
export interface HandoffSecurity {
  /**
   * Privacy mode at time of handoff.
   */
  privacyMode: 'unrestricted' | 'guarded' | 'strict';

  /**
   * Whether handoff crosses provider class boundaries.
   */
  crossProvider: boolean;

  /**
   * Whether secret redaction was applied.
   */
  secretsRedacted: boolean;

  /**
   * Whether PII (personally identifiable information) was redacted.
   */
  piiRedacted: boolean;

  /**
   * Security level classification.
   */
  securityLevel: 'low' | 'medium' | 'high';
}

// ============================================================
// HANDOFF SERIALIZER CLASS
// ============================================================

/**
 * Creates and serializes handoff packages.
 *
 * Usage:
 * ```typescript
 * const serializer = new HandoffSerializer();
 * const packet = serializer.create({
 *   mode: 'summary',
 *   source: { profileId, adapterType, ... },
 *   metadata: { ... },
 * });
 *
 * const serialized = serializer.serialize(packet);
 * ```
 *
 * Handoff creation workflow (FR-082, FR-083):
 * 1. Determine handoff mode based on policy and capabilities
 * 2. Gather source profile session metadata
 * 3. Attach summary or reference as needed
 * 4. Record security and privacy information
 * 5. Serialize to JSON for storage/transfer
 *
 * NOTE: This module does NOT store full transcript content in handoff
 * packets (FR-054). Only metadata and summary/reference IDs are stored.
 * Actual transcript content is handled separately via the TranscriptOracle.
 */
export class HandoffSerializer {
  private packetCounter: number = 0;

  /**
   * Create a new handoff packet.
   *
   * @param params - Handoff creation parameters
   * @returns Created handoff packet
   */
  create(params: HandoffCreateParams): HandoffPacket {
    const packetId = this.generatePacketId(params.source.profileId);

    const currentTime = new Date();

    // Determine if this is a cross-provider handoff
    const crossProvider = params.destination
      ? params.source.adapterType !== params.destination.adapterType
      : false;

    // Security level based on cross-provider and privacy mode
    const securityLevel = this.determineSecurityLevel(
      params.security?.privacyMode || 'unrestricted',
      crossProvider,
    );

    const packet: HandoffPacket = {
      packetId,
      mode: params.mode,
      source: params.source,
      destination: params.destination,
      metadata: {
        createdAt: currentTime,
        createdBy: params.metadata.createdBy || 'claude-switcher',
        reason: params.metadata.reason,
        tags: params.metadata.tags,
        userApproved: params.metadata.userApproved,
        userNotes: params.metadata.userNotes,
      },
      security: {
        privacyMode: params.security?.privacyMode || 'unrestricted',
        crossProvider,
        secretsRedacted: true, // Always redact for safety
        piiRedacted: params.security?.piiRedacted ?? true,
        securityLevel,
      },
    };

    // Attach content based on mode
    if (params.mode === 'summary' && params.summary) {
      packet.content = {
        kind: 'summary',
        summary: params.summary,
        transcriptId: params.transcriptId,
      };
    } else if (params.mode === 'full' && params.transcriptId) {
      // Note: No transcript content stored, only reference
      packet.content = {
        kind: 'summaryId',
        summaryId: undefined,
        transcriptId: params.transcriptId,
      };
    }

    return packet;
  }

  /**
   * Serialize handoff packet to JSON.
   *
   * @param packet - Handoff packet to serialize
   * @returns JSON string
   */
  serialize(packet: HandoffPacket): string {
    // Use replacer to handle Date serialization
    return JSON.stringify(packet, (_key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2);
  }

  /**
   * Deserialize handoff packet from JSON.
   *
   * @param json - JSON string to deserialize
   * @returns Deserialized handoff packet
   */
  deserialize(json: string): HandoffPacket {
    const parsed = JSON.parse(json, (key, value) => {
      // Convert ISO strings back to Date objects
      if (key.includes('Date') || key.includes('Time') || key === 'createdAt' || key === 'sessionStart' || key === 'sessionEnd') {
        return new Date(value);
      }
      return value;
    });

    // Basic validation
    if (!parsed.packetId || !parsed.mode || !parsed.source) {
      throw new Error('Invalid handoff packet: missing required fields');
    }

    return parsed as HandoffPacket;
  }

  /**
   * Validate handoff packet structure.
   *
   * @param packet - Handoff packet to validate
   * @returns true if valid, false otherwise
   */
  validate(packet: HandoffPacket): boolean {
    // Check required fields
    if (!packet.packetId || typeof packet.packetId !== 'string') {
      return false;
    }

    if (!['full', 'summary', 'export', 'none'].includes(packet.mode)) {
      return false;
    }

    if (!packet.source || !packet.source.profileId || !packet.source.adapterType) {
      return false;
    }

    if (!packet.metadata || !packet.metadata.createdAt) {
      return false;
    }

    if (!packet.security || !packet.security.privacyMode) {
      return false;
    }

    // Mode-specific validation
    if (packet.mode === 'summary' && !packet.content) {
      return false;
    }

    if (packet.mode === 'full' && !packet.content?.transcriptId) {
      return false;
    }

    return true;
  }

  /**
   * Create handshake acknowledgment packet.
   *
   * Used by receiving agent to confirm handoff receipt.
   *
   * @param packetId - Original handoff packet ID
   * @param receivedProfileId - Receiving profile ID
   * @param success - Whether handshake was successful
   * @returns Handshake acknowledgment packet
   */
  createAcknowledgment(
    packetId: string,
    receivedProfileId: string,
    success: boolean,
  ): HandoffMetadata {
    return {
      createdAt: new Date(),
      createdBy: 'claude-switcher',
      reason: 'Handoff acknowledgment',
      tags: ['acknowledgment', success ? 'success' : 'failed'],
      userApproved: false,
      userNotes: success
        ? `Handoff packet ${packetId} received by profile ${receivedProfileId}`
        : `Handoff packet ${packetId} rejected by profile ${receivedProfileId}`,
    };
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Generate unique packet ID.
   */
  private generatePacketId(profileId: string): string {
    this.packetCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.packetCounter.toString(16).padStart(4, '0');
    const profileSuffix = profileId.slice(0, 8).replace(/[^a-z0-9]/gi, '');
    return `hnd-${timestamp}-${counter}-${profileSuffix}`;
  }

  /**
   * Determine security level.
   */
  private determineSecurityLevel(
    privacyMode: 'unrestricted' | 'guarded' | 'strict',
    crossProvider: boolean,
  ): 'low' | 'medium' | 'high' {
    if (privacyMode === 'strict') {
      return 'high';
    }

    if (privacyMode === 'guarded' || crossProvider) {
      return 'medium';
    }

    return 'low';
  }
}

// ============================================================
// HANDOFF SERIALIZER OPTIONS
// ============================================================

/**
 * Parameters for creating a handoff packet.
 */
export interface HandoffCreateParams {
  /** Handoff mode */
  mode: 'full' | 'summary' | 'export' | 'none';

  /** Source profile information */
  source: HandoffSource;

  /** Destination profile information (optional) */
  destination?: HandoffDestination;

  /** Handoff metadata (without createdAt which is generated) */
  metadata: Omit<HandoffMetadata, 'createdAt'>;

  /** Security and privacy settings */
  security?: {
    /** Privacy mode */
    privacyMode?: 'unrestricted' | 'guarded' | 'strict';

    /** Whether PII should be redacted */
    piiRedacted?: boolean;
  };

  /** Transcript ID (for reference) */
  transcriptId?: string;

  /** Summary (for mode = 'summary') */
  summary?: ConversationSummary;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Create a handoff packet.
 *
 * @param params - Handoff creation parameters
 * @returns Handoff packet
 */
export function createHandoffPacket(
  params: HandoffCreateParams,
): HandoffPacket {
  const serializer = new HandoffSerializer();
  return serializer.create(params);
}

/**
 * Serialize a handoff packet to JSON.
 *
 * @param packet - Handoff packet
 * @returns JSON string
 */
export function serializeHandoffPacket(
  packet: HandoffPacket,
): string {
  const serializer = new HandoffSerializer();
  return serializer.serialize(packet);
}

/**
 * Deserialize a handoff packet from JSON.
 *
 * @param json - JSON string
 * @returns Handoff packet
 */
export function deserializeHandoffPacket(
  json: string,
): HandoffPacket {
  const serializer = new HandoffSerializer();
  return serializer.deserialize(json);
}

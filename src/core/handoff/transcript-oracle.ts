/**
 * src/core/handoff/transcript-oracle.ts
 *
 * Transcript Oracle Module
 *
 * Retrieves conversation transcripts from active agent sessions.
 * Implements the transcript observable interface per adapter contract.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 */

import { ModelAdapter, Transcript, ProfileConfig } from '../adapters/contract.js';

// ============================================================
// TRANSCRIPT ORACLE TYPES
// ============================================================

/**
 * Result of transcript retrieval.
 *
 * Includes the transcript and any errors encountered.
 */
export interface TranscriptFetchResult {
  /**
   * Retrieved transcript.
   *
   * Null if transcript not available or retrieval failed.
   */
  transcript: Transcript | null;

  /**
   * Whether retrieval was successful.
   */
  success: boolean;

  /**
   * Error message if retrieval failed.
   */
  error?: string;

  /**
   * Metadata about the retrieval operation.
   */
  metadata: {
    /** Profile ID for this transcript */
    profileId: string;

    /** Adapter type used for retrieval */
    adapterType: string;

    /** Timestamp when transcript was retrieved */
    fetchedAt: Date;

    /** Source of transcript (adapter memory or external) */
    source: 'adapter' | 'external' | 'cache';
  };
}

/**
 * Cache entry for transcript caching.
 */
interface TranscriptCacheEntry {
  transcript: Transcript;
  fetchedAt: Date;
  ttl: number;
}

// ============================================================
// TRANSCRIPT ORACLE CLASS
// ============================================================

/**
 * Retrieves conversation transcripts from adapter sessions.
 *
 * Usage:
 * ```typescript
 * const oracle = new TranscriptOracle();
 * const result = await oracle.fetchTranscript(adapter, config);
 *
 * if (result.success && result.transcript) {
 *   // Use transcript for handoff or summarization
 * }
 * ```
 *
 * Transcript retrieval workflow (FR-083):
 * 1. Check if adapter supports transcriptObservable capability
 * 2. If supported, call adapter.getTranscript()
 * 3. If not supported, return null (error with suggested alternatives)
 * 4. Optional cache support for repeated retrievals
 *
 * NOTE: This module does NOT manage session persistence. The adapter
 * implementation handles actual transcript storage and retrieval.
 * This oracle provides a unified interface for accessing transcripts
 * across different adapter types.
 */
export class TranscriptOracle {
  private cache: Map<string, TranscriptCacheEntry>;

  /** Cache TTL in milliseconds (default: 5 minutes) */
  readonly cacheTTL: number;

  /**
   * Whether caching is enabled.
   */
  readonly enableCache: boolean;

  constructor(options: TranscriptOracleOptions = {}) {
    this.cache = new Map();
    this.enableCache = options.enableCache ?? true;
    this.cacheTTL = options.cacheTTL ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Fetch transcript from adapter session.
   *
   * @param adapter - Adapter instance to fetch transcript from
   * @param config - Profile configuration for the session
   * @returns Transcript fetch result
   */
  async fetchTranscript(
    adapter: ModelAdapter,
    config: ProfileConfig,
  ): Promise<TranscriptFetchResult> {
    const metadata: TranscriptFetchResult['metadata'] = {
      profileId: config.id,
      adapterType: config.adapter,
      fetchedAt: new Date(),
      source: 'adapter',
    };

    // Check cache first if enabled
    if (this.enableCache) {
      const cached = this.getFromCache(config.id);
      if (cached) {
        metadata.source = 'cache';
        return {
          transcript: cached,
          success: true,
          metadata,
        };
      }
    }

    // Check if adapter supports transcriptObservable
    if (!adapter.capabilities.transcriptObservable) {
      const error = `Adapter "${config.adapter}" does not support transcript retrieval (transcriptObservable = false)`;
      return {
        transcript: null,
        success: false,
        error,
        metadata,
      };
    }

    // Check if getTranscript method exists
    if (typeof adapter.getTranscript !== 'function') {
      const error = `Adapter "${config.adapter}" declared transcriptObservable = true but getTranscript method is not implemented`;
      return {
        transcript: null,
        success: false,
        error,
        metadata,
      };
    }

    try {
      // Fetch transcript from adapter
      const transcript = await adapter.getTranscript();

      if (!transcript) {
        const error = 'Adapter returned null transcript (no active session or empty transcript)';
        return {
          transcript: null,
          success: false,
          error,
          metadata,
        };
      }

      // Cache the transcript if enabled
      if (this.enableCache) {
        this.addToCache(config.id, transcript);
      }

      return {
        transcript,
        success: true,
        metadata,
      };
    } catch (err) {
      const error = `Failed to fetch transcript: ${err instanceof Error ? err.message : String(err)}`;
      return {
        transcript: null,
        success: false,
        error,
        metadata,
      };
    }
  }

  /**
   * Fetch transcript and validate it.
   *
   * Additional validation ensures transcript is well-formed and complete.
   *
   * @param adapter - Adapter instance
   * @param config - Profile configuration
   * @returns Validated transcript fetch result
   */
  async fetchValidatedTranscript(
    adapter: ModelAdapter,
    config: ProfileConfig,
  ): Promise<TranscriptFetchResult> {
    const fetchResult = await this.fetchTranscript(adapter, config);

    if (!fetchResult.success || !fetchResult.transcript) {
      return fetchResult;
    }

    // Validate transcript structure
    const validationErrors = this.validateTranscript(fetchResult.transcript);

    if (validationErrors.length > 0) {
      return {
        transcript: null,
        success: false,
        error: `Transcript validation failed: ${validationErrors.join(', ')}`,
        metadata: fetchResult.metadata,
      };
    }

    return fetchResult;
  }

  // ============================================================
  // CACHE MANAGEMENT
  // ============================================================

  /**
   * Add transcript to cache.
   *
   * @param profileId - Profile ID as cache key
   * @param transcript - Transcript to cache
   */
  private addToCache(profileId: string, transcript: Transcript): void {
    if (!this.enableCache) {
      return;
    }

    const entry: TranscriptCacheEntry = {
      transcript,
      fetchedAt: new Date(),
      ttl: this.cacheTTL,
    };

    this.cache.set(profileId, entry);
  }

  /**
   * Get transcript from cache if not expired.
   *
   * @param profileId - Profile ID as cache key
   * @returns Cached transcript or null if not found/expired
   */
  private getFromCache(profileId: string): Transcript | null {
    if (!this.enableCache) {
      return null;
    }

    const entry = this.cache.get(profileId);

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    const age = Date.now() - entry.fetchedAt.getTime();
    if (age > entry.ttl) {
      this.cache.delete(profileId);
      return null;
    }

    return entry.transcript;
  }

  /**
   * Clear cache for a specific profile.
   *
   * @param profileId - Profile ID to clear from cache
   */
  clearCache(profileId: string): void {
    this.cache.delete(profileId);
  }

  /**
   * Clear all cached transcripts.
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  // ============================================================
  // TRANSCRIPT VALIDATION
  // ============================================================

  /**
   * Validate transcript structure.
   *
   * @param transcript - Transcript to validate
   * @returns Array of validation errors (empty if valid)
   */
  private validateTranscript(transcript: Transcript): string[] {
    const errors: string[] = [];

    if (!transcript.id) {
      errors.push('Missing transcript ID');
    }

    if (!transcript.profileId) {
      errors.push('Missing profile ID');
    }

    if (!Array.isArray(transcript.turns)) {
      errors.push('Turns must be an array');
    } else if (transcript.turns.length === 0) {
      errors.push('No conversation turns in transcript');
    } else {
      // Validate each turn
      transcript.turns.forEach((turn, index) => {
        if (!turn.role || !['user', 'assistant', 'system'].includes(turn.role)) {
          errors.push(`Turn ${index}: invalid role ${turn.role}`);
        }

        if (!turn.content || typeof turn.content !== 'string') {
          errors.push(`Turn ${index}: missing or invalid content`);
        }
      });
    }

    if (transcript.fileEdits && !Array.isArray(transcript.fileEdits)) {
      errors.push('File edits must be an array if present');
    }

    if (transcript.commands && !Array.isArray(transcript.commands)) {
      errors.push('Commands must be an array if present');
    }

    return errors;
  }

  /**
   * Check if a transcript is appropriate for handoff.
   *
   * @param transcript - Transcript to check
   * @returns true if transcript suitable for handoff
   */
  isSuitableForHandoff(transcript: Transcript): boolean {
    // Transcript needs at least some meaningful content
    if (!transcript.turns || transcript.turns.length < 2) {
      return false;
    }

    // Transcript should have metadata
    if (!transcript.id || !transcript.profileId) {
      return false;
    }

    return true;
  }

  /**
   * Check if a profile supports transcript retrieval.
   *
   * @param adapter - Adapter instance to check
   * @returns true if transcript retrieval is supported
   */
  supportsTranscriptRetrieval(adapter: ModelAdapter): boolean {
    return (
      adapter.capabilities.transcriptObservable &&
      typeof adapter.getTranscript === 'function'
    );
  }
}

// ============================================================
// TRANSCRIPT ORACLE OPTIONS
// ============================================================

/**
 * Options for TranscriptOracle.
 */
export interface TranscriptOracleOptions {
  /**
   * Enable transcript caching (default: true).
   */
  enableCache?: boolean;

  /**
   * Cache TTL in milliseconds (default: 5 minutes).
   */
  cacheTTL?: number;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Fetch transcript from adapter session.
 *
 * @param adapter - Adapter instance
 * @param config - Profile configuration
 * @returns Transcript fetch result
 */
export async function fetchTranscript(
  adapter: ModelAdapter,
  config: ProfileConfig,
): Promise<TranscriptFetchResult> {
  const oracle = new TranscriptOracle();
  return oracle.fetchTranscript(adapter, config);
}

/**
 * Check if adapter supports transcript retrieval.
 *
 * @param adapter - Adapter instance to check
 * @returns true if transcript retrieval is supported
 */
export function supportsTranscript(adapter: ModelAdapter): boolean {
  const oracle = new TranscriptOracle();
  return oracle.supportsTranscriptRetrieval(adapter);
}

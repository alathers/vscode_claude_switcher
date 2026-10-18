/**
 * src/core/handoff/summarizer.ts
 *
 * Summarizer Module
 *
 * Summarizes conversation transcripts for handoff between agents.
 * Provides local summarization (no external API) with deterministic outline fallback.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 */

import { ConversationTurn, Transcript } from '../adapters/contract.js';

// ============================================================
// SUMMARY TYPES
// ============================================================

/**
 * Summary of a conversation transcript.
 *
 * Produced by the summarizer for handoff to a new agent.
 */
export interface ConversationSummary {
  /** Summary unique identifier */
  id: string;

  /** Profile ID for the summarized session */
  profileId: string;

  /**
   * Summary format.
   *
   * - outline: Deterministic outline structure
   * - narrative: Narrative summary (local generation only)
   */
  format: 'outline' | 'narrative';

  /**
   * Session start timestamp.
   */
  startTime: Date;

  /**
   * Session end timestamp.
   */
  endTime: Date;

  /**
   * Number of conversation turns summarized.
   */
  turnCount: number;

  /**
   * Summary content.
   *
   * Either an outline structure or narrative text based on format.
   */
  content: OutlineSummary | NarrativeSummary;

  /**
   * File operations performed.
   */
  fileOperations?: FileOpSummary[];

  /**
   * Commands executed.
   */
  commandSummary?: CommandSummary[];

  /**
   * Summary metadata.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Deterministic outline summary.
 *
 * Structure-based summary that is reproducible and doesn't require generation.
 */
export interface OutlineSummary {
  /** Summary type identifier */
  type: 'outline';

  /**
   * Conversation context.
   */
  context: {
    /** Primary task or objective */
    task: string;

    /** Language/technology focus */
    domains?: string[];

    /** File patterns involved */
    filePatterns?: string[];
  };

  /**
   * Conversation outline by turns.
   */
  turns: OutlineTurn[];

  /**
   * Key decisions made.
   */
  decisions?: OutlineDecision[];

  /**
   * Outstanding work or blockers.
   */
  pending?: OutlinePending[];
}

/**
 * A single turn in outline summary.
 */
export interface OutlineTurn {
  /** Turn index in conversation */
  index: number;

  /** Role (user, assistant, or system) */
  role: 'user' | 'assistant' | 'system';

  /** Brief description of turn content */
  description: string;

  /**
   * Turn length (character count).
   */
  length: number;

  /**
   * Whether this turn involves code files.
   */
  hasCode: boolean;

  /**
   * Files mentioned in this turn.
   */
  files?: string[];
}

/**
 * A decision recorded in outline.
 */
export interface OutlineDecision {
  /** Decision identifier */
  id: string;

  /** Brief description of decision */
  description: string;

  /** Context for the decision */
  context: string;

  /** Turn index where decision was made */
  turnIndex: number;
}

/**
 * Pending work or blocker.
 */
export interface OutlinePending {
  /** Unique identifier */
  id: string;

  /** Description of pending work */
  description: string;

  /** Priority (1 = highest) */
  priority: number;

  /** Turn index where pending item was identified */
  turnIndex: number;
}

/**
 * Narrative summary.
 *
 * Natural language summary generated locally.
 */
export interface NarrativeSummary {
  /** Summary type identifier */
  type: 'narrative';

  /**
   * Summary text.
   */
  summary: string;

  /**
   * Key points extracted.
   */
  keyPoints: string[];

  /**
   * Next steps identified.
   */
  nextSteps?: string[];
}

/**
 * File operation summary.
 */
export interface FileOpSummary {
  /** File path */
  file: string;

  /** Operation type */
  operation: 'create' | 'modify' | 'delete';

  /** Turn index where operation occurred */
  turnIndex: number;
}

/**
 * Command execution summary.
 */
export interface CommandSummary {
  /** Command (may be redacted) */
  command: string;

  /** Exit code */
  exitCode: number;

  /** Turn index where command ran */
  turnIndex: number;

  /** Duration in milliseconds */
  duration: number;
}

// ============================================================
// SUMMARIZER CLASS
// ============================================================

/**
 * Generates conversation summaries for handoff.
 *
 * Usage:
 * ```typescript
 * const summarizer = new Summarizer();
 * const summary = summarizer.summarize(transcript, { format: 'outline' });
 * ```
 *
 * Summarization strategies (FR-081):
 * 1. Outline: Deterministic structure, no generation needed
 * 2. Narrative: Natural language summary (local generation only)
 *
 * The outline format is deterministic and always available.
 * Narrative format requires local summarization capabilities.
 *
 * NOTE: This module does NOT use external APIs. All summarization
 * is done locally using template-based or rule-based generation.
 */
export class Summarizer {
  /**
   * Summarize a transcript.
   *
   * @param transcript - Transcript to summarize
   * @param options - Summarization options
   * @returns Conversation summary
   */
  summarize(
    transcript: Transcript,
    options: SummarizerOptions = {},
  ): ConversationSummary {
    const format = options.format ?? 'outline';

    if (format === 'narrative' && !this.canGenerateNarrative()) {
      // Fall back to outline if narrative not available
      // Option is set to 'outline' but we return in 'narrative' field for consistency
      options.format = 'outline';
    }

    const turnCount = transcript.turns.length;

    let content: OutlineSummary | NarrativeSummary;

    if (options.format === 'narrative') {
      content = this.generateNarrativeSummary(transcript);
    } else {
      content = this.generateOutlineSummary(transcript);
    }

    // Extract file operations if available
    const fileOperations = transcript.fileEdits?.map(edit => ({
      file: edit.file,
      operation: edit.type,
      turnIndex: 0, // Would need to map to turn - simplified for stub
    }));

    // Extract command summary if available
    const commandSummary = transcript.commands?.map(cmd => ({
      command: this.redactCommand(cmd.command),
      exitCode: 0, // Need from CommandResult - simplified for stub
      turnIndex: 0, // Would need to map to turn - simplified for stub
      duration: 0,
    }));

    return {
      id: `summary-${transcript.id}`,
      profileId: transcript.profileId,
      format,
      startTime: transcript.startTime,
      endTime: transcript.endTime ?? new Date(),
      turnCount,
      content,
      fileOperations,
      commandSummary,
      metadata: transcript.metadata,
    };
  }

  // ============================================================
  // OUTLINE GENERATION
  // ============================================================

  /**
   * Generate deterministic outline summary.
   *
   * @param transcript - Transcript to summarize
   * @returns Outline summary
   */
  private generateOutlineSummary(transcript: Transcript): OutlineSummary {
    const turns: OutlineTurn[] = [];

    transcript.turns.forEach((turn, index) => {
      turns.push({
        index,
        role: turn.role,
        description: this.describeTurn(turn),
        length: turn.content.length,
        hasCode: this.containsCode(turn.content),
        files: this.extractFiles(turn.content),
      });
    });

    const context = this.extractContext(turns);

    return {
      type: 'outline',
      context,
      turns,
      decisions: this.extractDecisions(turns),
      pending: this.extractPending(turns),
    };
  }

  /**
   * Generate brief description of turn content.
   */
  private describeTurn(turn: ConversationTurn): string {
    const content = turn.content.trim();
    const firstLine = content.split('\n')[0].trim();

    // If content starts with code marker, describe as code
    if (this.containsCode(content)) {
      const firstNonCodeLine = content
        .match(/^[^[{]*/m)
        ?.[0]
        ?.split('\n')
        ?.filter(l => l.trim() && !l.trim().startsWith('```') && !l.trim().startsWith('//'))
        ?.[0]
        ?.trim();

      return firstNonCodeLine
        ? `Code + ${firstNonCodeLine.substring(0, 50)}...`
        : 'Code block';
    }

    // Return first line if short enough, else truncate
    if (firstLine.length <= 100) {
      return firstLine;
    }

    return `${firstLine.substring(0, 97)}...`;
  }

  /**
   * Check if content contains code.
   */
  private containsCode(content: string): boolean {
    return content.includes('```') || content.includes('```typescript') || content.includes('```javascript');
  }

  /**
   * Extract file paths from content.
   */
  private extractFiles(content: string): string[] {
    const fileRefs: string[] = [];

    // Match common file reference patterns
    const patterns = [
      /([a-zA-Z0-9/_-]+\.(ts|js|py|java|go|rs|cpp|c|h|json|yaml|yml|md|txt))/g,
      /\[([^\]]+\.ts)\]/g,
      /`([^`]+\.(ts|js|py))`/g,
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(m => fileRefs.push(m));
      }
    });

    // Deduplicate
    return [...new Set(fileRefs)];
  }

  /**
   * Extract conversation context.
   */
  private extractContext(turns: OutlineTurn[]): OutlineSummary['context'] {
    const task = this.detectTask(turns);
    const domains = this.detectDomains(turns);
    const filePatterns = this.detectFilePatterns(turns);

    return {
      task,
      domains,
      filePatterns,
    };
  }

  /**
   * Detect primary task from turns.
   */
  private detectTask(turns: OutlineTurn[]): string {
    // Simplified: check first user message
    const firstUser = turns.filter(t => t.role === 'user')[0];

    if (!firstUser) {
      return 'Unknown task';
    }

    return firstUser.description;
  }

  /**
   * Detect technology domains.
   */
  private detectDomains(turns: OutlineTurn[]): string[] {
    const domains = new Set<string>();

    turns.forEach(turn => {
      if (turn.files) {
        turn.files.forEach(file => {
          if (file.endsWith('.ts') || file.endsWith('.js')) {
            domains.add('TypeScript/JavaScript');
          } else if (file.endsWith('.py')) {
            domains.add('Python');
          } else if (file.endsWith('.go')) {
            domains.add('Go');
          } else if (file.endsWith('.rs')) {
            domains.add('Rust');
          }
        });
      }

      if (turn.description.toLowerCase().includes('api')) {
        domains.add('API');
      }

      if (turn.description.toLowerCase().includes('database') || turn.description.toLowerCase().includes('sql')) {
        domains.add('Database');
      }
    });

    return Array.from(domains);
  }

  /**
   * Detect file operation patterns.
   */
  private detectFilePatterns(turns: OutlineTurn[]): string[] | undefined {
    const patterns = new Set<string>();

    turns.forEach(turn => {
      if (turn.files) {
        turn.files.forEach(file => {
          const dir = file.split('/')[0];
          if (dir !== '.' && dir !== '') {
            patterns.add(dir);
          }
        });
      }
    });

    return patterns.size > 0 ? Array.from(patterns) : undefined;
  }

  /**
   * Extract decisions from turns.
   */
  private extractDecisions(turns: OutlineTurn[]): OutlineDecision[] {
    // Simplified: find turns with "decided" or "chose" etc.
    const decisions: OutlineDecision[] = [];

    turns.forEach(turn => {
      const desc = turn.description.toLowerCase();

      if (
        desc.includes('decided') ||
        desc.includes('chose') ||
        desc.includes('use') ||
        desc.includes('using')
      ) {
        decisions.push({
          id: `decision-${turn.index}`,
          description: turn.description,
          context: 'Identified from conversation flow',
          turnIndex: turn.index,
        });
      }
    });

    return decisions;
  }

  /**
   * Extract pending work.
   */
  private extractPending(turns: OutlineTurn[]): OutlinePending[] {
    // Simplified: find turns with "todo", "next", "pending" etc.
    const pending: OutlinePending[] = [];

    turns.forEach(turn => {
      const desc = turn.description.toLowerCase();

      if (desc.includes('todo') || desc.includes('next') || desc.includes('need to') || desc.includes('should')) {
        pending.push({
          id: `pending-${turn.index}`,
          description: turn.description,
          priority: 2,
          turnIndex: turn.index,
        });
      }
    });

    return pending;
  }

  // ============================================================
  // NARRATIVE GENERATION
  // ============================================================

  /**
   * Generate narrative summary.
   *
   * @param transcript - Transcript to summarize
   * @returns Narrative summary
   */
  private generateNarrativeSummary(transcript: Transcript): NarrativeSummary {
    // Stub implementation - will be enhanced in T081-T085
    const firstUser = transcript.turns.filter(t => t.role === 'user')[0];

    const task = firstUser?.content || 'No clear task identified';

    return {
      type: 'narrative',
      summary: `The conversation focused on: ${task.substring(0, 100)}...`,
      keyPoints: [
        'Task identified and clarified',
        'Progress made toward objectives',
        'Additional work may be needed',
      ],
      nextSteps: ['Review context', 'Continue work'],
    };
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Check if narrative generation is available.
   */
  private canGenerateNarrative(): boolean {
    // Stub - check if local summarization capabilities are available
    return false;
  }

  /**
   * Redact command output for safety.
   */
  private redactCommand(command: string): string {
    // Simple redaction - remove secrets and sensitive paths
    let redacted = command;

    // Redact password flags
    redacted = redacted.replace(/--password[=\s]+[^\s]+/g, '--password=[REDACTED]');
    redacted = redacted.replace(/-p[=\s]+[^\s]+/g, '-p=[REDACTED]');

    // Redact API keys
    redacted = redacted.replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');

    return redacted;
  }
}

// ============================================================
// SUMMARIZER OPTIONS
// ============================================================

/**
 * Options for summarization.
 */
export interface SummarizerOptions {
  /**
   * Summary format.
   *
   * - outline: Deterministic outline (always available)
   * - narrative: Natural language summary (requires local generation)
   */
  format?: 'outline' | 'narrative';

  /**
   * Maximum number of turns to include in summary.
   *
   * 0 = all turns.
   */
  maxTurns?: number;

  /**
   * Whether to include file operation details.
   */
  includeFileOperations?: boolean;

  /**
   * Whether to include command execution details.
   */
  includeCommands?: boolean;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Summarize a transcript.
 *
 * @param transcript - Transcript to summarize
 * @param options - Summarization options
 * @returns Conversation summary
 */
export function summarizeTranscript(
  transcript: Transcript,
  options?: SummarizerOptions,
): ConversationSummary {
  const summarizer = new Summarizer();
  return summarizer.summarize(transcript, options);
}

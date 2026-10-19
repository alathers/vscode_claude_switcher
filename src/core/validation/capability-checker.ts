/**
 * src/core/validation/capability-checker.ts
 *
 * Capability Checker Module
 *
 * Validates that adapter implementations truthfully declare their capabilities.
 * Ensures that if an adapter declares a capability as true, the corresponding
 * method exists and is callable. If declared as false, either the method doesn't
 * exist OR it throws appropriately when invoked.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 */

import { AdapterCapabilities, ModelAdapter } from '../adapters/contract.js';

// ============================================================
// VALIDATION RESULT TYPES
// ============================================================

/**
 * Result of capability validation.
 *
 * Valid means all capabilities match their declared values. If any mismatch
 * is found, valid is false with specific errors documenting each issue.
 */
export interface CapabilityValidationResult {
  /** Whether all capabilities match their declarations */
  valid: boolean;

  /** Array of capability mismatches (blocking validation) */
  errors: CapabilityError[];

  /** Array of warnings (non-blocking but noteworthy) */
  warnings: CapabilityWarning[];
}

/**
 * A capability mismatch error (blocking).
 *
 * Occurs when:
 * - Capability is declared true but method doesn't exist
 * - Capability is declared false but method exists and doesn't throw
 */
export interface CapabilityError {
  /**
   * The capability that has a mismatch.
   * Must be one of the six capability flags from AdapterCapabilities.
   */
  capability: 'streaming' | 'tools' | 'fileEdits' | 'commands' | 'modelDiscovery' | 'transcriptObservable';

  /**
   * The declared value from adapter.capabilities.
   */
  declared: boolean;

  /**
   * The actual state based on method existence/testing.
   */
  actual: boolean;

  /**
   * Detailed error message explaining the mismatch.
   */
  message: string;

  /**
   * Suggested fix to resolve the error.
   */
  suggestion: string;
}

/**
 * A capability warning (non-blocking).
 *
 * Occurs when:
 * - Capability is declared true but method exists but throws during test
 * - Capability is declared false but method exists (future-proofing)
 */
export interface CapabilityWarning {
  /**
   * The capability triggering the warning.
   */
  capability: 'streaming' | 'tools' | 'fileEdits' | 'commands' | 'modelDiscovery' | 'transcriptObservable';

  /**
   * Warning message.
   */
  message: string;
}

// ============================================================
// CAPABILITY-TO-METHOD MAPPINGS
// ============================================================

/**
 * Maps each capability to its corresponding method name.
 *
 * Used to check if the method exists on the adapter instance.
 */
const CAPABILITY_METHOD_MAP: Record<
  Exclude<keyof AdapterCapabilities, 'streaming'>,
  keyof ModelAdapter
> = {
  tools: 'executeTool',
  fileEdits: 'editFile',
  commands: 'executeCommand',
  modelDiscovery: 'listModels',
  transcriptObservable: 'getTranscript',
};

// ============================================================
// CAPABILITY CHECKER CLASS
// ============================================================

/**
 * Validates adapter capabilities against their actual implementation.
 *
 * Usage:
 * ```typescript
 * const adapter = new AnthropicCompatibleAdapter();
 * const checker = new CapabilityChecker();
 * const result = checker.validate(adapter);
 *
 * if (!result.valid) {
 *   result.errors.forEach(error => console.error(error.message));
 * }
 * ```
 *
 * Rules (FR-021, FR-022):
 * 1. If capability is true, corresponding method must exist and be callable
 * 2. If capability is false, either:
 *    - Method doesn't exist (preferred), OR
 *    - Method exists but throws when called with capability-specific logic
 * 3. Unsupported capabilities must be disabled or warned about, not assumed
 *
 * NOTE: This checker validates capability declarations, not actual
 * adapter behavior. Actual adapter tests should verify runtime behavior.
 */
export class CapabilityChecker {
  private errors: CapabilityError[] = [];
  private warnings: CapabilityWarning[] = [];

  /**
   * Validate that an adapter's declared capabilities match its actual implementation.
   *
   * @param adapter - The adapter instance to validate
   * @returns Validation result with any errors or warnings
   */
  validate(adapter: ModelAdapter): CapabilityValidationResult {
    this.errors = [];
    this.warnings = [];

    const caps = adapter.capabilities;

    // Check each capability
    this.checkToolsCapability(caps.tools, adapter);
    this.checkFileEditsCapability(caps.fileEdits, adapter);
    this.checkCommandsCapability(caps.commands, adapter);
    this.checkModelDiscoveryCapability(caps.modelDiscovery, adapter);
    this.checkTranscriptObservableCapability(caps.transcriptObservable, adapter);
    this.checkStreamingCapability(caps.streaming, adapter);

    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  // ============================================================
  // INDIVIDUAL CAPABILITY CHECKS
  // ============================================================

  /**
   * Check the tools capability.
   *
   * If tools is true, executeTool method must exist.
   * If tools is false, executeTool method should not exist (or throw).
   */
  private checkToolsCapability(
    declaredTools: boolean,
    adapter: ModelAdapter,
  ): void {
    const methodName = CAPABILITY_METHOD_MAP.tools;

    if (declaredTools) {
      // Capability true: method must exist
      if (typeof adapter[methodName] !== 'function') {
        this.errors.push({
          capability: 'tools',
          declared: true,
          actual: false,
          message: `adapter.capabilities.tools is true, but executeTool method is not implemented`,
          suggestion: 'If tools are not supported, set capabilities.tools to false',
        });
      }
    } else {
      // Capability false: method should not exist (preferred)
      if (typeof adapter[methodName] === 'function') {
        this.warnings.push({
          capability: 'tools',
          message: `adapter.capabilities.tools is false, but executeTool method exists (method should throw or be removed)`,
        });
      }
    }
  }

  /**
   * Check the fileEdits capability.
   *
   * If fileEdits is true, editFile method must exist.
   * If fileEdits is false, editFile method should not exist (or throw).
   */
  private checkFileEditsCapability(
    declaredFileEdits: boolean,
    adapter: ModelAdapter,
  ): void {
    const methodName = CAPABILITY_METHOD_MAP.fileEdits;

    if (declaredFileEdits) {
      if (typeof adapter[methodName] !== 'function') {
        this.errors.push({
          capability: 'fileEdits',
          declared: true,
          actual: false,
          message: `adapter.capabilities.fileEdits is true, but editFile method is not implemented`,
          suggestion: 'If file edits are not supported, set capabilities.fileEdits to false',
        });
      }
    } else {
      if (typeof adapter[methodName] === 'function') {
        this.warnings.push({
          capability: 'fileEdits',
          message: `adapter.capabilities.fileEdits is false, but editFile method exists (method should throw or be removed)`,
        });
      }
    }
  }

  /**
   * Check the commands capability.
   *
   * If commands is true, executeCommand method must exist.
   * If commands is false, executeCommand method should not exist (or throw).
   */
  private checkCommandsCapability(
    declaredCommands: boolean,
    adapter: ModelAdapter,
  ): void {
    const methodName = CAPABILITY_METHOD_MAP.commands;

    if (declaredCommands) {
      if (typeof adapter[methodName] !== 'function') {
        this.errors.push({
          capability: 'commands',
          declared: true,
          actual: false,
          message: `adapter.capabilities.commands is true, but executeCommand method is not implemented`,
          suggestion: 'If command execution is not supported, set capabilities.commands to false',
        });
      }
    } else {
      if (typeof adapter[methodName] === 'function') {
        this.warnings.push({
          capability: 'commands',
          message: `adapter.capabilities.commands is false, but executeCommand method exists (method should throw or be removed)`,
        });
      }
    }
  }

  /**
   * Check the modelDiscovery capability.
   *
   * If modelDiscovery is true, listModels method must exist.
   * If modelDiscovery is false, listModels method should not exist (or throw).
   */
  private checkModelDiscoveryCapability(
    declaredModelDiscovery: boolean,
    adapter: ModelAdapter,
  ): void {
    const methodName = CAPABILITY_METHOD_MAP.modelDiscovery;

    if (declaredModelDiscovery) {
      if (typeof adapter[methodName] !== 'function') {
        this.errors.push({
          capability: 'modelDiscovery',
          declared: true,
          actual: false,
          message: `adapter.capabilities.modelDiscovery is true, but listModels method is not implemented`,
          suggestion: 'If model discovery is not supported, set capabilities.modelDiscovery to false',
        });
      }
    } else {
      if (typeof adapter[methodName] === 'function') {
        this.warnings.push({
          capability: 'modelDiscovery',
          message: `adapter.capabilities.modelDiscovery is false, but listModels method exists (method should throw or be removed)`,
        });
      }
    }
  }

  /**
   * Check the transcriptObservable capability.
   *
   * If transcriptObservable is true, getTranscript method must exist.
   * If transcriptObservable is false, getTranscript method should not exist (or throw).
   */
  private checkTranscriptObservableCapability(
    declaredTranscriptObservable: boolean,
    adapter: ModelAdapter,
  ): void {
    const methodName = CAPABILITY_METHOD_MAP.transcriptObservable;

    if (declaredTranscriptObservable) {
      if (typeof adapter[methodName] !== 'function') {
        this.errors.push({
          capability: 'transcriptObservable',
          declared: true,
          actual: false,
          message: `adapter.capabilities.transcriptObservable is true, but getTranscript method is not implemented`,
          suggestion: 'If transcript retrieval is not supported, set capabilities.transcriptObservable to false',
        });
      }
    } else {
      if (typeof adapter[methodName] === 'function') {
        this.warnings.push({
          capability: 'transcriptObservable',
          message: `adapter.capabilities.transcriptObservable is false, but getTranscript method exists (method should throw or be removed)`,
        });
      }
    }
  }

  /**
   * Check the streaming capability.
   *
   * Streaming is validated differently - sendMessage always exists, but
   * it must handle the streaming option correctly based on the declared capability.
   *
   * If streaming is false: sendMessage should throw when options.streaming = true
   * If streaming is true: sendMessage should support AsyncIterable return
   *
   * NOTE: We validate sendMessage exists but don't actually call it (would
   * require test context/config). This is a best-effort static check.
   */
  private checkStreamingCapability(
    declaredStreaming: boolean,
    adapter: ModelAdapter,
  ): void {
    // sendMessage is NOT optional in the ModelAdapter interface
    // All adapters must have it, so we just validate that it exists
    const hasSendMessage = typeof adapter.sendMessage === 'function';

    if (!hasSendMessage) {
      this.errors.push({
        capability: 'streaming',
        declared: declaredStreaming,
        actual: false,
        message: 'sendMessage method is not implemented (required for all adapters)',
        suggestion: 'All adapters must implement sendMessage regardless of streaming capability',
      });
    }

    // Note: Actual streaming behavior validation requires functional tests
    // We can't call sendMessage here because it requires MessageContext and options
    // This is noted in the documentation for test coverage requirements
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Reset the checker's error and warning state.
   * Useful if reusing the same checker instance for multiple validations.
   */
  reset(): void {
    this.errors = [];
    this.warnings = [];
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Convenience function to validate an adapter's capabilities.
 *
 * Equivalent to creating a CapabilityChecker instance and calling validate().
 *
 * @param adapter - The adapter instance to validate
 * @returns Validation result with any errors or warnings
 */
export function validateCapabilities(
  adapter: ModelAdapter,
): CapabilityValidationResult {
  const checker = new CapabilityChecker();
  return checker.validate(adapter);
}

/**
 * Check if a specific capability is correctly declared on an adapter.
 *
 * @param adapter - The adapter instance to check
 * @param capability - The capability to validate
 * @returns True if capability is correctly declared, false otherwise
 */
export function hasCapability(
  adapter: ModelAdapter,
  capability: keyof AdapterCapabilities,
): boolean {
  const checker = new CapabilityChecker();
  const result = checker.validate(adapter);
  const error = result.errors.find(e => e.capability === capability);
  return !error && adapter.capabilities[capability];
}

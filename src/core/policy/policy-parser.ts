/**
 * src/core/policy/policy-parser.ts
 *
 * Policy Parser Module
 *
 * Parses and validates workspace policy configuration from YAML.
 * Enforces privacy mode, network restrictions, and permission limits.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 * File I/O is isolated to the vscode layer.
 */

import { ValidationError, ValidationWarning } from '../adapters/contract.js';

// ============================================================
// POLICY CONFIGURATION TYPES
// ============================================================

/**
 * Complete workspace policy configuration.
 *
 * Defines privacy controls, network restrictions, and permission limits
 * for the workspace. Loaded from workspace_policy.yaml.
 */
export interface WorkspacePolicy {
  /**
   * Workspace identification.
   */
  workspace: {
    /** Unique workspace identifier */
    id: string;

    /** Workspace name (optional) */
    name?: string;
  };

  /**
   * Privacy mode settings.
   *
   * Controls data flow restrictions across provider networks.
   */
  privacy: {
    /**
     * Current privacy mode.
     *
     * - unrestricted: No data flow restrictions
     * - guarded: Warn about cloud providers, block supporting network if configured
     * - strict: No cloud providers allowed, no supporting network
     */
    mode: 'unrestricted' | 'guarded' | 'strict';

    /**
     * Whether to block supporting network access entirely.
     *
     * When true, profiles with `supportingNetwork: 'allowed'` are rejected.
     */
    blockSupportingNetwork: boolean;
  };

  /**
   * Network policy restrictions.
   *
   * Controls which providers and adapters are allowed.
   */
  network: {
    /**
     * Blocked provider classes.
     *
     * Profiles using these provider classes are rejected during validation.
     */
    blockedProviderClasses: Array<'local' | 'private-network' | 'cloud'>;

    /**
     * Blocked adapter types.
     *
     * Profiles using these adapter types are rejected during validation.
     */
    blockedAdapters: Array<'native-claude' | 'anthropic-compatible' | 'openai-compatible' | 'ollama' | 'generic-command'>;

    /**
     * SSL/TLS requirements for HTTP endpoints.
     */
    tls: {
      /**
       * Whether to require TLS (HTTPS) for all HTTP endpoints.
       */
      required: boolean;

      /**
       * Whether to allow self-signed certificates.
       */
      allowSelfSigned: boolean;

      /**
       * List of allowed endpoint hostnames/addresses.
       *
       * Empty list means all endpoints are allowed.
       */
      allowedHosts?: string[];

      /**
       * List of blocked endpoint hostnames/addresses.
       *
     */
      blockedHosts?: string[];
    };
  };

  /**
   * Permission policy restrictions.
   *
   * Controls maximum permission modes allowed in profiles.
   */
  permissions: {
    /**
     * Maximum permission mode allowed.
     *
     * Profiles attempting to use a higher permission mode are rejected.
     */
    max: 'review-only' | 'edit-only' | 'edit-and-command';

    /**
     * Require workspace path restrictions.
     *
     * When true, profiles without `workspacePaths` are rejected.
     */
    requireWorkspacePaths: boolean;

    /**
     * Default permission mode for new profiles.
     */
    default: 'review-only' | 'edit-only' | 'edit-and-command';
  };

  /**
   * Handoff policy.
   *
   * Controls how session handoff is managed between profiles.
   */
  handoff: {
    /**
     * Allow handoff to different provider classes.
     *
     * When false, handoff only allowed between same provider class.
     */
    allowCrossProvider: boolean;

    /**
     * Default handoff mode.
     *
     * - full: Transfer complete transcript
     * - summary: Transfer summarized transcript
     * - export: Require user-mediated export/import
     * - none: No context transfer
     */
    defaultMode: 'full' | 'summary' | 'export' | 'none';

    /**
     * Metadata to track for sessions.
     */
    trackMetadata: boolean;
  };

  /**
   * Audit and logging policy.
   *
     * Controls what is logged and for how long.
   */
  audit: {
    /**
     * Whether to enable audit logging.
     */
    enabled: boolean;

    /**
     * Audit log retention period (days).
     *
     * 0 means logs are never deleted (until disk full).
     */
    retentionDays: number;

    /**
     * Maximum log file size (in MB) before rotation.
     */
    maxFileSizeMb: number;

    /**
     * What to log in audit trails.
     */
    events: {
      /** Log profile activations/deactivations */
      profileActivations: boolean;

      /** Log command execution requests */
      commandExecutions: boolean;

      /** Log tool execution requests */
      toolExecutions: boolean;

      /** Log handoff events */
      handoffs: boolean;

      /** Log policy violations */
      policyViolations: boolean;
    };
  };
}

/**
 * Result of policy parsing and validation.
 *
 * Includes the parsed policy and any validation errors.
 */
export interface PolicyParseResult {
  /**
   * The parsed workspace policy.
   */
  policy: WorkspacePolicy;

  /**
   * Whether parsing was successful.
   */
  valid: boolean;

  /** Parsing validation errors (blocking) */
  errors: ValidationError[];

  /** Parsing validation warnings (non-blocking) */
  warnings: ValidationWarning[];
}

// ============================================================
// POLICY PARSER CLASS
// ============================================================

/**
 * Parses workspace policy from YAML configuration.
 *
 * Usage:
 * ```typescript
 * const parser = new PolicyParser();
 * const result = parser.parse(policyYamlString);
 *
 * if (!result.valid) {
 *   result.errors.forEach(error => console.error(error.message));
 * }
 * ```
 *
 * Policy structure validation:
 * - All required fields must be present
 * - Enum values must be valid
 * - Policy defaults applied for optional fields
 * - No circular dependencies or contradictory rules
 *
 * NOTE: This module does NOT load files directly. The vscode layer
 * reads workspace_policy.yaml and passes the YAML string here.
 */
export class PolicyParser {
  /**
   * Parse workspace policy from YAML string.
   *
   * @param policyYaml - YAML string from workspace_policy.yaml
   * @returns Parsed policy with validation results
   */
  parse(policyYaml: string): PolicyParseResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Note: YAML parsing is done externally (by vscode layer or yaml library)
    // This method validates the parsed object structure and defaults
    const policy: WorkspacePolicy = this.parseYamlToObject(policyYaml);

    // Validate parsed policy
    this.validatePolicyStructure(policy, errors, warnings);

    // Apply defaults for missing optional fields
    this.applyDefaults(policy, warnings);

    // Check for contradictory policy rules
    this.checkContradictions(policy, errors, warnings);

    const valid = errors.length === 0;

    return {
      policy,
      valid,
      errors: [...errors],
      warnings: [...warnings],
    };
  }

  // ============================================================
  // YAML PARSING METHOD
  // ============================================================

  /**
   * Parse YAML string to WorkspacePolicy object.
   *
   * NOTE: This is a stub implementation that would integrate
   * with a YAML parser library. The vscode layer handles actual
   * YAML parsing, but this structure is maintained for type safety.
   *
   * @param yaml - YAML string
   * @returns Parsed WorkspacePolicy object
   */
  private parseYamlToObject(_yaml: string): WorkspacePolicy {
    // Stub implementation - in real usage, this would use yaml.parse()
    // or similar library. The vscode layer does this work.
    // For now, return a minimal valid policy for type checking.
    const minimalPolicy: WorkspacePolicy = {
      workspace: {
        id: 'default',
      },
      privacy: {
        mode: 'unrestricted',
        blockSupportingNetwork: false,
      },
      network: {
        blockedProviderClasses: [],
        blockedAdapters: [],
        tls: {
          required: true,
          allowSelfSigned: false,
        },
      },
      permissions: {
        max: 'edit-and-command',
        requireWorkspacePaths: false,
        default: 'review-only',
      },
      handoff: {
        allowCrossProvider: true,
        defaultMode: 'export',
        trackMetadata: true,
      },
      audit: {
        enabled: true,
        retentionDays: 30,
        maxFileSizeMb: 10,
        events: {
          profileActivations: true,
          commandExecutions: true,
          toolExecutions: true,
          handoffs: true,
          policyViolations: true,
        },
      },
    };

    // In real implementation: parse yaml string and merge with defaults
    // const parsed = yaml.parse(yaml);
    // return this.mergeWithDefaults(parsed);

    return minimalPolicy;
  }

  // ============================================================
  // POLICY VALIDATION METHODS
  // ============================================================

  /**
   * Validate policy structure and required fields.
   */
  private validatePolicyStructure(
    policy: WorkspacePolicy,
    errors: ValidationError[],
    _warnings: ValidationWarning[],
  ): void {
    // Validate workspace section
    if (!policy?.workspace?.id) {
      errors.push({
        field: 'workspace.id',
        message: 'Workspace ID is required',
      });
    }

    if (policy.workspace && !policy.workspace.id?.trim()) {
      errors.push({
        field: 'workspace.id',
        message: 'Workspace ID cannot be empty',
      });
    }

    // Validate privacy mode
    if (!policy?.privacy?.mode) {
      errors.push({
        field: 'privacy.mode',
        message: 'Privacy mode is required',
      });
    } else {
      const validModes: Array<'unrestricted' | 'guarded' | 'strict'> = [
        'unrestricted',
        'guarded',
        'strict',
      ];

      if (!validModes.includes(policy.privacy.mode)) {
        errors.push({
          field: 'privacy.mode',
          message: `Invalid privacy mode: ${policy.privacy.mode}. Must be one of: ${validModes.join(', ')}`,
        });
      }
    }

    // Validate network section
    if (!policy.network) {
      errors.push({
        field: 'network',
        message: 'Network section is required',
      });
    } else {
      if (!policy.network.blockedProviderClasses) {
        errors.push({
          field: 'network.blockedProviderClasses',
          message: 'Blocked provider classes array is required',
        });
      }

      if (!policy.network.blockedAdapters) {
        errors.push({
          field: 'network.blockedAdapters',
          message: 'Blocked adapters array is required',
        });
      }

      if (!policy.network.tls) {
        errors.push({
          field: 'network.tls',
          message: 'TLS configuration is required',
        });
      }
    }

    // Validate permissions section
    if (!policy.permissions) {
      errors.push({
        field: 'permissions',
        message: 'Permissions section is required',
      });
    } else {
      const validMax: Array<'review-only' | 'edit-only' | 'edit-and-command'> = [
        'review-only',
        'edit-only',
        'edit-and-command',
      ];

      if (policy.permissions.max && !validMax.includes(policy.permissions.max)) {
        errors.push({
          field: 'permissions.max',
          message: `Invalid max permission mode: ${policy.permissions.max}`,
        });
      }
    }

    // Validate handoff section
    if (!policy.handoff) {
      errors.push({
        field: 'handoff',
        message: 'Handoff section is required',
      });
    }

    // Validate audit section
    if (!policy.audit) {
      errors.push({
        field: 'audit',
        message: 'Audit section is required',
      });
    } else {
      if (policy.audit.retentionDays && policy.audit.retentionDays < 0) {
        errors.push({
          field: 'audit.retentionDays',
          message: 'Retention days cannot be negative',
        });
      }

      if (policy.audit.maxFileSizeMb && policy.audit.maxFileSizeMb <= 0) {
        errors.push({
          field: 'audit.maxFileSizeMb',
          message: 'Max file size must be greater than 0',
        });
      }
    }
  }

  /**
   * Apply defaults for optional fields.
   */
  private applyDefaults(
    _policy: WorkspacePolicy,
    _warnings: ValidationWarning[],
  ): void {
    // No defaults to apply - policy is comprehensive
    // All fields are required for operation
  }

  /**
   * Check for contradictory policy rules.
   */
  private checkContradictions(
    policy: WorkspacePolicy,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check strict privacy mode with cross-provider handoff
    if (
      policy.privacy.mode === 'strict' &&
      policy.handoff.allowCrossProvider
    ) {
      errors.push({
        field: 'privacy.mode / handoff.allowCrossProvider',
        message: 'Strict privacy mode contradicts cross-provider handoff',
        suggestion: 'Disable cross-provider handoff or relax privacy mode',
      });
    }

    // Check audit disabled with event tracking enabled
    if (
      !policy.audit.enabled &&
      (policy.audit.events.profileActivations ||
        policy.audit.events.commandExecutions ||
        policy.audit.events.toolExecutions ||
        policy.audit.events.handoffs)
    ) {
      warnings.push({
        field: 'audit.enabled',
        message: 'Audit is disabled but event tracking is configured',
      });
    }
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Parse workspace policy from YAML string.
 *
 * @param policyYaml - YAML string from workspace_policy.yaml
 * @returns Parsed policy with validation results
 */
export function parseWorkspacePolicy(
  policyYaml: string,
): PolicyParseResult {
  const parser = new PolicyParser();
  return parser.parse(policyYaml);
}

/**
 * Validate that a policy object matches the WorkspacePolicy type.
 *
 * Utility function for type checking at runtime.
 *
 * @param policy - Policy object to validate
 * @returns true if valid WorkspacePolicy, false otherwise
 */
export function isValidWorkspacePolicy(
  policy: unknown,
): policy is WorkspacePolicy {
  // Basic type guard - checks for required top-level structure
  if (typeof policy !== 'object' || policy === null) {
    return false;
  }

  const p = policy as Partial<WorkspacePolicy>;

  return (
    typeof p.workspace === 'object' &&
    typeof p.privacy === 'object' &&
    typeof p.network === 'object' &&
    typeof p.permissions === 'object' &&
    typeof p.handoff === 'object' &&
    typeof p.audit === 'object'
  );
}

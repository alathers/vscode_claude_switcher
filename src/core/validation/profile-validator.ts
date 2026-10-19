/**
 * src/core/validation/profile-validator.ts
 *
 * Profile Validator Module
 *
 * Validates profile configuration before activation. Performs schema validation,
 * policy compatibility checks, endpoint reachability, and capability validation.
 *
 * This module contains NO VS Code API imports - pure TypeScript logic.
 * SecretStorage access is isolated to the vscode layer (K384-K388).
 */

import {
  ProfileConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../adapters/contract.js';

// ============================================================
// VALIDATION RESULT TYPES
// ============================================================

/**
 * Extended validation result that includes adapter capability validation.
 *
 * Extends ValidationResult to include adapter-specific validation state
 * from the CapabilityChecker.
 */
export interface ProfileValidation extends ValidationResult {
  /**
   * Adapter capability validation result.
   * Empty if no adapter was provided for validation.
   */
  capabilities?: {
    /** Whether adapter capabilities match the profile declaration */
    valid: boolean;
    /** Capability-specific errors (blocking) */
    errors: Array<{
      capability: string;
      message: string;
      suggestion?: string;
    }>;
    /** Capability-specific warnings */
    warnings: Array<{
      capability: string;
      message: string;
    }>;
  };
}

/**
 * Policy compatibility check result.
 *
 * Validates that the profile configuration does not violate policy rules.
 */
export interface PolicyCompatibility {
  /** Whether the profile is compatible with the policy */
  compatible: boolean;

  /** Blocking policy violations */
  violations: PolicyViolation[];

  /** Non-violating policy warnings */
  warnings: PolicyWarning[];
}

/**
 * A blocking policy violation.
 */
export interface PolicyViolation {
  /** Rule path/identifier */
  rule: string;

  /** Violation message */
  message: string;

  /** Profile field causing the violation */
  field: string;

  /** Suggested fix or alternative */
  suggestion?: string;
}

/**
 * A non-blocking policy warning.
 */
export interface PolicyWarning {
  /** Rule path/identifier */
  rule: string;

  /** Warning message */
  message: string;

  /** Profile field triggering the warning */
  field: string;
}

// ============================================================
// PROFILE VALIDATOR CLASS
// ============================================================

/**
 * Validates profile configurations before activation.
 *
 * Usage:
 * ```typescript
 * const validator = new ProfileValidator();
 * const result = validator.validate(profileConfig);
 *
 * if (!result.valid) {
 *   result.errors.forEach(error => console.error(error.message));
 * }
 * ```
 *
 * Validation layers (FR-064, FR-071):
 * 1. Schema validation (already done by YAML parser before this is called)
 * 2. Policy compatibility checks
 * 3. Secret reference existence (via SecretStorage wrapper in vscode layer)
 * 4. Endpoint reachability (if health check configured)
 * 5. Capability declaration validation (via CapabilityChecker)
 *
 * NOTE: SecretStorage access is NOT done in this module. The vscode layer
 * wrapper must supply resolved secrets or existence status.
 */
export class ProfileValidator {
  // private capabilityChecker: CapabilityChecker;  // TODO: Use when validating adapter capabilities

  constructor() {
    // this.capabilityChecker = new CapabilityChecker();
  }

  /**
   * Validate a complete profile configuration.
   *
   * @param config - Profile configuration to validate
   * @returns Extended validation result with capability status
   */
  validateProfile(config: ProfileConfig): ProfileValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Basic configuration validation
    this.validateConfigFields(config, errors, warnings);

    // 2. Network classification validation
    this.validateNetworkClassification(config, errors, warnings);

    // 3. Permission mode validation
    this.validatePermissions(config, errors, warnings);

    // 4. Capability validation (if adapter instance provided)
    // Note: Adapter not available at this layer - done during activation
    // This validates that profile.capabilities are set correctly

    const valid = errors.length === 0;

    return {
      valid,
      errors: [...errors],
      warnings: [...warnings],
      // capabilities field populated when adapter is available in vscode layer
    };
  }

  /**
   * Validate policy compatibility.
   *
   * Checks if profile configuration is compatible with the configured policy.
   * This is a pure logic check based on policy rules - actual policy enforcement
   * happens during activation.
   *
   * @param config - Profile configuration
   * @param policy - Policy configuration (subset relevant to validation)
   * @returns Policy compatibility result
   */
  validatePolicy(
    config: ProfileConfig,
    policy: PolicyConfig,
  ): PolicyCompatibility {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    // Check privacy mode restrictions
    this.validatePrivacyMode(config, policy, violations, warnings);

    // Check network policy restrictions
    this.validateNetworkPolicy(config, policy, violations);

    // Check permission mode restrictions
    this.validatePermissionPolicy(config, policy, violations);

    return {
      compatible: violations.length === 0,
      violations: [...violations],
      warnings: [...warnings],
    };
  }

  // ============================================================
  // CONFIGURATION VALIDATION METHODS
  // ============================================================

  /**
   * Validate basic configuration fields.
   */
  private validateConfigFields(
    config: ProfileConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Validate adapter type
    const validAdapters: Array<ProfileConfig['adapter']> = [
      'native-claude',
      'anthropic-compatible',
      'openai-compatible',
      'ollama',
      'generic-command',
    ];

    if (!validAdapters.includes(config.adapter)) {
      errors.push({
        field: 'adapter',
        message: `Invalid adapter type: ${config.adapter}. Must be one of: ${validAdapters.join(', ')}`,
      });
    }

    // Validate model ID is not empty
    if (!config.model || config.model.trim() === '') {
      errors.push({
        field: 'model',
        message: 'Model ID is required and cannot be empty',
      });
    }

    // Validate credential mode
    const validModes: Array<ProfileConfig['credential']['mode']> = [
      'none',
      'secretRef',
      'environment',
      'subscription',
      'multi-key',
    ];

    if (!validModes.includes(config.credential.mode)) {
      errors.push({
        field: 'credential.mode',
        message: `Invalid credential mode: ${config.credential.mode}`,
      });
    }

    if (config.credential.mode === 'secretRef' && !config.credential.secretRef) {
      errors.push({
        field: 'credential.secretRef',
        message: 'secretRef is required when credential.mode is "secretRef"',
      });
    }

    if (config.credential.mode === 'multi-key') {
      if (!config.credential.secretRefs || config.credential.secretRefs.length === 0) {
        errors.push({
          field: 'credential.secretRefs',
          message: 'secretRefs array with at least one entry is required when credential.mode is "multi-key"',
        });
      }
      if (config.credential.secretRef) {
        const typedConfig = config as ProfileConfig & { credential: { secretRef?: string } };
        if (typedConfig.credential.secretRef) {
          warnings.push({
            field: 'credential',
            message: 'Both secretRef and secretRefs are present. Using secretRefs array for multi-key mode.',
          });
        }
      }
    }

    // Validate permission mode
    const validPermModes: Array<ProfileConfig['permissions']['mode']> = [
      'review-only',
      'edit-only',
      'edit-and-command',
    ];

    if (!validPermModes.includes(config.permissions.mode)) {
      errors.push({
        field: 'permissions.mode',
        message: `Invalid permission mode: ${config.permissions.mode}`,
      });
    }
  }

  /**
   * Validate network classification for consistency.
   */
  private validateNetworkClassification(
    config: ProfileConfig,
    errors: ValidationError[],
    _warnings: ValidationWarning[],
  ): void {

    const validProviderClasses: Array<ProfileConfig['network']['providerClass']> = [
      'local',
      'private-network',
      'cloud',
    ];

    if (!validProviderClasses.includes(config.network.providerClass)) {
      errors.push({
        field: 'network.providerClass',
        message: `Invalid provider class: ${config.network.providerClass}`,
      });
    }

    const validSupportingNetwork: Array<ProfileConfig['network']['supportingNetwork']> = [
      'allowed',
      'blocked',
    ];

    if (!validSupportingNetwork.includes(config.network.supportingNetwork)) {
      errors.push({
        field: 'network.supportingNetwork',
        message: `Invalid supporting network status: ${config.network.supportingNetwork}`,
      });
    }
  }

  /**
   * Validate permission mode consistency.
   */
  private validatePermissions(
    config: ProfileConfig,
    errors: ValidationError[],
    _warnings: ValidationWarning[],
  ): void {

    // Check workspace paths are provided paths array mode
    if (config.permissions.workspacePaths) {
      if (!Array.isArray(config.permissions.workspacePaths)) {
        errors.push({
          field: 'permissions.workspacePaths',
          message: 'workspacePaths must be an array',
        });
      }
    }
  }

  // ============================================================
  // POLICY VALIDATION METHODS
  // ============================================================

  /**
   * Validate privacy mode restrictions.
   */
  private validatePrivacyMode(
    config: ProfileConfig,
    policy: PolicyConfig,
    violations: PolicyViolation[],
    warnings: PolicyWarning[],
  ): void {
    const privacyMode = policy.privacyMode;

    // Strict mode: no cloud providers allowed
    if (privacyMode === 'strict' && config.network.providerClass === 'cloud') {
      violations.push({
        rule: 'privacy.strict.no-cloud',
        message: 'Strict privacy mode prohibits cloud providers',
        field: 'network.providerClass',
        suggestion: 'Use local, private-network provider, or relax privacy mode',
      });
    }

    // Guarded mode: warn about cloud providers
    if (privacyMode === 'guarded' && config.network.providerClass === 'cloud') {
      warnings.push({
        rule: 'privacy.guarded.cloud-warning',
        message: "Guarded privacy mode: cloud provider - confirm data won't leave local network",
        field: 'network.providerClass',
      });
    }

    // Supporting network check
    if (policy.blockSupportingNetwork && config.network.supportingNetwork === 'allowed') {
      violations.push({
        rule: 'privacy.block-supporting-network',
        message: 'Supporting network is blocked by policy',
        field: 'network.supportingNetwork',
        suggestion: 'Set supportingNetwork to "blocked" or change policy',
      });
    }
  }

  /**
   * Validate network policy restrictions.
   */
  private validateNetworkPolicy(
    config: ProfileConfig,
    policy: PolicyConfig,
    violations: PolicyViolation[],
  ): void {
    // Check if provider class is blocked
    const blockedProviders = policy.blockedProviderClasses ?? [];
    if (blockedProviders.includes(config.network.providerClass)) {
      violations.push({
        rule: 'network.blocked-provider',
        message: `Provider class "${config.network.providerClass}" is blocked by policy`,
        field: 'network.providerClass',
      });
    }

    // Check specific adapter restrictions
    const blockedAdapters = policy.blockedAdapters ?? [];
    if (blockedAdapters.includes(config.adapter)) {
      violations.push({
        rule: 'network.blocked-adapter',
        message: `Adapter type "${config.adapter}" is blocked by policy`,
        field: 'adapter',
      });
    }
  }

  /**
   * Validate permission mode restrictions.
   */
  private validatePermissionPolicy(
    config: ProfileConfig,
    policy: PolicyConfig,
    violations: PolicyViolation[],
  ): void {
    // Check if permission mode exceeds policy maximum
    const permHierarchy = {
      'review-only': 1,
      'edit-only': 2,
      'edit-and-command': 3,
    };

    const maxPermission = policy.maxPermissionMode ?? 'edit-and-command';
    const configPermission = config.permissions.mode;

    if (
      permHierarchy[configPermission] > permHierarchy[maxPermission]
    ) {
      violations.push({
        rule: 'permissions.max-exceeded',
        message: `Permission mode "${configPermission}" exceeds policy maximum of "${maxPermission}"`,
        field: 'permissions.mode',
        suggestion: `Use a permission mode at or below "${maxPermission}"`,
      });
    }
  }
}

// ============================================================
// POLICY CONFIG TYPES
// ============================================================

/**
 * Subset of policy configuration used for validation.
 *
 * This is the minimal policy interface needed for validation checks.
 * The full policy structure is loaded from workspace_policy.yaml.
 */
export interface PolicyConfig {
  /**
   * Current privacy mode setting.
   */
  privacyMode: 'unrestricted' | 'guarded' | 'strict';

  /**
   * Whether to block supporting network access.
   */
  blockSupportingNetwork?: boolean;

  /**
   * Provider classes blocked by policy.
   */
  blockedProviderClasses?: Array<'local' | 'private-network' | 'cloud'>;

  /**
   * Adapter types blocked by policy.
   */
  blockedAdapters?: Array<ProfileConfig['adapter']>;

  /**
   * Maximum permission mode allowed (defaults to edit-and-command).
   */
  maxPermissionMode?: 'review-only' | 'edit-only' | 'edit-and-command';
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Convenience function to validate a profile configuration.
 *
 * @param config - Profile configuration to validate
 * @returns Provalidation result
 */
export function validateProfile(
  config: ProfileConfig,
): ProfileValidation {
  const validator = new ProfileValidator();
  return validator.validateProfile(config);
}

/**
 * Check if a profile configuration is valid.
 *
 * Equivalent to validating and checking the valid flag.
 *
 * @param config - Profile configuration to validate
 * @returns true if profile is valid, false otherwise
 */
export function isProfileValid(
  config: ProfileConfig,
): boolean {
  const validator = new ProfileValidator();
  return validator.validateProfile(config).valid;
}

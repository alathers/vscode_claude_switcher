/**
 * tests/unit/core/validation/profile-validator.test.ts
 *
 * Unit tests for profile-validator.ts
 * Tests profile configuration validation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  ProfileValidator,
  validateProfile,
  isProfileValid,
  type ProfileValidation,
  type PolicyConfig,
} from '@src/core/validation/profile-validator';
import type {
  ProfileConfig,
  ValidationResult,
} from '@src/core/adapters/contract';

describe('ProfileValidator', () => {
  describe('validateProfile', () => {
    it('should validate a complete valid profile', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: {
          mode: 'secretRef',
          secretRef: 'api-key-profile1',
        },
        permissions: {
          mode: 'edit-only',
        },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should validate profile with no credentials', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'local-profile',
        adapter: 'ollama',
        model: 'llama2',
        credential: {
          mode: 'none',
        },
        permissions: {
          mode: 'edit-only',
        },
        network: {
          providerClass: 'local',
          supportingNetwork: 'blocked',
        },
        capabilities: {
          streaming: true,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid adapter type', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'invalid-adapter' as any,
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('adapter');
      expect(result.errors[0].message).toContain('Invalid adapter type');
    });

    it('should reject empty model ID', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: '',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('model');
      expect(result.errors[0].message).toContain('required');
    });

    it('should reject invalid credential mode', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'invalid-mode' as any },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('credential.mode');
      expect(result.errors[0].message).toContain('Invalid credential mode');
    });

    it('should reject secretRef credential without secretRef value', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: {
          mode: 'secretRef',
          // missing secretRef
        } as any,
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'credential.secretRef')).toBe(true);
      expect(result.errors.some(e => e.message.includes('secretRef is required'))).toBe(true);
    });

    it('should reject invalid permission mode', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'invalid-mode' as any },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('permissions.mode');
      expect(result.errors[0].message).toContain('Invalid permission mode');
    });

    it('should reject invalid provider class', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'invalid-class' as any,
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'network.providerClass')).toBe(true);
    });

    it('should reject invalid supportingNetwork value', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'invalid-value' as any,
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'network.supportingNetwork')).toBe(true);
    });

    it('should reject non-array workspacePaths', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: {
          mode: 'edit-only',
          workspacePaths: '/single/path' as any,
        },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'permissions.workspacePaths')).toBe(true);
    });

    it('should accept valid workspacePaths array', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: {
          mode: 'edit-only',
          workspacePaths: ['/safe/path', '/another/path'],
        },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(true);
    });

    it('should accumulate multiple validation errors', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'invalid-adapter' as any,
        model: '',
        credential: { mode: 'invalid-mode' as any },
        permissions: { mode: 'invalid-mode' as any },
        network: {
          providerClass: 'invalid-class' as any,
          supportingNetwork: 'invalid-value' as any,
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('validatePolicy', () => {
    it('should accept profile compatible with unrestricted policy', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-and-command' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should reject cloud provider in strict privacy mode', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'strict',
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].rule).toBe('privacy.strict.no-cloud');
      expect(result.violations[0].field).toBe('network.providerClass');
    });

    it('should warn about cloud provider in guarded privacy mode', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'guarded',
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].rule).toBe('privacy.guarded.cloud-warning');
      expect(result.warnings[0].field).toBe('network.providerClass');
    });

    it('should reject blocked supporting network', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'private-network',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        blockSupportingNetwork: true,
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].rule).toBe('privacy.block-supporting-network');
      expect(result.violations[0].field).toBe('network.supportingNetwork');
    });

    it('should reject blocked provider class', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        blockedProviderClasses: ['cloud'],
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(false);
      expect(result.violations.some(v => v.rule === 'network.blocked-provider')).toBe(true);
      expect(result.violations[0].field).toBe('network.providerClass');
    });

    it('should reject blocked adapter type', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'openai-compatible',
        model: 'gpt-4',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        blockedAdapters: ['openai-compatible'],
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(false);
      expect(result.violations.some(v => v.rule === 'network.blocked-adapter')).toBe(true);
      expect(result.violations[0].field).toBe('adapter');
    });

    it('should reject permission mode exceeding policy maximum', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-and-command' },
        network: {
          providerClass: 'local',
          supportingNetwork: 'blocked',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        maxPermissionMode: 'review-only',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(false);
      expect(result.violations.some(v => v.rule === 'permissions.max-exceeded')).toBe(true);
      expect(result.violations[0].field).toBe('permissions.mode');
    });

    it('should accept permission mode equal to policy maximum', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'local',
          supportingNetwork: 'blocked',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        maxPermissionMode: 'edit-only',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should accept permission mode below policy maximum', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'review-only' },
        network: {
          providerClass: 'local',
          supportingNetwork: 'blocked',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'unrestricted',
        maxPermissionMode: 'edit-and-command',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should handle policy with multiple restrictions', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'openai-compatible',
        model: 'gpt-4',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-and-command' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const policy: PolicyConfig = {
        privacyMode: 'strict',
        blockedAdapters: ['openai-compatible'],
        maxPermissionMode: 'edit-only',
      };

      const result = validator.validatePolicy(config, policy);

      expect(result.compatible).toBe(false);
      expect(result.violations.length).toBeGreaterThan(2);
    });
  });

  describe('Utility functions', () => {
    it('validateProfile should validate using utility function', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validateProfile(config);

      expect(result.valid).toBe(true);
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });

    it('isProfileValid should return true for valid profile', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const isValid = isProfileValid(config);

      expect(isValid).toBe(true);
    });

    it('isProfileValid should return false for invalid profile', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'invalid-adapter' as any,
        model: '',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const isValid = isProfileValid(config);

      expect(isValid).toBe(false);
    });
  });

  describe('ProfileValidation type', () => {
    it('should return ProfileValidation with all required fields', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result = validator.validateProfile(config);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      // capabilities field is optional and populated only when adapter is available
      expect(result.capabilities).toBeUndefined();
    });

    it('should type-cast result as ProfileValidation', () => {
      const validator = new ProfileValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      const result: ProfileValidation = validator.validateProfile(config);

      // Verify type structure
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('Valid adapter types', () => {
    it('should accept all valid adapter types', () => {
      const validator = new ProfileValidator();
      const validAdapters = [
        'native-claude',
        'anthropic-compatible',
        'openai-compatible',
        'ollama',
        'generic-command',
      ];

      validAdapters.forEach(adapter => {
        const config: ProfileConfig = {
          id: 'test-profile',
          adapter: adapter as any,
          model: 'test-model',
          credential: { mode: 'none' },
          permissions: { mode: 'edit-only' },
          network: {
            providerClass: 'local',
            supportingNetwork: 'blocked',
          },
          capabilities: {
            streaming: false,
            tools: false,
            fileEdits: false,
            commands: false,
            modelDiscovery: false,
            transcriptObservable: false,
          },
        };

        const result = validator.validateProfile(config);
        expect(result.valid).toBe(true);
      });
    });
  });
});

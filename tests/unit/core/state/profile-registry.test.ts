/**
 * tests/unit/core/state/profile-registry.test.ts
 *
 * Unit tests for profile-registry.ts
 * Tests profile loading, template overlay, merging defaults, and validation logic.
 */

import { describe, it, expect } from 'vitest';
import type { ProfileConfig } from '@src/core/adapters/contract';
import {
  ProfileRegistry,
  ProfileLoadError,
  ProfileValidationError,
  type ProfileLoadResult,
  type TemplateOverlayResult,
  type ProfileMergeDefaults,
} from '@src/core/state/profile-registry';

describe('ProfileRegistry', () => {
  describe('loadUserProfile', () => {
    it('should load valid profile from YAML string', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: test-profile
label: Test Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: my-api-key
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('test-profile', yaml);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.id).toBe('test-profile');
      expect(result.profile?.label).toBe('Test Profile');
      expect(result.profile?.adapter).toBe('anthropic-compatible');
      expect(result.profile?.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.errors).toEqual([]);
    });

    it('should handle profile with schemaVersion 1', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: version-one
label: Version One
adapter: openai-compatible
model: gpt-4
credential:
  mode: environment
permissions:
  mode: review-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: false
  tools: false
  fileEdits: false
  commands: false
  modelDiscovery: false
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('version-one', yaml);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.schemaVersion).toBe(1);
    });

    it('should handle profile with baseUrl', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: custom-endpoint
label: Custom Endpoint
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
baseUrl: https://api.custom.com/v1
credential:
  mode: secretRef
  secretRef: custom-key
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('custom-endpoint', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.baseUrl).toBe('https://api.custom.com/v1');
    });

    it('should handle profile with tunnel configuration', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: tunnel-profile
label: Tunnel Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: api-key
tunnel:
  enabled: true
  sshHostAlias: work-server
  localPort: 9000
permissions:
  mode: edit-only
network:
  providerClass: private-network
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('tunnel-profile', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.tunnel).toEqual({
        enabled: true,
        sshHostAlias: 'work-server',
        localPort: 9000,
      });
    });

    it('should handle profile with limits', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: limited-profile
label: Limited Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: api-key
limits:
  contextTokens: 100000
  maxOutputTokens: 4000
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('limited-profile', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.limits).toEqual({
        contextTokens: 100000,
        maxOutputTokens: 4000,
      });
    });

    it('should handle profile with workspace path restrictions', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: restricted-path
label: Restricted Path
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: api-key
permissions:
  mode: edit-only
  workspacePaths:
    - src/
    - tests/
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('restricted-path', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.permissions.workspacePaths).toEqual(['src/', 'tests/']);
    });

    it('should handle profile with environment refs', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: env-profile
label: Environment Profile
adapter: generic-command
model: custom-cli
credential:
  mode: environment
permissions:
  mode: edit-and-command
network:
  providerClass: local
  supportingNetwork: allowed
capabilities:
  streaming: false
  tools: false
  fileEdits: false
  commands: true
  modelDiscovery: false
  transcriptObservable: false
environmentRefs:
  - CUSTOM_API_ENDPOINT
  - CUSTOM_API_KEY
`;

      const result = registry.loadUserProfile('env-profile', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.environmentRefs).toEqual(['CUSTOM_API_ENDPOINT', 'CUSTOM_API_KEY']);
    });

    it('should handle profile with instructions', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: instructed-profile
label: Instructed Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: api-key
instructions: |
  You are an expert TypeScript developer. Focus on type safety and performance.
  Always write tests for your code.
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('instructed-profile', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.instructions).toContain('You are an expert TypeScript developer');
    });

    it('should handle profile with health check', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: health-check-profile
label: Health Check Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: api-key
healthCheck:
  url: /health
  method: GET
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('health-check-profile', yaml);

      expect(result.success).toBe(true);
      expect(result.profile?.healthCheck).toEqual({
        url: '/health',
        method: 'GET',
      });
    });

    it('should handle different adapter types', () => {
      const registry = new ProfileRegistry();
      const adapters = [
        'native-claude',
        'anthropic-compatible',
        'openai-compatible',
        'ollama',
        'generic-command',
      ] as const;

      adapters.forEach((adapter) => {
        const yaml = `
schemaVersion: 1
id: ${adapter}-profile
label: ${adapter} Profile
adapter: ${adapter}
model: test-model
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: adapter === 'generic-command'
  modelDiscovery: true
  transcriptObservable: false
`;

        const result = registry.loadUserProfile(`${adapter}-profile`, yaml);

        expect(result.success).toBe(true);
        expect(result.profile?.adapter).toBe(adapter);
      });
    });

    it('should handle different credential modes', () => {
      const registry = new ProfileRegistry();
      const modes = ['none', 'secretRef', 'environment', 'subscription'] as const;

      modes.forEach((mode) => {
        const yaml = `
schemaVersion: 1
id: ${mode}-profile
label: ${mode} Profile
adapter: anthropic-compatible
model: test-model
credential:
  mode: ${mode}
  ${mode === 'secretRef' ? 'secretRef: api-key' : ''}
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

        const result = registry.loadUserProfile(`${mode}-profile`, yaml);

        expect(result.success).toBe(true);
        expect(result.profile?.credential.mode).toBe(mode);
      });
    });

    it('should handle different network provider classes', () => {
      const registry = new ProfileRegistry();
      const providerClasses = ['local', 'private-network', 'cloud'] as const;

      providerClasses.forEach((providerClass) => {
        const yaml = `
schemaVersion: 1
id: ${providerClass}-profile
label: ${providerClass} Profile
adapter: anthropic-compatible
model: test-model
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: ${providerClass}
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

        const result = registry.loadUserProfile(`${providerClass}-profile`, yaml);

        expect(result.success).toBe(true);
        expect(result.profile?.network.providerClass).toBe(providerClass);
      });
    });

    it('should reject invalid YAML', () => {
      const registry = new ProfileRegistry();
      const yaml = `invalid yaml content: {malformed`;

      const result = registry.loadUserProfile('invalid', yaml);

      expect(result.success).toBe(false);
      expect(result.profile).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject profile missing required id field', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
label: No ID Profile
adapter: anthropic-compatible
model: test-model
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadUserProfile('test', yaml);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.path.includes('id'))).toBe(true);
    });
  });

  describe('loadTemplate', () => {
    it('should load valid template from YAML string', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: team-template
label: Team Template
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadTemplate('team-template', yaml);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.id).toBe('team-template');
    });

    it('should reject template containing secretRef', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: bad-template
label: Bad Template
adapter: anthropic-compatible
model: test-model
credential:
  mode: secretRef
  secretRef: forbidden-secret
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadTemplate('bad-template', yaml);

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) =>
          e.message.includes('Templates must not contain') && e.message.includes('secretRef'),
        ),
      ).toBe(true);
    });

    it('should allow template with credential.mode none', () => {
      const registry = new ProfileRegistry();
      const yaml = `
schemaVersion: 1
id: safe-template
label: Safe Template
adapter: anthropic-compatible
model: test-model
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const result = registry.loadTemplate('safe-template', yaml);

      expect(result.success).toBe(true);
    });
  });

  describe('mergeDefaults', () => {
    it('should merge defaults into partial profile', () => {
      const registry = new ProfileRegistry();
      const partial = {
        id: 'partial-profile',
        adapter: 'anthropic-compatible' as const,
        model: 'claude-3-5-sonnet-20241022',
        credential: { mode: 'secretRef' as const, secretRef: 'my-key' },
        permissions: { mode: 'edit-only' as const },
        network: { providerClass: 'cloud' as const, supportingNetwork: 'allowed' as const },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      } satisfies Partial<ProfileConfig>;

      const defaults: ProfileMergeDefaults = {
        schemaVersion: 1,
        label: 'Default Label',
        tunnel: { enabled: false, sshHostAlias: null, localPort: null },
        limits: null,
        instructions: null,
        environmentRefs: [],
        healthCheck: null,
      };

      const result = registry.mergeDefaults(partial, defaults);

      expect(result.schemaVersion).toBe(1);
      expect(result.label).toBe('Default Label');
      expect(result.tunnel).toEqual({ enabled: false, sshHostAlias: null, localPort: null });
      expect(result.limits).toBeNull();
      expect(result.instructions).toBeNull();
      expect(result.environmentRefs).toEqual([]);
      expect(result.healthCheck).toBeNull();
    });

    it('should preserve user-provided values over defaults', () => {
      const registry = new ProfileRegistry();
      const partial = {
        id: 'user-profile',
        adapter: 'anthropic-compatible' as const,
        model: 'claude-3-5-sonnet-20241022',
        label: 'User Custom Label',
        credential: { mode: 'secretRef' as const, secretRef: 'my-key' },
        tunnel: { enabled: true, sshHostAlias: 'custom-host', localPort: 8080 },
        permissions: { mode: 'edit-only' as const },
        network: { providerClass: 'cloud' as const, supportingNetwork: 'allowed' as const },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      } satisfies Partial<ProfileConfig>;

      const defaults: ProfileMergeDefaults = {
        schemaVersion: 1,
        label: 'Default Label',
        tunnel: { enabled: false, sshHostAlias: null, localPort: null },
        limits: null,
        instructions: null,
        environmentRefs: [],
        healthCheck: null,
      };

      const result = registry.mergeDefaults(partial, defaults);

      expect(result.label).toBe('User Custom Label');
      expect(result.tunnel).toEqual({ enabled: true, sshHostAlias: 'custom-host', localPort: 8080 });
    });
  });

  describe('overlayTemplate', () => {
    it('should overlay user profile onto template', () => {
      const registry = new ProfileRegistry();
      const templateYaml = `
schemaVersion: 1
id: team-template
label: Team Template
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
baseUrl: https://api.anthropic.com
credential:
  mode: none
tunnel:
  enabled: true
  sshHostAlias: work-server
  localPort: 9000
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const userOverlayYaml = `
schemaVersion: 1
id: team-template
label: My Team Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: my-team-key
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const templateResult = registry.loadTemplate('team-template', templateYaml);
      expect(templateResult.success).toBe(true);

      const userResult = registry.loadUserProfile('team-template', userOverlayYaml);
      expect(userResult.success).toBe(true);

      const overlayResult = registry.overlayTemplate(
        userResult.profile!,
        templateResult.profile!,
      );

      expect(overlayResult.success).toBe(true);
      expect(overlayResult.mergedProfile).toBeDefined();
      expect(overlayResult.mergedProfile?.id).toBe('team-template');
      expect(overlayResult.mergedProfile?.label).toBe('My Team Profile');
      expect(overlayResult.mergedProfile?.baseUrl).toBe('https://api.anthropic.com');
      expect(overlayResult.mergedProfile?.credential.mode).toBe('secretRef');
      expect(overlayResult.mergedProfile?.credential.secretRef).toBe('my-team-key');
      expect(overlayResult.mergedProfile?.tunnel).toEqual({
        enabled: true,
        sshHostAlias: 'work-server',
        localPort: 9000,
      });
    });

    it('should handle user overlay without template', () => {
      const registry = new ProfileRegistry();
      const userYaml = `
schemaVersion: 1
id: standalone-profile
label: Standalone Profile
adapter: anthropic-compatible
model: claude-3-5-sonnet-20241022
credential:
  mode: secretRef
  secretRef: my-key
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const userResult = registry.loadUserProfile('standalone-profile', userYaml);
      expect(userResult.success).toBe(true);

      const overlayResult = registry.overlayTemplate(userResult.profile!, null);

      expect(overlayResult.success).toBe(true);
      expect(overlayResult.mergedProfile).toEqual(userResult.profile);
    });

    it('should reject overlay with mismatched IDs', () => {
      const registry = new ProfileRegistry();
      const templateYaml = `
schemaVersion: 1
id: template-a
label: Template A
adapter: anthropic-compatible
model: test-model
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const userYaml = `
schemaVersion: 1
id: user-b
label: User B
adapter: anthropic-compatible
model: test-model
credential:
  mode: secretRef
  secretRef: my-key
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

      const templateResult = registry.loadTemplate('template-a', templateYaml);
      const userResult = registry.loadUserProfile('user-b', userYaml);

      const overlayResult = registry.overlayTemplate(userResult.profile!, templateResult.profile!);

      expect(overlayResult.success).toBe(false);
      expect(
        overlayResult.errors.some((e) => e.message.includes('ID mismatch')),
      ).toBe(true);
    });
  });

  describe('validateProfileConfig', () => {
    it('should validate well-formed profile config', () => {
      const registry = new ProfileRegistry();
      const config: ProfileConfig = {
        id: 'valid-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: { mode: 'secretRef', secretRef: 'my-key' },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      };

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject profile with invalid ID format', () => {
      const registry = new ProfileRegistry();
      const config: ProfileConfig = {
        schemaVersion: 1,
        label: 'Invalid ID Profile',
        id: 'Invalid_ID with spaces!',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      };

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('id'))).toBe(true);
    });

    it('should reject profile with invalid adapter', () => {
      const registry = new ProfileRegistry();
      const config = {
        schemaVersion: 1,
        label: 'Invalid Adapter Profile',
        id: 'invalid-adapter',
        adapter: 'invalid-adapter' as any,
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      } satisfies ProfileConfig;

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('adapter'))).toBe(true);
    });

    it('should reject profile with invalid credentials.mode', () => {
      const registry = new ProfileRegistry();
      const config = {
        schemaVersion: 1,
        label: 'Invalid Credential Mode Profile',
        id: 'invalid-credential-mode',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'invalid' as any },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      } satisfies ProfileConfig;

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('credential'))).toBe(true);
    });

    it('should reject profile with secretRef but no secret reference', () => {
      const registry = new ProfileRegistry();
      const config: ProfileConfig = {
        schemaVersion: 1,
        label: 'Missing Secret Ref Profile',
        id: 'missing-secret-ref',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'secretRef', secretRef: null },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      };

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.message.toLowerCase().includes('secretref must be provided')),
      ).toBe(true);
    });

    it('should reject profile with tunnel enabled but missing sshHostAlias', () => {
      const registry = new ProfileRegistry();
      const config: ProfileConfig = {
        schemaVersion: 1,
        label: 'Tunnel Missing Host Profile',
        id: 'tunnel-missing-host',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        tunnel: { enabled: true, sshHostAlias: null, localPort: 9000 },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      };

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.message.toLowerCase().includes('tunnel') && e.message.toLowerCase().includes('sshhostalias'),
        ),
      ).toBe(true);
    });

    it('should reject profile with invalid permission mode', () => {
      const registry = new ProfileRegistry();
      const config = {
        schemaVersion: 1,
        label: 'Invalid Permission Profile',
        id: 'invalid-permission',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'invalid' as any },
        network: { providerClass: 'cloud', supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      } satisfies ProfileConfig;

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('permission'))).toBe(true);
    });

    it('should reject profile with invalid network.providerClass', () => {
      const registry = new ProfileRegistry();
      const config = {
        schemaVersion: 1,
        label: 'Invalid Network Provider Profile',
        id: 'invalid-network',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: { mode: 'none' },
        permissions: { mode: 'edit-only' },
        network: { providerClass: 'invalid' as any, supportingNetwork: 'allowed' },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: true,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
      } satisfies ProfileConfig;

      const result = registry.validateProfileConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('network'))).toBe(true);
    });
  });

  describe('ProfileLoadError', () => {
    it('should create error with message and code', () => {
      const error = new ProfileLoadError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
    });
  });

  describe('ProfileValidationError', () => {
    it('should create error with message and code', () => {
      const error = new ProfileValidationError('Validation failed', 'VALIDATION_ERROR');

      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });
});

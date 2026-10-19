/**
 * tests/unit/core/validation/secret-resolution.test.ts
 *
 * Unit tests for secret-resolution.ts
 * Tests secret reference validation and redaction logic.
 */

import { describe, it, expect } from 'vitest';
import {
  SecretRefValidator,
  SecretRedactor,
  REDACTION_MARKERS,
  validateSecretReferences,
  createSecretRedactor,
  type SecretRef,
  type SecretResolution,
} from '@src/core/validation/secret-resolution';
import type { ProfileConfig } from '@src/core/adapters/contract';

describe('SecretRefValidator', () => {
  describe('validateSecretRefs', () => {
    it('should validate profile with secretRef credential mode and existing secret', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: {
          mode: 'secretRef',
          secretRef: 'my-api-key',
        },
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

      const secrets = {
        'my-api-key': 'sk-ant-api1234567890',
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.secrets['my-api-key'].value).toBe('sk-ant-api1234567890');
      expect(result.secrets['my-api-key'].redacted).toBe(true);
    });

    it('should reject profile when secretRef is not found in secrets', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: {
          mode: 'secretRef',
          secretRef: 'my-api-key',
        },
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

      const secrets = {
        'other-secret': 'value123',
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('my-api-key');
      expect(result.errors[0].message).toContain('not found');
    });

    it('should handle profile with none credential mode', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'ollama',
        model: 'llama2',
        credential: {
          mode: 'none',
        },
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

      const secrets = {};

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(true);
      expect(result.errors).toEqual([]);
      expect(Object.keys(result.secrets).length).toBe(0);
    });

    it('should handle profile with environment credential mode', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'openai-compatible',
        model: 'gpt-4',
        credential: {
          mode: 'environment',
        },
        environmentRefs: ['OPENAI_API_KEY', 'MODEL_NAME'],
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

      const secrets = {
        'OPENAI_API_KEY': 'sk-proj1234567890',
        'MODEL_NAME': 'gpt-4-turbo',
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.secrets['OPENAI_API_KEY'].value).toBe('sk-proj1234567890');
      expect(result.secrets['MODEL_NAME'].value).toBe('gpt-4-turbo');
    });

    it('should validate profile with multi-key credential mode', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: {
          mode: 'multi-key',
          secretRefs: ['claude-key-1', 'claude-key-2', 'claude-key-3'],
        },
        keyRotationStrategy: 'round-robin',
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
      } as ProfileConfig;

      const secrets = {
        'claude-key-1': 'sk-ant-key1',
        'claude-key-2': 'sk-ant-key2',
        'claude-key-3': 'sk-ant-key3',
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.secrets['claude-key-1'].value).toBe('sk-ant-key1');
      expect(result.secrets['claude-key-2'].value).toBe('sk-ant-key2');
      expect(result.secrets['claude-key-3'].value).toBe('sk-ant-key3');
    });

    it('should reject multi-key profile when any secret is missing', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: {
          mode: 'multi-key',
          secretRefs: ['claude-key-1', 'claude-key-2', 'claude-key-3'],
        },
        keyRotationStrategy: 'round-robin',
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
      } as ProfileConfig;

      const secrets = {
        'claude-key-1': 'sk-ant-key1',
        // claude-key-2 and claude-key-3 are missing
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors.some(e => e.message.includes('claude-key-2'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('claude-key-3'))).toBe(true);
    });

    it('should warn about unused secrets', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: {
          mode: 'secretRef',
          secretRef: 'my-api-key',
        },
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

      const secrets = {
        'my-api-key': 'value123',
        'unused-secret-1': 'value456',
        'unused-secret-2': 'value789',
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].message).toContain('unused-secret-1');
      expect(result.warnings[0].message).toContain('unused-secret-2');
    });

    it('should handle missing environment reference', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'openai-compatible',
        model: 'gpt-4',
        credential: {
          mode: 'environment',
        },
        environmentRefs: ['OPENAI_API_KEY', 'MODEL_NAME'],
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

      const secrets = {
        'OPENAI_API_KEY': 'sk-proj1234567890',
        // MODEL_NAME is missing
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('MODEL_NAME'))).toBe(true);
    });

    it('should mark all secrets as to be redacted', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: {
          mode: 'secretRef',
          secretRef: 'my-api-key',
        },
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

      const secrets = { 'my-api-key': 'secret-value' };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.secrets['my-api-key'].redacted).toBe(true);
    });

    it('should handle multiple missing secrets', () => {
      const validator = new SecretRefValidator();
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'openai-compatible',
        model: 'gpt-4',
        credential: {
          mode: 'environment',
        },
        environmentRefs: ['API_KEY_1', 'API_KEY_2', 'API_KEY_3'],
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

      const secrets = {
        'API_KEY_1': 'key1',
        // API_KEY_2 and API_KEY_3 missing
      };

      const result = validator.validateSecretRefs(config, secrets);

      expect(result.complete).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors.some(e => e.message.includes('API_KEY_2'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('API_KEY_3'))).toBe(true);
    });
  });
});

describe('SecretRedactor', () => {
  describe('registerSecret and redact', () => {
    it('should redact registered secret from message', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('sk-ant-api1234567890');

      const message = 'API key: sk-ant-api1234567890';
      const redacted = redactor.redact(message);

      expect(redacted).toContain('[REDACTED: SECRET]');
      expect(redacted).not.toContain('sk-ant-api1234567890');
    });

    it('should use custom marker when specified', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('my-secret-123', REDACTION_MARKERS.API_KEY);

      const message = 'Secret: my-secret-123';
      const redacted = redactor.redact(message);

      expect(redacted).toContain('[REDACTED: API_KEY]');
      expect(redacted).not.toContain('my-secret-123');
    });

    it('should redact multiple secrets from message', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret1');
      redactor.registerSecret('secret2');
      redactor.registerSecret('secret3');

      const message = 'First: secret1, Second: secret2, Third: secret3';
      const redacted = redactor.redact(message);

      expect(redacted).toContain('[REDACTED: SECRET]');
      expect(redacted).not.toContain('secret1');
      expect(redacted).not.toContain('secret2');
      expect(redacted).not.toContain('secret3');
    });

    it('should handle message with no secrets', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const message = 'This is a plain message with no secrets';
      const redacted = redactor.redact(message);

      expect(redacted).toBe(message);
    });

    it('should escape regex special characters in secret', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('$.^*+?()[]{}|\\');

      const message = 'Secret: $.^*+?()[]{}|\\';
      const redacted = redactor.redact(message);

      expect(redacted).toContain('[REDACTED: SECRET]');
      expect(redacted).not.toContain('$.^*+?()[]{}|\\');
    });

    it('should handle empty secret registration', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('');

      const message = 'Test message';
      const redacted = redactor.redact(message);

      expect(redacted).toBe('Test message');
    });

    it('should redact secret appearing multiple times', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const message = 'secret1: secret123, secret2: secret123, secret3: secret123';
      const redacted = redactor.redact(message);

      expect(redacted.match(/\[REDACTED: SECRET\]/g)?.length).toBe(3);
      expect(redacted).not.toContain('secret123');
    });
  });

  describe('redactObject', () => {
    it('should redact secrets in object string values', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const obj = {
        apiKey: 'secret123',
        message: 'Hello',
        url: 'https://api.example.com',
      };

      const redacted = redactor.redactObject(obj);

      expect(redacted.apiKey).toBe('[REDACTED: SECRET]');
      expect(redacted.message).toBe('Hello');
      expect(redacted.url).toBe('https://api.example.com');
    });

    it('should redact secrets in object array string values', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const obj = {
        keys: ['secret123', 'secret123', 'normal-key'],
      };

      const redacted = redactor.redactObject(obj);

      expect(redacted.keys[0]).toBe('[REDACTED: SECRET]');
      expect(redacted.keys[1]).toBe('[REDACTED: SECRET]');
      expect(redacted.keys[2]).toBe('normal-key');
    });

    it('should redact secrets in nested objects', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const obj = {
        level1: {
          level2: {
            apiKey: 'secret123',
          },
        },
      };

      const redacted = redactor.redactObject(obj);

      expect(redacted.level1.level2.apiKey).toBe('[REDACTED: SECRET]');
    });

    it('should preserve non-string values', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const obj = {
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
      };

      const redacted = redactor.redactObject(obj);

      expect(redacted.number).toBe(42);
      expect(redacted.boolean).toBe(true);
      expect(redacted.null).toBe(null);
      expect(redacted.array).toEqual([1, 2, 3]);
    });

    it('should redact mixed strings and other types in array', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret123');

      const obj = {
        mixed: ['secret123', 42, true, null, { key: 'secret123' }],
      };

      const redacted = redactor.redactObject(obj);

      expect(redacted.mixed[0]).toBe('[REDACTED: SECRET]');
      expect(redacted.mixed[1]).toBe(42);
      expect(redacted.mixed[2]).toBe(true);
      expect(redacted.mixed[3]).toBe(null);
      expect(typeof redacted.mixed[4]).toBe('object');
    });
  });

  describe('clear', () => {
    it('should clear all registered secrets', () => {
      const redactor = new SecretRedactor();
      redactor.registerSecret('secret1');
      redactor.registerSecret('secret2');

      let message = 'secret1 and secret2';
      let redacted = redactor.redact(message);
      expect(redacted).toContain('[REDACTED: SECRET]');

      redactor.clear();

      message = 'secret1 and secret2';
      redacted = redactor.redact(message);
      expect(redacted).not.toContain('[REDACTED: SECRET]');
      expect(redacted).toContain('secret1');
      expect(redacted).toContain('secret2');
    });
  });
});

describe('REDACTION_MARKERS', () => {
  it('should have all expected redaction markers', () => {
    expect(REDACTION_MARKERS.SECRET).toBe('[REDACTED: SECRET]');
    expect(REDACTION_MARKERS.API_KEY).toBe('[REDACTED: API_KEY]');
    expect(REDACTION_MARKERS.AUTH_TOKEN).toBe('[REDACTED: AUTH_TOKEN]');
    expect(REDACTION_MARKERS.PASSWORD).toBe('[REDACTED: PASSWORD]');
    expect(REDACTION_MARKERS.SSH_KEY).toBe('[REDACTED: SSH_KEY]');
  });
});

describe('Utility functions', () => {
  describe('validateSecretReferences', () => {
    it('should validate using utility function', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'test-model',
        credential: {
          mode: 'secretRef',
          secretRef: 'api-key',
        },
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

      const secrets = { 'api-key': 'secret123' };

      const result = validateSecretReferences(config, secrets);

      expect(result.complete).toBe(true);
      expect(result).toHaveProperty('secrets');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('createSecretRedactor', () => {
    it('should create redactor with predefined markers from keys', () => {
      const secrets = {
        'api-key': 'sk-ant-api1234567890',
        'auth-token': 'jwt-token-123456',
      };

      const redactor = createSecretRedactor(secrets);

      const message = 'API key: sk-ant-api1234567890, Token: jwt-token-123456';
      const redacted = redactor.redact(message);

      expect(redacted).toContain('[REDACTED: API-KEY]');
      expect(redacted).toContain('[REDACTED: AUTH-TOKEN]');
      expect(redacted).not.toContain('sk-ant-api1234567890');
      expect(redacted).not.toContain('jwt-token-123456');
    });

    it('should skip null values in secrets map', () => {
      const secrets = {
        'api-key': 'sk-ant-api1234567890',
        'auth-token': null, // This should be skipped
      };

      const redactor = createSecretRedactor(secrets);

      const message = 'API key: sk-ant-api1234567890';
      const redacted = redactor.redact(message);

      expect(redacted).toContain('[REDACTED: API-KEY]');
    });
  });
});

describe('SecretResolution type', () => {
  it('should return complete SecretResolution object', () => {
    const validator = new SecretRefValidator();
    const config: ProfileConfig = {
      id: 'test-profile',
      adapter: 'anthropic-compatible',
      model: 'test-model',
      credential: {
        mode: 'secretRef',
        secretRef: 'api-key',
      },
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

    const secrets = { 'api-key': 'secret123' };

    const result: SecretResolution = validator.validateSecretRefs(config, secrets);

    expect(result).toHaveProperty('secrets');
    expect(result).toHaveProperty('complete');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result.complete).toBe(true);
  });
});

describe('SecretRef type', () => {
  it('should create valid SecretRef', () => {
    const secretRef: SecretRef = {
      key: 'api-key',
      value: 'sk-ant-api1234567890',
      redacted: true,
    };

    expect(secretRef.key).toBe('api-key');
    expect(secretRef.value).toBe('sk-ant-api1234567890');
    expect(secretRef.redacted).toBe(true);
  });

  it('should allow null value in SecretRef', () => {
    const secretRef: SecretRef = {
      key: 'api-key',
      value: null,
      redacted: true,
    };

    expect(secretRef.value).toBe(null);
  });
});

/**
 * tests/unit/core/adapters/contract.test.ts
 *
 * Unit tests for contract.ts
 * Tests type definitions and value objects in the adapter contract.
 */

import { describe, it, expect } from 'vitest';
import type {
  AdapterCapabilities,
  ProfileConfig,
  MessageContext,
  MessageResponse,
  ValidationResult,
  ConnectionStatus,
} from '@src/core/adapters/contract';

// Note: contract.ts contains only type definitions and interfaces.
// These tests validate type structure, TypeScript compilation, and
// value object creation/validation patterns.

describe('AdapterContract', () => {
  describe('AdapterCapabilities', () => {
    it('should create valid capabilities object', () => {
      const capabilities: AdapterCapabilities = {
        streaming: true,
        tools: true,
        fileEdits: true,
        commands: true,
        modelDiscovery: true,
        transcriptObservable: true,
      };

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.tools).toBe(true);
      expect(capabilities.fileEdits).toBe(true);
      expect(capabilities.commands).toBe(true);
      expect(capabilities.modelDiscovery).toBe(true);
      expect(capabilities.transcriptObservable).toBe(true);
    });

    it('should create minimal capabilities object', () => {
      const capabilities: AdapterCapabilities = {
        streaming: false,
        tools: false,
        fileEdits: false,
        commands: false,
        modelDiscovery: false,
        transcriptObservable: false,
      };

      expect(capabilities.streaming).toBe(false);
      expect(capabilities.tools).toBe(false);
      expect(capabilities.fileEdits).toBe(false);
      expect(capabilities.commands).toBe(false);
      expect(capabilities.modelDiscovery).toBe(false);
      expect(capabilities.transcriptObservable).toBe(false);
    });

    it('should support mixed capabilities', () => {
      const capabilities: AdapterCapabilities = {
        streaming: true,
        tools: true,
        fileEdits: false,
        commands: false,
        modelDiscovery: false,
        transcriptObservable: true,
      };

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.tools).toBe(true);
      expect(capabilities.fileEdits).toBe(false);
      expect(capabilities.commands).toBe(false);
      expect(capabilities.modelDiscovery).toBe(false);
      expect(capabilities.transcriptObservable).toBe(true);
    });
  });

  describe('ProfileConfig', () => {
    it('should create valid profile config', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'native-claude',
        model: 'claude-3-5-sonnet-20241022',
        credential: {
          mode: 'none',
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
          transcriptObservable: true,
        },
      };

      expect(config.id).toBe('test-profile');
      expect(config.adapter).toBe('native-claude');
      expect(config.model).toBe('claude-3-5-sonnet-20241022');
      expect(config.credential.mode).toBe('none');
      expect(config.permissions.mode).toBe('edit-only');
      expect(config.network.providerClass).toBe('cloud');
      expect(config.capabilities.streaming).toBe(true);
    });

    it('should create profile with secretRef credential', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'openai-compatible',
        model: 'gpt-4',
        baseUrl: 'https://api.openai.com/v1',
        credential: {
          mode: 'secretRef',
          secretRef: 'api-key-profile1',
        },
        permissions: {
          mode: 'review-only',
          workspacePaths: ['/safe/path'],
        },
        network: {
          providerClass: 'cloud',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      expect(config.credential.mode).toBe('secretRef');
      expect(config.credential.secretRef).toBe('api-key-profile1');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.permissions.workspacePaths).toEqual(['/safe/path']);
    });

    it('should create profile with tunnel configuration', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'ollama',
        model: 'llama2',
        credential: {
          mode: 'none',
        },
        tunnel: {
          enabled: true,
          sshHostAlias: 'remote-server',
          localPort: 11434,
        },
        permissions: {
          mode: 'edit-and-command',
        },
        network: {
          providerClass: 'private-network',
          supportingNetwork: 'allowed',
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

      expect(config.tunnel?.enabled).toBe(true);
      expect(config.tunnel?.sshHostAlias).toBe('remote-server');
      expect(config.tunnel?.localPort).toBe(11434);
    });

    it('should create profile with limits', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'anthropic-compatible',
        model: 'claude-3-5-sonnet-20241022',
        credential: {
          mode: 'none',
        },
        limits: {
          contextTokens: 200000,
          maxOutputTokens: 8192,
        },
        permissions: {
          mode: 'edit-only',
        },
        network: {
          providerClass: 'private-network',
          supportingNetwork: 'blocked',
        },
        capabilities: {
          streaming: true,
          tools: true,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      expect(config.limits?.contextTokens).toBe(200000);
      expect(config.limits?.maxOutputTokens).toBe(8192);
      expect(config.network.supportingNetwork).toBe('blocked');
    });

    it('should create profile with instructions and health check', () => {
      const config: ProfileConfig = {
        id: 'test-profile',
        adapter: 'generic-command',
        model: 'default',
        credential: {
          mode: 'environment',
        },
        instructions: 'You are a helpful assistant focused on code quality.',
        environmentRefs: ['API_ENDPOINT', 'MODEL_NAME'],
        healthCheck: {
          url: 'https://custom-endpoint.com/health',
          method: 'GET',
        },
        permissions: {
          mode: 'edit-only',
        },
        network: {
          providerClass: 'local',
          supportingNetwork: 'allowed',
        },
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: true,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      };

      expect(config.instructions).toBe('You are a helpful assistant focused on code quality.');
      expect(config.environmentRefs).toEqual(['API_ENDPOINT', 'MODEL_NAME']);
      expect(config.healthCheck?.url).toBe('https://custom-endpoint.com/health');
      expect(config.healthCheck?.method).toBe('GET');
      expect(config.capabilities.commands).toBe(true);
    });
  });

  describe('MessageContext', () => {
    it('should create minimal message context', () => {
      const context: MessageContext = {};

      expect(context).toEqual({});
    });

    it('should create message context with file references', () => {
      const context: MessageContext = {
        files: [
          {
            path: '/path/to/file.ts',
            range: {
              start: { line: 10, character: 0 },
              end: { line: 20, character: 10 },
            },
          },
        ],
      };

      expect(context.files).toBeDefined();
      expect(context.files?.[0].path).toBe('/path/to/file.ts');
      expect(context.files?.[0].range?.start.line).toBe(10);
    });

    it('should create message context with conversation history', () => {
      const context: MessageContext = {
        history: [
          { role: 'user', content: 'Hello', timestamp: new Date('2024-01-01') },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date('2024-01-01') },
        ],
      };

      expect(context.history).toBeDefined();
      expect(context.history?.length).toBe(2);
      expect(context.history?.[0].role).toBe('user');
      expect(context.history?.[1].role).toBe('assistant');
    });

    it('should create complete message context', () => {
      const context: MessageContext = {
        files: [{ path: '/path/to/file.ts', content: 'const x = 1;' }],
        history: [
          { role: 'user', content: 'List files' },
          { role: 'assistant', content: 'Here are the files' },
        ],
        workspacePath: '/workspace',
        metadata: { sessionId: '12345' },
      };

      expect(context.files?.length).toBe(1);
      expect(context.history?.length).toBe(2);
      expect(context.workspacePath).toBe('/workspace');
      expect(context.metadata?.sessionId).toBe('12345');
    });
  });

  describe('MessageResponse', () => {
    it('should create minimal message response', () => {
      const response: MessageResponse = {
        content: 'Hello world',
        timestamp: new Date(),
      };

      expect(response.content).toBe('Hello world');
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should create message response with tool calls', () => {
      const response: MessageResponse = {
        content: 'Let me search for files',
        toolCalls: [
          {
            name: 'search_files',
            arguments: { pattern: '*.ts' },
            id: 'call_123',
          },
        ],
        timestamp: new Date(),
      };

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls?.[0].name).toBe('search_files');
      expect(response.toolCalls?.[0].arguments).toEqual({ pattern: '*.ts' });
      expect(response.toolCalls?.[0].id).toBe('call_123');
    });

    it('should create message response with file edits', () => {
      const response: MessageResponse = {
        content: 'I made some changes',
        fileEdits: [
          {
            file: '/path/to/file.ts',
            type: 'modify',
            content: 'const x = 2;',
            range: {
              start: { line: 10, character: 0 },
              end: { line: 10, character: 14 },
            },
          },
        ],
        timestamp: new Date(),
      };

      expect(response.fileEdits).toBeDefined();
      expect(response.fileEdits?.[0].file).toBe('/path/to/file.ts');
      expect(response.fileEdits?.[0].type).toBe('modify');
    });

    it('should create message response with commands', () => {
      const response: MessageResponse = {
        content: 'I ran a test',
        commands: [
          {
            command: 'npm test',
            cwd: '/workspace',
            timeout: 30000,
          },
        ],
        metadata: { finishReason: 'stop' },
        timestamp: new Date(),
      };

      expect(response.commands).toBeDefined();
      expect(response.commands?.[0].command).toBe('npm test');
      expect(response.commands?.[0].cwd).toBe('/workspace');
      expect(response.commands?.[0].timeout).toBe(30000);
      expect(response.metadata?.finishReason).toBe('stop');
    });
  });

  describe('ValidationResult', () => {
    it('should create successful validation result', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should create validation result with errors', () => {
      const result: ValidationResult = {
        valid: false,
        errors: [
          { field: 'model', message: 'Model not found' },
          { field: 'credential', message: 'Invalid secret reference', suggestion: 'Check secret stores' },
        ],
        warnings: [],
      };

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].field).toBe('model');
      expect(result.errors[0].message).toBe('Model not found');
      expect(result.errors[1].suggestion).toBe('Check secret stores');
    });

    it('should create validation result with warnings', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [
          { field: 'limits', message: 'Context tokens exceed recommended limit' },
          { field: 'permissions', message: 'Broad workspace permissions configured' },
        ],
      };

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings[0].field).toBe('limits');
      expect(result.warnings[1].field).toBe('permissions');
    });

    it('should create validation result with both errors and warnings', () => {
      const result: ValidationResult = {
        valid: false,
        errors: [{ field: 'baseUrl', message: 'Invalid URL format' }],
        warnings: [{ field: 'network', message: 'Cloud provider in strict mode' }],
      };

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.warnings.length).toBe(1);
    });
  });

  describe('ConnectionStatus', () => {
    it('should create successful connection status', () => {
      const status: ConnectionStatus = {
        connected: true,
        status: 'Connected successfully',
      };

      expect(status.connected).toBe(true);
      expect(status.status).toBe('Connected successfully');
    });

    it('should create failed connection status', () => {
      const status: ConnectionStatus = {
        connected: false,
        status: 'Connection failed: timeout',
        diagnostics: {
          host: 'api.example.com',
          port: 443,
          error: 'ETIMEDOUT',
        },
      };

      expect(status.connected).toBe(false);
      expect(status.status).toBe('Connection failed: timeout');
      expect(status.diagnostics?.host).toBe('api.example.com');
      expect(status.diagnostics?.error).toBe('ETIMEDOUT');
    });

    it('should create connection status with detailed diagnostics', () => {
      const status: ConnectionStatus = {
        connected: true,
        status: 'Connected via SSL',
        diagnostics: {
          protocol: 'https',
          sslVersion: 'TLSv1.3',
          latency: 150,
          endpoint: 'api.openai.com/v1',
        },
      };

      expect(status.connected).toBe(true);
      expect(status.diagnostics?.protocol).toBe('https');
      expect(status.diagnostics?.sslVersion).toBe('TLSv1.3');
      expect(status.diagnostics?.latency).toBe(150);
    });
  });
});

/**
 * tests/unit/core/validation/capability-checker.test.ts
 *
 * Unit tests for capability-checker.ts
 * Tests adapter capability validation logic.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CapabilityChecker,
  validateCapabilities,
  hasCapability,
  type CapabilityValidationResult,
} from '@src/core/validation/capability-checker';
import type {
  ModelAdapter,
  MessageContext,
  AdapterCapabilities,
  MessageResponse,
  ToolCall,
  FileEdit,
  CommandExecution,
  ObservableTranscript,
} from '@src/core/adapters/contract';

// ============================================================
// MOCK ADAPTER FOR TESTING
// ============================================================

/**
 * Mock adapter with all capabilities enabled and methods implemented.
 */
class MockAdapterWithAllCapabilities implements ModelAdapter {
  capabilities: AdapterCapabilities = {
    streaming: true,
    tools: true,
    fileEdits: true,
    commands: true,
    modelDiscovery: true,
    transcriptObservable: true,
  };

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options?: { streaming?: boolean },
  ): Promise<MessageResponse | AsyncIterable<MessageResponse>> {
    return {
      content: 'Response',
      timestamp: new Date(),
    };
  }

  async executeTool(_toolCall: ToolCall): Promise<MessageResponse> {
    return {
      content: 'Tool executed',
      timestamp: new Date(),
    };
  }

  async editFile(_edit: FileEdit): Promise<MessageResponse> {
    return {
      content: 'File edited',
      timestamp: new Date(),
    };
  }

  async executeCommand(_cmd: CommandExecution): Promise<MessageResponse> {
    return {
      content: 'Command executed',
      timestamp: new Date(),
    };
  }

  async listModels(): Promise<string[]> {
    return ['model-1', 'model-2'];
  }

  getTranscript(): ObservableTranscript {
    return {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getValue: vi.fn(),
    } as unknown as ObservableTranscript;
  }
}

/**
 * Mock adapter with no capabilities enabled and no corresponding methods.
 */
class MockAdapterWithNoCapabilities implements ModelAdapter {
  capabilities: AdapterCapabilities = {
    streaming: false,
    tools: false,
    fileEdits: false,
    commands: false,
    modelDiscovery: false,
    transcriptObservable: false,
  };

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options?: { streaming?: boolean },
  ): Promise<MessageResponse | AsyncIterable<MessageResponse>> {
    return {
      content: 'Response',
      timestamp: new Date(),
    };
  }
}

/**
 * Mock adapter with mismatched capabilities (declared true but method missing).
 */
class MockAdapterWithMissingMethods implements ModelAdapter {
  capabilities: AdapterCapabilities = {
    streaming: true,
    tools: true,
    fileEdits: true,
    commands: true,
    modelDiscovery: true,
    transcriptObservable: true,
  };

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options?: { streaming?: boolean },
  ): Promise<MessageResponse | AsyncIterable<MessageResponse>> {
    return {
      content: 'Response',
      timestamp: new Date(),
    };
  }

  // Missing executeTool, editFile, executeCommand, listModels, getTranscript
}

/**
 * Mock adapter with capabilities declared false but methods present.
 */
class MockAdapterWithUnimplementedCapabilities implements ModelAdapter {
  capabilities: AdapterCapabilities = {
    streaming: false,
    tools: false,
    fileEdits: false,
    commands: false,
    modelDiscovery: false,
    transcriptObservable: false,
  };

  async sendMessage(
    _message: string,
    _context: MessageContext,
    _options?: { streaming?: boolean },
  ): Promise<MessageResponse | AsyncIterable<MessageResponse>> {
    return {
      content: 'Response',
      timestamp: new Date(),
    };
  }

  async executeTool(_toolCall: ToolCall): Promise<MessageResponse> {
    return {
      content: 'Tool executed',
      timestamp: new Date(),
    };
  }

  async editFile(_edit: FileEdit): Promise<MessageResponse> {
    return {
      content: 'File edited',
      timestamp: new Date(),
    };
  }

  async executeCommand(_cmd: CommandExecution): Promise<MessageResponse> {
    return {
      content: 'Command executed',
      timestamp: new Date(),
    };
  }

  async listModels(): Promise<string[]> {
    return ['model-1', 'model-2'];
  }

  getTranscript(): ObservableTranscript {
    return {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getValue: vi.fn(),
    } as unknown as ObservableTranscript;
  }
}

describe('CapabilityChecker', () => {
  describe('validate', () => {
    it('should validate adapter with all capabilities correctly declared', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithAllCapabilities();

      const result = checker.validate(adapter);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should validate adapter with no capabilities', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithNoCapabilities();

      const result = checker.validate(adapter);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should reject adapter with declared true capabilities but missing methods', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithMissingMethods();

      const result = checker.validate(adapter);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(5); // 5 methods missing (not sendMessage)
      expect(result.warnings).toEqual([]);

      const errorCaps = result.errors.map(e => e.capability);
      expect(errorCaps).toContain('tools');
      expect(errorCaps).toContain('fileEdits');
      expect(errorCaps).toContain('commands');
      expect(errorCaps).toContain('modelDiscovery');
      expect(errorCaps).toContain('transcriptObservable');
    });

    it('should warn about adapter with declared false capabilities but methods present', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithUnimplementedCapabilities();

      const result = checker.validate(adapter);

      expect(result.valid).toBe(true); // warnings shouldn't make it invalid
      expect(result.errors).toEqual([]);
      expect(result.warnings.length).toBe(5);

      const warningCaps = result.warnings.map(w => w.capability);
      expect(warningCaps).toContain('tools');
      expect(warningCaps).toContain('fileEdits');
      expect(warningCaps).toContain('commands');
      expect(warningCaps).toContain('modelDiscovery');
      expect(warningCaps).toContain('transcriptObservable');
    });

    it('should reject adapter missing sendMessage method', () => {
      const checker = new CapabilityChecker();
      const adapter = {
        capabilities: {
          streaming: true,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      } as ModelAdapter; // sendMessage is missing

      const result = checker.validate(adapter);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].capability).toBe('streaming');
      expect(result.errors[0].message).toContain('sendMessage');
    });
  });

  describe('Individual capability checks', () => {
    it('should check tools capability correctly', () => {
      const checker = new CapabilityChecker();

      // Tools declared true, method exists
      const validAdapter = new MockAdapterWithAllCapabilities();
      checker.reset();
      const validResult = checker.validate(validAdapter);
      expect(validResult.errors.some(e => e.capability === 'tools')).toBe(false);

      // Tools declared true, method missing
      const invalidAdapter = {
        capabilities: {
          streaming: false,
          tools: true,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
        async sendMessage() {
          return { content: '', timestamp: new Date() };
        },
      } as ModelAdapter;
      checker.reset();
      const invalidResult = checker.validate(invalidAdapter);
      expect(invalidResult.errors.some(e => e.capability === 'tools')).toBe(true);
    });

    it('should check fileEdits capability correctly', () => {
      const checker = new CapabilityChecker();

      const validAdapter = new MockAdapterWithAllCapabilities();
      checker.reset();
      const validResult = checker.validate(validAdapter);
      expect(validResult.errors.some(e => e.capability === 'fileEdits')).toBe(false);

      const invalidAdapter = {
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: true,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
        async sendMessage() {
          return { content: '', timestamp: new Date() };
        },
      } as ModelAdapter;
      checker.reset();
      const invalidResult = checker.validate(invalidAdapter);
      expect(invalidResult.errors.some(e => e.capability === 'fileEdits')).toBe(true);
    });

    it('should check commands capability correctly', () => {
      const checker = new CapabilityChecker();

      const validAdapter = new MockAdapterWithAllCapabilities();
      checker.reset();
      const validResult = checker.validate(validAdapter);
      expect(validResult.errors.some(e => e.capability === 'commands')).toBe(false);

      const invalidAdapter = {
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: true,
          modelDiscovery: false,
          transcriptObservable: false,
        },
        async sendMessage() {
          return { content: '', timestamp: new Date() };
        },
      } as ModelAdapter;
      checker.reset();
      const invalidResult = checker.validate(invalidAdapter);
      expect(invalidResult.errors.some(e => e.capability === 'commands')).toBe(true);
    });

    it('should check modelDiscovery capability correctly', () => {
      const checker = new CapabilityChecker();

      const validAdapter = new MockAdapterWithAllCapabilities();
      checker.reset();
      const validResult = checker.validate(validAdapter);
      expect(validResult.errors.some(e => e.capability === 'modelDiscovery')).toBe(false);

      const invalidAdapter = {
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        },
        async sendMessage() {
          return { content: '', timestamp: new Date() };
        },
      } as ModelAdapter;
      checker.reset();
      const invalidResult = checker.validate(invalidAdapter);
      expect(invalidResult.errors.some(e => e.capability === 'modelDiscovery')).toBe(true);
    });

    it('should check transcriptObservable capability correctly', () => {
      const checker = new CapabilityChecker();

      const validAdapter = new MockAdapterWithAllCapabilities();
      checker.reset();
      const validResult = checker.validate(validAdapter);
      expect(validResult.errors.some(e => e.capability === 'transcriptObservable')).toBe(false);

      const invalidAdapter = {
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: true,
        },
        async sendMessage() {
          return { content: '', timestamp: new Date() };
        },
      } as ModelAdapter;
      checker.reset();
      const invalidResult = checker.validate(invalidAdapter);
      expect(invalidResult.errors.some(e => e.capability === 'transcriptObservable')).toBe(true);
    });

    it('should check streaming capability correctly', () => {
      const checker = new CapabilityChecker();

      const validAdapter = new MockAdapterWithAllCapabilities();
      checker.reset();
      const validResult = checker.validate(validAdapter);
      expect(validResult.errors.some(e => e.capability === 'streaming')).toBe(false);

      // sendMessage is required even if streaming is false
      const noSendMessageAdapter = {
        capabilities: {
          streaming: false,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        },
      } as ModelAdapter;
      checker.reset();
      const invalidResult = checker.validate(noSendMessageAdapter);
      expect(invalidResult.errors.some(e => e.capability === 'streaming')).toBe(true);
      expect(invalidResult.errors[0].message).toContain('sendMessage');
    });
  });

  describe('Error details', () => {
    it('should provide detailed error information', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithMissingMethods();
      const result = checker.validate(adapter);

      const error = result.errors[0];
      expect(error).toHaveProperty('capability');
      expect(error).toHaveProperty('declared');
      expect(error).toHaveProperty('actual');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('suggestion');

      expect(error.declared).toBe(true);
      expect(error.actual).toBe(false);
    });

    it('should provide helpful suggestion messages', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithMissingMethods();
      const result = checker.validate(adapter);

      const toolsError = result.errors.find(e => e.capability === 'tools');
      expect(toolsError?.suggestion).toContain('set capabilities.tools to false');

      const fileEditsError = result.errors.find(e => e.capability === 'fileEdits');
      expect(fileEditsError?.suggestion).toContain('set capabilities.fileEdits to false');
    });

    it('should provide warning messages for unused methods', () => {
      const checker = new CapabilityChecker();
      const adapter = new MockAdapterWithUnimplementedCapabilities();
      const result = checker.validate(adapter);

      const toolsWarning = result.warnings.find(w => w.capability === 'tools');
      expect(toolsWarning?.message).toContain('executeTool method exists');

      const fileEditsWarning = result.warnings.find(w => w.capability === 'fileEdits');
      expect(fileEditsWarning?.message).toContain('editFile method exists');
    });
  });

  describe('reset', () => {
    it('should reset error and warning state', () => {
      const checker = new CapabilityChecker();
      const adapter1 = new MockAdapterWithMissingMethods();

      // First validation
      const result1 = checker.validate(adapter1);
      expect(result1.errors.length).toBeGreaterThan(0);

      // Reset
      checker.reset();

      // Second validation on adapter with no capabilities
      const adapter2 = new MockAdapterWithNoCapabilities();
      const result2 = checker.validate(adapter2);

      expect(result2.valid).toBe(true);
      expect(result2.errors).toEqual([]);
    });
  });

  describe('Utility functions', () => {
    it('validateCapabilities should validate using utility function', () => {
      const adapter = new MockAdapterWithAllCapabilities();
      const result = validateCapabilities(adapter);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result.valid).toBe(true);
    });

    it('hasCapability should return true for correctly declared capability', () => {
      const adapter = new MockAdapterWithAllCapabilities();

      expect(hasCapability(adapter, 'tools')).toBe(true);
      expect(hasCapability(adapter, 'fileEdits')).toBe(true);
      expect(hasCapability(adapter, 'commands')).toBe(true);
      expect(hasCapability(adapter, 'modelDiscovery')).toBe(true);
      expect(hasCapability(adapter, 'transcriptObservable')).toBe(true);
      expect(hasCapability(adapter, 'streaming')).toBe(true);
    });

    it('hasCapability should return false for undeclared capability', () => {
      const adapter = new MockAdapterWithNoCapabilities();

      expect(hasCapability(adapter, 'tools')).toBe(false);
      expect(hasCapability(adapter, 'fileEdits')).toBe(false);
      expect(hasCapability(adapter, 'commands')).toBe(false);
      expect(hasCapability(adapter, 'modelDiscovery')).toBe(false);
      expect(hasCapability(adapter, 'transcriptObservable')).toBe(false);
      expect(hasCapability(adapter, 'streaming')).toBe(false);
    });

    it('hasCapability should return false for mismatched capability', () => {
      const adapter = new MockAdapterWithMissingMethods();

      // Capability declared true but method missing
      expect(hasCapability(adapter, 'tools')).toBe(false);
      expect(hasCapability(adapter, 'fileEdits')).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should validate adapter with some capabilities enabled', () => {
      class PartialAdapter implements ModelAdapter {
        capabilities: AdapterCapabilities = {
          streaming: true,
          tools: true,
          fileEdits: false,
          commands: false,
          modelDiscovery: true,
          transcriptObservable: false,
        };

        async sendMessage(
          _message: string,
          _context: MessageContext,
        ): Promise<MessageResponse> {
          return { content: '', timestamp: new Date() };
        }

        async executeTool(_toolCall: ToolCall): Promise<MessageResponse> {
          return { content: '', timestamp: new Date() };
        }

        async listModels(): Promise<string[]> {
          return ['model'];
        }
      }

      const checker = new CapabilityChecker();
      const result = checker.validate(new PartialAdapter());

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing capability for declared streaming', () => {
      class StreamingOnlyAdapter implements ModelAdapter {
        capabilities: AdapterCapabilities = {
          streaming: true,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        };

        async sendMessage(
          _message: string,
          _context: MessageContext,
        ): Promise<MessageResponse> {
          return { content: '', timestamp: new Date() };
        }
      }

      const checker = new CapabilityChecker();
      const result = checker.validate(new StreamingOnlyAdapter());

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle adapter with incorrect streaming declaration', () => {
      // This scenario tests that sendMessage validation works correctly
      class NoSendMessageAdapter implements ModelAdapter {
        capabilities: AdapterCapabilities = {
          streaming: true,
          tools: false,
          fileEdits: false,
          commands: false,
          modelDiscovery: false,
          transcriptObservable: false,
        };
      }

      const checker = new CapabilityChecker();
      const result = checker.validate(new NoSendMessageAdapter() as ModelAdapter);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.capability === 'streaming')).toBe(true);
    });
  });
});

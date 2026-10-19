/**
 * tests/unit/core/audit/audit-writer.test.ts
 *
 * Unit tests for audit-writer.ts
 * Tests audit logging, prohibited content detection, and security classification.
 */

import { describe, it, expect } from 'vitest';
import {
  AuditWriter,
  createAuditEntry,
  logAuditEvent,
  AuditEventType,
  AuditEntry,
  AuditLogConfig,
  PROHIBITED_PATTERNS,
} from '@src/core/audit/audit-writer';

describe('AuditWriter', () => {
  describe('constructor', () => {
    it('should initialize with default config', () => {
      const writer = new AuditWriter();

      expect(writer).toBeDefined();
    });

    it('should accept custom config', () => {
      const config: AuditLogConfig = {
        enabled: false,
        retentionDays: 7,
        maxFileSizeMb: 5,
      };

      const writer = new AuditWriter(config);

      expect(writer).toBeDefined();
    });

    it('should set default enabledEvents', () => {
      const writer = new AuditWriter();

      // Helper to get enabled events through log method
      const eventTypes: AuditEventType[] = [
        'profile_activation',
        'profile_deactivation',
        'command_execution',
        'tool_execution',
        'file_operation',
        'handoff',
        'policy_violation',
        'error',
        'security_event',
      ];

      // All event types should be enabled by default
      eventTypes.forEach(eventType => {
        const result = writer.log(
          eventType,
          'profile-1',
          'anthropic-compatible',
          { source: 'user', data: {} },
        );
        expect(result).toBeTruthy(); // Event logged successfully
      });
    });
  });

  describe('createEntry', () => {
    it('should create valid audit entry', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {
            reason: 'User requested activation',
          },
        },
      );

      expect(entry.eventId).toBeTruthy();
      expect(entry.eventId.startsWith('aud-')).toBe(true);
      expect(entry.eventType).toBe('profile_activation');
      expect(entry.profileId).toBe('profile-1');
      expect(entry.adapterType).toBe('anthropic-compatible');
      expect(entry.timestamp).toBeTruthy();
      expect(entry.securityLevel).toBeDefined();
      expect(entry.metadata.source).toBe('user');
      expect(entry.metadata.data.reason).toBe('User requested activation');
    });

    it('should generate unique event IDs', () => {
      const writer = new AuditWriter();

      const entry1 = writer.createEntry('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });
      const entry2 = writer.createEntry('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      expect(entry1.eventId).not.toBe(entry2.eventId);
    });

    it('should detect prohibited content in metadata containing prompt indicators', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              content: 'This is a user message that should be forbidden',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited content in metadata containing transcript indicators', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              log: 'Conversation: User said hello, Assistant output: hi there',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited code snippets', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              code: '```javascript\nconsole.log("hello");\n```',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited function definition patterns', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              snippet: 'function test() { return "hello"; }',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited token count references', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              info: 'This is 100 tokens',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited billing references', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              cost: 'The billing cost is $0.05',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited secret indicators', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              credential: 'The api_key is sk-ant-api03-abc123def456',
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should allow safe metadata', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {
            action: 'activated',
            timestamp: new Date().toISOString(),
            sessionId: 'session-123',
          },
        },
      );

      expect(entry.metadata.data.action).toBe('activated');
      expect(entry.metadata.data.sessionId).toBe('session-123');
    });

    it('should determine low security level for normal operations', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {},
        },
      );

      expect(entry.securityLevel).toBe('low');
    });

    it('should determine high security level for policy violations', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'policy_violation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {},
        },
      );

      expect(entry.securityLevel).toBe('high');
    });

    it('should determine high security level for security events', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'security_event',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'system',
          data: {},
        },
      );

      expect(entry.securityLevel).toBe('high');
    });

    it('should determine medium security level for failed events', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {},
          outcome: 'failure',
        },
      );

      expect(entry.securityLevel).toBe('medium');
    });

    it('should handle outcome in metadata', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'command_execution',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'system',
          data: {},
          outcome: 'success',
        },
      );

      expect(entry.metadata.outcome).toBe('success');
    });

    it('should handle error in metadata', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'error',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'adapter',
          data: {},
          outcome: 'failure',
          error: 'Connection timed out',
        },
      );

      expect(entry.metadata.outcome).toBe('failure');
      expect(entry.metadata.error).toBe('Connection timed out');
    });

    it('should handle related events', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry(
        'handoff',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {},
          relatedEvents: ['aud-123', 'aud-456'],
        },
      );

      expect(entry.metadata.relatedEvents).toEqual(['aud-123', 'aud-456']);
    });
  });

  describe('log', () => {
    it('should log event and return entry ID', () => {
      const writer = new AuditWriter();

      const eventId = writer.log(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {},
        },
      );

      expect(eventId).toBeTruthy();
      expect(eventId?.startsWith('aud-')).toBe(true);
    });

    it('should add entry to pending entries', () => {
      const writer = new AuditWriter();

      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      const pending = writer.getPendingEntries();
      expect(pending).toHaveLength(1);
      expect(pending[0].eventType).toBe('profile_activation');
    });

    it('should return null when logging is disabled', () => {
      const writer = new AuditWriter({ enabled: false });

      const eventId = writer.log('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      expect(eventId).toBeNull();
    });

    it('should return null for disabled event types', () => {
      const writer = new AuditWriter({
        enabledEvents: new Set(['profile_activation']), // Only allow profile_activation
      });

      const eventId = writer.log('handoff', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      expect(eventId).toBeNull();
    });

    it('should not add to pending when disabled', () => {
      const writer = new AuditWriter({ enabled: false });

      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      const pending = writer.getPendingEntries();
      expect(pending).toHaveLength(0);
    });

    it('should not add to pending for disabled event types', () => {
      const writer = new AuditWriter({
        enabledEvents: new Set(['profile_activation']),
      });

      writer.log('handoff', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      const pending = writer.getPendingEntries();
      expect(pending).toHaveLength(0);
    });

    it('should increment event counter for each log', () => {
      const writer = new AuditWriter();

      const id1 = writer.log('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });
      const id2 = writer.log('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe('getPendingEntries', () => {
    it('should return empty array when no entries', () => {
      const writer = new AuditWriter();

      const pending = writer.getPendingEntries();

      expect(pending).toEqual([]);
    });

    it('should return all pending entries', () => {
      const writer = new AuditWriter();

      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });
      writer.log('profile_deactivation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });
      writer.log('handoff', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });

      const pending = writer.getPendingEntries();

      expect(pending).toHaveLength(3);
    });

    it('should clear pending entries after retrieval', () => {
      const writer = new AuditWriter();

      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });
      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });

      const pending1 = writer.getPendingEntries();
      expect(pending1).toHaveLength(2);

      const pending2 = writer.getPendingEntries();
      expect(pending2).toHaveLength(0); // Cleared after first retrieval
    });

    it('should return copy of entries, not reference', () => {
      const writer = new AuditWriter();

      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });

      const pending1 = writer.getPendingEntries();
      const pending2 = writer.getPendingEntries();

      expect(pending1).not.toBe(pending2);
      expect(pending1).toHaveLength(1);
      expect(pending2).toHaveLength(0);
    });
  });

  describe('clearPending', () => {
    it('should clear all pending entries', () => {
      const writer = new AuditWriter();

      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });
      writer.log('profile_activation', 'profile-1', 'anthropic-compatible', { source: 'user', data: {} });

      expect(writer.getPendingEntries()).toHaveLength(2);

      writer.clearPending();

      expect(writer.getPendingEntries()).toHaveLength(0);
    });

    it('should handle clearing empty pending', () => {
      const writer = new AuditWriter();

      expect(() => writer.clearPending()).not.toThrow();
      expect(writer.getPendingEntries()).toHaveLength(0);
    });
  });

  describe('PROHIBITED_PATTERNS', () => {
    it('should contain all required prohibited patterns', () => {
      const requiredKeys = [
        'PROMPT_INDICATORS',
        'TRANSCRIPT_INDICATORS',
        'CODE_INDICATORS',
        'TOKENS_INDICATORS',
        'SECRET_INDICATORS',
      ];

      requiredKeys.forEach(key => {
        expect(PROHIBITED_PATTERNS).toHaveProperty(key);
        expect(Array.isArray(PROHIBITED_PATTERNS[key as keyof typeof PROHIBITED_PATTERNS])).toBe(true);
      });
    });

    it('should have patterns for user prompts', () => {
      expect(PROHIBITED_PATTERNS.PROMPT_INDICATORS.length).toBeGreaterThan(0);
      PROHIBITED_PATTERNS.PROMPT_INDICATORS.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should have patterns for transcript content', () => {
      expect(PROHIBITED_PATTERNS.TRANSCRIPT_INDICATORS.length).toBeGreaterThan(0);
      PROHIBITED_PATTERNS.TRANSCRIPT_INDICATORS.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should have patterns for code snippets', () => {
      expect(PROHIBITED_PATTERNS.CODE_INDICATORS.length).toBeGreaterThan(0);
      PROHIBITED_PATTERNS.CODE_INDICATORS.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should have patterns for tokens/billing', () => {
      expect(PROHIBITED_PATTERNS.TOKENS_INDICATORS.length).toBeGreaterThan(0);
      PROHIBITED_PATTERNS.TOKENS_INDICATORS.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });

    it('should have patterns for secrets', () => {
      expect(PROHIBITED_PATTERNS.SECRET_INDICATORS.length).toBeGreaterThan(0);
      PROHIBITED_PATTERNS.SECRET_INDICATORS.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config: AuditLogConfig = {
        enabled: true,
        retentionDays: 14,
        maxFileSizeMb: 20,
      };
      const writer = new AuditWriter(config);

      const returnedConfig = writer.getConfig();

      expect(returnedConfig.enabled).toBe(true);
      expect(returnedConfig.retentionDays).toBe(14);
      expect(returnedConfig.maxFileSizeMb).toBe(20);
    });

    it('should return copy of config, not reference', () => {
      const writer = new AuditWriter();

      const config1 = writer.getConfig();
      const config2 = writer.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('isEventEnabled', () => {
    it('should return true for enabled event types', () => {
      const writer = new AuditWriter();

      expect(writer.isEventEnabled('profile_activation')).toBe(true);
      expect(writer.isEventEnabled('handoff')).toBe(true);
    });

    it('should return false for disabled event types', () => {
      const writer = new AuditWriter({
        enabledEvents: new Set(['profile_activation']),
      });

      expect(writer.isEventEnabled('profile_activation')).toBe(true);
      expect(writer.isEventEnabled('handoff')).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should create audit entry using utility function', () => {
      const entry = createAuditEntry(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {
            action: 'test',
          },
        },
      );

      expect(entry.eventId).toBeTruthy();
      expect(entry.eventType).toBe('profile_activation');
      expect(entry.metadata.data.action).toBe('test');
    });

    it('should log audit event using utility function', () => {
      const eventId = logAuditEvent(
        'profile_activation',
        'profile-1',
        'anthropic-compatible',
        {
          source: 'user',
          data: {},
        },
      );

      expect(eventId).toBeTruthy();
    });
  });

  describe('security level classification', () => {
    describe('low security events', () => {
      it('should classify profile_activation as low security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('profile_activation', 'profile-1', 'anthropic-compatible', {
          source: 'user',
          data: {},
        });

        expect(entry.securityLevel).toBe('low');
      });

      it('should classify profile_deactivation as low security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('profile_deactivation', 'profile-1', 'anthropic-compatible', {
          source: 'user',
          data: {},
        });

        expect(entry.securityLevel).toBe('low');
      });

      it('should classify file_operation as low security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('file_operation', 'profile-1', 'anthropic-compatible', {
          source: 'adapter',
          data: {},
        });

        expect(entry.securityLevel).toBe('low');
      });

      it('should classify handoff as low security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('handoff', 'profile-1', 'anthropic-compatible', {
          source: 'user',
          data: {},
        });

        expect(entry.securityLevel).toBe('low');
      });

      it('should classify error as low security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('error', 'profile-1', 'anthropic-compatible', {
          source: 'adapter',
          data: {},
        });

        expect(entry.securityLevel).toBe('low');
      });
    });

    describe('medium security events', () => {
      it('should classify command_execution as medium security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('command_execution', 'profile-1', 'anthropic-compatible', {
          source: 'system',
          data: {},
        });

        expect(entry.securityLevel).toBe('medium');
      });

      it('should classify tool_execution as medium security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('tool_execution', 'profile-1', 'anthropic-compatible', {
          source: 'adapter',
          data: {},
        });

        expect(entry.securityLevel).toBe('medium');
      });

      it('should classify failed events as medium security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {},
            outcome: 'failure',
          },
        );

        expect(entry.securityLevel).toBe('medium');
      });
    });

    describe('high security events', () => {
      it('should classify policy_violation as high security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('policy_violation', 'profile-1', 'anthropic-compatible', {
          source: 'user',
          data: {},
        });

        expect(entry.securityLevel).toBe('high');
      });

      it('should classify security_event as high security', () => {
        const writer = new AuditWriter();

        const entry = writer.createEntry('security_event', 'profile-1', 'anthropic-compatible', {
          source: 'system',
          data: {},
        });

        expect(entry.securityLevel).toBe('high');
      });
    });
  });

  describe('prohibited content detection edge cases', () => {
    it('should detect prohibited content in nested objects', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              nested: {
                deeply: {
                  content: 'This is the user message that should be detected',
                },
              },
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should detect prohibited content in arrays', () => {
      const writer = new AuditWriter();

      expect(() => {
        writer.createEntry(
          'profile_activation',
          'profile-1',
          'anthropic-compatible',
          {
            source: 'user',
            data: {
              items: ['safe', 'user prompt: dangerous', 'also safe'],
            },
          },
        );
      }).toThrow('prohibited content');
    });

    it('should handle empty metadata object', () => {
      const writer = new AuditWriter();

      const entry = writer.createEntry('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {},
      });

      expect(entry.metadata.data).toEqual({});
    });

    it('should preserve objects in metadata (objects get JSON.stringify-ed)', () => {
      const writer = new AuditWriter();
      const testDate = new Date('2024-01-01T12:00:00Z');

      const entry = writer.createEntry('profile_activation', 'profile-1', 'anthropic-compatible', {
        source: 'user',
        data: {
          timestamp: testDate,
        },
      });

      expect(typeof entry.metadata.data.timestamp).toBe('object');
      expect(entry.metadata.data.timestamp).toBe(testDate);
    });
  });
});

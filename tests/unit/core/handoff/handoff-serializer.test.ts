/**
 * tests/unit/core/handoff/handoff-serializer.test.ts
 *
 * Unit tests for handoff-serializer.ts
 * Tests handoff packet creation, serialization, deserialization, and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  HandoffSerializer,
  HandoffPacket,
  HandoffSource,
  HandoffDestination,
  HandoffMetadata,
  HandoffSecurity,
  HandoffCreateParams,
  createHandoffPacket,
  serializeHandoffPacket,
  deserializeHandoffPacket,
} from '@src/core/handoff/handoff-serializer';

describe('HandoffSerializer', () => {
  describe('create', () => {
    it('should create a minimal handoff packet with summary mode', () => {
      const serializer = new HandoffSerializer();

      const source: HandoffSource = {
        profileId: 'source-profile-1',
        adapterType: 'anthropic-compatible',
        sessionStart: new Date('2024-01-01T10:00:00Z'),
        sessionEnd: new Date('2024-01-01T10:30:00Z'),
        turnCount: 10,
      };

      const params: HandoffCreateParams = {
        mode: 'summary',
        source,
        destination: undefined,
        metadata: {
          createdBy: 'user-123',
        },
        summary: {
          title: 'Test Summary',
          points: ['Point 1', 'Point 2'],
          turnCount: 10,
          createdAt: new Date(),
        },
      };

      const packet = serializer.create(params);

      expect(packet.packetId).toMatch(/^hnd-[a-z0-9]+-[0-9a-f]+-/);
      expect(packet.mode).toBe('summary');
      expect(packet.source.profileId).toBe('source-profile-1');
      expect(packet.content?.kind).toBe('summary');
      expect(packet.content?.summary).toBeTruthy();
      expect(packet.security.privacyMode).toBe('unrestricted');
      expect(packet.security.secretsRedacted).toBe(true);
    });

    it('should create a full mode handoff packet with transcript ID', () => {
      const serializer = new HandoffSerializer();

      const source: HandoffSource = {
        profileId: 'source-profile-1',
        adapterType: 'native-claude',
        sessionStart: new Date('2024-01-01T10:00:00Z'),
        sessionEnd: new Date('2024-01-01T10:30:00Z'),
        turnCount: 15,
      };

      const params: HandoffCreateParams = {
        mode: 'full',
        source,
        destination: {
          profileId: 'dest-profile-1',
          adapterType: 'anthropic-compatible',
        },
        metadata: {
          createdBy: 'extension',
          reason: 'Switching to faster model',
        },
        transcriptId: 'transcript-abc-123',
      };

      const packet = serializer.create(params);

      expect(packet.mode).toBe('full');
      expect(packet.content?.kind).toBe('summaryId');
      expect(packet.content?.transcriptId).toBe('transcript-abc-123');
      expect(packet.security.crossProvider).toBe(true); // Different adapter types
      expect(packet.security.securityLevel).toBe('medium'); // crossProvider + unrestricted
    });

    it('should detect cross-provider handoffs when adapters differ', () => {
      const serializer = new HandoffSerializer();

      const params: HandoffCreateParams = {
        mode: 'summary',
        source: {
          profileId: 'local-ollama',
          adapterType: 'ollama',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 5,
        },
        destination: {
          profileId: 'cloud-claude',
          adapterType: 'anthropic-compatible',
        },
        metadata: {},
      };

      const packet = serializer.create(params);

      expect(packet.security.crossProvider).toBe(true);
      expect(packet.security.securityLevel).toBe('medium');
    });

    it('should not flag same-provider as cross-provider', () => {
      const serializer = new HandoffSerializer();

      const params: HandoffCreateParams = {
        mode: 'summary',
        source: {
          profileId: 'claude-profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 5,
        },
        destination: {
          profileId: 'claude-profile-2',
          adapterType: 'anthropic-compatible', // Same adapter type
        },
        metadata: {},
      };

      const packet = serializer.create(params);

      expect(packet.security.crossProvider).toBe(false);
      expect(packet.security.securityLevel).toBe('low');
    });

    it('should determine high security level for strict privacy mode', () => {
      const serializer = new HandoffSerializer();

      const params: HandoffCreateParams = {
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 5,
        },
        metadata: {},
        security: {
          privacyMode: 'strict',
        },
        summary: {
          title: 'Summary',
          points: [],
          turnCount: 5,
          createdAt: new Date(),
        },
      };

      const packet = serializer.create(params);

      expect(packet.security.privacyMode).toBe('strict');
      expect(packet.security.securityLevel).toBe('high');
      expect(packet.security.piiRedacted).toBe(true);
    });

    it('should include optional metadata fields', () => {
      const serializer = new HandoffSerializer();

      const params: HandoffCreateParams = {
        mode: 'export',
        source: {
          profileId: 'profile-1',
          adapterType: 'generic-command',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 3,
        },
        metadata: {
          createdBy: 'user-456',
          reason: 'Export for external review',
          tags: ['review', 'external'],
          userApproved: true,
          userNotes: 'Approved for external system',
        },
      };

      const packet = serializer.create(params);

      expect(packet.metadata.reason).toBe('Export for external review');
      expect(packet.metadata.tags).toEqual(['review', 'external']);
      expect(packet.metadata.userApproved).toBe(true);
      expect(packet.metadata.userNotes).toBe('Approved for external system');
    });

    it('should use default creator when not specified', () => {
      const serializer = new HandoffSerializer();

      const params: HandoffCreateParams = {
        mode: 'none',
        source: {
          profileId: 'profile-1',
          adapterType: 'ollama',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 0,
        },
        metadata: {}, // No createdBy specified
      };

      const packet = serializer.create(params);

      expect(packet.metadata.createdBy).toBe('claude-switcher');
    });

    it('should create none mode handoff without content', () => {
      const serializer = new HandoffSerializer();

      const params: HandoffCreateParams = {
        mode: 'none',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 0,
        },
        metadata: {
          reason: 'Fresh start, no context',
        },
      };

      const packet = serializer.create(params);

      expect(packet.mode).toBe('none');
      expect(packet.content).toBeUndefined();
    });
  });

  describe('serialize', () => {
    it('should serialize handoff packet to JSON', () => {
      const serializer = new HandoffSerializer();

      const packet: HandoffPacket = {
        packetId: 'hnd-test-001',
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date('2024-01-01T10:00:00Z'),
          sessionEnd: new Date('2024-01-01T11:00:00Z'),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date('2024-01-01T12:00:00Z'),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
        content: {
          kind: 'summary',
          transcriptId: 'transcript-123',
        },
      };

      const json = serializer.serialize(packet);

      expect(json).toContain('"packetId": "hnd-test-001"');
      expect(json).toContain('"mode": "summary"');
      expect(json).toContain('2024-01-01T10:00:00.000Z'); // Date serialized as ISO string
    });

    it('should preserve nested data structures during serialization', () => {
      const serializer = new HandoffSerializer();

      const packet: HandoffPacket = {
        packetId: 'hnd-test-002',
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
          tags: ['tag1', 'tag2', 'tag3'],
        },
        security: {
          privacyMode: 'guarded',
          crossProvider: true,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'medium',
        },
        content: {
          kind: 'summary',
          summary: {
            title: 'Test Summary',
            points: ['Point 1', 'Point 2'],
            turnCount: 10,
            createdAt: new Date(),
          },
        },
      };

      const json = serializer.serialize(packet);
      const parsed = JSON.parse(json);

      expect(parsed.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(parsed.content.summary.points).toEqual(['Point 1', 'Point 2']);
    });
  });

  describe('deserialize', () => {
    it('should deserialize JSON to handoff packet', () => {
      const serializer = new HandoffSerializer();

      const json = JSON.stringify({
        packetId: 'hnd-test-003',
        mode: 'full',
        source: {
          profileId: 'profile-1',
          adapterType: 'native-claude',
          sessionStart: '2024-01-01T10:00:00Z',
          sessionEnd: '2024-01-01T11:00:00Z',
          turnCount: 15,
        },
        destination: {
          profileId: 'profile-2',
          adapterType: 'anthropic-compatible',
        },
        metadata: {
          createdAt: '2024-01-01T12:00:00Z',
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'strict',
          crossProvider: true,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'high',
        },
        content: {
          kind: 'summaryId',
          transcriptId: 'transcript-abc',
        },
      });

      const packet = serializer.deserialize(json);

      expect(packet.packetId).toBe('hnd-test-003');
      expect(packet.mode).toBe('full');
      expect(packet.source.profileId).toBe('profile-1');
      expect(packet.source.sessionStart).toBeInstanceOf(Date);
      expect(packet.destination?.profileId).toBe('profile-2');
      expect(packet.metadata.createdAt).toBeInstanceOf(Date);
      expect(packet.security.privacyMode).toBe('strict');
      expect(packet.content?.transcriptId).toBe('transcript-abc');
    });

    it('should convert ISO date strings to Date objects', () => {
      const serializer = new HandoffSerializer();

      const json = JSON.stringify({
        packetId: 'hnd-test-004',
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'ollama',
          sessionStart: '2024-01-01T10:00:00Z',
          sessionEnd: '2024-01-01T10:30:00Z',
          turnCount: 5,
        },
        metadata: {
          createdAt: '2024-01-01T11:00:00Z',
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
      });

      const packet = serializer.deserialize(json);

      expect(packet.source.sessionStart).toBeInstanceOf(Date);
      expect(packet.source.sessionEnd).toBeInstanceOf(Date);
      expect(packet.metadata.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid JSON', () => {
      const serializer = new HandoffSerializer();

      const invalidJson = JSON.stringify({
        packetId: 'hnd-test-005',
        // Missing required fields
      });

      expect(() => {
        serializer.deserialize(invalidJson);
      }).toThrow('Invalid handoff packet: missing required fields');
    });

    it('should throw error for malformed JSON', () => {
      const serializer = new HandoffSerializer();

      expect(() => {
        serializer.deserialize('not valid json');
      }).toThrow(); // JSON.parse will throw
    });
  });

  describe('validate', () => {
    it('should validate a correct handoff packet', () => {
      const serializer = new HandoffSerializer();

      const packet: HandoffPacket = {
        packetId: 'hnd-valid-001',
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
        content: {
          kind: 'summary',
          summary: {
            title: 'Summary',
            points: ['Point 1'],
            turnCount: 10,
            createdAt: new Date(),
          },
        },
      };

      expect(serializer.validate(packet)).toBe(true);
    });

    it('should reject packet with invalid packetId type', () => {
      const serializer = new HandoffSerializer();

      const packet = {
        packetId: 123, // Should be string
        mode: 'summary' as const,
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
      };

      expect(serializer.validate(packet as HandoffPacket)).toBe(false);
    });

    it('should reject packet with invalid mode', () => {
      const serializer = new HandoffSerializer();

      const packet = {
        packetId: 'hnd-invalid-001',
        mode: 'invalid-mode' as any,
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
      };

      expect(serializer.validate(packet as HandoffPacket)).toBe(false);
    });

    it('should reject packet missing source profileId', () => {
      const serializer = new HandoffSerializer();

      const packet = {
        packetId: 'hnd-invalid-002',
        mode: 'summary' as const,
        source: {
          profileId: '', // Empty string
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
      };

      expect(serializer.validate(packet as HandoffPacket)).toBe(false);
    });

    it('should reject packet missing metadata createdAt', () => {
      const serializer = new HandoffSerializer();

      const packet = {
        packetId: 'hnd-invalid-003',
        mode: 'summary' as const,
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: undefined as any, // Missing createdAt
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
      };

      expect(serializer.validate(packet as HandoffPacket)).toBe(false);
    });

    it('should reject summary mode packet without content', () => {
      const serializer = new HandoffSerializer();

      const packet: HandoffPacket = {
        packetId: 'hnd-invalid-004',
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
        // Missing content for summary mode
      };

      expect(serializer.validate(packet)).toBe(false);
    });

    it('should reject full mode packet without transcriptId', () => {
      const serializer = new HandoffSerializer();

      const packet: HandoffPacket = {
        packetId: 'hnd-invalid-005',
        mode: 'full',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 10,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
        content: {
          kind: 'summaryId',
          // Missing transcriptId
        },
      };

      expect(serializer.validate(packet)).toBe(false);
    });
  });

  describe('createAcknowledgment', () => {
    it('should create successful acknowledgment', () => {
      const serializer = new HandoffSerializer();

      const ack = serializer.createAcknowledgment(
        'hnd-source-001',
        'profile-dest-1',
        true,
      );

      expect(ack.reason).toBe('Handoff acknowledgment');
      expect(ack.tags).toContain('acknowledgment');
      expect(ack.tags).toContain('success');
      expect(ack.userApproved).toBe(false);
      expect(ack.userNotes).toContain('hnd-source-001');
      expect(ack.userNotes).toContain('profile-dest-1');
      expect(ack.userNotes).toContain('received by');
    });

    it('should create failure acknowledgment', () => {
      const serializer = new HandoffSerializer();

      const ack = serializer.createAcknowledgment(
        'hnd-source-002',
        'profile-dest-2',
        false,
      );

      expect(ack.tags).toContain('acknowledgment');
      expect(ack.tags).toContain('failed');
      expect(ack.userNotes).toContain('rejected by');
    });
  });

  describe('round-trip serialization', () => {
    it('should preserve all data through serialize/deserialize cycle', () => {
      const serializer = new HandoffSerializer();

      const originalPacket = serializer.create({
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: new Date('2024-01-01T10:00:00Z'),
          sessionEnd: new Date('2024-01-01T11:00:00Z'),
          turnCount: 20,
        },
        destination: {
          profileId: 'profile-2',
          adapterType: 'openai-compatible',
          model: 'gpt-4',
        },
        metadata: {
          createdBy: 'user-789',
          reason: 'Switching models',
          tags: ['switch', 'optimization'],
          userApproved: false,
        },
        security: {
          privacyMode: 'guarded',
          piiRedacted: false,
        },
        summary: {
          title: 'Development Summary',
          points: [
            'Implemented feature X',
            'Fixed bug Y',
            'Optimized performance',
          ],
          turnCount: 20,
          createdAt: new Date('2024-01-01T12:00:00Z'),
        },
        transcriptId: 'transcript-xyz-123',
      });

      // Serialize
      const json = serializer.serialize(originalPacket);

      // Deserialize
      const restoredPacket = serializer.deserialize(json);

      // Verify all fields
      expect(restoredPacket.packetId).toBe(originalPacket.packetId);
      expect(restoredPacket.mode).toBe(originalPacket.mode);
      expect(restoredPacket.source.profileId).toBe(originalPacket.source.profileId);
      expect(restoredPacket.source.adapterType).toBe(originalPacket.source.adapterType);
      expect(restoredPacket.source.model).toBe(originalPacket.source.model);
      expect(restoredPacket.source.turnCount).toBe(originalPacket.source.turnCount);
      expect(restoredPacket.destination?.profileId).toBe(originalPacket.destination?.profileId);
      expect(restoredPacket.metadata.reason).toBe(originalPacket.metadata.reason);
      expect(restoredPacket.metadata.tags).toEqual(originalPacket.metadata.tags);
      expect(restoredPacket.security.privacyMode).toBe(originalPacket.security.privacyMode);
      expect(restoredPacket.security.crossProvider).toBe(originalPacket.security.crossProvider);
      expect(restoredPacket.content?.kind).toBe(originalPacket.content?.kind);
      expect(restoredPacket.content?.summar).toEqual(originalPacket.content?.summar);
      expect(restoredPacket.content?.transcriptId).toBe(originalPacket.content?.transcriptId);
    });
  });

  describe('utility functions', () => {
    it('should create handoff packet using utility function', () => {
      const params: HandoffCreateParams = {
        mode: 'export',
        source: {
          profileId: 'profile-1',
          adapterType: 'ollama',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 5,
        },
        metadata: {
          createdBy: 'test-user',
        },
      };

      const packet = createHandoffPacket(params);

      expect(packet.packetId).toBeTruthy();
      expect(packet.mode).toBe('export');
      expect(packet.source.profileId).toBe('profile-1');
    });

    it('should serialize handoff packet using utility function', () => {
      const packet: HandoffPacket = {
        packetId: 'util-test-001',
        mode: 'none',
        source: {
          profileId: 'profile-1',
          adapterType: 'generic-command',
          sessionStart: new Date(),
          sessionEnd: new Date(),
          turnCount: 0,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
      };

      const json = serializeHandoffPacket(packet);

      expect(json).toContain('"packetId": "util-test-001"');
      expect(json).toContain('"mode": "none"');
    });

    it('should deserialize handoff packet using utility function', () => {
      const json = JSON.stringify({
        packetId: 'util-test-002',
        mode: 'summary',
        source: {
          profileId: 'profile-1',
          adapterType: 'anthropic-compatible',
          sessionStart: '2024-01-01T10:00:00Z',
          sessionEnd: '2024-01-01T11:00:00Z',
          turnCount: 10,
        },
        metadata: {
          createdAt: '2024-01-01T12:00:00Z',
          createdBy: 'test-user',
        },
        security: {
          privacyMode: 'unrestricted',
          crossProvider: false,
          secretsRedacted: true,
          piiRedacted: true,
          securityLevel: 'low',
        },
        content: {
          kind: 'summary',
          summary: {
            title: 'Summary',
            points: [],
            turnCount: 0,
            createdAt: '2024-01-01T12:00:00Z',
          },
        },
      });

      const packet = deserializeHandoffPacket(json);

      expect(packet.packetId).toBe('util-test-002');
      expect(packet.mode).toBe('summary');
      expect(packet.source.profileId).toBe('profile-1');
    });
  });
});

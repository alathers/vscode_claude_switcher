/**
 * tests/unit/core/handoff/transcript-oracle.test.ts
 *
 * Unit tests for transcript-oracle.ts
 * Tests transcript retrieval, caching, and validation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  TranscriptOracle,
  fetchTranscript,
  supportsTranscript,
} from '@src/core/handoff/transcript-oracle';
import type { ModelAdapter, ProfileConfig, Transcript } from '@src/core/adapters/contract';

describe('TranscriptOracle', () => {
  const createMockAdapter = (overrides?: Partial<ModelAdapter>): ModelAdapter => ({
    id: 'test-adapter',
    type: 'anthropic-compatible',
    name: 'Test Adapter',
    capabilities: {
      textGeneration: true,
      functionCalling: false,
      transcriptObservable: true,
      sessionPersistence: false,
    },
    getTranscript: overrides?.getTranscript ?? vi.fn(),
    generateResponse: overrides?.generateResponse ?? vi.fn(),
    awaitResponse: overrides?.awaitResponse ?? vi.fn(),
    setCapabilities: overrides?.setCapabilities ?? vi.fn(),
    ...overrides,
  });

  const createMockProfile = (overrides?: Partial<ProfileConfig>): ProfileConfig => ({
    id: 'profile-1',
    name: 'Test Profile',
    adapter: 'anthropic-compatible',
    model: 'claude-3-5-sonnet',
    credential: {
      mode: 'secretRef',
      secretRef: 'claude-api-key',
    },
    permissions: {
      mode: 'edit-and-command',
    },
    network: {
      providerClass: 'cloud',
      supportingNetwork: 'allowed',
    },
    capabilities: {
      textGeneration: true,
      functionCalling: false,
      transcriptObservable: true,
    },
    ...overrides,
  });

  const createMockTranscript = (overrides?: Partial<Transcript>): Transcript => ({
    id: 'transcript-001',
    profileId: 'profile-1',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T11:00:00Z'),
    turns: [
      {
        role: 'user',
        content: 'Hello, world!',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        role: 'assistant',
        content: 'Hi! How can I help you?',
        timestamp: new Date('2024-01-01T10:00:05Z'),
      },
    ],
    metadata: {
      model: 'claude-3-5-sonnet',
    },
    ...overrides,
  });

  describe('constructor', () => {
    it('should initialize with cache enabled by default', () => {
      const oracle = new TranscriptOracle();

      expect(oracle.enableCache).toBe(true);
      expect(oracle.cacheTTL).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should initialize with custom cache options', () => {
      const oracle = new TranscriptOracle({
        enableCache: false,
        cacheTTL: 10000,
      });

      expect(oracle.enableCache).toBe(false);
      expect(oracle.cacheTTL).toBe(10000);
    });

    it('should initialize with caching enabled but custom TTL', () => {
      const oracle = new TranscriptOracle({
        cacheTTL: 30000, // 30 seconds
      });

      expect(oracle.enableCache).toBe(true);
      expect(oracle.cacheTTL).toBe(30000);
    });
  });

  describe('fetchTranscript', () => {
    it('should fetch transcript from adapter successfully', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(true);
      expect(result.transcript).toEqual(mockTranscript);
      expect(result.error).toBeUndefined();
      expect(result.metadata.profileId).toBe('profile-1');
      expect(result.metadata.adapterType).toBe('anthropic-compatible');
      expect(result.metadata.source).toBe('adapter');
      expect(result.metadata.fetchedAt).toBeInstanceOf(Date);
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);
    });

    it('should return from cache when transcript is cached', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: true });

      // First fetch - should call adapter
      const firstResult = await oracle.fetchTranscript(adapter, profile);
      expect(firstResult.metadata.source).toBe('adapter');
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);

      // Second fetch - should use cache
      const secondResult = await oracle.fetchTranscript(adapter, profile);
      expect(secondResult.metadata.source).toBe('cache');
      expect(getTranscriptMock).toHaveBeenCalledTimes(1); // Still only called once

      expect(secondResult.transcript).toEqual(mockTranscript);
    });

    it('should bypass cache when cache is disabled', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });

      // First fetch
      await oracle.fetchTranscript(adapter, profile);
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);

      // Second fetch - should call adapter again (no cache)
      await oracle.fetchTranscript(adapter, profile);
      expect(getTranscriptMock).toHaveBeenCalledTimes(2);
    });

    it('should return error when adapter does not support transcriptObservable', async () => {
      const adapter = createMockAdapter({
        capabilities: {
          textGeneration: true,
          functionCalling: false,
          transcriptObservable: false, // Not supported
          sessionPersistence: false,
        },
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('does not support transcript retrieval');
      expect(result.metadata.source).toBe('adapter');
    });

    it('should return error when getTranscript method is not implemented', async () => {
      const adapter = createMockAdapter({
        capabilities: {
          textGeneration: true,
          functionCalling: false,
          transcriptObservable: true, // Declared as supported
          sessionPersistence: false,
        },
        getTranscript: undefined as any, // But method not implemented
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('getTranscript method is not implemented');
    });

    it('should return error when adapter throws exception', async () => {
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockRejectedValue(new Error('Connection failed')),
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('Failed to fetch transcript');
      expect(result.error).toContain('Connection failed');
    });

    it('should return error when adapter returns null transcript', async () => {
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(null),
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('Adapter returned null transcript');
    });
  });

  describe('fetchValidatedTranscript', () => {
    it('should return transcript when validation passes', async () => {
      const mockTranscript = createMockTranscript();
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(mockTranscript),
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchValidatedTranscript(adapter, profile);

      expect(result.success).toBe(true);
      expect(result.transcript).toEqual(mockTranscript);
      expect(result.error).toBeUndefined();
    });

    it('should return error when validation fails', async () => {
      const invalidTranscript = createMockTranscript({
        id: '', // Missing required field
      });
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(invalidTranscript),
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchValidatedTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('Transcript validation failed');
      expect(result.error).toContain('Missing transcript ID');
    });

    it('should return error when fetch itself fails', async () => {
      const adapter = createMockAdapter({
        capabilities: {
          textGeneration: true,
          functionCalling: false,
          transcriptObservable: false,
          sessionPersistence: false,
        },
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchValidatedTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('does not support transcript retrieval');
    });
  });

  describe('cache management', () => {
    it('should add transcript to cache', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: true });

      await oracle.fetchTranscript(adapter, profile);

      // Second request should use cache
      const result = await oracle.fetchTranscript(adapter, profile);
      expect(result.metadata.source).toBe('cache');
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);
    });

    it('should allow clearing cache for specific profile', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: true });

      // Fetch and cache
      await oracle.fetchTranscript(adapter, profile);
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);

      // Clear cache
      oracle.clearCache(profile.id);

      // Fetch again - should call adapter again
      await oracle.fetchTranscript(adapter, profile);
      expect(getTranscriptMock).toHaveBeenCalledTimes(2);
    });

    it('should allow clearing all cache', async () => {
      const mockTranscript = createMockTranscript();

      const adapter1 = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(mockTranscript),
        id: 'adapter-1',
      });
      const profile1 = createMockProfile({ id: 'profile-1' });

      const adapter2 = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(mockTranscript),
        id: 'adapter-2',
      });
      const profile2 = createMockProfile({ id: 'profile-2' });

      const oracle = new TranscriptOracle({ enableCache: true });

      // Fetch both profiles (both cached)
      await oracle.fetchTranscript(adapter1, profile1);
      await oracle.fetchTranscript(adapter2, profile2);

      expect(adapter1.getTranscript).toHaveBeenCalledTimes(1);
      expect(adapter2.getTranscript).toHaveBeenCalledTimes(1);

      // Clear all cache
      oracle.clearAllCache();

      // Fetch both again - should call adapters again
      await oracle.fetchTranscript(adapter1, profile1);
      await oracle.fetchTranscript(adapter2, profile2);

      expect(adapter1.getTranscript).toHaveBeenCalledTimes(2);
      expect(adapter2.getTranscript).toHaveBeenCalledTimes(2);
    });

    it('should expire cache entries after TTL', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({
        enableCache: true,
        cacheTTL: 100, // Very short TTL (100ms)
      });

      // Fetch and cache
      await oracle.fetchTranscript(adapter, profile);
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);

      // Use cached version immediately
      await oracle.fetchTranscript(adapter, profile);
      expect(getTranscriptMock).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fetch again - cache expired, should call adapter
      const result = await oracle.fetchTranscript(adapter, profile);
      expect(result.metadata.source).toBe('adapter');
      expect(getTranscriptMock).toHaveBeenCalledTimes(2);
    }, 1000); // Increase timeout for this test

    it('should not use cache when cache is disabled', async () => {
      const mockTranscript = createMockTranscript();
      const getTranscriptMock = vi.fn().mockResolvedValue(mockTranscript);

      const adapter = createMockAdapter({
        getTranscript: getTranscriptMock,
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });

      await oracle.fetchTranscript(adapter, profile);
      await oracle.fetchTranscript(adapter, profile);

      expect(getTranscriptMock).toHaveBeenCalledTimes(2); // No caching
    });
  });

  describe('supportsTranscriptRetrieval', () => {
    it('should return true when adapter supports transcriptObservable', () => {
      const adapter = createMockAdapter();

      const oracle = new TranscriptOracle();
      const result = oracle.supportsTranscriptRetrieval(adapter);

      expect(result).toBe(true);
    });

    it('should return false when transcriptObservable is false', () => {
      const adapter = createMockAdapter({
        capabilities: {
          textGeneration: true,
          functionCalling: false,
          transcriptObservable: false,
          sessionPersistence: false,
        },
      });

      const oracle = new TranscriptOracle();
      const result = oracle.supportsTranscriptRetrieval(adapter);

      expect(result).toBe(false);
    });

    it('should return false when getTranscript is not a function', () => {
      const adapter = createMockAdapter({
        capabilities: {
          textGeneration: true,
          functionCalling: false,
          transcriptObservable: true,
          sessionPersistence: false,
        },
        getTranscript: undefined as any,
      });

      const oracle = new TranscriptOracle();
      const result = oracle.supportsTranscriptRetrieval(adapter);

      expect(result).toBe(false);
    });
  });

  describe('isSuitableForHandoff', () => {
    it('should return true for suitable transcript', () => {
      const oracle = new TranscriptOracle();
      const transcript = createMockTranscript({
        id: 'transcript-001',
        profileId: 'profile-1',
        turns: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      });

      const result = oracle.isSuitableForHandoff(transcript);

      expect(result).toBe(true);
    });

    it('should return false when transcript has less than 2 turns', () => {
      const oracle = new TranscriptOracle();
      const transcript = createMockTranscript({
        id: 'transcript-001',
        profileId: 'profile-1',
        turns: [
          { role: 'user', content: 'Hello' },
        ],
      });

      const result = oracle.isSuitableForHandoff(transcript);

      expect(result).toBe(false);
    });

    it('should return false when transcript has no turns', () => {
      const oracle = new TranscriptOracle();
      const transcript = createMockTranscript({
        id: 'transcript-001',
        profileId: 'profile-1',
        turns: [],
      });

      const result = oracle.isSuitableForHandoff(transcript);

      expect(result).toBe(false);
    });

    it('should return false when transcript id is missing', () => {
      const oracle = new TranscriptOracle();
      const transcript = createMockTranscript({
        id: '', // Empty
        profileId: 'profile-1',
        turns: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      });

      const result = oracle.isSuitableForHandoff(transcript);

      expect(result).toBe(false);
    });

    it('should return false when profileId is missing', () => {
      const oracle = new TranscriptOracle();
      const transcript = createMockTranscript({
        id: 'transcript-001',
        profileId: '', // Empty
        turns: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      });

      const result = oracle.isSuitableForHandoff(transcript);

      expect(result).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should fetch transcript using utility function', async () => {
      const mockTranscript = createMockTranscript();
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(mockTranscript),
      });
      const profile = createMockProfile();

      const result = await fetchTranscript(adapter, profile);

      expect(result.success).toBe(true);
      expect(result.transcript).toEqual(mockTranscript);
    });

    it('should check support using utility function', () => {
      const adapter = createMockAdapter();

      const result = supportsTranscript(adapter);

      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle adapter that returns undefined transcript', async () => {
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockResolvedValue(undefined),
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.transcript).toBeNull();
      expect(result.error).toContain('Adapter returned null transcript');
    });

    it('should handle non-Error exceptions', async () => {
      const adapter = createMockAdapter({
        getTranscript: vi.fn().mockRejectedValue('String error'),
      });
      const profile = createMockProfile();

      const oracle = new TranscriptOracle({ enableCache: false });
      const result = await oracle.fetchTranscript(adapter, profile);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch transcript: String error');
    });

    it('should handle clearing cache for non-existent profile', () => {
      const oracle = new TranscriptOracle({ enableCache: true });

      // Should not throw
      expect(() => oracle.clearCache('non-existent-profile')).not.toThrow();
    });

    it('should handle empty cache on clearAllCache', () => {
      const oracle = new TranscriptOracle({ enableCache: true });

      // Should not throw with empty cache
      expect(() => oracle.clearAllCache()).not.toThrow();
    });
  });
});

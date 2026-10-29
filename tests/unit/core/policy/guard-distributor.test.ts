/**
 * tests/unit/core/policy/guard-distributor.test.ts
 *
 * Guard Distributor Unit Tests
 *
 * Tests approval flow, timeout tracking, and multi-approver logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { GuardDistributor } from '../../../../src/core/policy/guard-distributor.js';

// Mock current time for consistent test behavior
const mockDate = new Date('2024-01-15T10:30:00Z');
vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
vi.spyOn(Date.prototype, 'toUTCString').mockReturnValue(mockDate.toUTCString());

describe('GuardDistributor', () => {
  describe('Request Registration', () => {
    it('should register pending cloud request', () => {
      const distributor = new GuardDistributor();

      const requestId = 'req-123';
      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      const request = distributor.getRequest(requestId);
      expect(request).toBeDefined();
      expect(request.requestId).toBe(requestId);
      expect(request.status).toBe('pending');
      expect(request.destination).toBe('anthropic:claude-3-opus-20240229');
    });

    it('should throw error when registering duplicate request ID', () => {
      const distributor = new GuardDistributor();

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      expect(() =>
        distributor.registerRequest({
          requestId,
          destination: 'anthropic:claude-3-sonnet-20240229',
          sessionId: 'session-def',
          profileId: 'profile-xyz',
          requestedAt: Date.now(),
        }),
      ).toThrow(/duplicate.*request/i);
    });

    it('should auto-expire pending requests after timeout', () => {
      const distributor = new GuardDistributor({ defaultTimeoutMinutes: 5 });

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      });

      const request = distributor.getRequest(requestId);
      expect(request.status).toBe('expired');
    });

    it('should not auto-expire requests within timeout window', () => {
      const distributor = new GuardDistributor({ defaultTimeoutMinutes: 5 });

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now() - 4 * 60 * 1000, // 4 minutes ago
      });

      const request = distributor.getRequest(requestId);
      expect(request.status).toBe('pending');
    });
  });

  describe('Request Approval', () => {
    it('should approve pending request', () => {
      const distributor = new GuardDistributor();

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      const result = distributor.approveRequest(requestId, {
        approvedBy: 'user-001',
        reason: 'Required for analysis',
      });

      expect(result.success).toBe(true);
      expect(result.approved.requestId).toBe(requestId);

      const request = distributor.getRequest(requestId);
      expect(request.status).toBe('approved');
      expect(request.approvedBy).toBe('user-001');
      expect(request.approvedAt).toBeDefined();
      expect(request.reason).toBe('Required for analysis');
    });

    it('should deny pending request', () => {
      const distributor = new GuardDistributor();

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      const result = distributor.denyRequest(requestId, {
        deniedBy: 'user-001',
        reason: 'Security concern',
      });

      expect(result.success).toBe(true);
      expect(result.denied.requestId).toBe(requestId);

      const request = distributor.getRequest(requestId);
      expect(request.status).toBe('denied');
      expect(request.deniedBy).toBe('user-001');
      expect(request.deniedAt).toBeDefined();
      expect(request.reason).toBe('Security concern');
    });

    it('should throw error when approving non-existent request', () => {
      const distributor = new GuardDistributor();

      expect(() =>
        distributor.approveRequest('non-existent', { approvedBy: 'user-001' }),
      ).toThrow(/request not found/i);
    });

    it('should throw error when denying non-existent request', () => {
      const distributor = new GuardDistributor();

      expect(() =>
        distributor.denyRequest('non-existent', { deniedBy: 'user-001' }),
      ).toThrow(/request not found/i);
    });

    it('should throw error when approving already approved request', () => {
      const distributor = new GuardDistributor();

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.approveRequest(requestId, { approvedBy: 'user-001' });

      expect(() =>
        distributor.approveRequest(requestId, { approvedBy: 'user-002' }),
      ).toThrow(/request.*not.*pending/i);
    });

    it('should throw error when denying already denied request', () => {
      const distributor = new GuardDistributor();

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.denyRequest(requestId, { deniedBy: 'user-001' });

      expect(() =>
        distributor.denyRequest(requestId, { deniedBy: 'user-002' }),
      ).toThrow(/request.*not.*pending/i);
    });
  });

  describe('Second Approver Logic', () => {
    it('should require second approver when configured', () => {
      const distributor = new GuardDistributor({
        requireSecondApprover: true,
      });

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      // First approval - should remain pending
      const result1 = distributor.approveRequest(requestId, {
        approvedBy: 'user-001',
        reason: 'Required for analysis',
      });

      expect(result1.success).toBe(true);
      expect(result1.fullyApproved).toBe(false);

      const request = distributor.getRequest(requestId);
      expect(request.status).toBe('pending');
      expect(request.approvers).toHaveLength(1);
      expect(request.approvers?.[0]).toBe('user-001');

      // Second approval - should approve
      const result2 = distributor.approveRequest(requestId, {
        approvedBy: 'user-002',
        reason: 'Confirmed safe',
      });

      expect(result2.success).toBe(true);
      expect(result2.fullyApproved).toBe(true);

      const finalRequest = distributor.getRequest(requestId);
      expect(finalRequest.status).toBe('approved');
      expect(finalRequest.approvers).toHaveLength(2);
    });

    it('should prevent same user from approving twice', () => {
      const distributor = new GuardDistributor({
        requireSecondApprover: true,
      });

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.approveRequest(requestId, {
        approvedBy: 'user-001',
        reason: 'First approval',
      });

      expect(() =>
        distributor.approveRequest(requestId, {
          approvedBy: 'user-001',
          reason: 'Second approval',
        }),
      ).toThrow(/already approved/i);
    });

    it('should track all approvers in approval history', () => {
      const distributor = new GuardDistributor({
        requireSecondApprover: true,
      });

      const requestId = 'req-123';

      distributor.registerRequest({
        requestId,
        destination: 'anthropic:claude-3-opus-20240229',
        sessionId: 'session-abc',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.approveRequest(requestId, {
        approvedBy: 'user-001',
        reason: 'First approval',
      });

      distributor.approveRequest(requestId, {
        approvedBy: 'user-002',
        reason: 'Second approval',
      });

      const request = distributor.getRequest(requestId);
      expect(request.approvalHistory).toHaveLength(2);
      expect(request.approvalHistory?.[0].approver).toBe('user-001');
      expect(request.approvalHistory?.[1].approver).toBe('user-002');
    });
  });

  describe('Request Query', () => {
    it('should get pending requests', () => {
      const distributor = new GuardDistributor();

      distributor.registerRequest({
        requestId: 'req-1',
        destination: 'anthropic:claude-3-opus',
        sessionId: 'session-1',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.registerRequest({
        requestId: 'req-2',
        destination: 'anthropic:claude-3-sonnet',
        sessionId: 'session-2',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.approveRequest('req-1', { approvedBy: 'user-001' });

      const pendingRequests = distributor.getPendingRequests();

      expect(pendingRequests).toHaveLength(1);
      expect(pendingRequests[0].requestId).toBe('req-2');
    });

    it('should get requests by session', () => {
      const distributor = new GuardDistributor();

      distributor.registerRequest({
        requestId: 'req-1',
        destination: 'anthropic:claude-3-opus',
        sessionId: 'session-1',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      distributor.registerRequest({
        requestId: 'req-2',
        destination: 'anthropic:claude-3-sonnet',
        sessionId: 'session-2',
        profileId: 'profile-xyz',
        requestedAt: Date.now(),
      });

      const session1Requests = distributor.getRequestsBySession('session-1');

      expect(session1Requests).toHaveLength(1);
      expect(session1Requests[0].requestId).toBe('req-1');
    });

    it('should get expired requests', () => {
      const distributor = new GuardDistributor({ defaultTimeoutMinutes: 5 });

      distributor.registerRequest({
        requestId: 'req-1',
        destination: 'anthropic:claude-3-opus',
        sessionId: 'session-1',
        profileId: 'profile-xyz',
        requestedAt: Date.now() - 10 * 60 * 1000, // Expired
      });

      distributor.registerRequest({
        requestId: 'req-2',
        destination: 'anthropic:claude-3-sonnet',
        sessionId: 'session-2',
        profileId: 'profile-xyz',
        requestedAt: Date.now(), // Not expired
      });

      const expiredRequests = distributor.getExpiredRequests();

      expect(expiredRequests).toHaveLength(1);
      expect(expiredRequests[0].requestId).toBe('req-1');
      expect(expiredRequests[0].status).toBe('expired');
    });
  });

  describe('Cleanup', () => {
    it('should remove expired requests', () => {
      const distributor = new GuardDistributor({ defaultTimeoutMinutes: 5 });

      distributor.registerRequest({
        requestId: 'req-1',
        destination: 'anthropic:claude-3-opus',
        sessionId: 'session-1',
        profileId: 'profile-xyz',
        requestedAt: Date.now() - 10 * 60 * 1000, // Expired
      });

      distributor.registerRequest({
        requestId: 'req-2',
        destination: 'anthropic:claude-3-sonnet',
        sessionId: 'session-2',
        profileId: 'profile-xyz',
        requestedAt: Date.now(), // Not expired
      });

      const removed = distributor.cleanupExpired();

      expect(removed).toHaveLength(1);
      expect(removed[0]).toBe('req-1');

      const remaining = distributor.getPendingRequests();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].requestId).toBe('req-2');
    });

    it('should cleanup resolved requests after retention period', () => {
      const distributor = new GuardDistributor({
        resolvedRetentionMinutes: 60,
      });

      distributor.registerRequest({
        requestId: 'req-1',
        destination: 'anthropic:claude-3-opus',
        sessionId: 'session-1',
        profileId: 'profile-xyz',
        requestedAt: Date.now() - 90 * 60 * 1000, // 90 minutes ago
      });

      distributor.approveRequest('req-1', { approvedBy: 'user-001' });

      distributor.registerRequest({
        requestId: 'req-2',
        destination: 'anthropic:claude-3-sonnet',
        sessionId: 'session-2',
        profileId: 'profile-xyz',
        requestedAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
      });

      distributor.approveRequest('req-2', { approvedBy: 'user-001' });

      expect(distributor.getRequest('req-1')).toBeUndefined();
      expect(distributor.getRequest('req-2')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return undefined when getting unknown request', () => {
      const distributor = new GuardDistributor();

      expect(distributor.getRequest('unknown')).toBeUndefined();
    });

    it('should throw error when registering invalid request data', () => {
      const distributor = new GuardDistributor();

      expect(() =>
        distributor.registerRequest({
          requestId: '', // Empty ID
          destination: 'anthropic:claude-3-opus',
          sessionId: 'session-1',
          profileId: 'profile-xyz',
          requestedAt: Date.now(),
        }),
      ).toThrow();
    });
  });
});

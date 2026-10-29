/**
 * Quota Provider - Fetch quota data from various sources
 *
 * NOTE: No official Claude subscription API available per research finding.
 * These are stubs for future integration when official APIs become available.
 */

import type * as vscode from 'vscode';

/**
 * Stub for fetching subscription usage (user-manual per research)
 * When official API exists, this will call it.
 */
export async function fetchSubscriptionUsage(): Promise<number> {
  // User-manual tracking - quota-tracker maintains currentUsage
  // Stub for future official API integration
  return 0;
}

/**
 * Fetch API credit balance from SecretStorage
 * This stub reads from VS Code SecretStorage
 */
export async function fetchAPIBalance(secretStorage: vscode.SecretStorage): Promise<number | null> {
  try {
    const apiKey = await secretStorage.get('claude.api-key');
    if (!apiKey) {
      return null;
    }

    // Stub: In real implementation, this would call Claude API to get balance
    // For now, return null to indicate no balance data available
    return null;
  } catch (error) {
    console.error('Failed to fetch API balance:', error);
    return null;
  }
}

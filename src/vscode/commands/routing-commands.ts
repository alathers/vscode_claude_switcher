/**
 * src/vscode/commands/routing-commands.ts
 *
 * Routing Commands
 *
 * VS Code commands for routing operations (export history, reset quota, configure, etc.).
 */

import * as vscode from 'vscode';
import { URLValidator } from '../../utils/url-validator.js';
import { RoutingHistoryManager } from '../../core/routing/routing-history.js';
import { resetUsage } from '../../core/quota/quota-tracker.js';
import type { SubscriptionQuotaState } from '../../core/quota/quota-cache.js';

// Constants (T061: Extract magic numbers)
const HARVEY_DEFAULT_PORT = 11434;
const HARVEY_DEFAULT_URL = `http://localhost:${HARVEY_DEFAULT_PORT}`;
// ROUTING_HISTORY_RETENTION_DAYS is used by routing-history.getAllDecisionsForExport()
// Exporting here for reference when implementing history analytics
// const ROUTING_HISTORY_RETENTION_DAYS = 30; // eslint-disable-line @typescript-eslint/no-unused-vars // Used for history export retention

// Security: URL validator for SSRF prevention (T062)
const urlValidator = new URLValidator();

// Global state for quota tracker (will be initialized by extension)
let quotaState: SubscriptionQuotaState | null = null;
let routingHistory: RoutingHistoryManager | null = null;

/**
 * Initialize routing commands global state.
 * Called by extension activation.
 */
export function initializeRoutingCommands(
  theQuotaState: SubscriptionQuotaState,
  theRoutingHistory: RoutingHistoryManager
): void {
  quotaState = theQuotaState;
  routingHistory = theRoutingHistory;
}

/**
 * Registers all routing commands.
 */
export function registerRoutingCommands(context: vscode.ExtensionContext): void {
  // T051: Export routing history command
  const exportHistoryCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.exportHistory',
    async () => {
      try {
        if (!routingHistory) {
          await vscode.window.showErrorMessage('Routing history not initialized');
          return;
        }

        // Prompt user for save location
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('routing-history-export.json'),
          title: 'Export Routing History',
          filters: {
            'JSON': ['json'],
          },
        });

        if (!saveUri) {
          return; // User canceled
        }

        // Load all routing decisions
        const decisions = await routingHistory.getAllDecisionsForExport();

        // Write to selected file
        const fs = require('fs');
        fs.writeFileSync(saveUri.fsPath, JSON.stringify(decisions, null, 2), 'utf-8');

        // Show success message
        await vscode.window.showInformationMessage(
          `Exported ${decisions.length} routing records to ${saveUri.fsPath}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`Failed to export routing history: ${errorMessage}`);
      }
    }
  );

  // T052: Manual quota reset command
  const resetQuotaCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.resetQuota',
    async () => {
      if (!quotaState) {
        await vscode.window.showErrorMessage('Quota tracker not initialized');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        'Reset subscription quota to 0? This will restart your rolling window.',
        { modal: true },
        'Reset',
        'Cancel'
      );

      if (confirm === 'Reset') {
        try {
          // Reset quota state
          resetUsage(quotaState);

          // TODO: Update quotaState reference (this needs to be refactored to be mutable)
          // For now, show confirmation message

          // TODO: Log routing decision documenting manual reset
          // await routingHistory?.writeDecision({
          //   routedTo: 'subscription',
          //   taskType: 'quota-reset',
          //   quotaBefore: quotaState.currentUsage,
          //   quotaAfter: 0,
          //   reason: 'Manual quota reset by user'
          // });

          await vscode.window.showInformationMessage(
            'Quota tracking reset to 0, rolling window restarted'
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(`Failed to reset quota: ${errorMessage}`);
        }
      }
    }
  );

  // T053: Configure routing shortcut command
  const configureRoutingCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.configure',
    async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:claude-switcher claudeSwitcher.routing'
      );
    }
  );

  // T054/T025: Show quota dashboard command
  const showQuotaCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.showQuota',
    async () => {
      // TODO: Implement quota dashboard webview (T026)
      // For now, show a placeholder message
      await vscode.window.showInformationMessage(
        'Quota dashboard coming soon. Configuration available in Settings.'
      );
    }
  );

  // T049: Validate Harvey connectivity command
  const validateHarveyCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.validateHarvey',
    async () => {
      try {
        // Get Harvey baseUrl from configuration
        const config = vscode.workspace.getConfiguration('claudeSwitcher.routing');
        const baseUrl = config.get<string>('harvey.baseUrl', HARVEY_DEFAULT_URL);

        // T062: Security hardening - validate baseUrl is localhost to prevent SSRF
        if (!urlValidator.isLocalhost(baseUrl)) {
          await vscode.window.showErrorMessage(
            `Security: Harvey baseUrl must be localhost-based for security (SSRF prevention). Current baseUrl: ${baseUrl}. Please use localhost, 127.0.0.1, or ::1.`
          );
          return;
        }

        // Try to connect to Harvey health endpoint
        const healthUrl = `${baseUrl}/health`;
        const response = await fetch(healthUrl);

        if (response.ok) {
          await vscode.window.showInformationMessage(
            `Harvey service reachable and responding at ${baseUrl}`
          );
        } else {
          await vscode.window.showErrorMessage(
            `Cannot connect to Harvey: ${response.statusText}. Troubleshooting: 1. Verify Harvey running: \`harvey serve --port ${HARVEY_DEFAULT_PORT}\` 2. Check baseUrl in settings 3. Check firewall rules (must be localhost-based)`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(
          `Cannot connect to Harvey: ${errorMessage}. Troubleshooting: 1. Verify Harvey running: \`harvey serve --port ${HARVEY_DEFAULT_PORT}\` 2. Check baseUrl in settings 3. Check firewall rules (must be localhost-based)`
        );
      }
    }
  );

  context.subscriptions.push(
    exportHistoryCommand,
    resetQuotaCommand,
    configureRoutingCommand,
    showQuotaCommand,
    validateHarveyCommand
  );
}

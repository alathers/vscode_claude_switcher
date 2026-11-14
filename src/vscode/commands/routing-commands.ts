/**
 * src/vscode/commands/routing-commands.ts
 *
 * Routing Commands
 *
 * VS Code commands for routing operations (export history, reset quota, configure, etc.).
 */

import * as vscode from 'vscode';
<<<<<<< HEAD
import * as fs from 'fs';
import * as path from 'path';
import { URLValidator } from '../../utils/url-validator.js';

// Constants (T061: extract magic numbers)
const HARVEY_DEFAULT_PORT = 11434;
const HARVEY_DEFAULT_URL = `http://localhost:${HARVEY_DEFAULT_PORT}`;
const ROUTING_HISTORY_RETENTION_DAYS = 30;
=======
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
>>>>>>> origin/main

// Security: URL validator for SSRF prevention (T062)
const urlValidator = new URLValidator();

<<<<<<< HEAD
/**
 * Gets the default path for routing history records.
 */
function getRoutingRecordsPath(context: vscode.ExtensionContext): string {
  const recordsPath = path.join(context.globalStorageUri.fsPath, 'routing-records');
  return recordsPath;
}

/**
 * Reads all routing decision records from daily files.
 */
async function readAllRoutingDecisions(context: vscode.ExtensionContext): Promise<any[]> {
  const recordsPath = getRoutingRecordsPath(context);
  if (!fs.existsSync(recordsPath)) {
    return [];
  }

  const allDecisions: any[] = [];
  const dailyDir = path.join(recordsPath, 'daily');

  if (!fs.existsSync(dailyDir)) {
    return allDecisions;
  }

  const files = fs.readdirSync(dailyDir);
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse(); // Most recent first

  for (const file of jsonFiles.slice(0, ROUTING_HISTORY_RETENTION_DAYS)) { // Limit to ROUTING_HISTORY_RETENTION_DAYS
    const filePath = path.join(dailyDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = JSON.parse(content) as any[];
      allDecisions.push(...records);
    } catch (error) {
      console.error(`Failed to read routing history file ${file}:`, error);
    }
  }

  return allDecisions;
}

/**
 * Registers routing commands.
=======
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
>>>>>>> origin/main
 */
export function registerRoutingCommands(context: vscode.ExtensionContext): void {
  // T051: Export routing history command
  const exportHistoryCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.exportHistory',
    async () => {
      try {
<<<<<<< HEAD
=======
        if (!routingHistory) {
          await vscode.window.showErrorMessage('Routing history not initialized');
          return;
        }

>>>>>>> origin/main
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
<<<<<<< HEAD
        const decisions = await readAllRoutingDecisions(context);

        // Write to selected file
=======
        const decisions = await routingHistory.getAllDecisionsForExport();

        // Write to selected file
        const fs = require('fs');
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
      if (!quotaState) {
        await vscode.window.showErrorMessage('Quota tracker not initialized');
        return;
      }

>>>>>>> origin/main
      const confirm = await vscode.window.showWarningMessage(
        'Reset subscription quota to 0? This will restart your rolling window.',
        { modal: true },
        'Reset',
        'Cancel'
      );

      if (confirm === 'Reset') {
        try {
<<<<<<< HEAD
          // TODO: Integrate with QuotaTracker.resetUsage()
          // For now, just show confirmation since QuotaTracker not yet implemented
          await vscode.window.showInformationMessage(
            'Quota tracking reset to 0, rolling window restarted'
          );

          // Log routing decision documenting manual reset
          // TODO: Call routingHistory.writeDecision() when available
=======
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
>>>>>>> origin/main
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

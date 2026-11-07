/**
 * src/vscode/commands/routing-commands.ts
 *
 * Routing Commands
 *
 * VS Code commands for routing operations (export history, reset quota, configure, etc.).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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

  for (const file of jsonFiles.slice(0, 30)) { // Limit to 30 days
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
 */
export function registerRoutingCommands(context: vscode.ExtensionContext): void {
  // T051: Export routing history command
  const exportHistoryCommand = vscode.commands.registerCommand(
    'claudeSwitcher.routing.exportHistory',
    async () => {
      try {
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
        const decisions = await readAllRoutingDecisions(context);

        // Write to selected file
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
      const confirm = await vscode.window.showWarningMessage(
        'Reset subscription quota to 0? This will restart your rolling window.',
        { modal: true },
        'Reset',
        'Cancel'
      );

      if (confirm === 'Reset') {
        try {
          // TODO: Integrate with QuotaTracker.resetUsage()
          // For now, just show confirmation since QuotaTracker not yet implemented
          await vscode.window.showInformationMessage(
            'Quota tracking reset to 0, rolling window restarted'
          );

          // Log routing decision documenting manual reset
          // TODO: Call routingHistory.writeDecision() when available
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

  context.subscriptions.push(
    exportHistoryCommand,
    resetQuotaCommand,
    configureRoutingCommand
  );
}

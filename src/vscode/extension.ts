/**
 * src/vscode/extension.ts
 *
 * Extension Entry Point
 *
 * Main extension activation/deactivation and command registration.
 * All VS Code API access is isolated in the vscode layer.
 *
 * This module CONTAINS VS Code API imports - part of the vscode layer.
 */

import * as vscode from 'vscode';

// ============================================================
// VS Code Integration Layer
// ============================================================

/**
 * Extension activation.
 *
 * This method is called when the extension is activated.
 *
 * @param context - Extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Claude-Switcher] Extension is activating...');

  // Register commands
  registerCommands(context);

  // Register configuration watchers
  registerConfigurationWatchers(context);

  // Show welcome notification on first activation
  await showWelcomeNotification(context);

  console.log('[Claude-Switcher] Extension activated successfully');
}

/**
 * Extension deactivation.
 *
 * This method is called when the extension is deactivated.
 */
export async function deactivate(): Promise<void> {
  console.log('[Claude-Switcher] Extension is deactivating...');

  // Clean up resources
  // (Disposables are automatically cleaned up via their subscriptions)

  console.log('[Claude-Switcher] Extension deactivated successfully');
}

// ============================================================
// COMMAND REGISTRATION
// ============================================================

/**
 * Register all extension commands.
 *
 * @param context - Extension context
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Profile management commands
  registerCommand(context, 'claudeSwitcher.selectProfile', selectProfileCommand);
  registerCommand(context, 'claudeSwitcher.createProfile', createProfileCommand);
  registerCommand(context, 'claudeSwitcher.editProfile', editProfileCommand);
  registerCommand(context, 'claudeSwitcher.deleteProfile', deleteProfileCommand);

  // Session management commands
  registerCommand(context, 'claudeSwitcher.startSession', startSessionCommand);
  registerCommand(context, 'claudeSwitcher.switchProfile', switchProfileCommand);
  registerCommand(context, 'claudeSwitcher.endSession', endSessionCommand);

  // Handoff commands
  registerCommand(context, 'claudeSwitcher.handoffTranscript', handoffTranscriptCommand);
  registerCommand(context, 'claudeSwitcher.handoffSummary', handoffSummaryCommand);
  registerCommand(context, 'claudeSwitcher.handoffNone', handoffNoneCommand);

  // Configuration commands
  registerCommand(context, 'claudeSwitcher.configureWorkspace', configureWorkspaceCommand);
  registerCommand(context, 'claudeSwitcher.setPrivacyMode', setPrivacyModeCommand);
  registerCommand(context, 'claudeSwitcher.openSettings', openSettingsCommand);

  // Validation and diagnostics commands
  registerCommand(context, 'claudeSwitcher.validateProfile', validateProfileCommand);
  registerCommand(context, 'claudeSwitcher.runDiagnostics', runDiagnosticsCommand);

  // Utility commands
  registerCommand(context, 'claudeSwitcher.showActivityLedger', showActivityLedgerCommand);
  registerCommand(context, 'claudeSwitcher.manageSecrets', manageSecretsCommand);
  registerCommand(context, 'claudeSwitcher.exportData', exportDataCommand);
}

/**
 * Helper function to register a command.
 *
 * @param context - Extension context
 * @param commandId - Command ID
 * @param handler - Command handler function
 */
function registerCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  handler: (...args: unknown[]) => unknown | Promise<unknown>,
): void {
  const disposable = vscode.commands.registerCommand(commandId, handler);
  context.subscriptions.push(disposable);
}

// ============================================================
// CONFIGURATION WATCHERS
// ============================================================

/**
 * Register configuration change watchers.
 *
 * @param context - Extension context
 */
function registerConfigurationWatchers(context: vscode.ExtensionContext): void {
  // Note: This will be implemented with WorkspaceConfigurationManager
  // For now, this is a placeholder
  const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('claudeSwitcher')) {
      console.log('[Claude-Switcher] Configuration changed');
      // Handle configuration change
    }
  });

  context.subscriptions.push(disposable);
}

// ============================================================
// WELCOME NOTIFICATION
// ============================================================

/**
 * Show welcome notification on first activation.
 *
 * @param context - Extension context
 */
async function showWelcomeNotification(context: vscode.ExtensionContext): Promise<void> {
  // Check if this is the first activation
  const activationKey = 'firstActivation';
  const isFirstActivation = !context.globalState.get(activationKey);

  if (isFirstActivation) {
    const message = 'Claude Switcher is now active! Select a profile to get started.';
    const action = 'Select Profile';

    const selection = await vscode.window.showInformationMessage(message, action);

    if (selection === action) {
      // Trigger select profile command
      await vscode.commands.executeCommand('claudeSwitcher.selectProfile');
    }

    // Mark as activated
    await context.globalState.update(activationKey, true);
  }
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

/**
 * Handler for select profile command.
 */
async function selectProfileCommand(): Promise<void> {
  vscode.window.showInformationMessage('Profile selection - To be implemented');
}

/**
 * Handler for create profile command.
 */
async function createProfileCommand(): Promise<void> {
  vscode.window.showInformationMessage('Create profile - To be implemented');
}

/**
 * Handler for edit profile command.
 */
async function editProfileCommand(): Promise<void> {
  vscode.window.showInformationMessage('Edit profile - To be implemented');
}

/**
 * Handler for delete profile command.
 */
async function deleteProfileCommand(): Promise<void> {
  vscode.window.showInformationMessage('Delete profile - To be implemented');
}

/**
 * Handler for start session command.
 */
async function startSessionCommand(): Promise<void> {
  vscode.window.showInformationMessage('Start session - To be implemented');
}

/**
 * Handler for switch profile command.
 */
async function switchProfileCommand(): Promise<void> {
  vscode.window.showInformationMessage('Switch profile - To be implemented');
}

/**
 * Handler for end session command.
 */
async function endSessionCommand(): Promise<void> {
  vscode.window.showInformationMessage('End session - To be implemented');
}

/**
 * Handler for handoff transcript command.
 */
async function handoffTranscriptCommand(): Promise<void> {
  vscode.window.showInformationMessage('Handoff transcript - To be implemented');
}

/**
 * Handler for handoff summary command.
 */
async function handoffSummaryCommand(): Promise<void> {
  vscode.window.showInformationMessage('Handoff summary - To be implemented');
}

/**
 * Handler for handoff none command.
 */
async function handoffNoneCommand(): Promise<void> {
  vscode.window.showInformationMessage('Handoff none - To be implemented');
}

/**
 * Handler for configure workspace command.
 */
async function configureWorkspaceCommand(): Promise<void> {
  vscode.window.showInformationMessage('Configure workspace - To be implemented');
}

/**
 * Handler for set privacy mode command.
 */
async function setPrivacyModeCommand(): Promise<void> {
  vscode.window.showInformationMessage('Set privacy mode - To be implemented');
}

/**
 * Handler for open settings command.
 */
async function openSettingsCommand(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', 'claudeSwitcher');
}

/**
 * Handler for validate profile command.
 */
async function validateProfileCommand(): Promise<void> {
  vscode.window.showInformationMessage('Validate profile - To be implemented');
}

/**
 * Handler for run diagnostics command.
 */
async function runDiagnosticsCommand(): Promise<void> {
  vscode.window.showInformationMessage('Run diagnostics - To be implemented');
}

/**
 * Handler for show activity ledger command.
 */
async function showActivityLedgerCommand(): Promise<void> {
  vscode.window.showInformationMessage('Show activity ledger - To be implemented');
}

/**
 * Handler for manage secrets command.
 */
async function manageSecretsCommand(): Promise<void> {
  vscode.window.showInformationMessage('Manage secrets - To be implemented');
}

/**
 * Handler for export data command.
 */
async function exportDataCommand(): Promise<void> {
  vscode.window.showInformationMessage('Export data - To be implemented');
}

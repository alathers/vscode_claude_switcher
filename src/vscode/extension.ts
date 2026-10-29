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
import { loadConfiguration, validateConfiguration } from '../core/routing/routing-config';
import { Logger, LogLevel } from '../utils/logger';
import type { ModelSource } from '../core/routing/routing-engine';
import { createStatusBarItem, show as showStatusBar, dispose as disposeStatusBar } from './views/quota-status-bar';
import { showDashboardCommand } from './views/quota-dashboard';


// ============================================================
// VS Code Integration Layer
// ============================================================

// Logger instance for extension
const logger = new Logger(LogLevel.INFO);

// Alert state to avoid duplicate notifications
let hasNotifiedAlertThreshold = false;

// Routing transition tracking
let lastRoutingSource: ModelSource | null = null;
let hasNotifiedTransitionToApiCredits = false;

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

  // Initialize routing configuration
  await initializeRoutingConfiguration(context);

  // Initialize status bar
  initializeStatusBar();

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

  // Dispose of status bar
  disposeStatusBar();

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

  // Model Cost Optimization commands
  registerCommand(context, 'claudeSwitcher.routing.showQuota', showDashboardCommand);
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
  const disposable = vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration('claudeSwitcher.routing')) {
      await handleRoutingConfigurationChange();
    }
  });

  context.subscriptions.push(disposable);
}

/**
 * Initialize routing configuration on extension startup.
 */
async function initializeRoutingConfiguration(_context: vscode.ExtensionContext): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('claudeSwitcher.routing');
    const routingConfig = await loadConfiguration(config);

    const validation = validateConfiguration(routingConfig, logger);

    if (!validation.valid) {
      logger.warn(
        'ExtensionInit',
        `Routing configuration has validation errors: ${validation.errors.join('; ')}`
      );
      vscode.window.showWarningMessage(
        `Claude Switcher routing configuration has errors. Check settings.`
      );
    } else {
      logger.info('ExtensionInit', 'Routing configuration loaded successfully');
    }
  } catch (error) {
    logger.error(
      'ExtensionInit',
      `Failed to initialize routing configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Handle routing configuration changes.
 */
async function handleRoutingConfigurationChange(): Promise<void> {
  try {
    logger.info('RoutingConfig', 'Routing configuration changed, reloading...');

    const config = vscode.workspace.getConfiguration('claudeSwitcher.routing');
    const routingConfig = await loadConfiguration(config);

    const validation = validateConfiguration(routingConfig, logger);

    if (!validation.valid) {
      logger.warn(
        'RoutingConfig',
        `Configuration validation failed: ${validation.errors.join('; ')}`
      );

      // Show warning message to user
      vscode.window.showWarningMessage(
        `Claude Switcher routing configuration is invalid. ${validation.errors.join('; ')}`
      );
    } else {
      logger.info('RoutingConfig', 'Routing configuration reloaded successfully');
    }
  } catch (error) {
    logger.error(
      'RoutingConfig',
      `Failed to reload routing configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Initialize status bar widget.
 */
function initializeStatusBar(): void {
  createStatusBarItem();
  showStatusBar();

  // Initial status will be updated when quota data is available
  logger.info('StatusBar', 'Status bar widget initialized');
}

/**
 * Check alert threshold and show notification if needed.
 *
 * This should be called after each quota usage increment.
 *
 * @param percentUsed - Current quota percentage used
 * @param alertThreshold - Alert threshold percentage from config
 */
export async function checkAlertThreshold(
  percentUsed: number,
  alertThreshold: number
): Promise<void> {
  if (percentUsed >= alertThreshold && !hasNotifiedAlertThreshold) {
    const message = `Subscription quota at ${Math.round(percentUsed)}% used. Approaching limit. Consider reducing usage or enabling auto-fallback to Ollama.`;

    logger.warn('QuotaAlert', message);
    vscode.window.showInformationMessage(message);

    // Set flagged to avoid duplicate notifications
    hasNotifiedAlertThreshold = true;
  } else if (percentUsed < alertThreshold / 2) {
    // Reset alert flag when usage drops significantly below threshold
    // (e.g., after rolling window reset)
    hasNotifiedAlertThreshold = false;
  }
}

/**
 * Check routing transition and show notification if source changes to API credits.
 *
 * This should be called after each routing decision.
 *
 * @param currentSource - Current routing source ('subscription' | 'api-credits' | 'ollama')
 */
export function checkRoutingTransition(currentSource: ModelSource): void {
  const previousSource = lastRoutingSource;

  // Detect transition from subscription to api-credits
  if (previousSource === 'subscription' && currentSource === 'api-credits' && !hasNotifiedTransitionToApiCredits) {
    const message = 'Routing change: subscription exhausted → API credits';

    logger.warn('RoutingTransition', message);
    void vscode.window.showInformationMessage(message);

    // Set flagged to avoid duplicate notifications
    hasNotifiedTransitionToApiCredits = true;
  }

  // Reset notification flag when routing returns to subscription
  if (currentSource === 'subscription') {
    hasNotifiedTransitionToApiCredits = false;
  }

  // Update last routing source
  lastRoutingSource = currentSource;
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

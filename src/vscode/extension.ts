/**
 * src/vscode/extension.ts
 *
 * Extension Entry Point
 *
 * Extension activation/deactivation, command registration (all VS Code API access here).
 */

import * as vscode from 'vscode';
import { WorkspaceConfig } from './configuration/workspace-config.js';
import { SecretStorage } from './configuration/secret-storage.js';
import { ClaudeCodeIntegrator } from './integration/claude-code-integrator.js';
import { registerRoutingCommands } from './commands/routing-commands.js';

export function activate(context: vscode.ExtensionContext): void {
  // eslint-disable-next-line no-console
  console.info('Claude Switcher extension is now active!');

  // Initialize VS Code components
  const configAdapter = {
    getConfiguration: () => vscode.workspace.getConfiguration(),
    update: (key: string, value: unknown, target: vscode.ConfigurationTarget | boolean | null | undefined) =>
      Promise.resolve(vscode.workspace.getConfiguration().update(key, value, target)),
  };

  const workspaceConfig = new WorkspaceConfig(configAdapter);
  const secretStorage = new SecretStorage({
    getSecret: (key: string) => Promise.resolve(context.secrets.get(key)),
    setSecret: (key: string, value: string) => Promise.resolve(context.secrets.store(key, value)),
    deleteSecret: (key: string) => Promise.resolve(context.secrets.delete(key)),
  });
  const integrator = new ClaudeCodeIntegrator({
    commands: vscode.commands,
    window: vscode.window,
  });

  // Prevent "declared but never used" errors - will be used in command registration
  void workspaceConfig;
  void secretStorage;
  void integrator;

  // Register commands
  registerRoutingCommands(context);
}

export function deactivate(): void {
  // eslint-disable-next-line no-console
  console.info('Claude Switcher extension is now deactivated.');
}

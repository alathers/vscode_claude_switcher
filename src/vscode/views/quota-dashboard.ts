/**
 * Quota Dashboard Webview
 *
 * Displays detailed quota information in a VS Code webview panel.
 *
 * This module CONTAINS VS Code API imports - part of the vscode layer.
 */

import * as vscode from 'vscode';
import type { QuotaSnapshot } from '../../core/routing/routing-engine';

/**
 * Current dashboard panel
 */
let dashboardPanel: vscode.WebviewPanel | null = null;

/**
 * Create quota dashboard webview panel
 */
export function createDashboard(): vscode.WebviewPanel {
  if (dashboardPanel) {
    dashboardPanel.reveal();
    return dashboardPanel;
  }

  const panel = vscode.window.createWebviewPanel(
    'claudeSwitcher.quotaDashboard',
    'Claude Switcher: Quota Dashboard',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: []
    }
  );

  dashboardPanel = panel;

  // Set up webview content
  panel.webview.html = getDashboardHTML(getPlaceholderQuota());

  // Handle panel disposal
  panel.onDidDispose(() => {
    dashboardPanel = null;
  });

  return panel;
}

/**
 * Update dashboard with current quota data
 */
export function updateDashboard(quota: QuotaSnapshot): void {
  if (!dashboardPanel) {
    return;
  }

  dashboardPanel.webview.html = getDashboardHTML(quota);
}

/**
 * Show quota dashboard command handler
 */
export function showDashboardCommand(): void {
  createDashboard();
}

/**
 * Get placeholder quota data for initial render
 */
function getPlaceholderQuota(): QuotaSnapshot {
  return {
    subscription: {
      plan: 'pro',
      dailyLimit: 30,
      rollingWindowDays: 7,
      currentUsage: 0,
      remainingQuota: 210,
      percentUsed: 0,
      rollingWindowStart: new Date().toISOString().split('T')[0],
      rollingWindowEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    apiCredits: {
      balance: 0,
      authenticated: false,
      stale: false,
      lastFetchTime: 0
    },
    ollama: {
      available: false,
      harveyReachable: false,
      circuitBreakerState: 'closed'
    }
  };
}

/**
 * Generate dashboard HTML
 */
function getDashboardHTML(quota: QuotaSnapshot): string {
  const subPercent = Math.round(quota.subscription.percentUsed);
  const remaining = quota.subscription.remainingQuota;
  const total = quota.subscription.dailyLimit * quota.subscription.rollingWindowDays;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Switcher: Quota Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 10px;
    }
    h2 {
      font-size: 18px;
      margin-top: 25px;
      margin-bottom: 15px;
    }
    .section {
      margin-bottom: 30px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .label {
      font-weight: bold;
    }
    .value {
      text-align: right;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
      margin: 15px 0;
    }
    .progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-foreground);
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    .progress-fill.warning {
      background-color: #d18900;
    }
    .progress-fill.error {
      background-color: #f14c4c;
    }
  </style>
</head>
<body>
  <h1>📊 Claude Switcher: Quota Dashboard</h1>

  <div class="section">
    <h2>🎯 Subscription (${quota.subscription.plan.toUpperCase()} Plan)</h2>
    <div class="info-row">
      <span class="label">Daily Limit:</span>
      <span class="value">${quota.subscription.dailyLimit}</span>
    </div>
    <div class="info-row">
      <span class="label">Rolling Window:</span>
      <span class="value">${quota.subscription.rollingWindowDays} days</span>
    </div>
    <div class="info-row">
      <span class="label">Window:</span>
      <span class="value">${quota.subscription.rollingWindowStart} to ${quota.subscription.rollingWindowEnd}</span>
    </div>
    <div class="info-row">
      <span class="label">Current Usage:</span>
      <span class="value">${quota.subscription.currentUsage}/${total}</span>
    </div>
    <div class="info-row">
      <span class="label">Remaining:</span>
      <span class="value">${remaining}</span>
    </div>

    <div class="progress-bar">
      <div class="progress-fill ${subPercent >= 100 ? 'error' : subPercent >= 80 ? 'warning' : ''}" style="width: ${subPercent}%">
        ${subPercent}%
      </div>
    </div>
  </div>

  ${quota.apiCredits.authenticated ? `
  <div class="section">
    <h2>💳 API Credits</h2>
    <div class="info-row">
      <span class="label">Balance:</span>
      <span class="value">${quota.apiCredits.balance.toLocaleString()}</span>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>🦙 Ollama</h2>
    <div class="info-row">
      <span class="label">Available:</span>
      <span class="value">${quota.ollama.available ? '✅ Yes' : '❌ No'}</span>
    </div>
    <div class="info-row">
      <span class="label">Harvey Reachable:</span>
      <span class="value">${quota.ollama.harveyReachable ? '✅ Yes' : '❌ No'}</span>
    </div>
    <div class="info-row">
      <span class="label">Circuit Breaker:</span>
      <span class="value">${quota.ollama.circuitBreakerState.toUpperCase()}</span>
    </div>
  </div>
</body>
</html>
  `.trim();
}

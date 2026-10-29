/**
 * Quota Status Bar Widget
 *
 * Displays quota status in VS Code status bar.
 *
 * This module CONTAINS VS Code API imports - part of the vscode layer.
 */

import * as vscode from 'vscode';
import type { QuotaSnapshot } from '../../core/routing/routing-engine';

/**
 * Quota status bar item
 */
let statusBarItem: vscode.StatusBarItem | null = null;

/**
 * Create status bar item for quota display
 */
export function createStatusBarItem(): vscode.StatusBarItem {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      'claudeSwitcher.routing.statusBarItem',
      vscode.StatusBarAlignment.Right,
      100 // Priority
    );

    statusBarItem.command = 'claudeSwitcher.routing.showQuota';
    statusBarItem.tooltip = 'Model Cost Optimization: Click for details';

    updateStatus({
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
    });
  }

  return statusBarItem;
}

/**
 * Update status bar with current quota state
 */
export function updateStatus(quota: QuotaSnapshot): void {
  if (!statusBarItem) {
    return;
  }

  const subPercent = Math.round(quota.subscription.percentUsed);
  const apiBalance = quota.apiCredits.authenticated
    ? quota.apiCredits.balance.toLocaleString()
    : '∞';

  // Build status text
  let statusText = `🎯 Sub: ${subPercent}% | API: ${apiBalance} | 🦙 Ollama`;

  // Update text based on quota state
  if (subPercent >= 100) {
    statusText = `❌ Sub: 100% | API: ${apiBalance} | 🦙 Ollama`;
  } else if (subPercent >= 80) {
    statusText = `⚠️ Sub: ${subPercent}% | API: ${apiBalance} | 🦙 Ollama`;
  }

  statusBarItem.text = statusText;

  // Colorize badge based on quota state
  if (subPercent >= 100) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
  } else if (subPercent >= 80) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
  } else {
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
  }

  // Update tooltip with current quota details
  const tooltipLines = [
    '**Claude Switcher - Model Cost Optimization**',
    '',
    `**Subscription (${quota.subscription.plan.toUpperCase()} Plan)**`,
    `Daily Limit: ${quota.subscription.dailyLimit}`,
    `Rolling Window: ${quota.subscription.rollingWindowDays} days`,
    `Current Usage: ${quota.subscription.currentUsage}/${quota.subscription.dailyLimit * quota.subscription.rollingWindowDays}`,
    `Remaining: ${quota.subscription.remainingQuota}`,
    `Percentage: ${subPercent}%`,
    '',
    `**Window:** ${quota.subscription.rollingWindowStart} to ${quota.subscription.rollingWindowEnd}`,
    ''
  ];

  if (quota.apiCredits.authenticated) {
    tooltipLines.push(`**API Credits:** ${quota.apiCredits.balance.toLocaleString()}`);
    tooltipLines.push('');
  }

  tooltipLines.push('Click to open Quota Dashboard');

  statusBarItem.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));
}

/**
 * Show status bar widget
 */
export function show(): void {
  if (statusBarItem) {
    statusBarItem.show();
  }
}

/**
 * Hide status bar widget
 */
export function hide(): void {
  if (statusBarItem) {
    statusBarItem.hide();
  }
}

/**
 * Dispose of status bar item
 */
export function dispose(): void {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = null;
  }
}

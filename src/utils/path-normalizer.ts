import * as path from 'path';
import * as os from 'os';

/**
 * Platform-agnostic path handling utility
 *
 * Constitution requirement: MUST NOT import vscode module
 * Uses Node.js built-ins: path, os
 */

/**
 * Normalize a file path for platform independence
 * @param inputPath - The path to normalize
 * @returns Normalized absolute path
 */
export function normalizePath(inputPath: string): string {
 return path.resolve(inputPath);
}

/**
 * Get user home directory in platform-agnostic way
 * @returns Path to user home directory
 */
export function getUserHome(): string {
 return os.homedir();
}

/**
 * Get default profiles directory
 * @returns Path to profiles directory (~/.claude-claude-switcher/profiles/)
 */
export function getProfilesDir(): string {
 return path.join(getUserHome(), '.claude-claude-switcher', 'profiles');
}

/**
 * Get default handoffs directory
 * @returns Path to handoffs directory (~/.claude-claude-switcher/handoffs/)
 */
export function getHandoffsDir(): string {
 return path.join(getUserHome(), '.claude-claude-switcher', 'handoffs');
}

/**
 * Get default audit log path
 * @returns Path to audit log (~/.claude-claude-switcher/audit.log)
 */
export function getAuditLogPath(): string {
 return path.join(getUserHome(), '.claude-claude-switcher', 'audit.log');
}

/**
 * Get workspace templates directory
 * @param workspaceRoot - Root path of the workspace
 * @returns Path to templates directory (.claude-switcher/templates/)
 */
export function getTemplatesDir(workspaceRoot: string): string {
 return path.join(workspaceRoot, '.claude-switcher', 'templates');
}

/**
 * Get workspace policy file path
 * @param workspaceRoot - Root path of the workspace
 * @returns Path to policy.yaml file
 */
export function getPolicyPath(workspaceRoot: string): string {
 return path.join(workspaceRoot, '.claude-switcher', 'policy.yaml');
}

/**
 * Relative path from base to target (for display purposes)
 * @param basePath - Base directory
 * @param targetPath - Target file/path
 * @returns Relative path if possible, otherwise returns targetPath
 */
export function getRelativePath(basePath: string, targetPath: string): string {
 return path.relative(basePath, targetPath);
}

/**
 * Check if path is within home directory
 * @param checkPath - Path to check
 * @returns True if path is inside user home directory
 */
export function isHomePath(checkPath: string): boolean {
 const normalized = path.normalize(checkPath);
 const home = path.normalize(getUserHome());
 return normalized.startsWith(home);
}

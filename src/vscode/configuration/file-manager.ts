/**
 * src/vscode/configuration/file-manager.ts
 *
 * File Manager Module
 *
 * Provides VS Code filesystem access for reading/writing files.
 * All VS Code API access is isolated in the vscode layer.
 *
 * This module CONTAINS VS Code API imports - part of the vscode layer.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// FILE MANAGER TYPES
// ============================================================

/**
 * File read result.
 */
export interface FileReadResult {
  /** File content */
  content: string;

  /** File encoding used */
  encoding: BufferEncoding;

  /** Whether the file exists */
  exists: boolean;
}

/**
 * File write result.
 */
export interface FileWriteResult {
  /** Whether the write was successful */
  success: boolean;

  /** Error message if the write failed */
  error?: string;

  /** Number of bytes written */
  bytesWritten?: number;
}

/**
 * File delete result.
 */
export interface FileDeleteResult {
  /** Whether the delete was successful */
  success: boolean;

  /** Error message if the delete failed */
  error?: string;
}

/**
 * Directory listing result.
 */
export interface DirectoryListingResult {
  /** List of file/directory entries */
  entries: string[];

  /** Whether the directory exists */
  exists: boolean;

  /** Error message if the listing failed */
  error?: string;
}

/**
 * File metadata.
 */
export interface FileMetadata {
  /** Absolute file path */
  path: string;

  /** File size in bytes */
  size: number;

  /** File creation time */
  createdAt: Date;

  /** File last modified time */
  modifiedAt: Date;

  /** Whether the path is a directory */
  isDirectory: boolean;

  /** Whether the path exists */
  exists: boolean;
}

// ============================================================
// FILE MANAGER
// ============================================================

/**
 * Manages file and directory operations for the extension.
 *
 * Usage:
 * ```typescript
 * const fileManager = new FileManager();
 *
 * // Read a file
 * const result = await fileManager.readFile('/path/to/file.txt');
 * if (result.exists) {
 *   console.log(result.content);
 * }
 *
 * // Write a file
 * const writeResult = await fileManager.writeFile('/path/to/file.txt', 'content');
 *
 * // Delete a file
 * await fileManager.deleteFile('/path/to/file.txt');
 *
 * // List directory contents
 * const listing = await fileManager.listDirectory('/path/to/directory');
 * ```
 *
 * This module isolates all file system API access, allowing core logic
 * modules to remain pure logic without file I/O dependencies.
 *
 * Security notes:
 * - Workspace configuration (including .vscode files) MUST NOT contain secrets (FR-014)
 * - Template files may contain endpoint/model/protocol details but NOT secrets (FR-005)
 * - File operations are scoped to workspace directories by default
 * - Diagnostics redact all secret values (FR-073)
 */
export class FileManager {
  private readonly fs: typeof fs;

  /**
   * Create a new file manager.
   *
   * @param fs - Filesystem module (for testing)
   */
  constructor(_fs: typeof fs = fs) {
    this.fs = _fs;
  }

  /**
   * Read a file.
   *
   * @param filePath - Absolute path to the file
   * @param encoding - File encoding (defaults to utf-8)
   * @returns File read result
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<FileReadResult> {
    try {
      const content = await this.fs.promises.readFile(filePath, { encoding });

      return {
        content,
        encoding,
        exists: true,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // File not found
        return {
          content: '',
          encoding,
          exists: false,
        };
      }

      // Other errors
      throw err;
    }
  }

  /**
   * Write a file.
   *
   * If the directory doesn't exist, it will be created.
   *
   * @param filePath - Absolute path to the file
   * @param content - Content to write
   * @param encoding - File encoding (defaults to utf-8)
   * @returns File write result
   */
  async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<FileWriteResult> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.ensureDirectory(dir);

      // Write file
      const buffer = Buffer.from(content, encoding);
      await this.fs.promises.writeFile(filePath, buffer);

      return {
        success: true,
        bytesWritten: buffer.length,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Delete a file.
   *
   * @param filePath - Absolute path to the file
   * @returns File delete result
   */
  async deleteFile(filePath: string): Promise<FileDeleteResult> {
    try {
      await this.fs.promises.unlink(filePath);

      return {
        success: true,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to delete file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Check if a file exists.
   *
   * @param filePath - Absolute path to the file
   * @returns true if the file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.fs.promises.access(filePath, this.fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is a directory.
   *
   * @param filePath - Absolute path to check
   * @returns true if the path is a directory
   */
  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await this.fs.promises.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata.
   *
   * @param filePath - Absolute path to the file
   * @returns File metadata
   */
  async getFileMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const stats = await this.fs.promises.stat(filePath);

      return {
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isDirectory: stats.isDirectory(),
        exists: true,
      };
    } catch {
      return {
        path: filePath,
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
        isDirectory: false,
        exists: false,
      };
    }
  }

  /**
   * List directory contents.
   *
   * @param dirPath - Absolute path to the directory
   * @returns Directory listing result
   */
  async listDirectory(dirPath: string): Promise<DirectoryListingResult> {
    try {
      const entries = await this.fs.promises.readdir(dirPath);

      return {
        entries,
        exists: true,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' || (err as NodeJS.ErrnoException).code === 'ENOTDIR') {
        // Directory not found or path is not a directory
        return {
          entries: [],
          exists: false,
        };
      }

      return {
        entries: [],
        exists: false,
        error: `Failed to list directory: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Create a directory.
   *
   * Creates parent directories if they don't exist.
   *
   * @param dirPath - Absolute path to the directory
   * @returns Promise that resolves when directory is created
   */
  async createDirectory(dirPath: string): Promise<void> {
    await this.fs.promises.mkdir(dirPath, { recursive: true });
  }

  /**
   * Ensure a directory exists.
   *
   * Creates directory and parents if they don't exist.
   *
   * @param dirPath - Absolute path to the directory
   * @returns Promise that resolves when directory exists
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await this.fs.promises.access(dirPath, this.fs.constants.F_OK);
    } catch {
      // Directory doesn't exist, create it
      await this.fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Delete a directory and its contents.
   *
   * @param dirPath - Absolute path to the directory
   * @returns Promise that resolves when directory is deleted
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    await this.fs.promises.rm(dirPath, { recursive: true, force: true });
  }

  /**
   * Find files matching a pattern.
   *
   * @param dirPath - Root directory to search
   * @param pattern - Glob pattern to match
   * @returns Array of matching file paths
   */
  async findFiles(dirPath: string, pattern: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await this.fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findFiles(fullPath, pattern);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // Check if file matches pattern
          if (this.matchesPattern(entry.name, pattern)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore errors (e.g., permission issues)
    }

    return files;
  }

  /**
   * Check if a filename matches a glob pattern.
   *
   * @param filename - Filename to check
   * @param pattern - Glob pattern
   * @returns true if the filename matches
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching
    // Supports * and ? wildcards
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filename);
  }

  /**
   * Get the workspace root directory.
   *
   * @returns Workspace root URI or undefined
   */
  getWorkspaceRoot(): vscode.Uri | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    if (workspaceFolders.length === 1) {
      return workspaceFolders[0].uri;
    }

    // If multiple workspace folders, return the first one
    return workspaceFolders[0].uri;
  }

  /**
   * Resolve a path relative to workspace root.
   *
   * @param relativePath - Relative path from workspace root
   * @returns Absolute path or undefined if no workspace
   */
  resolveWorkspacePath(relativePath: string): string | undefined {
    const workspaceRoot = this.getWorkspaceRoot();

    if (!workspaceRoot) {
      return undefined;
    }

    return path.join(workspaceRoot.fsPath, relativePath);
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get the file manager instance.
 *
 * @returns File manager
 */
export function getFileManager(): FileManager {
  return new FileManager();
}

/**
 * Read a file.
 *
 * @param filePath - Absolute path to the file
 * @param encoding - File encoding (defaults to utf-8)
 * @returns File read result
 */
export async function readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<FileReadResult> {
  const manager = new FileManager();
  return manager.readFile(filePath, encoding);
}

/**
 * Write a file.
 *
 * @param filePath - Absolute path to the file
 * @param content - Content to write
 * @param encoding - File encoding (defaults to utf-8)
 * @returns File write result
 */
export async function writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<FileWriteResult> {
  const manager = new FileManager();
  return manager.writeFile(filePath, content, encoding);
}

/**
 * Delete a file.
 *
 * @param filePath - Absolute path to the file
 * @returns File delete result
 */
export async function deleteFile(filePath: string): Promise<FileDeleteResult> {
  const manager = new FileManager();
  return manager.deleteFile(filePath);
}

/**
 * Check if a file exists.
 *
 * @param filePath - Absolute path to the file
 * @returns true if the file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const manager = new FileManager();
  return manager.fileExists(filePath);
}

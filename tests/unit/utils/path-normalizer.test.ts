/**
 * tests/unit/utils/path-normalizer.test.ts
 *
 * Unit tests for path-normalizer.ts
 * Tests platform-agnostic path handling utilities.
 */

import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  normalizePath,
  getUserHome,
  getProfilesDir,
  getHandoffsDir,
  getAuditLogPath,
  getTemplatesDir,
  getPolicyPath,
  getRelativePath,
  isHomePath,
} from '@src/utils/path-normalizer';

describe('normalizePath', () => {
  it('should normalize relative path to absolute', () => {
    const result = normalizePath('src/test');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should return absolute path unchanged', () => {
    const absolutePath = path.join(os.homedir(), 'test');
    const result = normalizePath(absolutePath);
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should handle path with .. components', () => {
    const result = normalizePath('src/../src/test');
    expect(result).toContain('src/test');
  });

  it('should handle path with . components', () => {
    const result = normalizePath('./src/test');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toContain('src/test');
  });

  it('should handle forward slashes on all platforms', () => {
    const result = normalizePath('src/test/file.ts');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should handle backslashes on Windows-like paths', () => {
    const input = os.platform() === 'win32' ? 'src\\test\\file.ts' : 'src/test/file.ts';
    const result = normalizePath(input);
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should return string', () => {
    const result = normalizePath('test');
    expect(typeof result).toBe('string');
  });
});

describe('getUserHome', () => {
  it('should return user home directory path', () => {
    const result = getUserHome();
    expect(result).toBe(os.homedir());
  });

  it('should return absolute path', () => {
    const result = getUserHome();
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should return string', () => {
    const result = getUserHome();
    expect(typeof result).toBe('string');
  });

  it('should not be empty', () => {
    const result = getUserHome();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getProfilesDir', () => {
  it('should return profiles directory path', () => {
    const result = getProfilesDir();
    expect(result).toContain('.claude-claude-switcher');
    expect(result).toContain('profiles');
  });

  it('should be within home directory', () => {
    const result = getProfilesDir();
    expect(result.startsWith(getUserHome())).toBe(true);
  });

  it('should be absolute path', () => {
    const result = getProfilesDir();
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should use correct path separator', () => {
    const result = getProfilesDir();
    const separator = path.sep;
    expect(result).toContain(separator);
  });
});

describe('getHandoffsDir', () => {
  it('should return handoffs directory path', () => {
    const result = getHandoffsDir();
    expect(result).toContain('.claude-claude-switcher');
    expect(result).toContain('handoffs');
  });

  it('should be within home directory', () => {
    const result = getHandoffsDir();
    expect(result.startsWith(getUserHome())).toBe(true);
  });

  it('should be absolute path', () => {
    const result = getHandoffsDir();
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should be different from profiles directory', () => {
    const profilesDir = getProfilesDir();
    const handoffsDir = getHandoffsDir();
    expect(profilesDir).not.toBe(handoffsDir);
  });
});

describe('getAuditLogPath', () => {
  it('should return audit log file path', () => {
    const result = getAuditLogPath();
    expect(result).toContain('.claude-claude-switcher');
    expect(result).toContain('audit.log');
  });

  it('should be within home directory', () => {
    const result = getAuditLogPath();
    expect(result.startsWith(getUserHome())).toBe(true);
  });

  it('should be absolute path', () => {
    const result = getAuditLogPath();
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should have .log extension', () => {
    const result = getAuditLogPath();
    expect(result.endsWith('.log')).toBe(true);
  });
});

describe('getTemplatesDir', () => {
  it('should return templates directory path', () => {
    const workspaceRoot = process.cwd();
    const result = getTemplatesDir(workspaceRoot);
    expect(result).toContain('.claude-switcher');
    expect(result).toContain('templates');
  });

  it('should be within workspace root', () => {
    const workspaceRoot = process.cwd();
    const result = getTemplatesDir(workspaceRoot);
    expect(result.startsWith(workspaceRoot)).toBe(true);
  });

  it('should be absolute path', () => {
    const workspaceRoot = process.cwd();
    const result = getTemplatesDir(workspaceRoot);
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should handle workspace root with trailing separator', () => {
    const workspaceRoot = process.cwd();
    const rootWithSep = workspaceRoot + path.sep;
    const result = getTemplatesDir(rootWithSep);
    expect(path.isAbsolute(result)).toBe(true);
  });
});

describe('getPolicyPath', () => {
  it('should return policy file path', () => {
    const workspaceRoot = process.cwd();
    const result = getPolicyPath(workspaceRoot);
    expect(result).toContain('.claude-switcher');
    expect(result).toContain('policy.yaml');
  });

  it('should be within workspace root', () => {
    const workspaceRoot = process.cwd();
    const result = getPolicyPath(workspaceRoot);
    expect(result.startsWith(workspaceRoot)).toBe(true);
  });

  it('should be absolute path', () => {
    const workspaceRoot = process.cwd();
    const result = getPolicyPath(workspaceRoot);
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should have .yaml extension', () => {
    const workspaceRoot = process.cwd();
    const result = getPolicyPath(workspaceRoot);
    expect(result.endsWith('.yaml')).toBe(true);
  });
});

describe('getRelativePath', () => {
  it('should return relative path when target is within base', () => {
    const basePath = '/home/user/project';
    const targetPath = '/home/user/project/src/file.ts';
    const result = getRelativePath(basePath, targetPath);

    // Should not be absolute (starts with . or dirname)
    expect(path.isAbsolute(result)).toBe(false);
  });

  it('should return relative path with dot notation for parent directory', () => {
    const basePath = '/home/user/project/src';
    const targetPath = '/home/user/project/file.ts';
    const result = getRelativePath(basePath, targetPath);

    expect(result).toContain('..');
  });

  it('should handle same path', () => {
    const basePath = '/home/user/project';
    const targetPath = '/home/user/project';
    const result = getRelativePath(basePath, targetPath);

    // Should be empty or dot
    expect(result === '' || result === '.').toBe(true);
  });

  it('should handle nested paths', () => {
    const basePath = '/home/user/project';
    const targetPath = '/home/user/project/src/utils/helper.ts';
    const result = getRelativePath(basePath, targetPath);

    expect(result).toContain('src');
    expect(result).toContain('utils');
  });

  it('should work with current directory', () => {
    const basePath = process.cwd();
    const targetPath = path.join(process.cwd(), 'test', 'file.txt');
    const result = getRelativePath(basePath, targetPath);

    expect(typeof result).toBe('string');
  });

  it('should return string', () => {
    const result = getRelativePath('/a/b', '/a/b/c');
    expect(typeof result).toBe('string');
  });
});

describe('isHomePath', () => {
  it('should return true for path in home directory', () => {
    const home = getUserHome();
    const result = isHomePath(home);
    expect(result).toBe(true);
  });

  it('should return true for nested path in home', () => {
    const home = getUserHome();
    const nestedPath = path.join(home, 'Documents', 'file.txt');
    const result = isHomePath(nestedPath);
    expect(result).toBe(true);
  });

  it('should return false for path outside home', () => {
    const nonHomePath = '/tmp/file.txt';
    const result = isHomePath(nonHomePath);

    // On macOS/Linux /tmp is not typically in home
    // On Windows this might be different, but we'll test false case
    expect(result).toBe(false);
  });

  it('should handle relative paths', () => {
    const relativePath = './test/file.txt';
    const result = isHomePath(relativePath);

    // Relative paths get normalized based on current working directory
    expect(typeof result).toBe('boolean');
  });

  it('should handle . itself', () => {
    const result = isHomePath('.');
    expect(typeof result).toBe('boolean');
  });

  it('should return true for profiles directory', () => {
    const profilesDir = getProfilesDir();
    const result = isHomePath(profilesDir);
    expect(result).toBe(true);
  });

  it('should return true for handoffs directory', () => {
    const handoffsDir = getHandoffsDir();
    const result = isHomePath(handoffsDir);
    expect(result).toBe(true);
  });

  it('should return true for audit log path', () => {
    const auditPath = getAuditLogPath();
    const result = isHomePath(auditPath);
    expect(result).toBe(true);
  });
});

describe('integration tests', () => {
  it('should work together: normalize and check home', () => {
    const relativePath = 'Documents/test.txt';
    const normalized = normalizePath(relativePath);
    const isHome = isHomePath(normalized);

    expect(normalized).toBeTruthy();
    expect(typeof isHome).toBe('boolean');
  });

  it('should get all config paths correctly', () => {
    const profilesDir = getProfilesDir();
    const handoffsDir = getHandoffsDir();
    const auditPath = getAuditLogPath();

    expect(profilesDir).toBeTruthy();
    expect(handoffsDir).toBeTruthy();
    expect(auditPath).toBeTruthy();

    expect(isHomePath(profilesDir)).toBe(true);
    expect(isHomePath(handoffsDir)).toBe(true);
    expect(isHomePath(auditPath)).toBe(true);
  });

  it('should handle workspace paths consistently', () => {
    const workspaceRoot = process.cwd();
    const templatesDir = getTemplatesDir(workspaceRoot);
    const policyPath = getPolicyPath(workspaceRoot);

    expect(templatesDir.startsWith(workspaceRoot)).toBe(true);
    expect(policyPath.startsWith(workspaceRoot)).toBe(true);

    const relativeTemplates = getRelativePath(workspaceRoot, templatesDir);
    expect(relativeTemplates.startsWith(workspaceRoot)).toBe(false);
  });
});

describe('edge cases', () => {
  it('should handle empty string for normalizePath', () => {
    const result = normalizePath('');
    expect(path.isAbsolute(result)).toBe(true);
    expect(typeof result).toBe('string');
  });

  it('should handle dot for normalizePath', () => {
    const result = normalizePath('.');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should handle double dot for normalizePath', () => {
    const result = normalizePath('..');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should handle paths with multiple separators', () => {
    const result = normalizePath('src///test///file.ts');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('should handle workspace root without trailing separator', () => {
    const workspaceRoot = process.cwd();
    const result1 = getTemplatesDir(workspaceRoot);
    const result2 = getTemplatesDir(workspaceRoot + path.sep);
    expect(result1).toBe(result2);
  });

  it('should handle different path formats for same location', () => {
    const basePath = '/home/user/project';
    const target1 = '/home/user/project/src/file.ts';
    const target2 = '/home/user/project/./src/file.ts';

    const result1 = getRelativePath(basePath, target1);
    const result2 = getRelativePath(basePath, target2);

    // Should normalize and produce same relative path (or close to it)
    expect(result1.replace(/^\.\//, '')).toBe(result2.replace(/^\.\//, ''));
  });
});

describe('path separator handling', () => {
  it('should use correct separator on current platform', () => {
    const profilesDir = getProfilesDir();
    const separator = path.sep;

    if (os.platform() === 'win32') {
      expect(profilesDir).toContain('\\');
    } else {
      expect(profilesDir).toContain('/');
    }
  });

  it('should handle mixed separators and normalize', () => {
    // Tests might use forward slashes everywhere on all platforms
    // But the result should use the correct platform separator
    const result = normalizePath('src/test/file');
    expect(path.isAbsolute(result)).toBe(true);
  });
});

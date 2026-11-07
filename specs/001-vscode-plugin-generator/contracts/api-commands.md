# API Commands Contract

**Project**: VS Code Claude Model Rotator
**Version**: 1.0
**Date**: 2026-11-06
**Purpose**: Interface contract for all VS Code extension commands

## Overview

This contract defines the schema for all VS Code extension commands, including input parameters, output responses, and error handling. The extension registers these commands through `package.json` `contributes.commands` and implements them in `src/vscode/commands/`.

Commands are categorized by functional area:
- Endpoint commands
- Routing commands
- Status commands
- Export/import commands

## Command Conventions

All commands follow these conventions:

1. **Command IDs**: Prefixed with `claudeSwitcher.` (e.g., `claudeSwitcher.addEndpoint`)
2. **Error Handling**: All commands throw errors with standardized codes and messages
3. **Progress Reporting**: Long-running commands provide progress notifications
4. **Confirmation**: Destructive operations require user confirmation dialogs
5. **Undo Support**: Where applicable, commands provide undo capability through status bar actions

## Error Schema

```typescript
export interface ExtensionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}
```

Common error codes:

| Code | Meaning | Retryable |
|------|---------|-----------|
| `ENDPOINT_INVALID_URL` | Endpoint URL is invalid | No |
| `ENDPOINT_NOT_FOUND` | Endpoint does not exist | No |
| `ENDPOINT_IN_USE` | Endpoint is currently active | No |
| `NO_ENDPOINTS_CONFIGURED` | No endpoints have been configured | No |
| `AUTH_TOKEN_MISSING` | Auth token not found in SecretStorage | No |
| `NETWORK_ERROR` | Network/endpoint unreachable | Yes |
| `UNREACHABLE` | Endpoint is unreachable | Yes |
| `PANEL_RELOAD_FAILED` | Claude Code panel reload failed | Yes |
| `NO_ACTIVE_PANEL` | No Claude Code panel is open | No |
| `NO_ACTIVE_ENDPOINT` | No endpoint is set as active | No |
| `RELOAD_FAILED` | Panel reload operation failed | Yes |
| `UNKNOWN` | Unexpected error | Maybe |

---

## Endpoint Commands

### Add Endpoint

**Command ID**: `claudeSwitcher.addEndpoint`

**Purpose**: Add a new Claude API endpoint configuration

```typescript
interface AddEndpointArgs {
  url: string;
  authToken?: string;  // Optional - for endpoints requiring auth
  label?: string;     // Optional - display label, defaults to URL
  models: {
    name: string;     // Canonical model name (e.g., "claude-sonnet-5-5")
    alias?: string;   // Optional display alias (e.g., "Sonnet 5.5")
  }[];                // One or more models available at this endpoint
}

interface AddEndpointResult {
  success: boolean;
  message: string;
  endpoint: {
    id: string;  // Auto-generated unique ID
    url: string;
    label: string;
    hasAuth: boolean;
    status: 'untested' | 'connected' | 'unreachable';
    models: {
      name: string;
      alias?: string;
    }[];
  };
}
```

**Behavior**:
1. Validate URL format
2. If authToken provided, store securely in SecretStorage
3. Generate unique endpoint ID
4. Create endpoint configuration
5. Perform initial connectivity check
6. Update status bar if this is the first endpoint

**Errors**:
- `ENDPOINT_INVALID_URL`: URL is malformed or not a valid HTTP/HTTPS URL
- `NETWORK_ERROR`: Initial connectivity check failed (non-blocking)

---

### Edit Endpoint

**Command ID**: `claudeSwitcher.editEndpoint`

**Purpose**: Edit an existing endpoint configuration

```typescript
interface EditEndpointArgs {
  endpointId: string;
  url?: string;
  authToken?: string;
  label?: string;
  models?: {
    name: string;
    alias?: string;
  }[];
}

interface EditEndpointResult {
  success: boolean;
  message: string;
  endpoint: {
    id: string;
    url: string;
    label: string;
    hasAuth: boolean;
    status: 'untested' | 'connected' | 'unreachable';
    models: {
      name: string;
      alias?: string;
    }[];
  };
}
```

**Behavior**:
1. Validate endpoint exists
2. Update provided fields (merge semantics)
3. If authToken updated, replace old secret in SecretStorage
4. If URL updated, perform new connectivity check
5. Update active endpoint if this endpoint is currently active

**Errors**:
- `ENDPOINT_NOT_FOUND`: Endpoint id not found
- `ENDPOINT_INVALID_URL`: URL is malformed

---

### Remove Endpoint

**Command ID**: `claudeSwitcher.removeEndpoint`

**Purpose**: Remove an endpoint configuration

```typescript
interface RemoveEndpointArgs {
  endpointId: string;
  confirm: boolean;  // User confirmed deletion in dialog
}

interface RemoveEndpointResult {
  success: boolean;
  message: string;
  removed: {
    endpointId: string;
    label: string;
    url: string;
  };
}
```

**Behavior**:
1. Require user confirmation (via prompt dialog before command invocation)
2. Delete endpoint from configuration
3. Delete auth token from SecretStorage if present
4. If this endpoint was active, select another endpoint or mark none active
5. Update status bar

**Errors**:
- `ENDPOINT_NOT_FOUND`: Endpoint id not found
- `ENDPOINT_IN_USE`: Cannot remove the only active endpoint (if others exist, must select another first)

---

## Routing Commands

### Select Active Endpoint

**Command ID**: `claudeSwitcher.selectActiveEndpoint`

**Purpose**: Select which endpoint should receive Claude API calls with panel reload

```typescript
interface SelectActiveEndpointArgs {
  endpointId: string;
}

interface SelectActiveEndpointResult {
  success: boolean;
  message: string;
  endpoint: {
    id: string;
    label: string;
    url: string;
    status: 'untested' | 'connected' | 'unreachable';
    models: {
      name: string;
      alias?: string;
    }[];
  };
  reloaded: boolean;  // Whether panel was reloaded
}
```

**Behavior**:
1. Validate endpoint exists
2. Check if Claude Code panel is active with an ongoing session
3. If active session exists, prompt user with options: (1) reload panel with new endpoint (continue session), (2) keep current session unchanged, (3) start new session with new endpoint
4. Set as active endpoint (persistent across VS Code restarts)
5. Update status bar indicator
6. Route all Claude API calls to this endpoint
7. If user chose to reload, restart the Claude Code panel with new endpoint configuration

**Errors**:
- `ENDPOINT_NOT_FOUND`: Endpoint id not found
- `PANEL_RELOAD_FAILED`: Failed to reload Claude Code panel with new endpoint
- `NO_ACTIVE_ENDPOINT`: No endpoint is configured as active
- `NO_ACTIVE_PANEL`: No Claude Code panel is currently open

---

### Reload Claude Code Panel

**Command ID**: `claudeSwitcher.reloadPanel`

**Purpose**: Manually reload the Claude Code panel with the current active endpoint

```typescript
interface ReloadPanelArgs {
  sessionId?: string;  // Optional: specific session
  mode: 'continue' | 'new-session';  // Continue current session or start fresh
}

interface ReloadPanelResult {
  success: boolean;
  message: string;
  result: {
    endpointId: string;
    endpointUrl: string;
    mode: 'continue' | 'new-session';
    sessionId?: string;
    reloadedAt: Date;
  };
}
```

**Behavior**:
1. Identify the current Claude Code panel session
2. Reload the panel with the current active endpoint configuration
3. If mode='continue', attempt to preserve the current session context
4. If mode='new-session', start a fresh Claude Code session with the same endpoint
5. Update status bar to reflect the reload

**Errors**:
- `NO_ACTIVE_PANEL`: No Claude Code panel is currently open
- `NO_ACTIVE_ENDPOINT`: No endpoint is configured as active
- `RELOAD_FAILED`: Panel reload operation failed

---

### Show Endpoint Picker

**Command ID**: `claudeSwitcher.showEndpointPicker`

**Purpose**: Open Quick Pick dialog to select endpoint

```typescript
interface ShowEndpointPickerArgs {
  selectFor?: 'active' | 'edit' | 'remove';  // Default: 'active'
  onlyActive?: boolean;  // If true, only show active endpoint (no-op action)
}

interface ShowEndpointPickerResult {
  success: boolean;
  action: 'selected' | 'cancelled';
  selection?: {
    endpointId: string;
    selectFor: 'active' | 'edit' | 'remove';
  };
}
```

**Behavior**:
1. Show Quick Pick dialog with available endpoints
2. Display URL, label, and connectivity status
3. Highlight currently active endpoint
4. Display models with their aliases
5. On selection, invoke appropriate action (selectActiveEndpoint, editEndpoint, removeEndpoint)
6. If onlyActive is true, show minimal picker for viewing only

---

## Status Commands

### Check Endpoint Connectivity

**Command ID**: `claudeSwitcher.checkConnectivity`

**Purpose**: Test connectivity to a specific endpoint manually

```typescript
interface CheckConnectivityArgs {
  endpointId: string;
}

interface CheckConnectivityResult {
  success: boolean;
  message: string;
  endpoint: {
    id: string;
    url: string;
    status: 'untested' | 'connected' | 'unreachable';
    models: {
      name: string;
      alias?: string;
    }[];
    latency?: number;  // Response time in ms
    error?: string;    // Error message if unreachable
  };
}
```

**Behavior**:
1. Validate endpoint exists
2. Perform connectivity check (lightweight HTTP request)
3. Update endpoint status
4. Return results including latency if successful

**Errors**:
- `ENDPOINT_NOT_FOUND`: Endpoint id not found
- `UNREACHABLE`: Endpoint is unreachable (non-blocking)

---

### List Endpoints

**Command ID**: `claudeSwitcher.listEndpoints`

**Purpose**: Get list of all configured endpoints

```typescript
interface ListEndpointsArgs {
  // No arguments
}

interface ListEndpointsResult {
  success: boolean;
  endpoints: {
    id: string;
    url: string;
    label: string;
    hasAuth: boolean;
    status: 'untested' | 'connected' | 'unreachable';
    isActive: boolean;
    models: {
      name: string;
      alias?: string;
    }[];
  }[];
  activeEndpointId?: string;
}
```

**Behavior**:
1. Return all configured endpoints
2. Include connectivity status and active flag
3. No network calls performed (status from cache)

---

## Export/Import Commands

### Export Configuration

**Command ID**: `claudeSwitcher.exportConfig`

**Purpose**: Export endpoint configuration (auth tokens excluded)

```typescript
interface ExportConfigArgs {
  outputPath?: string;  // Optional: user-provided path, default: JSON in clipboard
  includeAuth: boolean;  // User confirmed they understand auth tokens will NOT be included
  approved: boolean;    // User approved export
}

interface ExportConfigResult {
  success: boolean;
  message: string;
  exported: {
    endpointCount: number;
    exportedTo: 'clipboard' | 'file';
    filePath?: string;  // If exported to file
  };
}
```

**Behavior**:
1. Warn user that auth tokens are NOT included in export
2. Export endpoints with URLs, labels, models, but NO auth tokens
3. Save to clipboard or specified path
4. Export includes endpoint IDs to allow import (may require re-mapping)

**Errors**:
- `NO_ENDPOINTS_CONFIGURED`: No endpoints to export

---

### Import Configuration

**Command ID**: `claudeSwitcher.importConfig`

**Purpose**: Import endpoint configuration

```typescript
interface ImportConfigArgs {
  inputPath?: string;  // Optional: user-provided path, default: read from clipboard
  confirmOverwrite: boolean;  // User confirmed overwrite if conflict
  approved: boolean;  // User approved import
}

interface ImportConfigResult {
  success: boolean;
  message: string;
  imported: {
    endpointCount: number;
    newEndpoints: number;
    updatedEndpoints: number;
    conflicts: string[];
  };
  needAuth: {
    endpointIds: string[];  // Endpoints requiring auth token configuration
  };
}
```

**Behavior**:
1. Load configuration from clipboard or specified path
2. Validate endpoint URLs
3. Generate new IDs for imported endpoints
4. For endpoints with auth, mark as needing token configuration
5. Open dialog to configure auth tokens for endpoints that require them
6. Import if no conflicts or user confirms overwrite

**Errors**:
- `ENDPOINT_INVALID_URL`: Import contains invalid URL
- `CONFIRMATION_REQUIRED`: User must approve import and/or overwrite

---

## Command Registration in package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "claudeSwitcher.addEndpoint",
        "title": "Add Endpoint",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.editEndpoint",
        "title": "Edit Endpoint",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.removeEndpoint",
        "title": "Remove Endpoint",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.selectActiveEndpoint",
        "title": "Select Active Endpoint",
        "category": "Claude Switcher",
        "icon": "$(debug-disconnect)"
      },
      {
        "command": "claudeSwitcher.showEndpointPicker",
        "title": "Show Endpoint Picker",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.checkConnectivity",
        "title": "Check Endpoint Connectivity",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.listEndpoints",
        "title": "List Endpoints",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.reloadPanel",
        "title": "Reload Claude Code Panel",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.exportConfig",
        "title": "Export Configuration",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.importConfig",
        "title": "Import Configuration",
        "category": "Claude Switcher"
      }
    ]
  }
}
```

## Future Extensions

Additional command categories may be added in future versions:

- **Advanced Features**: Per-session endpoint overrides, endpoint-specific model selection
- **Analytics**: Endpoint usage tracking, latency reporting, quota monitoring (via Claude API status endpoints)
- **Teammate Sharing**: Secure export/import of endpoints (auth tokens always excluded)

Command interface changes require:
1. Command ID versioning (e.g., `claudeSwitcher.v2.addEndpoint`)
2. Backward compatibility for existing commands
3. Updated documentation
4. Version bump in contract document

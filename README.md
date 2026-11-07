# VS Code Claude Switcher

VS Code extension for managing and switching between Claude API endpoints with automatic panel reload for seamless model rotation.

## Overview

The Claude Model Rotator allows developers to configure multiple Claude API endpoints (including official Claude API, SSH-tunneled local endpoints, and custom endpoints), select which endpoint Claude Code should use, and automatically reload the panel to apply the configuration change.

### Key Features

- **Multiple Endpoints**: Configure any number of Claude API endpoints with URLs, auth tokens, and available models
- **Model Aliases**: Define both canonical model names (e.g., "claude-sonnet-5-5") and display aliases (e.g., "Sonnet 5.5")
- **Seamless Reload**: Automatically reload VS Code's Claude Code panel when switching endpoints
- **Session Management**: Choose to continue current session with new endpoint, keep session unchanged, or start fresh
- **Connectivity Status**: View connectivity status (connected/untested/unreachable) and latency for all endpoints
- **Secure Auth**: Auth tokens stored securely with VS Code's SecretStorage
- **Export/Import**: Share endpoint configurations securely (auth tokens excluded)

## Installation

### Requirements

- VS Code 1.90.0 or higher
- Node.js 18.x or higher (for development)

### Install from Source

```bash
# Clone the repository
git clone https://github.com/your-username/vscode-claude-switcher.git
cd vscode-claude-switcher

# Install dependencies
npm install

# Build the extension
npm run compile

# Install in VS Code
# Option 1: From the command line
npm install -g @vscode/vsce
vsce package
code --install-extension vscode-claude-switcher-x.x.x.vsix

# Option 2: Press F5 in VS Code to open a new Extension Development Host window for testing
```

### Install from Marketplace (coming soon)

```
Coming soon to the VS Code Extension Marketplace
```

## Quick Start

### 1. Add Your First Endpoint

1. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Run `Claude Switcher: Add Endpoint`
3. Fill in the details:
   - **URL**: Your Claude API endpoint (e.g., `https://api.anthropic.com`)
   - **Auth Token**: Your API key (optional for SSH-tunneled endpoints)
   - **Label**: Display name (defaults to URL)
   - **Models**: Add models with canonical names and optional aliases:
     - Name: `claude-sonnet-5-5`
     - Alias: `Sonnet 5.5` (optional)

### 2. Select Active Endpoint

1. Click the status bar item labeled with your endpoint
2. Select the endpoint you want to use
3. If a Claude Code panel is active with an ongoing session, you'll see options:
   - **Continue with reload**: Reload panel with new endpoint, preserve conversation
   - **Keep unchanged**: Switch applies to next session
   - **Start new session**: Close current and start fresh with new endpoint

### 3. View Endpoint Status

The status bar shows:
- **Active endpoint** with connectivity badge:
  - 🟢 Green: Connected
  - 🟡 Yellow: Untested
  - 🔴 Red: Unreachable
- **Number of configured endpoints**

Click to open endpoint picker and see all configured endpoints with their status.

### 4. Check Connectivity

1. Open Command Palette
2. Run `Claude Switcher: Check Endpoint Connectivity`
3. Select an endpoint to test
4. View results including latency if reachable

## Configuration

### YAML-Based Endpoint Configuration

Endpoints are stored in VS Code workspace settings and persist across VS Code restarts.

Example configuration (automatically managed by extension):

```json
{
  "claudeSwitcher.endpoints": [
    {
      "id": "ep-1234567890",
      "url": "https://api.anthropic.com",
      "label": "Claude Official",
      "hasAuth": true,
      "status": "connected",
      "isActive": true,
      "models": [
        {
          "name": "claude-sonnet-5-5",
          "alias": "Sonnet 5.5"
        },
        {
          "name": "claude-haiku-5-5",
          "alias": "Haiku 5.5"
        }
      ]
    },
    {
      "id": "ep-0987654321",
      "url": "http://localhost:11434",
      "label": "Ollama Local",
      "hasAuth": false,
      "status": "connected",
      "isActive": false,
      "models": [
        {
          "name": "llama3.2",
          "alias": "Llama 3.2"
        }
      ]
    }
  ],
  "claudeSwitcher.activeEndpointId": "ep-1234567890"
}
```

### SSH-Tunneled Endpoints

For SSH-forwarded tunnels to localhost:

1. Set up your SSH tunnel:
```bash
ssh -L 11434:localhost:11434 your-server
```

2. Add endpoint with localhost URL:
```
URL: http://localhost:11434
Auth Token: [leave empty]
```

3. Add models available via that tunnel

### Auth Tokens

Auth tokens are stored securely using VS Code's SecretStorage and are **never** included in exported configurations.

## Commands

### Endpoint Management

- **`Claude Switcher: Add Endpoint`** (`claudeSwitcher.addEndpoint`)
  - Add a new Claude API endpoint with URL, auth token, and models

- **`Claude Switcher: Edit Endpoint`** (`claudeSwitcher.editEndpoint`)
  - Edit an existing endpoint's configuration

- **`Claude Switcher: Remove Endpoint`** (`claudeSwitcher.removeEndpoint`)
  - Delete an endpoint (removes auth token from SecretStorage)

- **`Claude Switcher: Show Endpoint Picker`** (`claudeSwitcher.showEndpointPicker`)
  - Open Quick Pick dialog to view and select endpoints

### Endpoint Selection

- **`Claude Switcher: Select Active Endpoint`** (`claudeSwitcher.selectActiveEndpoint`)
  - Set the endpoint that receives Claude API calls
  - Automatically reloads Claude Code panel

- **`Claude Switcher: Reload Claude Code Panel`** (`claudeSwitcher.reloadPanel`)
  - Manually reload the panel with current active endpoint
  - Mode: `continue` (preserve session) or `new-session` (start fresh)

### Status and Diagnostics

- **`Claude Switcher: Check Endpoint Connectivity`** (`claudeSwitcher.checkConnectivity`)
  - Test connectivity to a specific endpoint
  - Returns latency if reachable

- **`Claude Switcher: List Endpoints`** (`claudeSwitcher.listEndpoints`)
  - Show all configured endpoints with status

### Configuration Export/Import

- **`Claude Switcher: Export Configuration`** (`claudeSwitcher.exportConfig`)
  - Export endpoint configuration to JSON in clipboard or file
  - Auth tokens are **not** included for security

- **`Claude Switcher: Import Configuration`** (`claudeSwitcher.importConfig`)
  - Import endpoint configuration from clipboard or file
  - Configure auth tokens for endpoints that require them

## How It Works

### The Reload Challenge

The most complex part of this extension is managing the interface between VS Code's Claude Code panel and custom endpoints:

1. **Configuration Management**: The extension finds and modifies Claude Code configuration files to inject the new endpoint URL and auth token
2. **Session Detection**: Detects if a Claude Code panel is open with an active session
3. **User Choice**: Prompts you to choose: continue session, keep unchanged, or start new session
4. **Panel Orchestration**: Sequences the reload: update config → close panel → wait → open panel → verify new endpoint
5. **Graceful Degradation**: If programmatic reload fails, provides manual instructions

### Security

- Auth tokens stored using VS Code SecretStorage (encrypted at rest)
- Tokens never logged or exposed in error messages
- Export functionality excludes auth tokens
- Tokens never transmitted in extension telemetry

### Session State Preservation

When you choose "Continue with reload", the extension:
1. Preserves your conversation state
2. Closes the panel cleanly
3. Updates configuration with new endpoint
4. Reopens the panel
5. Your conversation continues with the new endpoint active

## Troubleshooting

### Panel Reload Fails

**Issue**: Error message "Failed to reload Claude Code panel"

**Solution**:
1. Extension has updated configuration but panel needs manual restart
2. Manually close the Claude Code panel
3. Reopen it - will use the new endpoint
4. Verify by checking status bar shows correct active endpoint

### Endpoint Shows "Unreachable"

**Issue**: Connectivity status stuck on "unreachable"

**Solution**:
1. Run `Claude Switcher: Check Endpoint Connectivity` for that endpoint
2. Verify URL is correct and endpoint is accessible
3. Check if auth token is required and properly configured
4. For SSH tunnels, verify tunnel is running:
```bash
curl http://localhost:11434/health
```

### Auth Token Not Working

**Issue**: "Authorization failed" or similar auth errors

**Solution**:
1. Verify auth token in SecretStorage is correct
2. Run `Claude Switcher: Edit Endpoint` and re-enter the token
3. Check if token has expired or been revoked
4. Verify endpoint requires Bearer token in Authorization header

### Models Not Listed

**Issue**: Models added to endpoint but not showing in picker

**Solution**:
1. Run `Claude Switcher: Edit Endpoint` to verify models are saved
2. Use canonical model names (e.g., `claude-sonnet-5-5`, not `sonnet-5.5`)
3. Aliases are for display only - canonical name must match API
4. Check endpoint supports the listed models

### Cannot Remove Active Endpoint

**Issue**: Error "Cannot remove active endpoint"

**Solution**:
1. Select another endpoint as active first
2. Or remove all non-active endpoints, then the active one
3. Extension prevents removing the only active endpoint

## Development

### Project Structure

```
vscode-claude-switcher/
├── src/
│   ├── core/
│   │   ├── endpoints/
│   │   │   └── endpoint-registry.ts    # Endpoint CRUD operations
│   │   ├── status/
│   │   │   └── status-tracker.ts       # Connectivity tracking
│   │   └── routing/
│   │       └── routing-engine.ts        # Active endpoint management
│   ├── vscode/
│   │   ├── commands/                   # VS Code command handlers
│   │   ├── integration/
│   │   │   ├── claude-code-integrator.ts  # Panel reload orchestration
│   │   │   └── status-bar.ts          # Status bar management
│   │   └── ui/
│   │       └── endpoints/              # Webview UI components
│   └── extension.ts                    # Extension entry point
├── tests/
│   ├── unit/                           # Vitest tests
│   └── integration/                    # VS Code Test Runner tests
└── specs/001-vscode-plugin-generator/
    ├── spec.md                         # Simplified feature specification
    ├── tasks.md                        # Task breakdown (104 tasks)
    └── contracts/
        └── api-commands.md             # Command interfaces
```

### Build and Test

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run unit tests (Vitest)
npm test

# Run integration tests (VS Code Test Runner)
npm run test:integration

# Package extension for distribution
npm run package
```

### Coding Guidelines

- **TDD**: Write tests before implementation
- **Separation of Concerns**: Pure logic in `src/core/`, VS Code API access isolated to `src/vscode/`
- **No VS Code API Imports in Core**: Core modules must not import from `vscode` package
- **Type Safety**: Use TypeScript strict mode, all functions typed

## Architecture

### Foundational Modules (Phase 2)

These must complete before any user story implementation:

1. **Pure Logic Utilities** (`src/utils/`):
   - `url-validator.ts` - URL validation
   - `logger.ts` - Logging with redaction
   - `crypto-utils.ts` - Token hashing/redaction
   - `retry.ts` - Exponential backoff retry

2. **Core State Management** (`src/core/`):
   - `endpoint-registry.ts` - Endpoint CRUD, model management
   - `status-tracker.ts` - Connectivity status, latency
   - `routing-engine.ts` - Active endpoint selection

3. **VS Code Integration** (`src/vscode/`):
   - `workspace-config.ts` - Configuration persistence
   - `secret-storage.ts` - Auth token storage
   - `claude-code-integrator.ts` - Panel reload orchestration

### User Stories

**US1 (P1)**: Configure model endpoints - Add, edit, remove endpoints with models
**US2 (P1 Critical)**: Select active endpoint with reload - Panel reload mechanics
**US3 (P2)**: View endpoint status - Connectivity visibility
**US4 (P2)**: Export/Import - Share configurations securely

See [`specs/001-vscode-plugin-generator/tasks.md`](specs/001-vscode-plugin-generator/tasks.md) for complete task breakdown.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests first (TDD approach)
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## License

MIT

## Acknowledgments

Built with:
- TypeScript
- VS Code Extension API
- Vitest for unit testing
- VS Code Test Runner for integration testing

See [`specs/001-vscode-plugin-generator/spec.md`](specs/001-vscode-plugin-generator/spec.md) for full feature specification.

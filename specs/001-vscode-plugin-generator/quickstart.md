# Quickstart Validation Guide

**Project**: VS Code Model Profile Orchestrator
**Version**: 1.0
**Date**: 2026-10-17
**Purpose**: Runnable validation scenarios proving end-to-end functionality

## Overview

This guide provides hands-on validation scenarios for the VS Code Model Profile Orchestrator extension. Use these to verify core functionality after implementation.

Each scenario includes:
- Prerequisites and setup
- Steps to execute
- Expected outcomes
- Validation checks

**Audience**: QA testers, developer validation
**Time Estimate**: 2-3 hours for full validation suite
**Required**: VS Code with TypeScript extension, Node.js, and working AI API endpoints (at least one local or accessible cloud provider)

---

## Environment Setup

### Prerequisites

1. **Development Environment**:
   - [ ] Visual Studio Code (stable or insiders, 1.90+ recommended)
   - [ ] Node.js LTS version (18.x or 20.x)
   - [ ] Git (for cloning and committing)

2. **AI Provider Access** (at least one required for validation):
   - [ ] **Local**: Ollama running on localhost (http://127.0.0.1:11434)
     - Install: `curl https://ollama.ai/install.sh | sh`
     - Pull model: `ollama pull qwen-coder`
   - [ ] **Cloud**: Anthropic API key
     - Get from: https://console.anthropic.com/
   - [ ] **Private-Network**: SSH-tunneled Anthropic endpoint
     - Requires: VPN, SSH config, accessible internal server

3. **Extension Development Tools**:
   - [ ] TypeScript extension for VS Code
   - [ ] Extension Test Runner (built-in VS Code test)

---

### Installation

1. **Clone Repository**:
   ```bash
   git clone https://github.com/example/vscode-claude-switcher.git
   cd vscode-claude-switcher
   npm install
   ```

2. **Build Extension**:
   ```bash
   npm run compile  # Compile TypeScript to out/
   ```

3. **Run in Development**:
   ```bash
   # Open VS Code with extension loaded
   code .
   # Press F5 to launch Extension Development Host
   ```

4. **Install Dependencies**:
   - VS Code prompts to install recommended extensions; accept all

---

## Validation Scenarios

### Scenario 1: Create and Activate a Local Profile (Ollama)

**Purpose**: Validate profile creation, schema validation, and local model selection

**Prerequisites**:
- Ollama running with `ollama pull qwen-coder`
- Extension loaded in Extension Development Host

**Steps**:

1. **Create Local Profile**:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Type "Claude Switcher: Create New Profile"
   - Press Enter

2. **Step 1: Start from scratch** (select "Start from scratch", click Next)

3. **Step 2: Basic Configuration**:
   - ID: `ollama-test-qwen`
   - Label: `Test Ollama Qwen`
   - Adapter: `ollama` (select from dropdown)
   - Model: `qwen-coder` (type manually)
   - Click Next

4. **Step 3: Connection Details**:
   - Base URL: `http://127.0.0.1:11434`
   - Credential Mode: `none` (radio button)
   - Click Next

5. **Step 4: Permissions and Privacy**:
   - Permissions: `edit-and-command`
   - Provider Class: `local` (radio button)
   - Click Next

6. **Step 5: Capabilities**:
   - Check: `streaming`, `tools`, `fileEdits`, `commands`, `modelDiscovery`
   - Uncheck: `transcriptObservable` (Ollama doesn't support)
   - Click Next

7. **Step 6: Review**:
   - Verify all settings
   - Click **Create Profile**
   - Wait for validation (should show all checks passing)

8. **Activate Profile**:
   - Click status bar: "No Profile"
   - Quick Pick appears: Select "Test Ollama Qwen (local)"
   - Status bar updates: "Test Ollama Qwen (local)" with green badge

**Expected Outcomes**:
- [ ] Profile created and saved to `~/.claude-claude-switcher/profiles/ollama-test-qwen.yaml`
- [ ] Validation passes: Schema valid, secrets resolved, endpoint reachable
- [ ] Status bar shows active profile with green "(local)" badge
- [ ] No errors in "Claude Switcher Errors" output channel

**Validation Checks**:
```bash
# Verify profile file exists
cat ~/.claude-claude-switcher/profiles/ollama-test-qwen.yaml

# Verify审计日志 (optional - check audit.log)
tail -n 5 ~/.claude-claude-switcher/audit.log
# Look for: "eventType": "profile-selected"
```

---

### Scenario 2: Create and Activate a Cloud Profile (Anthropic)

**Purpose**: Validate secret storage, cloud provider integration, and privacy mode enforcement

**Prerequisites**:
- Anthropic API key
- Extension loaded

**Steps**:

1. **Store API Key**:
   - Open Command Palette
   - Type "Claude Switcher: Add Secret"
   - Press Enter
   - Secret Reference ID: `api-key:anthropic-main`
   - Paste API key value when prompted
   - Confirm

2. **Create Cloud Profile**:
   - Open Command Palette → "Claude Switcher: Create New Profile"
   - Step 1: Start from scratch, click Next

3. **Step 2: Basic Configuration**:
   - ID: `anthropic-test-sonnet`
   - Label: `Test Anthropic Sonnet`
   - Adapter: `anthropic-compatible`
   - Model: `claude-3-5-sonnet-20241022`
   - Click Next

4. **Step 3: Connection Details**:
   - Base URL: `https://api.anthropic.com`
   - Credential Mode: `secretRef`
   - Secret Reference: `api-key:anthropic-main` (autocomplete from list)
   - Click Next

5. **Step 4: Permissions and Privacy**:
   - Permissions: `edit-and-command`
   - Provider Class: `cloud`
   - Click Next

6. **Step 5: Capabilities**:
   - Check: `streaming`, `tools`, `fileEdits`, `transcriptObservable`
   - Uncheck: `commands` (Anthropic API doesn't execute shell commands directly)
   - Check: `modelDiscovery` (if supported)
   - Click Next

7. **Step 6: Review**:
   - Click **Create Profile**
   - Validation passes

**Activate Profile in Guarded Mode**:
8. **Set Guarded Mode**:
   - Open Command Palette → "Claude Switcher: Set Privacy Mode"
   - Select "Guarded"
   - Input dialog appears: "Why are you changing the privacy mode?"
   - Enter: "Validation scenario test"
   - Click OK

9. **Attempt to Activate Cloud Profile**:
   - Click status bar: Currently shows Ollama profile
   - Quick Pick shows "Test Anthropic Sonnet (cloud)" with yellow badge
   - Select "Test Anthropic Sonnet (cloud)"
   - Confirmation dialog appears: "Cloud profile in guarded mode. Approve?"
   - Click **Approve**
   - Status bar updates: "Test Anthropic Sonnet (cloud)" with yellow badge

**Expected Outcomes**:
- [ ] API key stored in VS Code SecretStorage (not in profile file)
- [ ] Profile created with `credential.secretRef: "api-key:anthropic-main"`
- [ ] Guarded mode active; status bar shows "Guarded"
- [ ] Cloud profile activation requires confirmation
- [ ] Status bar shows cloud profile with yellow badge

**Validation Checks**:
```bash
# Verify profile does NOT contain API key (only reference)
grep -i "api-key" ~/.claude-claude-switcher/profiles/anthropic-test-sonnet.yaml
# Should NOT show actual API value

# Verify secret exists (VS Code SecretStorage is not directly checkable from CLI;
# use extension UI: Command Palette → "Claude Switcher: List Secrets")
```

---

### Scenario 3: Profile Handoff (Local → Cloud, Summary Mode)

**Purpose**: Validate handoff mode selection, summarization, and audit metadata

**Prerequisites**:
- Both profiles from Scenarios 1 and 2 created
- Cloud profile active
- Some conversation history (simulate user message)

**Steps**:

1. **Simulate Conversation** (in Claude Code panel or terminal):
   - Ask a question about code: "Explain this function" (provide code snippet)
   - Get response from Claude (via extension integration)

2. **Initiate Handoff**:
   - Click status bar: "Test Anthropic Sonnet (cloud)"
   - Quick Pick appears
   - Select "Test Ollama Qwen (local)"
   - **Handoff Mode Dialog** appears

3. **Select Handoff Mode**:
   - Recommended: "Summary (no code, no secrets)"
   - Click "Configure Summary" (optional)
   - Verify defaults:
     - ☐ Include Code (unchecked)
     - ☑ Include Paths (checked)
     - ☐ Include Sensitive Data (unchecked)
   - Click "Continue" (accept defaults)

4. **Confirm Handoff**:
   - Dialog: "Transfer summary of conversation to local Ollama? This will not include code snippets or sensitive data."
   - Click **Continue** with Handoff

5. **Observe Handoff**:
   - Status bar shows spinner: "Handoff in progress..."
   - Progress notification: "Generating summary..."
   - After 2-3 seconds, status bar updates: "Test Ollama Qwen (local)"

**Expected Outcomes**:
- [ ] Handoff mode selection dialog shows recommended summary mode (local→cloud recommendation)
- [ ] Summary generation completes without errors
- [ ] Status bar switches to local profile
- [ ] Handoff metadata saved (no actual content) to `~/.claude-claude-switcher/handoffs/*.json`
- [ ] Audit log shows two events: "handoff-initiated" and "handoff-completed"

**Validation Checks**:
```bash
# Verify handoff metadata exists (redacted)
ls -lt ~/.claude-claude-switcher/handoffs/ | head -n 5
cat ~/.claude-claude-switcher/handoffs/[latest].json | head -n 20
# Verify: No transcript or summary content, only metadata (mode, timestamp, profile IDs)

# Verify audit log
grep "handoff" ~/.claude-claude-switcher/audit.log | tail -n 2
```

---

### Scenario 4: Concurrency and Conflict Detection

**Purpose**: Validate activity ledger, concurrent session visibility, and conflict warnings

**Prerequisites**:
- Two active sessions (simulate by opening two Claude Code conversations or using extension session simulation)

**Steps**:

1. **Open Activity Ledger**:
   - Command Palette → "Claude Switcher: Show Activity Ledger"
   - Side panel opens showing all active sessions

2. **Simulate Concurrent Editing**:
   - Session A: Edit `src/example.ts` (function `calculateSum`)
   - Session B: Edit same file (`src/example.ts`) (function `calculateProduct`)

3. **Observe Conflict Warning**:
   - Activity Ledger shows both sessions
   - Second session's "Files" column shows overlapping file path
   - Conflict indicator turns yellow (medium risk) or red (high risk)
   - Status bar shows warning icon: "Concurrent editing may cause conflicts"

4. **Right-Click Conflict Row**:
   - Context menu: "View Conflicting Files", "Open Diff", "Take Over File"
   - Select "Open Diff"
   - VS Code opens diff view of overlapping changes

**Expected Outcomes**:
- [ ] Activity Ledger displays both sessions with correct metadata
- [ ] Conflict risk indicator updates dynamically
- [ ] Status bar shows warning icon when conflicts detected
- [ ] Diff view highlights conflicting lines
- [ ] "Take Over File" warns other session and updates ownership

**Validation Checks**:
```typescript
// Optional manual code validation: Verify ledger update
// Open activity ledger view in VS Code and inspect table data
// Each row should have: Profile, Provider (badge), State, Files, Conflict, Last Active
```

---

### Scenario 5: Profile Validation

**Purpose**: Validate schema validation, endpoint health checks, and capability verification

**Prerequisites**:
- Ollama profile created (Scenario 1)
- Cloud profile created (Scenario 2)

**Steps**:

1. **Validate Local Profile**:
   - Command Palette → "Claude Switcher: Validate Profile"
   - Quick Pick: Select "Test Ollama Qwen (local)"
   - Progress notification: "Validating profile..."
   - Result: Notification "Validation passed" (or warnings)

2. **Validate Cloud Profile**:
   - Command Palette → "Claude Switcher: Validate Profile"
   - Quick Pick: Select "Test Anthropic Sonnet (cloud)"
   - Progress notification appears
   - Result: Notification with validation details

3. **Test Validation Failure**:
   - Edit local profile: Change `baseUrl` to invalid URL: `http://invalid:99999`
   - Command Palette → "Claude Switcher: Validate Profile"
   - Quick Pick: Select "Test Ollama Qwen (local)"
   - Result: Error notification "Profile validation failed: Endpoint unreachable"
   - Open error output channel to see details

4. **Restore Profile**:
   - Edit profile: Restore `baseUrl` to `http://127.0.0.1:11434`
   - Re-validate (should pass)

**Expected Outcomes**:
- [ ] Valid profiles show "Validation passed" notification
- [ ] Validation checks: Schema, policy compatibility, secrets, endpoint, capabilities
- [ ] Invalid endpoint shows error with actionable advice
- [ ] Validation duration < 3 seconds per profile (performance criterion)
- [ ] Error output channel shows clear error details

**Validation Checks**:
- [ ] Profile validation returns valid=true, errors=[]
- [ ] Health check (if enabled) shows `connected: true`
- [ ] Incorrect endpoint triggers error code `NETWORK_ERROR`

---

### Scenario 6: Policy Governance

**Purpose**: Validate workspace policy enforcement, reason requirements, and auto-revert

**Prerequisites**:
- Guarded mode active (Scenario 2)

**Steps**:

1. **View Current Policy**:
   - Command Palette → "Claude Switcher: Show Policy Editor"
   - Side panel shows current policy configuration

2. **Attempt Policy Change Without Reason**:
   - Change Privacy Mode from "Guarded" to "Unrestricted"
   - Try to save
   - Error: "Reason is required for policy changes in guarded mode"
   - Input dialog appears: "Why are you changing the privacy mode?"
   - Enter: "Validation test - temporarily allow unrestricted access"
   - Click OK

3. **Set Auto-Revert**:
   - Scroll to "Policy Changes" section
   - Check "Revert After Minutes"
   - Set to `5` minutes
   - Save policy
   - Success notification: "Policy updated with auto-revert in 5 minutes"

4. **Wait for Auto-Revert** (optional, 5 minutes):
   - After 5 minutes, notification: "Policy auto-reverted to Guarded mode"
   - Status bar shows "Guarded" badge again

5. **Verify Strict Mode Blocking**:
   - Set Privacy Mode to "Strict"
   - Provide reason
   - Try to activate cloud profile (Test Anthropic Sonnet)
   - Error: "Cloud model requests are blocked in strict mode. Change privacy mode to enable."

**Expected Outcomes**:
- [ ] Policy changes require reason in guarded/strict mode
- [ ] Auto-revert executes after configured timeout
- [ ] Strict mode blocks cloud model requests
- [ ] Policy editor validates fields before saving
- [ ] Audit log records policy changes with reason

**Validation Checks**:
```bash
# Verify policy file updated
cat .claude-switcher/policy.yaml

# Verify audit log
grep "policy-changed" ~/.claude-claude-switcher/audit.log | tail -n 3
```

---

### Scenario 7: Secret Management

**Purpose**: Validate secure secret storage, reference resolution, and secret deletion

**Prerequisites**:
- Cloud profile created (Scenario 2)
- Anthropic API key stored

**Steps**:

1. **List Secrets**:
   - Command Palette → "Claude Switcher: List Secrets"
   - Quick Pick shows all stored secrets with IDs (not values)
   - Example: `api-key:anthropic-main` (API Key)

2. **Add New Secret**:
   - Command Palette → "Claude Switcher: Add Secret"
   - Secret Reference ID: `api-key:openai-backup`
   - Paste OpenAI API key (if available) or dummy value
   - Confirm
   - Success notification: "Secret stored successfully"

3. **Delete Secret**:
   - Command Palette → "Claude Switcher: Delete Secret"
   - Quick Pick: Select `api-key:openai-backup`
   - Confirmation dialog: "Delete secret reference api-key:openai-backup?"
   - Click **Delete**
   - Success notification: "Secret deleted"

4. **Verify Profile Still Works** (Anthropic profile):
   - Validate profile: Should still pass (anthropic-main secret intact)

**Expected Outcomes**:
- [ ] Secrets stored in VS Code SecretStorage (not workspace)
- [ ] Secret references appear in profile YAML (not actual values)
- [ ] Secret list shows only references, not values
- [ ] Deleted secret removes reference cleanly
- [ ] Profiles using deleted secrets fail validation with `SECRET_MISSING` error

**Validation Checks**:
- [ ] Secrets NOT present in workspace files (.vscode/, .claude-switcher/)
- [ ] Profile YAML shows `credential.secretRef: "api-key:anthropic-main"` (no value)
- [ ] Deleting secret triggers validation error if profile references it

---

### Scenario 8: Handoff Export/Import

**Purpose**: Validate manual handoff package export for user-mediated transfer

**Prerequisites**:
- Active session with conversation history
- Both profiles created

**Steps**:

1. **Export Handoff Package**:
   - Command Palette → "Claude Switcher: Export Handoff Package"
   - Input: Provide destination profile ID: `ollama-test-qwen`
   - Select handoff mode: "Summary" (default options)
   - Input: Output path (or accept default): `~/.claude-claude-switcher/exports/test-handoff.json`
   - Confirm export

2. **Verify Export Package**:
   - File created: `test-handoff.json`
   - Inspect file (should contain only metadata, not full transcript)

3. **Simulate Import** (manual copy):
   - Copy exported JSON to archival location
   - Delete handoff metadata from local storage (simulate cleanup)
   - (This scenario assumes manual import; extension import feature may not exist in MVP)

**Expected Outcomes**:
- [ ] Export package created with metadata only (mode, summary fields, timestamp)
- [ ] No actual transcript or summary content stored
- [ ] File size is small (< 1KB for metadata only)
- [ ] Export logged in audit log: "handoff-exported"

**Validation Checks**:
```bash
# Verify export package
cat ~/.claude-claude-switcher/exports/test-handoff.json | head -n 30
# Should show JSON with: sourceSessionId, destinationProfileId, mode, summaryFields, timestamp
# Should NOT show full conversation content
```

---

## Integration Testing (Automated)

### Run Unit Tests

```bash
npm test
```

**Expected**: All Vitest tests pass (pure logic modules in `src/core/`)

**Coverage**: > 80% for adapter interfaces, validation logic, profile management

---

### Run Integration Tests

1. Open VS Code
2. Press `F5` to launch Extension Development Host
3. In extension host, open Command Palette → "Run All Tests"

**Expected**: All integration tests pass (VS Code API interactions)

**Coverage**:
- Profile creation, activation, editing
- Handoff workflows
- Policy enforcement
- Secret storage operations
- Status bar interactions

---

## Smoke Test Checklist

After completing all scenarios, verify:

- [ ] Extension loads without errors (Output → "Extension Host")
- [ ] Status bar items visible and interactive
- [ ] Activity Ledger view opens and updates
- [ ] Policy editor accessible and modifiable
- [ ] No errors in "Claude Switcher Errors" output channel
- [ ] Audit log populating (non-empty)
- [ ] Profile files created in `~/.claude-claude-switcher/profiles/`
- [ ] handoff metadata stored in `~/.claude-claude-switcher/handoffs/`

---

## Troubleshooting

### Common Issues

**Issue**: "Profile validation failed: Endpoint unreachable"
- **Solution**: Verify `baseUrl` is correct, network connectivity, provider status
- **Check**: Ollama running (`ollama ps`), Anthropic API key valid, VPN connected for private-network

**Issue**: "Secret not found in SecretStorage"
- **Solution**: Ensure secret was stored with correct reference ID
- **Check**: Command Palette → "List Secrets" and verify reference exists

**Issue**: "Handoff failed: Capability not supported"
- **Solution**: Verify source profile's capabilities match actual adapter support
- **Check**: `transcriptObservable` must be true for full transcript handoff

**Issue**: Extension fails to load
- **Solution**: Check `npm compile` succeeded, no TypeScript errors
- **Check**: View → Output → "Extension Host" for runtime errors

---

## Next Steps

After all scenarios pass validation:

1. **Review Audit Logs**: Ensure all audit events are recorded correctly
2. **Performance Validation**: Verify profile selection < 10s, switching < 5s, validation < 3s
3. **Privacy Verification**: Confirm no secrets in workspace files, metadata-only handoff storage
4. **Documentation Update**: If scenarios reveal gaps, update documentation
5. **Release Prep**: Package extension for marketplace submission (if applicable)

---

## References

- [Profile Schema Contract](./contracts/profile-schema.md)
- [Adapter Interface Contract](./contracts/adapter-interface.md)
- [API Commands Contract](./contracts/api-commands.md)
- [UI Contracts](./contracts/ui-contracts.md)
- [Data Model](./data-model.md)
- [Research Decisions](./research.md)

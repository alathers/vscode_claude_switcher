# API Commands Contract

**Project**: VS Code Model Profile Orchestrator
**Version**: 1.0
**Date**: 2026-10-17
**Purpose**: Interface contract for all VS Code extension commands

## Overview

This contract defines the schema for all VS Code extension commands, including input parameters, output responses, and error handling. The extension registers these commands through `package.json` `contributes.commands` and implements them in `src/vscode/commands/`.

Commands are categorized by functional area:
- Profile commands
- Handoff commands
- Policy commands
- Validation commands
- UI commands

## Command Conventions

All commands follow these conventions:

1. **Command IDs**: Prefixed with `claudeSwitcher.` (e.g., `claudeSwitcher.selectProfile`)
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
| `PROFILE_NOT_FOUND` | Profile does not exist | No |
| `PROFILE_INVALID` | Profile validation failed | No |
| `SECRET_MISSING` | Credential secret not found in SecretStorage | No |
| `NETWORK_ERROR` | Network/endpoint unreachable | Yes |
| `TIMEOUT` | Operation exceeded timeout | Yes |
| `PERMISSION_DENIED` | User lacks permission | No |
| `CONFLICT` | Operation conflicts with another session | N/A |
| `UNSUPPORTED_OPERATION` | Capability not supported by adapter | No |
| `CANCELLED` | User cancelled operation | No |
| `UNKNOWN` | Unexpected error | Maybe |

---

## Profile Commands

### Select Profile (Workspace Default)

**Command ID**: `claudeSwitcher.selectProfile`

**Purpose**: Select or change the workspace default profile

```typescript
interface SelectProfileArgs {
  profileId: string | null;  // null = no default profile
}

interface SelectProfileResult {
  success: boolean;
  message: string;
  profile: {
    id: string;
    label: string;
    adapter: string;
    model: string;
    network: {
      providerClass: 'local' | 'private-network' | 'cloud';
    };
  } | null;
}
```

**Behavior**:
1. Validate profile exists
2. Check secret references (if required)
3. Validate profile against workspace policy (allowedTemplateIds)
4. Run non-billable preflight validation
5. Set workspace profile (persistent across VS Code restarts)
6. Update status bar indicator
7. Log audit event (profile-selected)

**Errors**:
- `PROFILE_NOT_FOUND`: Profile id not in available profiles
- `PROFILE_INVALID`: Profile validation failed
- `SECRET_MISSING`: Secret reference not found in SecretStorage
- `POLICY_VIOLATION`: Profile not in allowedTemplateIds

---

### Select Profile (Per-Conversation Override)

**Command ID**: `claudeSwitcher.selectProfileOverride`

**Purpose**: Select profile for current conversation only (temporary override

```typescript
interface SelectProfileOverrideArgs {
  profileId: string;
  sessionId?: string;  // Optional: specific session
}

interface SelectProfileOverrideResult {
  success: boolean;
  message: string;
  override: {
    profileId: string;
    sessionId: string;
    until?: Date;  // Temporary override expiration (optional)
  };
}
```

**Behavior**:
1. Validate profile exists
2. Check secret references
3. Validate against policy
4. Apply override to specified session (or current active session)
5. Log audit event (profile-selected with override flag)

---

### Create Profile

**Command ID**: `claudeSwitcher.createProfile`

**Purpose**: Create a new user profile or use a template

```typescript
interface CreateProfileArgs {
  templateId?: string | null;  // Optional: start from template
  profile: {
    id: string;
    label: string;
    adapter: AdapterType;
    // ... (partial profile config; validation fills defaults)
  };
}

interface CreateProfileResult {
  success: boolean;
  message: string;
  profile: {
    id: string;
    label: string;
    validation?: ValidationResult;
  };
}
```

**Behavior**:
1. If templateId provided, load template as starting point
2. Validate profile structure per schema
3. Validate secret references (if provided)
4. Store profile in `~/.claude-claude-switcher/profiles/<id>.yaml`
5. Log audit event (profile-created)

**Errors**:
- `PROFILE_ID_EXISTS`: Profile with this id already exists
- `TEMPLATE_NOT_FOUND`: Template id not found
- `PROFILE_INVALID`: Profile validation failed

---

### Edit Profile

**Command ID**: `claudeSwitcher.editProfile`

**Purpose**: Edit an existing user profile

```typescript
interface EditProfileArgs {
  profileId: string;
  changes: Partial<ProfileConfig>;  // Fields to update (merge semantics)
}

interface EditProfileResult {
  success: boolean;
  message: string;
  profile: {
    id: string;
    label: string;
    updatedFields: string[];
    validation?: ValidationResult;
  };
}
```

**Behavior**:
1. Load existing profile
2. Merge changes (override provided fields)
3. Validate updated profile
4. Write to file (atomic write-to-temp-then-rename)
5. Keep backup of previous config
6. Log audit event (profile-updated)

**Errors**:
- `PROFILE_NOT_FOUND`: Profile id not found
- `PROFILE_INVALID`: Updated profile validation failed
- `SECRET_MISSING`: Secret reference not found

---

### Delete Profile

**Command ID**: `claudeSwitcher.deleteProfile`

**Purpose**: Delete a user profile

```typescript
interface DeleteProfileArgs {
  profileId: string;
  confirm: boolean;  // User confirmed deletion in dialog
}

interface DeleteProfileResult {
  success: boolean;
  message: string;
  deleted: {
    profileId: string;
    backupPath: string;  // Path to backup file
  };
}
```

**Behavior**:
1. Require user confirmation (via prompt dialog before command invocation)
2. Move profile to backup location (`backups/<id>-<timestamp>.yaml`)
3. If profile was workspace default, clear default
4. If profile was active in sessions, deactivate those sessions
5. Log audit event (profile-deleted)

**Errors**:
- `PROFILE_NOT_FOUND`: Profile id not found
- `PROFILE_IN_USE`: Profile is currently active in sessions

---

### Duplicate Profile

**Command ID**: `claudeSwitcher.duplicateProfile`

**Purpose**: Create a copy of an existing profile

```typescript
interface DuplicateProfileArgs {
  sourceProfileId: string;
  newProfileId: string;
  newLabel: string;
  copySecrets: boolean;  // Whether to copy secret references
}

interface DuplicateProfileResult {
  success: boolean;
  message: string;
  profile: {
    id: string;
    label: string;
    sourceProfileId: string;
  };
}
```

**Behavior**:
1. Validate source profile exists
2. Copy all fields to new profile
3. If not copySecrets, clear credential.secretRef
4. Store new profile
5. Log audit event (profile-duplicated)

**Errors**:
- `PROFILE_NOT_FOUND`: Source profile not found
- `PROFILE_ID_EXISTS`: New profile id already exists

---

## Handoff Commands

### Switch Profile (with Handoff)

**Command ID**: `claudeSwitcher.switchProfile`

**Purpose**: Switch current session to different profile with handoff options

```typescript
interface SwitchProfileArgs {
  sourceProfileId: string;
  destinationProfileId: string;
  sessionId: string;
  handoffMode: 'full' | 'summary' | 'none';
  summaryOptions?: {
    includeCode: boolean;
    includeSensitiveData: boolean;
    includeToolOutput: boolean;
    includeDiffs: boolean;
    includeCommandOutput: boolean;
    includePaths: boolean;
  };
  userApproval: boolean;  // User approved this handoff
}

interface SwitchProfileResult {
  success: boolean;
  message: string;
  handoff: {
    handoffId: string;
    sourceProfileId: string;
    destinationProfileId: string;
    mode: 'full' | 'summary' | 'none';
    summaryFields?: typeof summaryOptions;
    timestamp: Date;
  };
  newSession?: {
    sessionId: string;  // If new session created
    status: 'initializing' | 'active';
  };
}
```

**Behavior**:
1. Validate both source and destination profiles
2. Check compatibility of handoff mode with capabilities
3. For mode=full:
   - Call getTranscript on source adapter (if supported)
   - Validate transcript retrieved successfully
4. For mode=summary:
   - Generate summary using local summarizer or source-model (if opt-in)
   - Apply redaction based on summaryOptions
5. For mode=none: No context transfer
6. Inactivate source session
7. Create or activate destination session with handoff context
8. Store handoff metadata (excluding transcript/summary content)
9. Log audit events (handoff-initiated, handoff-completed)

**Errors**:
- `PROFILE_NOT_FOUND`: Source or destination profile not found
- `CAPABILITY_NOT_SUPPORTED`: full transcript handoff not supported by source adapter
- `SUMMARY_GENERATION_FAILED`: Failed to generate summary
- `NETWORK_ERROR`: Destination provider unreachable
- `CANCELLED`: User cancelled mid-handoff

**UI Flow**:
1. User invokes command (via status bar, command palette, or activity ledger)
2. Extension shows handoff mode selection dialog
3. Extension recommends mode based on trust-zone combination
4. User selects mode; for summary mode, shows field inclusion options
5. User confirms
6. Handoff executes with progress indicator

---

### Export Handoff Package

**Command ID**: `claudeSwitcher.exportHandoffPackage`

**Purpose**: Manually export a sanitized handoff package for user-mediated transfer

```typescript
interface ExportHandoffPackageArgs {
  sourceSessionId: string;
  destinationProfileId: string;
  includeTranscript: boolean;  // If supported
  summaryOptions?: typeof summaryOptions;
  outputPath?: string;  // Optional: user-provided path
  approved: boolean;
}

interface ExportHandoffPackageResult {
  success: boolean;
  message: string;
  package: {
    id: string;
    type: 'transcript' | 'summary' | 'empty';
    filePath: string;  // Where package was saved
    sizeBytes: number;
    expires?: Date;  // If configured retention applies
  };
}
```

**Behavior**:
1. Generate handoff content (transcript or summary) with redaction
2. Create package JSON containing metadata + content
3. Save to `~/.claude-claude-switcher/exports/<id>.json` or user-provided path
4. Log audit event (handoff-exported)

**Errors**:
- `SESSION_NOT_FOUND`: Source session not found
- `CAPABILITY_NOT_SUPPORTED`: Transcript export not supported

---

### Delete Handoff Metadata

**Command ID**: `claudeSwitcher.deleteHandoffMetadata`

**Purpose**: Delete handoff metadata and optionally content from local storage

```typescript
interface DeleteHandoffMetadataArgs {
  handoffId: string;
  confirmed: boolean;  // User confirmed deletion
}

interface DeleteHandoffMetadataResult {
  success: boolean;
  message: string;
  deleted: {
    handoffId: string;
    deletedFiles: string[];
  };
}
```

**Behavior**:
1. Require user confirmation
2. Delete handoff metadata file
3. Delete any associated content files
4. Log audit event (handoff-deleted)

---

## Policy Commands

### Set Privacy Mode

**Command ID**: `claudeSwitcher.setPrivacyMode`

**Purpose**: Change workspace privacy mode (unrestricted/guarded/strict

```typescript
interface SetPrivacyModeArgs {
  mode: 'unrestricted' | 'guarded' | 'strict';
  reason?: string;  // Optional: user-provided reason
  revertAfterMinutes?: number | null;  // Optional: auto-revert timeout
  requireSecondApprover?: boolean;  // Optional: get second approval
}

interface SetPrivacyModeResult {
  success: boolean;
  message: string;
  policy: {
    previousMode: 'unrestricted' | 'guarded' | 'strict';
    newMode: 'unrestricted' | 'guarded' | 'strict';
    reason?: string;
    revertAt?: Date;
  };
}
```

**Behavior**:
1. Validate mode change respects workspace policy configuration (requireConfirmation, requireReason, etc.)
2. If requireReason and not provided, prompt user for reason
3. If revertAfterMinutes, schedule auto-revert
4. If requireSecondApprover, trigger second approval workflow
5. Update workspace policy file
6. Log audit event (policy-changed)

**Errors**:
- `REQUIRES_CONFIRMATION`: User must confirm mode change
- `REQUIRES_REASON`: User must provide reason
- `REQUIRES_APPROVAL`: Second approver must approve
- `POLICY_INVALID`: Updated policy validation fails

### Approve Cloud Request

**Command ID**: `claudeSwitcher.approveCloudRequest`

**Purpose**: Approve a pending cloud model request in guarded mode

```typescript
interface ApproveCloudRequestArgs {
  requestId: string;
  destination: string;  // Cloud provider/model
  reason?: string;
}

interface ApproveCloudRequestResult {
  success: boolean;
  message: string;
  approved: {
    requestId: string;
    destination: string;
    approvedAt: Date;
  };
}
```

**Behavior**:
1. Verify request is pending
2. Record approval with metadata
3. Allow request to proceed
4. Log audit event

---

### Deny Cloud Request

**Command ID**: `claudeSwitcher.denyCloudRequest`

**Purpose**: Deny a pending cloud model request

```typescript
interface DenyCloudRequestArgs {
  requestId: string;
  reason?: string;
}

interface DenyCloudRequestResult {
  success: boolean;
  message: string;
  denied: {
    requestId: string;
    deniedAt: Date;
  };
}
```

**Behavior**:
1. Verify request is pending
2. Record denial with reason
3. Block request
4. Log audit event

---

## Validation Commands

### Validate Profile

**Command ID**: `claudeSwitcher.validateProfile`

**Purpose**: Run validation on a profile (schema, policy, secrets, endpoint)

```typescript
interface ValidateProfileArgs {
  profileId: string;
  deepValidation?: boolean;  // Optional: attempt billable model calls
  approved?: boolean;  // Required if deepValidation=true
}

interface ValidateProfileResult {
  success: boolean;
  message: string;
  validation: {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    performedAt: Date;
    deepValidationPerformed: boolean;
  };
  performance: {
    durationMs: number;
  };
}
```

**Behavior** (default validation FR-071):
1. Validate schema compliance
2. Validate policy compatibility (allowedTemplateIds)
3. Validate secret references exist in SecretStorage
4. Validate endpoint reachability (healthCheck.url)
5. Validate declared capabilities vs adapter capabilities
6. No model calls (no billable cost)

**Behavior** (deep validation, requires user approval FR-072):
7. Model discovery (listModels) if capabilities.modelDiscovery
8. Test message send/receive with minimal prompt
9. Potentially incurs charges; UI must show cost estimate before approval

**Errors**:
- `PROFILE_NOT_FOUND`: Profile id not found
- `SECRET_MISSING`: Secret reference not found
- `NETWORK_ERROR`: Endpoint unreachable
- `APPROVAL_REQUIRED`: User must approve deep validation

---

### Run Diagnostics

**Command ID**: `claudeSwitcher.runDiagnostics`

**Purpose**: Run comprehensive diagnostics on workspace configuration

```typescript
interface RunDiagnosticsArgs {
  includeAllProfiles?: boolean;  // Default: only active/default profiles
}

interface RunDiagnosticsResult {
  success: boolean;
  message: string;
  diagnostics: {
    workspace: WorkspaceDiagnostics;
    profiles: ProfileDiagnostics[];
    policy: PolicyDiagnostics;
    secrets: SecretsDiagnostics;
    summary: {
      totalErrors: number;
      totalWarnings: number;
      criticalIssues: string[];
    };
  };
}
```

**Behavior**:
1. Validate workspace structure (.claude-switcher directories)
2. Validate policy file
3. Validate all (or active) profiles
4. Detect conflicting inherited configuration
5. Check secret references
6. Report all errors and warnings (redacted)

---

## UI Commands

### Show Profile Selector

**Command ID**: `claudeSwitcher.showProfileSelector`

**Purpose**: Open profile selection UI (quick pick or full interface

```typescript
interface ShowProfileSelectorArgs {
  selectFor?: 'workspace' | 'session';  // Default: workspace
  sessionId?: string;  // Required if selectFor='session'
}

interface ShowProfileSelectorResult {
  success: boolean;
  action: 'selected' | 'cancelled';
  selection?: {
    profileId: string;
    selectFor: 'workspace' | 'session';
    sessionId?: string;
  };
}
```

**Behavior**:
1. Show Quick Pick dialog with available profiles
2. Filter by workspace policy allowedTemplateIds
3. Show adapter, model, trust zone indicators
4. On selection, invoke `selectProfile` or `selectProfileOverride`

---

### Show HandoffDialog

**Command ID**: `claudeSwitcher.showHandoffDialog`

**Purpose**: Show handoff mode selection and summary options UI

```typescript
interface ShowHandoffDialogArgs {
  sourceProfileId: string;
  destinationProfileId: string;
  sessionId: string;
}

interface ShowHandoffDialogResult {
  success: boolean;
  action: 'selected' | 'cancelled';
  selection?: {
    mode: 'full' | 'summary' | 'none';
    summaryOptions?: typeof summaryOptions;
    recommendedMode: 'full' | 'summary' | 'none';
    recommendationReason: string;
  };
}
```

**Behavior**:
1. Show dialog with three handoff modes
2. Highlight recommended mode based on trust-zone combination
3. If summary mode selected, show field inclusion options
4. On confirm, invoke `switchProfile`

---

### Show Activity Ledger

**Command ID**: `claudeSwitcher.showActivityLedger`

**Purpose**: Show activity ledger view displaying concurrent sessions

```typescript
interface ShowActivityLedgerArgs {
  // No arguments
}

interface ShowActivityLedgerResult {
  success: boolean;
  sessions: ActivityLedgerEntry[];
}
```

---

### Show Policy Editor

**Command ID**: `claudeSwitcher.showPolicyEditor`

**Purpose**: Open workspace policy editor UI

```typescript
interface ShowPolicyEditorArgs {
  // No arguments
}

interface ShowPolicyEditorResult {
  success: boolean;
  policy: WorkspacePolicy;
}
```

---

## Session Management Commands

### List Active Sessions

**Command ID**: `claudeSwitcher.listActiveSessions`

**Purpose**: List currently active sessions

```typescript
interface ListActiveSessionsArgs {
  // No arguments
}

interface ListActiveSessionsResult {
  success: boolean;
  sessions: Session[];
}
```

---

### Terminate Session

**Command ID**: `claudeSwitcher.terminateSession`

**Purpose**: Terminate an active session

```typescript
interface TerminateSessionArgs {
  sessionId: string;
  confirm: boolean;  // User confirmed termination
}

interface TerminateSessionResult {
  success: boolean;
  message: string;
  terminated: {
    sessionId: string;
    terminatedAt: Date;
  };
}
```

---

## Command Registration in package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "claudeSwitcher.selectProfile",
        "title": "Select Workspace Profile",
        "category": "Claude Switcher",
        "icon": "$(debug-disconnect)"
      },
      {
        "command": "claudeSwitcher.createProfile",
        "title": "Create New Profile",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.editProfile",
        "title": "Edit Profile",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.validateProfile",
        "title": "Validate Profile",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.switchProfile",
        "title": "Switch Profile (Handoff)",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.setPrivacyMode",
        "title": "Set Privacy Mode",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.runDiagnostics",
        "title": "Run Diagnostics",
        "category": "Claude Switcher"
      },
      {
        "command": "claudeSwitcher.showActivityLedger",
        "title": "Show Activity Ledger",
        "category": "Claude Switcher"
      }
    ]
  }
}
```

## Future Extensions

Additional command categories may be added in future versions:

- **Workspace Management**: Set workspace policy, manage worktree isolation
- **Advanced Features**: Custom summarizers, advanced redaction rules
- **Integration Specific**: Adapter-specific commands (e.g., configure Ollama models)
- **Admin Commands**: For team administrators (audit export, bulk operations)

Command interface changes require:
1. Command ID versioning (e.g., `claudeSwitcher.v2.switchProfile`)
2. Backward compatibility for existing commands
3. Updated documentation
4. Version bump in contract document

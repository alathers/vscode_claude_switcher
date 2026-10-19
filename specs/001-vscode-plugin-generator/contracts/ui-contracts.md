# UI Contracts

**Project**: VS Code Model Profile Orchestrator
**Version**: 1.0
**Date**: 2026-10-17
**Purpose**: Contract for extension UI components, status bar, views, dialogs, and user interaction design

## Overview

This contract defines the UI/UX components and interaction patterns for the VS Code extension. It specifies status bar indicators, activity ledger view, dialog flows, Quick Pick configurations, and error handling patterns.

All UI components must:
- Use VS Code native APIs (webview, Quick Pick, notifications, status bar)
- Be keyboard-accessible and screen-reader friendly (VS Code default accessibility)
- Respect configured themes (no hardcoded colors)
- Provide clear feedback and error messaging
- Support undo for destructive operations

## Status Bar

### Primary Status Bar Item

**Location**: Right side of status bar

**Appearance**:
- Icon: Switch profile indicator (tabs-icon when active, debug-disconnect when none)
- Text: Profile label (e.g., "Claude 3.5 (cloud)" or "Qwen Coder (local)")
- Tooltip: Full profile details + privacy mode

**Interactions**:
- **Click (left)**: Opens profile selector Quick Pick
- **Click (right)**: Shows context menu with:
  - Switch Profile (Handoff)
  - Validate Current Profile
  - Set Privacy Mode
  - Show Activity Ledger
  - Show Policy Editor

**States**:
1. **No Profile Selected**: Icon "debug-disconnect", text "No Profile", tooltip "Click to select a profile"
2. **Local Profile**: Icon "tabs-icon", text includes "(local)", color green/light-green badge
3. **Private-Network Profile**: Icon "tabs-icon", text includes "(private)", color yellow/orange badge
4. **Cloud Profile**: Icon "tabs-icon", text includes "(cloud)", color red/pink badge if guarded/strict mode, else neutral

**Badges**:
- Override active: Small "↑" badge suffix when per-session override is set
- Validation error: Small "!" badge suffix if last validation failed

---

### Secondary Status Bar Items

**Privacy Mode Indicator**:
- Location: Left side of status bar (near workspace name)
- Text: Current mode (e.g., "Guarded", "Strict", "Unrestricted")
- Color: Neutral (unrestricted), Yellow (guarded), Red (strict)
- Click: Opens privacy mode Quick Pick

**Conflict Warning Indicator**:
- Location: Center status bar
- Icon: "warning"
- Tooltip: "Concurrent editing may cause conflicts (X sessions)"
- Only visible when conflictRisk !== 'low'
- Click: Opens Activity Ledger with conflict details

**Handoff Progress Indicator**:
- Location: Right status bar (during active handoff)
- Icon: "sync~spin" (spinning)
- Text: "Handoff in progress..."
- Disappears when handoff completes

---

## Quick Pick Dialogs

### Profile Selector Quick Pick

**Purpose**: Select workspace default or per-session profile

**UI Components**:
```typescript
interface ProfileQuickPickItem extends QuickPickItem {
  id: string;
  label: string;  // Profile label with badge
  description: string;  // Adapter type + providerClass
  detail: string;  // Model name
  providerClass: 'local' | 'private-network' | 'cloud';
  isActive: boolean;  // Current workspace profile
  validationStatus: 'valid' | 'warning' | 'error';
}
```

**Display Format**:
```
┌─────────────────────────────────────────────┐
│ Select Profile (Workspace Default)          │
├─────────────────────────────────────────────┤
│ ✓ Claude 3.5 Sonnet (cloud)                 │
│   anthropic-compatible / claude-3-5-sonnet  │
│   Active workspace profile                  │
│                                             │
│   Qwen Coder (local)                        │
│   ollama / qwen-coder                       │
│   Last validated: 2h ago                    │
│                                             │
│   ! GPT-4 Turbo (cloud)                     │
│   openai-compatible / gpt-4-turbo            │
│   ⚠️ Validation failed: endpoint unreachable │
└─────────────────────────────────────────────┘
```

**Selection Handling**:
- Double-selecting currently active profile opens Edit Profile dialog
- New profile selection triggers confirmation if cloud and guarded/strict mode
- Displays validation status icon (✓, ⚠️, !) based on profile status

**Buttons**:
- Refresh: Re-load profiles and re-validate
- Create Profile: Opens profile creation wizard
- Help: Opens documentation

---

### Handoff Mode Dialog

**Purpose**: Select handoff mode and summary options when switching profiles

**UI Flow**:

1. **Primary Dialog - Handoff Mode Selection**:
   ```
   ┌─────────────────────────────────────────────┐
   │ Switch Profile: Handoff Mode                 │
   ├─────────────────────────────────────────────┤
   │ Recommended: Summary (no code, no secrets) │
   │                                             │
   │ ◉ Full Transcript                           │
   │   Transfer complete conversation            │
   │   ⚠️ Destination: Qwen Coder (local)        │
   │   ✓ Source supports transcript export      │
   │                                             │
   │ ○ Reviewed Summary                          │
   │   Transfer summarized context              │
   │   ✓ Local summarizer (no code, no secrets)  │
   │                                             │
   │ ○ No Context Transfer                      │
   │   Start fresh conversation                  │
   │                                             │
   │          [Configure Summary] [Cancel]       │
   │              [Continue]                     │
   │                                             │
   │ Learn more about handoff modes              │
   └─────────────────────────────────────────────┤
   ```

2. **Secondary Dialog - Summary Options (if 'Reviewed Summary' selected)**:
   ```
   ┌─────────────────────────────────────────────┐
   │ Configure Summary Options                   │
   ├─────────────────────────────────────────────┤
   │ Include in summary:                        │
   │                                             │
   │ ☐ Code snippets              (default off) │
   │ ☑ File paths and structures (default on)  │
   │ ☐ Sensitive data             (default off) │
   │ ☐ Tool call results          (default off) │
   │ ☐ Code diffs                 (default off) │
   │ ☐ Command output            (default off) │
   │                                             │
   │ Explanation: Only include what you trust    │
   │ the destination model to see                │
   │                                             │
   │           [Back]               [Continue]    │
   └─────────────────────────────────────────────┘
   ```

**Recommendation Logic**:
```
Source → Destination:
local → local: Full transcript
local → private: Full transcript
local → cloud: Summary (recommended) or None
private → local: Full transcript
private → private: Full transcript
private → cloud: Summary (recommended) or None
cloud → local: Summary (recommended) or None
cloud → private: Summary (recommended) or None
cloud → cloud: Full transcript
```

**Confirmation**:
- If cloud destination and guarded/strict mode: require explicit approval
- Show data leakage warning if code/secrets selected for summary
- Display estimated content size before transfer

---

### Privacy Mode Quick Pick

**Purpose**: Switch workspace privacy mode

**UI Components**:
```
┌─────────────────────────────────────────────┐
│ Set Privacy Mode                            │
├─────────────────────────────────────────────┤
│ Current: Unrestricted                        │
│                                             │
│ ◉ Unrestricted                              │
│   All profile changes allowed               │
│   Cloud model requests: Allow               │
│                                             │
│ ○ Guarded                                   │
│   Privacy changes require reason            │
│   Cloud requests require approval           │
│   Default: Summary handoffs, exclude code  │
│                                             │
│ ○ Strict                                    │
│   Policy changes require second approval    │
│   Cloud requests: Blocked                   │
│   Cloud-bound handoffs: Blocked             │
│                                             │
│          [ Configure Firewall ]              │
└─────────────────────────────────────────────┘
```

**Input Dialogs** (triggered by mode selection):
- If mode=guarded and policyChanges.requireReason: Show input dialog for reason
- If policyChanges.revertAfterMinutes: Show input dialog for timeout
- If policyChanges.requireSecondApprover: Show second approval dialog

**Buttons**:
- Configure Firewall: Opens traffic configuration (not implemented in MVP)
- Preview Changes: Show diff before confirming policy change

---

## Views

### Activity Ledger View

**Purpose**: Display concurrent sessions, conflict detection, and recent activity

**Location**: Side panel (Explorer → "Claude Switcher: Activity Ledger")

**Table Columns**:
| Column | Width | Description |
|--------|-------|-------------|
| Profile | 150px | Profile label |
| Provider | 80px | ProviderClass badge (Local/Private/Cloud) |
| State | 100px | Session state (Active/Idle/Switching) |
| Files | 200px | Known files modified (truncates with "..." if >2) |
| Conflict | 80px | Risk level (🟢 Low / 🟡 Medium / 🔴 High) |
| Last Active | 120px | Timestamp (e.g., "2m ago") |

**Row Formatting**:
- Active session highlighted with different background color
- Cloud profiles show provider badge color
- Red highlight if conflictRisk === 'high'
- Group by profile ID if multiple sessions use same profile

**Row Interactions**:
- Right-click: Context menu
  - Terminate Session (require confirmation)
  - Force Save Files
  - View Session Details
- Double-click: Open file at conflict point (if high conflict risk)

**Footer**:
- Total sessions: X active, Y idle
- Conflicts: Z files with potential conflicts
- Last updated: [timestamp]

**Refresh**: Manual refresh button, auto-refresh every 5s when any session is active

---

### Policy Editor View

**Purpose**: Edit workspace policy configuration (guarded mode only requires reason)

**Location**: Side panel (Explorer → "Claude Switcher: Workspace Policy")

**Form Sections**:

1. **Privacy Configuration**:
   ```
   ┌─────────────────────────────────────────────┐
   │ Privacy Mode ◀dropdown▶                    │
   │                                             │
   │ Cloud Model Requests                        │
   │ Default: [require-confirmation ▼]          │
   │                                             │
   │ Handoff Configuration                       │
   │ Allowed Modes: [☑ Full ☑ Summary ☑ None]   │
   │ Default Mode: [summary ▼]                  │
   │                                             │
   │ Summary Defaults:                           │
   │ ☐ Include Code                              │
   │ ☐ Include Sensitive Data                    │
   │ ☐ Include Tool Output                       │
   │ ☐ Include Diffs                             │
   │ ☐ Include Command Output                   │
   │ ☑ Include Paths                            │
   │                                             │
   │ Policy Changes                              │
   │ ☐ Require Confirmation                     │
   │ ☐ Require Reason                           │
   │ Revert After: [60 ▼] minutes               │
   │ ☐ Require Second Approver                   │
   └─────────────────────────────────────────────┘
   ```

2. **Concurrency Configuration**:
   ```
   ┌─────────────────────────────────────────────┘
   │ Concurrency                                 │
   │                                             │
   │ Default Mode: [concurrent ▼]                │
   │ On Conflict: [warn ▼]                       │
   │ ☑ Supports Worktrees                        │
   │ ☑ Checkpoint Before Mutation                │
   │                                             │
   │ Profile Governance                          │
   │ Allowed Templates:                           │
   │ ○ template-anthropic-models                  │
   │ ○ template-local-ollama                      │
   │ [+ Add Template]                            │
   └─────────────────────────────────────────────┘
   ```

**Validation**:
- Real-time validation as user types/changes
- Error indicators (red border) for invalid fields
- Warning indicators (yellow border) for potentially risky changes
- Save button disabled if policy invalid

**Actions**:
- Save: Validates and saves to `.claude-switcher/policy.yaml`
- Revert: Discard unsaved changes
- Export: Export policy to JSON for backup
- Import: Import policy from JSON file

---

## Wizard Dialogs

### Create Profile Wizard

**Purpose**: Walk user through creating a new profile step-by-step

**Steps**:

1. **Step 1: Start from Template or Scratch**
   ```
   ┌─────────────────────────────────────────────┐
   │ Create Profile: Step 1 of 5                 │
   ├─────────────────────────────────────────────┤
   │                                             │
   │   ○ Start from template                     │
   │   [template-anthropic-models ▼]              │
   │   (Templates define structure but not       │
   │    secrets; you'll add your own)            │
   │                                             │
   │   ○ Start from scratch                      │
   │   (Define all settings manually)            │
   │                                             │
   │            [Cancel]       [Next ›]          │
   └─────────────────────────────────────────────┘
   ```

2. **Step 2: Basic Configuration**
   ```typescript
   interface BasicConfig {
     id: string;         // Pattern: ^[a-z0-9-]+$
     label: string;      // Display name
     adapter: AdapterType;  // Dropdown
     model: string;      // Autocomplete if modelDiscovery supported
   }
   ```

3. **Step 3: Connection Details**
   ```typescript
   interface ConnectionDetails {
     baseUrl?: string;   // URL input (optional, some adapters default)
     credential: {
       mode: CredentialMode;  // Radio buttons
       secretRef?: string;    // Input if mode=secretRef
     };
     tunnel?: {
       enabled: boolean;
       sshHostAlias?: string;  // Autocomplete from ~/.ssh/config
       localPort?: number;     // Number input
     };
   }
   ```

4. **Step 4: Permissions and Privacy**
   ```typescript
   interface PermissionsAndPrivacy {
     permissions: {
       mode: PermissionMode;  // Radio buttons
       workspacePaths: string[];  // Multi-input
     };
     network: {
       providerClass: ProviderClass;  // Radio buttons
       supportingNetwork: 'allowed' | 'blocked';  // Radio buttons
     };
   }
   ```

5. **Step 5: Capabilities and Limits**
   ```typescript
   interface CapabilitiesAndLimits {
     capabilities: {
       streaming: boolean;
       tools: boolean;
       fileEdits: boolean;
       commands: boolean;
       modelDiscovery: boolean;
       transcriptObservable: boolean;
     };
     limits?: {
       contextTokens?: number;
       maxOutputTokens?: number;
     };
   }
   ```

6. **Step 6: Review and Create**
   ```
   ┌─────────────────────────────────────────────┐
   │ Create Profile: Step 6 of 6                 │
   ├─────────────────────────────────────────────┤
   │ Review your profile configuration:         │
   │                                             │
   │ ID: laptop-ollama-qwen                      │
   │ Label: Laptop Ollama - Qwen Coder           │
   │ Adapter: Ollama                             │
   │ Model: qwen-coder                           │
   │ Base URL: http://127.0.0.1:11434            │
   │ Provider Class: Local                       │
   │ Permissions: Edit and Command               │
   │                                             │
   │ Validation: (Running...)                    │
   │ ✓ Schema valid                             │
   │ ✓ Secrets resolved                          │
   │ ✓ Endpoint reachable                       │
   │ ⚠️ Model discovery not supported            │
   │                                             │
   │       [< Back]  [Create Profile]             │
   └─────────────────────────────────────────────┘
   ```

**Wizard Behavior**:
- Progress indicator at top shows current step
- Back button available on all steps except first
- Next/Create button validates current step before allowing advance
- Real-time validation on each field
- Warning before creating if validation has warnings

---

### Edit Profile Dialog

**Purpose**: Modify existing profile fields

**UI Components**:
- Similar to Create Profile Wizard but single-page view with collapsible sections
- Sections: Basic, Connection, Permissions, Privacy, Capabilities, Limits, Health Check, Instructions
- Each section shows current values in input fields
- Save button validates all changes before writing
- Diff view: Show "Changes" tab to preview modifications

**Diff View Example**:
```
┌─────────────────────────────────────────────┐
│ Edit: laptop-ollama-qwen                    │
├─────────────────────────────────────────────┤
│ [Configuration] ⚫ [ Changes ○]             │
│                                             │
│ Changed Fields:                             │
│                                             │
│ limits.contextTokens:                       │
│ -   200000                                   │
│ +   400000                                   │
│                                             │
│ capabilities.modelDiscovery:                │
│ -   false                                   │
│ +   true                                    │
│                                             │
│ permissions.workspacePaths:                 │
│ -   []                                      │
│ +   ["src/", "test/"]                       │
│                                             │
│                                             │
│ ⚠️ Enabling model discovery requires user    │
│    approval (may query provider and incur   │
│    charges). Approve? [Yes] [No]            │
│                                             │
│       [Cancel]              [Save Changes]  │
└─────────────────────────────────────────────┘
```

---

## Notifications and Alerts

### Success Notifications (Info Level)

```typescript
vscode.window.showInformationMessage(
  'Profile "Claude 3.5 Sonnet" selected',
  'Undo',
  'View Details'
)
```

**Use Cases**:
- Profile selection completed
- Handoff completed successfully
- Policy updated successfully
- Validation passed

---

### Warning Notifications (Warning Level)

```typescript
vscode.window.showWarningMessage(
  'Profile validation completed with warnings. ' +
  'Model discovery not supported. See details.',
  'Ignore',
  'View Details'
)
```

**Use Cases**:
- Validation passed with warnings
- Cloud model requested in guarded mode (pre-approval)
- Potential conflict detected (non-blocking)
- Handoff mode not recommended for source/destination pair

---

### Error Notifications (Error Level)

```typescript
vscode.window.showErrorMessage(
  'Profile validation failed: Endpoint unreachable. ' +
  'Check base URL and network connectivity.',
  'Retry',
  'Edit Profile'
)
```

**Use Cases**:
- Validation failed
- Secret not found
- Network timeout
- Handoff failed
- Policy violation (blocked operation)

**Error Output Channel**:
- Dedicated output channel: "Claude Switcher Errors"
- Logs all error messages with stack traces
- Timestamps for each error entry
- User can open: View → Output → Select from dropdown

---

### Progress Notifications

```typescript
const progress = await vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: 'Validating profile...',
    cancellable: true
  },
  async (progress, token) => {
    progress.report({ increment: 20, message: 'Checking schema...' });
    // ... validation steps
    progress.report({ increment: 60, message: 'Testing endpoint...' });
    // ...
    return validation;
  }
);
```

**Use Cases**:
- Profile validation (long-running)
- Handoff in progress
- Deep validation (model discovery)
- Export package generation

**Progress Indicators**:
- Increment percentage based on steps completed
- Additional message for current step
- Cancellable where appropriate (user can abort handoff or validation)

---

### Confirmation Dialogs

**Destructive Operations**:

```typescript
const confirm = await vscode.window.showWarningMessage(
  `Delete profile "${profile.label}"? This action cannot be undone. ` +
  `A backup will be saved to ${backupPath}.`,
  {
    modal: true,
    detail: 'If this profile is currently active, it will be deactivated.'
  },
  'Delete',
  'Cancel'
);

if (confirm === 'Delete') {
  // Execute delete
}
```

**Use Cases**:
- Delete profile
- Terminate session
- Clear all secrets
- Revert policy changes

**Modal Confirmations**:
- Used for critical destructive operations
- User must explicitly type confirm string (e.g., "DELETE") for highly destructive
- Non-modal confirmations for less critical operations

---

## Context Menus

### Profile Items (Activity Ledger or Quick Pick)

```typescript
profileQuickPick.onDidChangeSelection(async ([selected]) => {
  const actions = [];

  if (selected.isActive) {
    actions.push({
      label: 'Edit Profile',
      handler: () => editProfile(selected.id)
    });
  }

  actions.push(
    { label: 'Validate Profile', handler: () => validateProfile(selected.id) },
    { label: 'Duplicate Profile', handler: () => duplicateProfile(selected.id) },
    { label: '---' },
    { label: 'Delete Profile', handler: () => deleteProfile(selected.id) }
  );

  const action = await vscode.window.showQuickPick(
    actions.map(a => ({ label: a.label })),
    { placeHolder: `Actions for ${selected.label}` }
  );

  if (action) {
    actions.find(a => a.label === action.label).handler();
  }
});
```

---

### Session Items (Activity Ledger)

```typescript
const sessionActions = [
  { label: 'View Details' },
  { label: 'Force Save Files' },
  { label: '---' },
  { label: 'Terminate Session' }
];
```

---

### Conflict Indicators (Activity Ledger Right-Click)

```typescript
const conflictActions = [
  { label: 'View Conflicting Files' },
  { label: 'Open Diff' },
  { label: 'Take Over File' }  // Claims ownership, warns other session
];
```

---

## Input Dialogs

### Secret Reference Input

```typescript
const secretRef = await vscode.window.showInputBox({
  title: 'Add Secret Reference',
  prompt: 'Enter the secret reference ID (e.g., "api-key:openai-main")',
  placeHolder: 'api-key:<identifier>',
  validateInput: (value) => {
    if (!value.match(/^api-key:[a-z0-9-]+$/)) {
      return 'Secret reference must match "api-key:<identifier>"';
    }
    return null;
  }
});
```

---

### Timeout/Reason Input (Policy Changes)

```typescript
const reason = await vscode.window.showInputBox({
  title: 'Policy Change Reason',
  prompt: 'Why are you changing the privacy mode?',
  placeHolder: 'Enter reason (required for guarded mode)',
  validateInput: (value) => {
    if (!value.trim()) {
      return 'Reason is required';
    }
    if (value.length < 10) {
      return 'Reason must be at least 10 characters';
    }
    return null;
  }
});
```

---

### Quick Input Multi-Select (Workspace Paths)

```typescript
const paths = await vscode.window.showQuickPick(
  ['src/', 'test/', 'docs/', 'examples/'],
  {
    placeHolder: 'Select workspace paths for permission restrictions',
    canPickMany: true,
    ignoreFocusOut: true
  }
);
```

---

## Accessibility and Internationalization

### Keyboard Shortcuts (MVP)

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Ctrl+Shift+P` (Cmd+Shift+P) | Open Command Palette | Global |
| `claudeSwitcher.selectProfile` | Select Profile (via palette) | Global |
| `claudeSwitcher.switchProfile` | Switch Profile (Handoff) | Global |
| `Ctrl+Shift+A` (Cmd+Shift+A) | Show Activity Ledger | Extension |
| `Ctrl+Shift+P` | Show Policy Editor | Extension |

NOTE: Keyboard shortcuts configurable in `package.json` `contributes.keybindings`, user can override.

---

### Screen Reader Support

- All Quick Pick items have descriptive labels and details
- Status bar items include tooltips with full context
- Dialog titles clearly state purpose
- Error messages include actionable suggestions
- Progress notifications announce current step clearly
- Table views (Activity Ledger) support navigation with arrow keys

---

### Theme Compatibility

- No hardcoded colors; use VS Code theme tokens
- Use `vscode.ThemeColor` for badges and indicators
- Respect user's accent color setting
- Dark/light mode compatible via VS Code defaults

---

### Internationalization (Future)

- Not implemented in MVP
- Future extension: Extract all strings to VS Code's `package.nls.json` format
- Support for localization via marketplace language packs

---

## Error Handling UI Pattern

### Error Recovery Flow

```
Error Occurs
    ↓
Show Error Notification with [Retry] and button
    ↓
User clicks [Details] → Open Error Output Channel
    ↓
User clicks [Retry] → Re-execute with progress
    ↓
If Retry Fails → Show detailed error with [Open Documentation]
```

### Error Log Output Channel

```typescript
const errorChannel = vscode.window.createOutputChannel(
  'Claude Switcher Errors',
  { log: true }  // Log to file automatically
);

errorChannel.appendLine(`[${timestamp}] ERROR: ${errorCode}`);
errorChannel.appendLine(`Message: ${errorMessage}`);
errorChannel.appendLine(`Details: ${JSON.stringify(errorDetails)}`);
errorChannel.show();
```

---

## Future UI Extensions

Not in MVP, may be added later:

- **Tree View**: Hierarchical organization of profiles/templates
- **Webview**: Profile creation/editing in rich HTML form
- **Live Preview**: Profile status indicator updates in real-time
- **Collision Detection UI**: Visual diff of conflicting changes
- **Advanced Metrics**: Token usage, cost tracking (optional opt-in)
- **Integration Dashboard**: Third-party integrations (Slack notifications, etc.)

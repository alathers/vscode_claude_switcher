<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Bump rationale: Initial ratification; every placeholder replaced with concrete governance.

Principles defined (template slot → title):
  - PRINCIPLE_1 → I. Native VS Code Integration
  - PRINCIPLE_2 → II. Safe, Reversible Switching
  - PRINCIPLE_3 → III. Secrets & Privacy
  - PRINCIPLE_4 → IV. Tested Behavior
  - PRINCIPLE_5 → V. Lightweight & Simple

Added sections:
  - Technical Constraints (template SECTION_2)
  - Development Workflow & Quality Gates (template SECTION_3)
  - Governance (filled)

Removed sections: none

Dependent templates (read the constitution at runtime; not modified by this command):
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate derives from
     Principles I–V and the Quality Gates; "Complexity Tracking" records justified deviations.
  ✅ .specify/templates/spec-template.md — no constitution-specific fields required.
  ✅ .specify/templates/tasks-template.md — test tasks align with Principle IV.

Deferred TODOs: none. Distribution channel (local VSIX vs. Marketplace) is intentionally
undecided; the Marketplace Gate in Technical Constraints activates by amendment when decided.

NOTE: This report is review scratch material. Remove it before committing.
-->

# vscode_claude_switcher Constitution

## Core Principles

### I. Native VS Code Integration

- The extension MUST use only stable, public VS Code extension APIs. Proposed or private APIs
  MUST NOT be used.
- All user-facing features MUST be reachable through declared contribution points (commands,
  configuration, menus, status bar items, or views) registered in `package.json`. Every command
  MUST be discoverable in the Command Palette.
- Extension-owned settings MUST be read and written through `vscode.workspace.getConfiguration`
  and MUST respect the user vs. workspace scope the user chose.
- Reads and writes to files outside VS Code's own settings (for example, Claude configuration
  files) MUST go through a single, dedicated adapter module, so external formats are isolated
  from extension logic.

**Rationale**: Stable APIs and declared contribution points keep the extension working across
VS Code releases and make its behavior predictable to users. Isolating external file formats
contains the blast radius when those formats change.

### II. Safe, Reversible Switching

- A switch operation MUST be atomic: it either fully applies or leaves the prior state untouched.
  File writes MUST use write-to-temp-then-rename (or an equivalent atomic mechanism).
- Target state MUST be validated before it is applied. Invalid or unreadable state MUST abort the
  switch with an actionable error message, and nothing may be left partially written.
- The previously active state MUST be recoverable after every switch (for example, via a
  backup or a "switch back" command).
- The extension MUST NOT delete or overwrite user-authored configuration it did not create
  without explicit user confirmation.
- The currently active selection MUST be visible to the user at all times while the extension is
  active (for example, in a status bar item).

**Rationale**: The extension's core job is mutating configuration the user depends on. A
half-applied or irreversible switch can break the user's Claude setup, which is worse than not
switching at all.

### III. Secrets & Privacy

- Any credential, token, or API key MUST be stored only via `vscode.ExtensionContext.secrets`
  (SecretStorage). Secrets MUST NOT be written to settings, workspace files, logs, or globalState.
- Secrets and full configuration payloads MUST NOT appear in log output, error messages, or
  notifications. Log identifiers or redacted forms instead.
- The extension MUST NOT collect telemetry or make network requests unless a specified feature
  requires it. Any such feature MUST honor `vscode.env.isTelemetryEnabled` and be documented in
  the README.

**Rationale**: A tool that manages Claude configuration may handle account credentials. Leaking
them through logs or synced settings is the highest-impact failure this project can have.

### IV. Tested Behavior

- Every feature MUST ship with automated tests that cover its acceptance scenarios from the spec.
- Logic that does not need the extension host (parsing, validation, state transitions) MUST live
  in modules that do not import `vscode`, and MUST be covered by fast unit tests.
- Behavior that depends on the extension host (command registration, configuration updates,
  status bar state) MUST be covered by integration tests run in a VS Code test instance.
- Every bug fix MUST include a regression test that fails without the fix.
- Test-first (Red-Green-Refactor) is the preferred workflow. It is encouraged but not enforced
  per commit; the merge gate is that tests exist and pass.

**Rationale**: Switching logic has many edge cases (missing files, malformed config, concurrent
windows). Separating pure logic from host-dependent code keeps most tests fast while still
verifying real VS Code behavior.

### V. Lightweight & Simple

- Activation MUST use specific activation events. The `*` activation event MUST NOT be used,
  and `onStartupFinished` requires a justification recorded in the plan.
- Runtime dependencies MUST be kept minimal. Each new runtime dependency MUST be justified in
  the feature plan when the same result is achievable with Node.js or VS Code built-ins.
- Features MUST be built for current, specified needs (YAGNI). Speculative abstraction and
  configuration knobs without a spec'd use case MUST NOT be added.

**Rationale**: Extensions share the extension host with everything else the user runs. A small
switcher has no reason to slow editor startup or carry a heavy dependency tree.

## Technical Constraints

- **Language**: TypeScript with `strict` compiler mode enabled. `any` requires an inline comment
  justifying it.
- **Engine compatibility**: `package.json` MUST declare a minimum `engines.vscode` version, and
  only APIs available at that version may be used.
- **Platform**: The extension MUST work on macOS. Path handling MUST be platform-agnostic
  (`path`, `os.homedir()`, `vscode.Uri`). Hard-coded separators and home-directory paths are
  prohibited so that Windows and Linux support is not foreclosed.
- **Packaging**: The extension MUST be packageable as a VSIX with `@vscode/vsce`. Packaged
  output MUST exclude tests, development-only source maps, and other unneeded files (via
  `.vscodeignore` or a bundler).
- **Versioning**: `package.json` `version` MUST follow semantic versioning from the first
  release, and user-visible changes MUST be recorded in `CHANGELOG.md`.
- **Marketplace Gate** (inactive until distribution is decided): before any public Marketplace
  release, a constitution amendment MUST activate this gate and add the release requirements
  (at minimum: publisher identity, icon and README listing assets, a verified Windows and Linux
  pass, and a documented backward-compatibility policy for settings).

## Development Workflow & Quality Gates

- Features follow the Spec Kit flow: `/speckit-specify` → `/speckit-clarify` (as needed) →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Each feature is developed on its
  own numbered feature branch.
- Every plan MUST complete the Constitution Check against Principles I–V and Technical
  Constraints before research begins, and re-check it after design. Deviations MUST be recorded
  and justified in the plan's Complexity Tracking table, or the design MUST change.
- Before a change merges to `main`, all of the following MUST pass:
  1. Type check (`tsc --noEmit`) with zero errors.
  2. Linting with zero errors.
  3. All unit and integration tests.
  4. A successful VSIX package build.
- Changes that alter a setting's name, type, or meaning, or the on-disk format the extension
  writes, MUST include migration handling for existing users' state and MUST be noted in
  `CHANGELOG.md`.

## Governance

- This constitution supersedes conflicting practices, conventions, and guidance in this
  repository. Where runtime guidance (README, CLAUDE.md) conflicts with it, the constitution wins
  and the guidance MUST be corrected.
- **Amendment procedure**: Amendments are made via `/speckit-constitution`. Each amendment MUST
  state its rationale, update the version and Last Amended date, and be committed as its own
  change. Amendments that tighten rules MUST include a note on how existing code is brought into
  compliance (immediately or with a tracked follow-up).
- **Versioning policy**: The constitution uses semantic versioning.
  - MAJOR: a principle or gate is removed or redefined in a backward-incompatible way.
  - MINOR: a principle or section is added, or guidance is materially expanded.
  - PATCH: clarifications, wording, and typo fixes with no change in meaning.
- **Compliance review**: Compliance is checked at three points: the plan's Constitution Check,
  code review before merge, and the Quality Gates above. Reviewers MUST reject changes that
  violate a MUST rule without a recorded justification in Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16

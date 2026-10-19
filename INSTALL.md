# Installation Guide

This guide shows you how to install the **Claude Switcher** extension for VS Code on your operating system.

## Quick Start

### Option 1: Install from VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Claude Switcher"
4. Click **Install**

---

## Installation by Operating System

### macOS

#### Method 1: Using VS Code Marketplace

1. Open VS Code
2. Press `Cmd+Shift+X` to open Extensions view
3. Search for "Claude Switcher - Model Profile Orchestrator"
4. Click **Install**
5. Reload VS Code when prompted

#### Method 2: Install from .vsix Package

1. Download the latest `vscode-claude-switcher-*.vsix` file from the [Releases](../../releases) page
2. Open VS Code
3. Open the **Extensions** view (`Cmd+Shift+X`)
4. Click the **...** menu in the top-right corner
5. Select **Install from VSIX...**
6. Navigate to and select the downloaded `.vsix` file
7. Reload VS Code when prompted

#### Method 3: Install via Command Line

1. Download the latest `.vsix` package
2. Open Terminal
3. Navigate to the directory containing `.vsix` file
4. Run:
   ```bash
   code --install-extension vscode-claude-switcher-*.vsix --force
   ```

---

### Windows

#### Method 1: Using VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions view
3. Search for "Claude Switcher - Model Profile Orchestrator"
4. Click **Install**
5. Reload VS Code when prompted

#### Method 2: Install from .vsix Package

1. Download the latest `vscode-claude-switcher-*.vsix` file from the [Releases](../../releases) page
2. Open VS Code
3. Open the **Extensions** view (`Ctrl+Shift+X`)
4. Click the **...** menu in the top-right corner
5. Select **Install from VSIX...**
6. Navigate to and select the downloaded `.vsix` file
7. Reload VS Code when prompted

#### Method 3: Install via Command Line (PowerShell or CMD)

1. Download the latest `.vsix` package
2. Open PowerShell or Command Prompt
3. Navigate to the directory containing `.vsix` file
4. Run:
   ```powershell
   code --install-extension vscode-claude-switcher-*.vsix --force
   ```

---

### Linux (Ubuntu, Debian, Fedora, Arch, etc.)

#### Method 1: Using VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions view
3. Search for "Claude Switcher - Model Profile Orchestrator"
4. Click **Install**
5. Reload VS Code when prompted

#### Method 2: Install from .vsix Package

1. Download the latest `vscode-claude-switcher-*.vsix` file from the [Releases](../../releases) page
2. Open VS Code
3. Open the **Extensions** view (`Ctrl+Shift+X`)
4. Click the **...** menu in the top-right corner
5. Select **Install from VSIX...**
6. Navigate to and select the downloaded `.vsix` file
7. Reload VS Code when prompted

#### Method 3: Install via Command Line

1. Download the latest `.vsix` package
2. Open Terminal
3. Navigate to the directory containing `.vsix` file
4. Run:
   ```bash
   code --install-extension vscode-claude-switcher-*.vsix --force
   ```

---

## Development Installation

If you are developing the extension or want to run from source:

### Prerequisites

- **Node.js**: Install from [nodejs.org](https://nodejs.org/) (v18 or later recommended)
- **VS Code**: Install from [code.visualstudio.com](https://code.visualstudio.com/)

### Steps (All Operating Systems)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd vscode_claude_switcher
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run compile
   ```

4. **Install in development mode:**

   **Option A: Using the VS Code debugger**
   - Open the project in VS Code
   - Press `F5` to launch a new VS Code instance with the extension installed

   **Option B: Install the .vsix package**
   ```bash
   npm run package
   code --install-extension vscode-claude-switcher-0.1.0.vsix
   ```

---

## Verification

After installation, verify the extension is active:

1. Open VS Code
2. Open the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Claude Switcher"
4. Confirm it appears as **Enabled**

You should also see the **Claude Switcher** commands available:
- Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
- Type `Claude Switcher`
- You should see commands like:
  - `Claude Switcher: Select Workspace Profile`
  - `Claude Switcher: Create New Profile`
  - `Claude Switcher: Show Policy Editor`
  - etc.

---

## Troubleshooting

### "Cannot activate extension" error

1. Ensure you have VS Code version 1.90.0 or later
2. Reload VS Code (`Developer: Reload Window` from Command Palette)
3. Check the **Output** panel for error messages

### Extension not appearing after installation

1. Reload VS Code
2. Check if the extension is disabled in the Extensions view
3. Click **Enable** if shown

### Permission denied on Linux/macOS

If you get permission errors running `--install-extension`:

```bash
sudo code --install-extension vscode-claude-switcher-*.vsix
```

Or install using the VS Code UI (Methods 1 or 2 above).

### VS Code cannot be found on command line

If `code` command is not recognized:

**macOS:**
1. Open VS Code
2. Press `Cmd+Shift+P`
3. Type "shell command"
4. Select **Shell Command: Install 'code' command in PATH**

**Windows:**
1. Reinstall VS Code and ensure "Add to PATH" is checked

**Linux:**
Ensure the VS Code binary is in your PATH (typically installed in `/usr/bin/code` or similar).

---

## System Requirements

- **VS Code**: 1.90.0 or later
- **Node.js**: 18.0 or later (for development only)
- **Operating Systems:**
  - macOS 10.15+ (Catalina or later)
  - Windows 10 or later
  - Linux主流发行版 (Ubuntu 18.04+, Debian 10+, Fedora 29+, Arch Linux, etc.)

---

## Post-Installation Setup

After installation, you may want to:

1. **Configure default profile:** In VS Code settings, search for `claudeSwitcher.defaultProfileId`
2. **Set log level:** In VS Code settings, search for `claudeSwitcher.logLevel` (options: error, warn, info, debug)
3. **Create your first profile:** Use `Claude Switcher: Create New Profile` from the Command Palette

For detailed configuration and usage, see the [README](README.md).

---

## Support

For issues, questions, or feature requests, please open an issue in the [GitHub repository](../../issues).

---

## Uninstallation

### From VS Code UI

1. Open Extensions view
2. Find "Claude Switcher"
3. Click the gear icon (⚙️) next to the extension
4. Select **Uninstall**

### From Command Line

```bash
code --uninstall-extension claude-switcher.vscode-claude-switcher
```

### On Windows with VS Code Insiders

```bash
code-insiders --uninstall-extension claude-switcher.vscode-claude-switcher
```

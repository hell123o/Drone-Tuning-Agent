# Electron Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce Windows `Setup.exe` and `Portable.exe` builds for Drone Tuning Agent.

**Architecture:** Keep the existing Electron wrapper as the desktop shell. Add a root packaging script that orchestrates Python CLI build, Next.js standalone build, and Electron Builder output generation.

**Tech Stack:** PowerShell, Python 3.11+, PyInstaller, Next.js 16 standalone output, Electron, electron-builder NSIS and portable targets.

## Global Constraints

- Produce both an installer and a portable executable for Windows.
- Leave final artifacts in `dist-desktop/`.
- Bundle `webui/.next/standalone`, `webui/.next/static`, `webui/public`, `dist/drone-agent-cli.exe`, and `config/`.
- Do not change the diagnostic algorithm, hardware profiles, LLM behavior, report generation, or Web UI workflow.
- Fail early when required build inputs or tools are missing.

---

## File Structure

- Create `scripts/package-windows.ps1`: root-level repeatable packaging command.
- Modify `.gitignore`: ignore Electron output and PyInstaller build artifacts.
- Modify `desktop/package.json`: keep existing Electron Builder config and adjust only if verification shows the current metadata prevents the requested artifacts.
- Use existing `desktop/main.js`: runtime architecture already matches the design.
- Use existing `desktop/afterPack.js`: resource copy checks already fail when required build inputs are missing.

### Task 1: Add Windows Packaging Script

**Files:**
- Create: `scripts/package-windows.ps1`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `drone-agent-cli.spec`, `webui/package.json`, `desktop/package.json`
- Produces: a command `powershell -ExecutionPolicy Bypass -File scripts/package-windows.ps1`

- [ ] **Step 1: Write the failing verification command**

Run:

```powershell
Test-Path scripts\package-windows.ps1
```

Expected: `False`

- [ ] **Step 2: Create `scripts/package-windows.ps1`**

Write this file:

```powershell
$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$DistCli = Join-Path $Root "dist\drone-agent-cli.exe"
$WebStandalone = Join-Path $Root "webui\.next\standalone"
$WebStatic = Join-Path $Root "webui\.next\static"
$DesktopNodeModules = Join-Path $Root "desktop\node_modules"
$OutputDir = Join-Path $Root "dist-desktop"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [scriptblock] $Command
    )

    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Command
}

function Assert-Path {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,
        [Parameter(Mandatory = $true)]
        [string] $Message
    )

    if (-not (Test-Path $Path)) {
        throw "$Message`nMissing path: $Path"
    }
}

Push-Location $Root
try {
    Invoke-Step "Installing Python package and PyInstaller if needed" {
        python -m pip install -e .
        python -m pip install pyinstaller
    }

    Invoke-Step "Building Python CLI" {
        python -m PyInstaller --clean --noconfirm drone-agent-cli.spec
        Assert-Path $DistCli "PyInstaller did not produce the diagnostic CLI."
    }

    Invoke-Step "Installing Web UI dependencies" {
        Push-Location (Join-Path $Root "webui")
        try {
            npm install
        } finally {
            Pop-Location
        }
    }

    Invoke-Step "Building Web UI standalone output" {
        Push-Location (Join-Path $Root "webui")
        try {
            npm run build
        } finally {
            Pop-Location
        }
        Assert-Path $WebStandalone "Next.js did not produce standalone output."
        Assert-Path $WebStatic "Next.js did not produce static output."
    }

    Invoke-Step "Installing Electron dependencies" {
        Push-Location (Join-Path $Root "desktop")
        try {
            npm install
        } finally {
            Pop-Location
        }
        Assert-Path $DesktopNodeModules "Electron dependencies were not installed."
    }

    Invoke-Step "Building Electron installer and portable app" {
        Push-Location (Join-Path $Root "desktop")
        try {
            npm run dist
        } finally {
            Pop-Location
        }
    }

    Invoke-Step "Verifying Electron artifacts" {
        Assert-Path $OutputDir "Electron Builder did not create the output directory."
        $setup = Get-ChildItem $OutputDir -Filter "*Setup.exe" -File -Recurse | Select-Object -First 1
        $portable = Get-ChildItem $OutputDir -Filter "*Portable.exe" -File -Recurse | Select-Object -First 1
        if (-not $setup) {
            throw "Setup.exe artifact was not found under $OutputDir."
        }
        if (-not $portable) {
            throw "Portable.exe artifact was not found under $OutputDir."
        }
        Write-Host "Installer: $($setup.FullName)"
        Write-Host "Portable:  $($portable.FullName)"
    }
} finally {
    Pop-Location
}
```

- [ ] **Step 3: Ignore packaging outputs**

Add these lines to `.gitignore`:

```gitignore

# Packaging outputs
build/
dist/
dist-desktop/
desktop/node_modules/
desktop/dist/
```

- [ ] **Step 4: Verify script exists**

Run:

```powershell
Test-Path scripts\package-windows.ps1
```

Expected: `True`

- [ ] **Step 5: Commit**

```powershell
git add scripts\package-windows.ps1 .gitignore
git commit -m "Add Windows packaging script"
```

### Task 2: Run Packaging Pipeline

**Files:**
- Uses: `scripts/package-windows.ps1`
- Uses: `desktop/package.json`
- Uses: `desktop/afterPack.js`

**Interfaces:**
- Consumes: packaging command from Task 1
- Produces: `dist-desktop/*Setup.exe` and `dist-desktop/*Portable.exe`

- [ ] **Step 1: Run full packaging command**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package-windows.ps1
```

Expected: command exits with code `0` and prints both artifact paths.

- [ ] **Step 2: If Electron dependencies are missing, rerun script after install**

Run:

```powershell
Test-Path desktop\node_modules
```

Expected after the script: `True`

- [ ] **Step 3: If Electron Builder reports missing inputs, inspect expected paths**

Run:

```powershell
Test-Path dist\drone-agent-cli.exe
Test-Path webui\.next\standalone
Test-Path webui\.next\static
Test-Path config
```

Expected:

```text
True
True
True
True
```

- [ ] **Step 4: Verify final artifacts**

Run:

```powershell
Get-ChildItem dist-desktop -Recurse -File |
  Where-Object { $_.Name -like "*Setup.exe" -or $_.Name -like "*Portable.exe" } |
  Select-Object FullName, Length
```

Expected: two rows, one `Setup.exe` and one `Portable.exe`, both with non-zero length.

### Task 3: Smoke Test Packaged Inputs

**Files:**
- Uses: `dist/drone-agent-cli.exe`
- Uses: `dist-desktop/`

**Interfaces:**
- Consumes: artifacts from Task 2
- Produces: verification evidence that bundled inputs exist and Python CLI runs

- [ ] **Step 1: Run Python CLI smoke check**

Run:

```powershell
.\dist\drone-agent-cli.exe --list-profiles
```

Expected: command exits with code `0` and prints available hardware profile ids.

- [ ] **Step 2: Verify unpacked resources from Electron Builder directory build if present**

Run:

```powershell
$resourceRoots = Get-ChildItem dist-desktop -Directory -Recurse |
  Where-Object { Test-Path (Join-Path $_.FullName "resources") }
$resourceRoots | Select-Object FullName
```

Expected: at least one app output directory is listed if Electron Builder kept an unpacked directory for the build.

- [ ] **Step 3: Verify resource contents if an unpacked app directory exists**

Run:

```powershell
$appDir = Get-ChildItem dist-desktop -Directory -Recurse |
  Where-Object { Test-Path (Join-Path $_.FullName "resources") } |
  Select-Object -First 1
if ($appDir) {
  $resources = Join-Path $appDir.FullName "resources"
  Test-Path (Join-Path $resources "webui-standalone\server.js")
  Test-Path (Join-Path $resources "webui-standalone\.next\static")
  Test-Path (Join-Path $resources "app-core\drone-agent-cli.exe")
  Test-Path (Join-Path $resources "app-core\config")
}
```

Expected when `$appDir` exists:

```text
True
True
True
True
```

### Task 4: Final Verification And Summary

**Files:**
- Uses: `dist-desktop/`
- Uses: `git status`

**Interfaces:**
- Consumes: outputs from Tasks 1-3
- Produces: final user-facing artifact paths and verification summary

- [ ] **Step 1: Run final artifact listing**

Run:

```powershell
Get-ChildItem dist-desktop -Recurse -File |
  Where-Object { $_.Name -like "*Setup.exe" -or $_.Name -like "*Portable.exe" } |
  Select-Object FullName, Length, LastWriteTime
```

Expected: two current artifacts.

- [ ] **Step 2: Check git status**

Run:

```powershell
git status --short
```

Expected: only intentional source changes are tracked or staged. Ignored build outputs do not appear.

- [ ] **Step 3: Report final paths**

Final response must include:

- The installer path.
- The portable path.
- The packaging command users can rerun.
- Any verification command that could not be completed.

## Self-Review

- Spec coverage: Tasks 1 and 2 implement the repeatable packaging chain. Task 3 covers Python CLI and resource smoke checks. Task 4 covers final artifact reporting.
- Placeholder scan: no `TBD`, `TODO`, `implement later`, or unspecified test steps remain.
- Type consistency: the script path, artifact names, and expected directories match the design document and existing Electron Builder configuration.

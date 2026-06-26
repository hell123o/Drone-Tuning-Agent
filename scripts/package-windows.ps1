$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPython = Join-Path $Root ".venv-win\Scripts\python.exe"
$DistCli = Join-Path $Root "dist\drone-agent-cli.exe"
$WebStandalone = Join-Path $Root "webui\.next\standalone"
$WebStatic = Join-Path $Root "webui\.next\static"
$DesktopNodeModules = Join-Path $Root "desktop\node_modules"
$OutputDir = Join-Path $Root "dist-desktop"
$PackageStartedAt = Get-Date

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

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock] $Command,
        [Parameter(Mandatory = $true)]
        [string] $Message
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Message failed with exit code $LASTEXITCODE."
    }
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
    Invoke-Step "Preparing isolated Python build environment" {
        if (-not (Test-Path $VenvPython)) {
            Invoke-Native { python -m venv (Join-Path $Root ".venv-win") } "python -m venv"
        }
        Assert-Path $VenvPython "Python virtual environment was not created."
        Invoke-Native { & $VenvPython -m pip install --upgrade pip } "pip install --upgrade pip"
        Invoke-Native { & $VenvPython -m pip install -e . } "pip install -e ."
        Invoke-Native { & $VenvPython -m pip install pyinstaller } "pip install pyinstaller"
    }

    Invoke-Step "Building Python CLI" {
        Invoke-Native { & $VenvPython -m PyInstaller --clean --noconfirm drone-agent-cli.spec } "PyInstaller"
        Assert-Path $DistCli "PyInstaller did not produce the diagnostic CLI."
    }

    Invoke-Step "Installing Web UI dependencies" {
        Push-Location (Join-Path $Root "webui")
        try {
            Invoke-Native { npm install } "npm install (webui)"
        } finally {
            Pop-Location
        }
    }

    Invoke-Step "Building Web UI standalone output" {
        Push-Location (Join-Path $Root "webui")
        try {
            Invoke-Native { npm run build } "npm run build (webui)"
        } finally {
            Pop-Location
        }
        Assert-Path $WebStandalone "Next.js did not produce standalone output."
        Assert-Path $WebStatic "Next.js did not produce static output."
    }

    Invoke-Step "Installing Electron dependencies" {
        Push-Location (Join-Path $Root "desktop")
        try {
            Invoke-Native { npm install } "npm install (desktop)"
        } finally {
            Pop-Location
        }
        Assert-Path $DesktopNodeModules "Electron dependencies were not installed."
    }

    Invoke-Step "Building Electron installer and portable app" {
        if (Test-Path $OutputDir) {
            Get-ChildItem $OutputDir -Filter "*.exe" -File | Remove-Item -Force
        }
        Push-Location (Join-Path $Root "desktop")
        try {
            Invoke-Native { npm run dist } "npm run dist (desktop)"
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
        if ($setup.LastWriteTime -lt $PackageStartedAt) {
            throw "Setup.exe artifact is stale: $($setup.FullName)"
        }
        if ($portable.LastWriteTime -lt $PackageStartedAt) {
            throw "Portable.exe artifact is stale: $($portable.FullName)"
        }
        Write-Host "Installer: $($setup.FullName)"
        Write-Host "Portable:  $($portable.FullName)"
    }
} finally {
    Pop-Location
}

$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPython = Join-Path $Root ".venv-win\Scripts\python.exe"
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
    Invoke-Step "Preparing isolated Python build environment" {
        if (-not (Test-Path $VenvPython)) {
            python -m venv (Join-Path $Root ".venv-win")
        }
        Assert-Path $VenvPython "Python virtual environment was not created."
        & $VenvPython -m pip install --upgrade pip
        & $VenvPython -m pip install -e .
        & $VenvPython -m pip install pyinstaller
    }

    Invoke-Step "Building Python CLI" {
        & $VenvPython -m PyInstaller --clean --noconfirm drone-agent-cli.spec
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

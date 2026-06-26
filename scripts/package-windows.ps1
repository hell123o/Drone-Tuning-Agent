$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPython = Join-Path $Root ".venv-win\Scripts\python.exe"
$DistCli = Join-Path $Root "dist\drone-agent-cli.exe"
$WebStandalone = Join-Path $Root "webui\.next\standalone"
$WebStatic = Join-Path $Root "webui\.next\static"
$DesktopNodeModules = Join-Path $Root "desktop\node_modules"
$OutputDir = Join-Path $Root "dist-desktop"
$WinUnpackedDir = Join-Path $OutputDir "win-unpacked"
$WinResourcesDir = Join-Path $WinUnpackedDir "resources"
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

function Update-WinUnpackedResources {
    Assert-Path $WinUnpackedDir "Existing win-unpacked directory is required for the offline packaging fallback."

    $copies = @(
        @{
            From = Join-Path $Root "desktop\main.js"
            To = Join-Path $WinResourcesDir "app\main.js"
        },
        @{
            From = Join-Path $Root "desktop\package.json"
            To = Join-Path $WinResourcesDir "app\package.json"
        },
        @{
            From = $WebStandalone
            To = Join-Path $WinResourcesDir "webui-standalone"
        },
        @{
            From = $WebStatic
            To = Join-Path $WinResourcesDir "webui-standalone\.next\static"
        },
        @{
            From = Join-Path $Root "webui\public"
            To = Join-Path $WinResourcesDir "webui-standalone\public"
        },
        @{
            From = $DistCli
            To = Join-Path $WinResourcesDir "app-core\drone-agent-cli.exe"
        },
        @{
            From = Join-Path $Root "config"
            To = Join-Path $WinResourcesDir "app-core\config"
        }
    )

    foreach ($item in $copies) {
        Assert-Path $item.From "Prepackaged input is missing."
        if (Test-Path $item.To) {
            Remove-Item $item.To -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $item.To -Parent) | Out-Null
        Copy-Item $item.From $item.To -Recurse -Force
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
            npm run dist
            if ($LASTEXITCODE -ne 0) {
                Write-Host "npm run dist failed with exit code $LASTEXITCODE; retrying from existing win-unpacked output." -ForegroundColor Yellow
                Update-WinUnpackedResources
                Invoke-Native { npx electron-builder --win nsis portable --prepackaged $WinUnpackedDir } "electron-builder --prepackaged"
            }
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

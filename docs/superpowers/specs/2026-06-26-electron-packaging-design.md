# Electron Packaging Design

Date: 2026-06-26

## Goal

Package the existing Drone Tuning Agent project as a Windows desktop application
that can be shared with other users. The build must produce both an installer and
a portable executable:

- `Setup.exe` installer via NSIS
- `Portable.exe` green/portable build

## Current Project Shape

The repository already contains the three pieces needed for this packaging flow:

- Python diagnostic CLI: `main.py`, `agent.py`, `tools/`, `config/`, `prompts/`
- Next.js Web UI: `webui/`
- Electron wrapper: `desktop/`

The existing Electron wrapper starts a local Next.js server and opens it in a
desktop window. In packaged mode, it expects the Python CLI and configuration
files to be bundled as Electron resources, then copied into the app user data
runtime directory before the web server starts.

## Recommended Approach

Use the existing `desktop` Electron app and `electron-builder` configuration as
the packaging foundation. Add or fix only the build orchestration needed to make
the packaging repeatable from a clean checkout.

The build pipeline should run in this order:

1. Build the Python CLI with PyInstaller from `drone-agent-cli.spec`.
2. Build the Next.js app with standalone output enabled.
3. Build the Electron desktop app with `electron-builder --win nsis portable`.

This approach keeps the desktop app close to the current web architecture and
avoids rewriting the UI or Python diagnostic layer.

## Desktop Runtime Architecture

In development mode:

- Electron starts `npm run dev` inside `webui/`.
- The app opens `http://127.0.0.1:<port>`.
- The web API routes call the local Python entry point or virtual environment.

In packaged mode:

- Electron starts the bundled Next standalone `server.js` using Electron as the
  Node runtime with `ELECTRON_RUN_AS_NODE=1`.
- Electron sets `DRONE_AGENT_PROJECT_ROOT` to a writable runtime directory under
  Electron `userData`.
- Electron copies the bundled Python CLI to that runtime directory as
  `drone-agent-cli.exe`.
- Electron copies bundled `config/` files to the same runtime directory when
  possible.
- Web API routes find `drone-agent-cli.exe` through `DRONE_AGENT_PROJECT_ROOT`
  and spawn it for diagnosis jobs.

## Bundled Resources

The Electron package must include:

- `webui/.next/standalone` as `resources/webui-standalone`
- `webui/.next/static` as `resources/webui-standalone/.next/static`
- `webui/public` as `resources/webui-standalone/public`
- `dist/drone-agent-cli.exe` as `resources/app-core/drone-agent-cli.exe`
- `config/` as `resources/app-core/config`

The PyInstaller spec already embeds `config/` and `prompts/` inside the CLI, so
the external `config/` copy is useful for the Web UI profile browser and as a
runtime-friendly resource.

## Build Script Design

Add a root-level packaging command that performs the full Windows build:

1. Install or reuse Python and Node dependencies already present in the
   workspace.
2. Run PyInstaller with `drone-agent-cli.spec`.
3. Run `npm run build` inside `webui/`.
4. Run `npm run dist` inside `desktop/`.

The script should fail fast if a required tool is missing and should leave final
artifacts in `dist-desktop/`, matching the existing Electron builder output
directory.

## Error Handling

Packaging should fail early when required inputs are missing:

- Missing PyInstaller output: `dist/drone-agent-cli.exe`
- Missing Next standalone output: `webui/.next/standalone`
- Missing Next static output: `webui/.next/static`
- Missing Electron dependencies under `desktop/`

At runtime, Electron should continue to show a startup error dialog if the local
web server cannot start, and the server logs should remain in the writable
runtime directory for troubleshooting.

## Testing And Verification

Verification should include:

- Python CLI smoke check, such as listing hardware profiles from the packaged
  CLI.
- Next.js production build.
- Electron builder producing both NSIS and portable artifacts.
- A quick packaged-app structure check confirming the bundled resources exist.

If launching the packaged desktop app is practical in the current environment,
open it once to confirm the window starts and the local server responds.

## Scope Boundaries

This packaging work does not change the diagnostic algorithm, hardware profiles,
LLM behavior, report generation, or Web UI workflow. Any encoding cleanup in
existing Chinese UI text should be handled only if it blocks build or packaged
runtime usability.

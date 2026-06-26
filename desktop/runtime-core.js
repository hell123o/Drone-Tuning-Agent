const path = require('node:path');

function writeWarning({ fsImpl, projectRoot, warning }) {
  try {
    fsImpl.writeFileSync(
      path.join(projectRoot, 'config-copy-warning.log'),
      `${warning}\n`,
      'utf-8',
    );
  } catch {
    // Best effort only. Startup must continue so the web server can fall back
    // to the read-only bundled config.
  }
}

function ensurePackagedCore({ projectRoot, bundledCore, fsImpl }) {
  const warnings = [];
  const targetCli = path.join(projectRoot, 'drone-agent-cli.exe');
  const targetConfig = path.join(projectRoot, 'config');
  const targetRuns = path.join(projectRoot, 'webui_runs');
  fsImpl.mkdirSync(targetRuns, { recursive: true });

  const sourceCli = path.join(bundledCore, 'drone-agent-cli.exe');
  if (fsImpl.existsSync(sourceCli)) {
    try {
      fsImpl.copyFileSync(sourceCli, targetCli);
    } catch (error) {
      const warning = `Unable to copy bundled diagnostic CLI to runtime directory: ${targetCli}\n${error.message}`;
      warnings.push(warning);
      writeWarning({ fsImpl, projectRoot, warning });
    }
  }

  const sourceConfig = path.join(bundledCore, 'config');
  const targetManifest = path.join(targetConfig, 'hardware-profiles', 'manifest.json');
  if (fsImpl.existsSync(sourceConfig) && !fsImpl.existsSync(targetManifest)) {
    try {
      fsImpl.mkdirSync(path.dirname(targetConfig), { recursive: true });
      fsImpl.cpSync(sourceConfig, targetConfig, { recursive: true, force: true });
    } catch (error) {
      const warning = `Unable to copy bundled config to runtime directory: ${targetConfig}\n${error.message}`;
      warnings.push(warning);
      writeWarning({ fsImpl, projectRoot, warning });
    }
  }

  return { ok: true, warnings };
}

module.exports = { ensurePackagedCore };

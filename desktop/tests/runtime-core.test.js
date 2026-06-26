const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { ensurePackagedCore } = require('../runtime-core');

test('ensurePackagedCore does not throw when runtime config copy fails', () => {
  const projectRoot = 'C:\\Users\\test\\AppData\\Roaming\\app\\runtime';
  const bundledCore = 'C:\\Temp\\portable\\resources\\app-core';
  const warnings = [];
  const fsImpl = {
    existsSync(target) {
      if (target === path.join(bundledCore, 'drone-agent-cli.exe')) return true;
      if (target === path.join(bundledCore, 'config')) return true;
      if (target === path.join(projectRoot, 'config', 'hardware-profiles', 'manifest.json')) return false;
      return false;
    },
    mkdirSync() {},
    copyFileSync() {},
    cpSync() {
      const error = new Error('simulated EIO');
      error.code = 'EIO';
      throw error;
    },
    writeFileSync(_target, content) {
      warnings.push(String(content));
    },
  };

  const result = ensurePackagedCore({ projectRoot, bundledCore, fsImpl });

  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /config/i);
  assert.equal(warnings.length, 1);
});

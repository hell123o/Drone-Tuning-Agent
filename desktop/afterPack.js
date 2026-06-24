const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const projectRoot = path.resolve(__dirname, '..');
  const resourcesDir = path.join(context.appOutDir, 'resources');

  const copies = [
    {
      from: path.join(projectRoot, 'webui', '.next', 'standalone'),
      to: path.join(resourcesDir, 'webui-standalone'),
    },
    {
      from: path.join(projectRoot, 'webui', '.next', 'static'),
      to: path.join(resourcesDir, 'webui-standalone', '.next', 'static'),
    },
    {
      from: path.join(projectRoot, 'webui', 'public'),
      to: path.join(resourcesDir, 'webui-standalone', 'public'),
      optional: true,
    },
    {
      from: path.join(projectRoot, 'dist', 'drone-agent-cli.exe'),
      to: path.join(resourcesDir, 'app-core', 'drone-agent-cli.exe'),
    },
    {
      from: path.join(projectRoot, 'config'),
      to: path.join(resourcesDir, 'app-core', 'config'),
    },
  ];

  for (const item of copies) {
    if (!fs.existsSync(item.from)) {
      if (item.optional) continue;
      throw new Error(`Missing packaging input: ${item.from}`);
    }
    fs.rmSync(item.to, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(item.to), { recursive: true });
    fs.cpSync(item.from, item.to, { recursive: true });
  }
};

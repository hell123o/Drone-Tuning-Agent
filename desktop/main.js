const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

let serverProcess = null;
let mainWindow = null;

function isPackaged() {
  return app.isPackaged;
}

function getPort() {
  return Number(process.env.DRONE_AGENT_PORT || 3211);
}

function getProjectRoot() {
  if (!isPackaged()) {
    return path.resolve(__dirname, '..');
  }
  const userRoot = path.join(app.getPath('userData'), 'runtime');
  fs.mkdirSync(userRoot, { recursive: true });
  return userRoot;
}

function getServerCwd() {
  if (!isPackaged()) {
    return path.resolve(__dirname, '..', 'webui');
  }
  return path.join(process.resourcesPath, 'webui-standalone');
}

function getServerEntry() {
  if (!isPackaged()) {
    return null;
  }
  return path.join(process.resourcesPath, 'webui-standalone', 'server.js');
}

function ensurePackagedCore() {
  if (!isPackaged()) return;
  const projectRoot = getProjectRoot();
  const bundledCore = path.join(process.resourcesPath, 'app-core');
  const targetCli = path.join(projectRoot, 'drone-agent-cli.exe');
  const targetConfig = path.join(projectRoot, 'config');
  const targetRuns = path.join(projectRoot, 'webui_runs');
  fs.mkdirSync(targetRuns, { recursive: true });

  const sourceCli = path.join(bundledCore, 'drone-agent-cli.exe');
  if (fs.existsSync(sourceCli)) {
    try {
      fs.copyFileSync(sourceCli, targetCli);
    } catch (error) {
      throw new Error(`无法复制内置诊断程序到运行目录：${targetCli}\n${error.message}`);
    }
  }
  const sourceConfig = path.join(bundledCore, 'config');
  if (fs.existsSync(sourceConfig) && !fs.existsSync(path.join(targetConfig, 'hardware-profiles', 'manifest.json'))) {
    fs.mkdirSync(path.dirname(targetConfig), { recursive: true });
    fs.cpSync(sourceConfig, targetConfig, { recursive: true, force: true });
  }
}

function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Web service did not start on port ${port}`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
    };
    tryConnect();
  });
}

async function startServer() {
  const port = getPort();
  const projectRoot = getProjectRoot();
  ensurePackagedCore();

  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    DRONE_AGENT_PROJECT_ROOT: projectRoot,
    DRONE_AGENT_BUNDLED_CONFIG_ROOT: isPackaged() ? path.join(process.resourcesPath, 'app-core', 'config') : '',
  };

  if (isPackaged()) {
    const entry = getServerEntry();
    serverProcess = spawn(process.execPath, [entry], {
      cwd: getServerCwd(),
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: [
        'ignore',
        fs.openSync(path.join(projectRoot, 'desktop-server.out.log'), 'a'),
        fs.openSync(path.join(projectRoot, 'desktop-server.err.log'), 'a'),
      ],
      windowsHide: true,
    });
  } else {
    serverProcess = spawn('npm.cmd', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: getServerCwd(),
      env,
      stdio: 'ignore',
      windowsHide: true,
    });
  }

  if (serverProcess) {
    serverProcess.on('exit', (code) => {
      if (code !== 0 && mainWindow) {
        dialog.showErrorBox('Drone Tuning Agent', `Web service exited with code ${code}`);
      }
    });
  }

  await waitForPort(port);
  return `http://127.0.0.1:${port}`;
}

async function createWindow() {
  const url = await startServer();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'Drone Tuning Agent',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox('Drone Tuning Agent 启动失败', error.stack || error.message || String(error));
  app.quit();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const BlockchainUploader = require('./uploader');

let mainWindow;
let ffmpegProcess;
let watcher;
let isStreaming = false;
let uploader = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('renderer/simple.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopStreaming();
    app.quit();
  }
});

ipcMain.handle('start-streaming', async (event, config) => {
  if (isStreaming) {
    return { success: false, error: 'Already streaming' };
  }

  try {
    uploader = new BlockchainUploader(config);
    const connected = await uploader.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to blockchain');
    }

    const chunksDir = path.join(__dirname, 'chunks');
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir);
    }

    const oldChunks = fs.readdirSync(chunksDir);
    oldChunks.forEach(file => {
      fs.unlinkSync(path.join(chunksDir, file));
    });

    const ffmpegPath = path.join(__dirname, 'ffmpeg', 'ffmpeg.exe');

    const listDevices = spawn(ffmpegPath, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
    listDevices.stderr.on('data', (data) => {
      mainWindow.webContents.send('log-message', `Available devices: ${data.toString()}`);
    });
    await new Promise(resolve => listDevices.on('close', resolve));

    const ffmpegArgs = [
      '-f', 'dshow',
      '-rtbufsize', '100M',
      '-i', 'video=OBS Virtual Camera',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-pix_fmt', 'yuv420p',
      '-b:v', '500k',
      '-maxrate', '500k',
      '-bufsize', '1000k',
      '-g', '30',
      '-keyint_min', '1',
      '-sc_threshold', '0',
      '-flush_packets', '1',
      '-max_delay', '0',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'segment',
      '-segment_time', '1',
      '-reset_timestamps', '1',
      '-segment_format', 'mp4',
      path.join(chunksDir, 'chunk_%03d.mp4')
    ];

    ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    ffmpegProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('log-message', `FFmpeg: ${data.toString()}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      mainWindow.webContents.send('log-message', `FFmpeg: ${data.toString()}`);
    });

    ffmpegProcess.on('error', (error) => {
      mainWindow.webContents.send('error-message', `FFmpeg error: ${error.message}`);
      stopStreaming();
    });

    watcher = chokidar.watch(path.join(chunksDir, '*.mp4'), {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('add', async (filepath) => {
      mainWindow.webContents.send('new-chunk', filepath);
      try {
        const result = await uploader.uploadChunk(filepath);
        mainWindow.webContents.send('log-message',
          `✅ Uploaded ${result.filename} (${result.size} bytes) - TX: ${result.txHash}`);
      } catch (error) {
        mainWindow.webContents.send('error-message',
          `❌ Failed to upload ${error.filename}: ${error.error}`);
      }
    });

    isStreaming = true;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-streaming', async () => {
  stopStreaming();
  return { success: true };
});

function stopStreaming() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
  }
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  isStreaming = false;
}

ipcMain.handle('save-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { success: true, config };
    }
    return { success: false, error: 'No config found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
  return { success: true };
});

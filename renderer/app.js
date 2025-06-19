import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/dist/ethers.min.js";

// UI Elements
const startBtn = document.getElementById('startStream');
const stopBtn = document.getElementById('stopStream');
const saveConfigBtn = document.getElementById('saveConfig');
const loadConfigBtn = document.getElementById('loadConfig');
const statusEl = document.getElementById('status');
const consoleEl = document.getElementById('console');
const video = document.getElementById('video');

// Input fields
const rpcUrlInput = document.getElementById('rpcUrl');
const privateKeyInput = document.getElementById('privateKey');
const contractAddressInput = document.getElementById('contractAddress');

// Contract ABI
const ABI = [
  "function pushChunk(bytes calldata data) external",
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes)"
];

// State
let contract = null;
let wallet = null;
let mediaSource = null;
let sourceBuffer = null;
let lastViewerIndex = -1;
let viewerInterval = null;

// Initialize viewer
function initializeViewer() {
  mediaSource = new MediaSource();
  video.src = URL.createObjectURL(mediaSource);

  mediaSource.addEventListener('sourceopen', () => {
    const mime = 'video/mp2t; codecs="avc1.42E01E, mp4a.40.2"';
    sourceBuffer = mediaSource.addSourceBuffer(mime);
    startViewerPolling();
  });
}

// Poll for new chunks from blockchain
async function startViewerPolling() {
  if (viewerInterval) clearInterval(viewerInterval);
  
  viewerInterval = setInterval(async () => {
    if (!contract) return;
    
    try {
      const latestIndex = Number(await contract.getLatestIndex());
      
      if (latestIndex > 0 && latestIndex - 1 > lastViewerIndex) {
        const [, , data] = await contract.getChunk(latestIndex - 1);
        const buffer = ethers.getBytes(data);
        
        if (!sourceBuffer.updating && !video.error) {
          sourceBuffer.appendBuffer(new Uint8Array(buffer));
          lastViewerIndex = latestIndex - 1;
          log(`Received chunk ${latestIndex - 1} from blockchain`, 'success');
        }
      }
    } catch (err) {
      log(`Viewer error: ${err.message}`, 'error');
    }
  }, 3000);
}

// Log to console
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Update status
function updateStatus(streaming) {
  if (streaming) {
    statusEl.className = 'status-indicator streaming';
    statusEl.textContent = 'Streaming';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusEl.className = 'status-indicator idle';
    statusEl.textContent = 'Idle';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// Start streaming
startBtn.addEventListener('click', async () => {
  const config = {
    rpcUrl: rpcUrlInput.value,
    privateKey: privateKeyInput.value,
    contractAddress: contractAddressInput.value
  };

  if (!config.rpcUrl || !config.privateKey || !config.contractAddress) {
    log('Please fill in all configuration fields', 'error');
    return;
  }

  try {
    // Initialize ethers
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    wallet = new ethers.Wallet(config.privateKey, provider);
    contract = new ethers.Contract(config.contractAddress, ABI, wallet);

    log('Initializing blockchain connection...', 'info');
    
    // Test connection
    const latestIndex = await contract.getLatestIndex();
    log(`Connected to contract. Latest index: ${latestIndex}`, 'success');

    // Start FFmpeg streaming
    const result = await window.electronAPI.startStreaming(config);
    
    if (result.success) {
      log('Streaming pipeline started', 'success');
      updateStatus(true);
      initializeViewer();
    } else {
      log(`Failed to start streaming: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
});

// Stop streaming
stopBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.stopStreaming();
  if (result.success) {
    log('Streaming stopped', 'info');
    updateStatus(false);
    if (viewerInterval) {
      clearInterval(viewerInterval);
      viewerInterval = null;
    }
  }
});

// Save configuration
saveConfigBtn.addEventListener('click', async () => {
  const config = {
    rpcUrl: rpcUrlInput.value,
    privateKey: privateKeyInput.value,
    contractAddress: contractAddressInput.value
  };

  const result = await window.electronAPI.saveConfig(config);
  if (result.success) {
    log('Configuration saved', 'success');
  } else {
    log(`Failed to save config: ${result.error}`, 'error');
  }
});

// Load configuration
loadConfigBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.loadConfig();
  if (result.success) {
    rpcUrlInput.value = result.config.rpcUrl || '';
    privateKeyInput.value = result.config.privateKey || '';
    contractAddressInput.value = result.config.contractAddress || '';
    log('Configuration loaded', 'success');
  } else {
    log('No saved configuration found', 'info');
  }
});

// Listen for log messages from main process
window.electronAPI.onLogMessage((message) => {
  log(message, 'info');
});

// Listen for error messages
window.electronAPI.onErrorMessage((message) => {
  log(message, 'error');
});

// Listen for new chunks
window.electronAPI.onNewChunk(async (filepath) => {
  if (!contract || !wallet) return;
  
  try {
    // Read chunk file
    const filename = filepath.split(/[\\/]/).pop();
    log(`Uploading ${filename}...`, 'info');
    
    // In a real implementation, we'd read the file from the main process
    // For now, we'll simulate the upload
    const response = await fetch(filepath);
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    if (data.length > 256 * 1024) {
      log(`Chunk too large: ${data.length} bytes`, 'error');
      return;
    }
    
    const tx = await contract.pushChunk(data);
    log(`Uploaded ${filename} - TX: ${tx.hash}`, 'success');
    
  } catch (error) {
    log(`Upload error: ${error.message}`, 'error');
  }
});

// Load config on startup
window.addEventListener('DOMContentLoaded', () => {
  loadConfigBtn.click();
});
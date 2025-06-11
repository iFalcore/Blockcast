import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const video = document.getElementById("video");
const alertBox = document.getElementById("alert");

// Display error messages
function showError(message) {
  alertBox.textContent = `⚠️ ${message}`;
  alertBox.style.display = "block";
}

// SKALE RPC and Contract Info
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";

// ABI
const ABI = [
  "function getLatestIndex() public view returns (uint256)",
  "function getChunk(uint256 index) public view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// MediaSource Setup
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;
let lastIndex = 0;
const queue = [];

mediaSource.addEventListener("sourceopen", () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640028, mp4a.40.2"');

  sourceBuffer.addEventListener("updateend", () => {
    if (queue.length > 0 && !sourceBuffer.updating) {
      sourceBuffer.appendBuffer(queue.shift());
    }
  });

  startFetchingChunks();
});

// Repeatedly fetch new chunks
async function startFetchingChunks() {
  while (true) {
    try {
      const latest = await contract.getLatestIndex();
      while (lastIndex < latest) {
        const [index, timestamp, data] = await contract.getChunk(lastIndex);
        const chunkBuffer = ethers.getBytes(data);
        queue.push(new Uint8Array(chunkBuffer));

        if (!sourceBuffer.updating && queue.length === 1) {
          sourceBuffer.appendBuffer(queue.shift());
        }

        lastIndex++;
      }
    } catch (err) {
      showError(`Fetch error: ${err.reason || err.message}`);
      console.warn("⚠️ Fetch error", err);
    }

    await new Promise((res) => setTimeout(res, 1000));
  }
}

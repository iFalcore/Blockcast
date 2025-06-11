import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";

const ABI = [
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes)",
  "function getLatestIndex() view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("videoPlayer");
const errorBox = document.getElementById("errorBox");

const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;
let lastIndex = -1;

mediaSource.addEventListener("sourceopen", () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640028, mp4a.40.2"');
  pollChunks();
});

function showError(msg) {
  console.warn("⚠️ Fetch error:", msg);
  errorBox.textContent = "⚠️ " + msg;
}

async function fetchChunk(index) {
  try {
    const chunk = await contract.getChunk(index);
    return chunk[2]; // bytes data
  } catch (err) {
    showError(err.message);
    return null;
  }
}

async function pollChunks() {
  while (true) {
    try {
      const latestIndexBN = await contract.getLatestIndex();
      const latestIndex = BigInt(latestIndexBN).toString(); // cast safely
      const latest = parseInt(latestIndex);

      for (let i = lastIndex + 1; i < latest - 2; i++) { // 2-chunk delay
        const chunkData = await fetchChunk(i);
        if (chunkData) {
          const buffer = new Uint8Array(chunkData);
          await appendToBuffer(buffer);
          lastIndex = i;
        }
      }
    } catch (err) {
      showError(err.message);
    }

    await delay(2000); // Wait 2 seconds before polling again
  }
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function appendToBuffer(buffer) {
  return new Promise((resolve, reject) => {
    if (sourceBuffer.updating) {
      sourceBuffer.addEventListener("updateend", () => {
        sourceBuffer.appendBuffer(buffer);
        resolve();
      }, { once: true });
    } else {
      sourceBuffer.appendBuffer(buffer);
      resolve();
    }
  });
}

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/dist/ethers.min.js";

// === CONFIG ===
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes)"
];

// === ELEMENTS ===
const video = document.getElementById("video");
const errorBox = document.getElementById("errorBox");

// === MEDIA SETUP ===
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;
let lastIndex = -1;

mediaSource.addEventListener("sourceopen", () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640029, mp4a.40.2"');
  pollLatestChunk(); // Start polling once buffer is ready
});

// === ERROR HANDLER ===
function showError(msg) {
  console.error(msg);
  if (errorBox) errorBox.textContent = msg;
}

// === ETH SETUP ===
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// === LIVE POLLING ===
async function pollLatestChunk() {
  try {
    const latestIndexBN = await contract.getLatestIndex();
    const latestIndex = Number(latestIndexBN);

    if (latestIndex > 0 && latestIndex - 1 !== lastIndex) {
      const [, , data] = await contract.getChunk(latestIndex - 1);
      const buffer = ethers.getBytes(data);

      if (!sourceBuffer.updating) {
        sourceBuffer.appendBuffer(new Uint8Array(buffer));
        lastIndex = latestIndex - 1;
        console.log(`✅ Appended chunk ${lastIndex}`);
      }
    }
  } catch (err) {
    showError(`⚠️ Fetch error: ${err.message}`);
  }

  setTimeout(pollLatestChunk, 3000); // ~3s delay to give chunks time to arrive
}

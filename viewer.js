import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const video = document.getElementById("video");
const alertBox = document.getElementById("alert");

function showError(message) {
  alertBox.textContent = `⚠️ ${message}`;
  alertBox.style.display = "block";
}

const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";

const ABI = [
  "function getLatestIndex() public view returns (uint256)",
  "function getChunk(uint256 index) public view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;
let lastIndex = 0;
const queue = [];

mediaSource.addEventListener("sourceopen", () => {
  try {
    sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640028, mp4a.40.2"');

    sourceBuffer.addEventListener("updateend", () => {
      if (queue.length > 0 && !sourceBuffer.updating) {
        const chunk = queue.shift();
        try {
          sourceBuffer.appendBuffer(chunk);
        } catch (err) {
          showError(`Append failed: ${err.message}`);
        }
      }
    });

    fetchChunks();
  } catch (e) {
    showError("Failed to open media source: " + e.message);
  }
});

async function fetchChunks() {
  while (true) {
    try {
      const latest = await contract.getLatestIndex();

      while (lastIndex < latest) {
        const [index, timestamp, data] = await contract.getChunk(lastIndex);
        const buffer = new Uint8Array(ethers.getBytes(data));
        queue.push(buffer);

        if (!sourceBuffer.updating && queue.length > 0) {
          sourceBuffer.appendBuffer(queue.shift());
        }

        lastIndex++;
      }
    } catch (err) {
      showError(`Fetch error: ${err.reason || err.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";

const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256) view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("video");
const status = document.getElementById("status");

let mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let latestFetched = -1;

mediaSource.addEventListener("sourceopen", () => {
  const mime = 'video/mp2t; codecs="avc1.640029, mp4a.40.2"';
  const sourceBuffer = mediaSource.addSourceBuffer(mime);
  status.textContent = "🎥 Waiting for stream...";

  async function fetchLoop() {
    try {
      const latestIndex = await contract.getLatestIndex();

      if (latestIndex > latestFetched + 1) {
        for (let i = latestFetched + 1; i < latestIndex; i++) {
          const [, , data] = await contract.getChunk(i);
          const chunk = ethers.getBytes(data);
          if (!sourceBuffer.updating) {
            sourceBuffer.appendBuffer(new Uint8Array(chunk));
            status.textContent = `✅ Playing chunk ${i}`;
          }
          latestFetched = i;
        }
      }
    } catch (err) {
      status.textContent = `⚠️ Error: ${err.message}`;
      console.error(err);
    }

    setTimeout(fetchLoop, 1000);
  }

  fetchLoop();
});

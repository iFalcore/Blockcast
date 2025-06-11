import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";

// Paste ABI below (must include getChunk + getLatestIndex)
const ABI = [
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes memory)",
  "function getLatestIndex() view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("video");
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;

mediaSource.addEventListener("sourceopen", async () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640028, mp4a.40.2"');

  try {
    const latest = await contract.getLatestIndex();
    const start = Math.max(0, Number(latest) - 10); // Start with last 10 chunks

    for (let i = start; i < latest; i++) {
      try {
        const [, , data] = await contract.getChunk(i);
        const buffer = ethers.getBytes(data);
        sourceBuffer.appendBuffer(new Uint8Array(buffer));
        await new Promise(r => sourceBuffer.addEventListener("updateend", r, { once: true }));
      } catch (err) {
        console.warn(`❌ Skipped chunk ${i}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("Failed to load video:", err);
  }
});

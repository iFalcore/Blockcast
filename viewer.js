import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("video");
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;
let fetching = false;
let currentIndex = 0;
const delayBuffer = 2;

mediaSource.addEventListener("sourceopen", async () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640028, mp4a.40.2"');
  pollChunks();
});

async function pollChunks() {
  while (true) {
    try {
      const latestIndex = await contract.getLatestIndex();
      const targetIndex = latestIndex > delayBuffer ? latestIndex - delayBuffer : 0;

      while (currentIndex <= targetIndex) {
        if (sourceBuffer.updating || fetching) {
          await wait(100); // wait a bit if buffer is busy
          continue;
        }

        fetching = true;
        try {
          const chunk = await contract.getChunk(currentIndex);
          const data = ethers.getBytes(chunk[2]);
          sourceBuffer.appendBuffer(new Uint8Array(data));
          console.log(`✅ Appended chunk ${currentIndex}`);
          currentIndex++;
        } catch (err) {
          console.warn(`⚠️ Fetch error at chunk ${currentIndex}:`, err.message || err);
          // skip invalid chunks
          currentIndex++;
        } finally {
          fetching = false;
        }
      }

      await wait(1000); // delay before next poll
    } catch (err) {
      console.error("❌ Viewer error:", err.message || err);
      await wait(2000);
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";

const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("video");
const alertBox = document.getElementById("alert");

let mediaSource = new MediaSource();
let sourceBuffer;
video.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener("sourceopen", () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001F, mp4a.40.2"');
  pollChunks();
});

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.style.display = "block";
  setTimeout(() => {
    alertBox.style.display = "none";
  }, 5000);
}

let lastFetched = 0;

async function pollChunks() {
  setInterval(async () => {
    try {
      const latestIndex = await contract.getLatestIndex();
      if (latestIndex <= lastFetched) return;

      for (let i = lastFetched; i < latestIndex; i++) {
        try {
          const [, , data] = await contract.getChunk(i);
          const bytes = ethers.getBytes(data);

          sourceBuffer.appendBuffer(new Uint8Array(bytes));
          await new Promise((res) => {
            sourceBuffer.addEventListener("updateend", res, { once: true });
          });

          console.log(`✅ Appended chunk ${i}`);
          lastFetched = i + 1;
        } catch (err) {
          console.warn(`⚠️ Chunk ${i} error: ${err.message}`);
          showAlert(`⚠️ Error loading chunk ${i}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error("❌ Fetch error", err);
      showAlert(`❌ Fetch error: ${err.message}`);
    }
  }, 1000); // Poll every second
}

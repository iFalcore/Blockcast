
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/dist/ethers.min.js";

const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256) view returns (uint256, uint256, bytes)"
];

const video = document.getElementById("video");
const errorBox = document.getElementById("errorBox");

const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let sourceBuffer;
let lastIndex = -1;
const approxChunkDuration = 10;

mediaSource.addEventListener("sourceopen", () => {
  const mime = 'video/mp2t; codecs="avc1.640029, mp4a.40.2"';
  if (!MediaSource.isTypeSupported(mime)) {
    showError("❌ Browser does not support required MIME type: " + mime);
    return;
  }
  sourceBuffer = mediaSource.addSourceBuffer(mime);
  pollLatestChunk();
});

function showError(msg) {
  console.error(msg);
  if (errorBox) errorBox.textContent = msg;
}

video.addEventListener("error", () => {
  const err = video.error;
  if (err) showError(`🚨 Video Error (${err.code}): ${err.message || "Unknown error"}`);
});

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

async function pollLatestChunk() {
  try {
    const latestIndex = Number(await contract.getLatestIndex());
    const nextIndex = latestIndex - 1;

    if (latestIndex > 0 && nextIndex !== lastIndex && nextIndex >= 0) {
      const [, , data] = await contract.getChunk(nextIndex);
      const buffer = ethers.getBytes(data);

      if (mediaSource.readyState === "open" && !sourceBuffer.updating) {
        sourceBuffer.timestampOffset = nextIndex * approxChunkDuration;
        sourceBuffer.appendBuffer(new Uint8Array(buffer));
        lastIndex = nextIndex;
        console.log(`✅ Appended chunk ${lastIndex}`);
        if (video.paused) video.play();
      }
    }
  } catch (err) {
    showError(`⚠️ Fetch error: ${err.message}`);
  }

  setTimeout(pollLatestChunk, 12000); // 12s polling for 10s chunks
}

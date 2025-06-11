# Save the corrected viewer.js that matches the latest contract definition
corrected_viewer_js = """
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/dist/ethers.min.js";

// === CONFIG ===
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256) view returns (uint256, uint256, bytes)"
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
  const mime = 'video/mp2t; codecs="avc1.640029, mp4a.40.2"';

  if (!MediaSource.isTypeSupported(mime)) {
    showError(`❌ Browser does not support required MIME type: ${mime}`);
    return;
  }

  sourceBuffer = mediaSource.addSourceBuffer(mime);
  pollLatestChunk(); // Start polling once buffer is ready
});

// === ERROR HANDLER ===
function showError(msg) {
  console.error(msg);
  if (errorBox) errorBox.textContent = msg;
}

video.addEventListener("error", () => {
  const err = video.error;
  if (err) {
    showError(`🚨 Video Error (${err.code}): ${err.message || "Unknown error"}`);
  }
});

// === ETH SETUP ===
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// === LIVE POLLING ===
async function pollLatestChunk() {
  try {
    const latestIndexBN = await contract.getLatestIndex();
    const latestIndex = Number(latestIndexBN);
    const nextIndex = latestIndex - 1;

    if (latestIndex > 0 && nextIndex !== lastIndex && nextIndex >= 0) {
      const [, , data] = await contract.getChunk(nextIndex);
      const buffer = ethers.getBytes(data);

      if (mediaSource.readyState === "open" && !sourceBuffer.updating) {
        sourceBuffer.appendBuffer(new Uint8Array(buffer));
        lastIndex = nextIndex;
        console.log(`✅ Appended chunk ${lastIndex}`);
      }
    }
  } catch (err) {
    showError(`⚠️ Fetch error: ${err.message}`);
  }

  setTimeout(pollLatestChunk, 3000);
}
"""

# Write the corrected viewer.js to a file
corrected_viewer_path = "/mnt/data/viewer.js"
with open(corrected_viewer_path, "w", encoding="utf-8") as file:
    file.write(corrected_viewer_js)

corrected_viewer_path

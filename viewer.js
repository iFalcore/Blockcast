
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";

const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256) view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("player");
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let index = 0;
let sourceBuffer;

mediaSource.addEventListener("sourceopen", async () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640029, mp4a.40.2"');
  pollChunks();
});

async function pollChunks() {
  try {
    const latest = await contract.getLatestIndex();
    while (index < latest) {
      const [, , data] = await contract.getChunk(index);
      const chunk = ethers.getBytes(data);
      await appendBuffer(chunk);
      console.log("✅ Fetched chunk", index);
      index++;
    }
  } catch (e) {
    console.error("⚠️ Fetch error", e);
  } finally {
    setTimeout(pollChunks, 1000);
  }
}

function appendBuffer(chunk) {
  return new Promise(resolve => {
    sourceBuffer.appendBuffer(new Uint8Array(chunk));
    sourceBuffer.addEventListener("updateend", resolve, { once: true });
  });
}

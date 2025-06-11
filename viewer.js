import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";

const ABI = [
  "function getLatestIndex() view returns (uint256)",
  "function getChunk(uint256 index) view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("player");
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener("sourceopen", async () => {
  const mimeCodec = 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
  const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);

  try {
    const latest = await contract.getLatestIndex();
    const start = Math.max(0, latest - 30); // last 30 chunks

    for (let i = start; i < latest; i++) {
      try {
        const [, , data] = await contract.getChunk(i);
        const buffer = ethers.getBytes(data);
        sourceBuffer.appendBuffer(new Uint8Array(buffer));
        await new Promise(res => sourceBuffer.addEventListener("updateend", res, { once: true }));
      } catch (err) {
        console.warn(`⚠️ Chunk ${i} skipped:`, err.reason || err.message);
        continue;
      }
    }

    mediaSource.endOfStream();
  } catch (err) {
    console.error("⚠️ Fetch error", err);
  }
});

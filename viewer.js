import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.14.3/+esm";

document.addEventListener("DOMContentLoaded", async () => {
  const video = document.getElementById("player");
  if (!video) return console.error("❌ No video element found");

  const mediaSource = new MediaSource();
  video.src = URL.createObjectURL(mediaSource);

  const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
  const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
  const ABI = [
    "function getLatestIndex() view returns (uint256)",
    "function getChunk(uint256 index) view returns (uint256, uint256, bytes memory)"
  ];

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  let sourceBuffer;

  mediaSource.addEventListener("sourceopen", async () => {
    sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.640028, mp4a.40.2"');

    let latestIndex;
    try {
      latestIndex = (await contract.getLatestIndex()).toNumber();
    } catch (e) {
      return console.error("❌ Contract unreachable or wrong address", e);
    }

    console.log(`🔢 Latest chunk index: ${latestIndex}`);

    const BUFFER_SIZE = 360;
    let start = Math.max(0, latestIndex - BUFFER_SIZE);

    for (let i = start; i < latestIndex; i++) {
      try {
        const [, , data] = await contract.getChunk(i);
        const buffer = ethers.getBytes(data);
        sourceBuffer.appendBuffer(new Uint8Array(buffer));
        await new Promise(res => sourceBuffer.addEventListener("updateend", res, { once: true }));
        console.log(`✅ Appended chunk ${i}`);
      } catch (err) {
        console.warn(`⚠️ Skipping chunk ${i}:`, err.reason || err.code || err.message);
      }
    }

    mediaSource.endOfStream();
    console.log("🎞️ Playback complete");
  });
});

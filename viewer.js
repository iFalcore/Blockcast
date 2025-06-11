const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";

const ABI = [
  "function getLatestIndex() public view returns (uint256)",
  "function getChunk(uint256 index) public view returns (uint256, uint256, bytes)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("video");
const errorBox = document.getElementById("errorBox");

let mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

let lastIndex = -1;
let sourceBuffer;

mediaSource.addEventListener("sourceopen", () => {
  sourceBuffer = mediaSource.addSourceBuffer('video/mp2t; codecs="avc1.42E01E, mp4a.40.2"');
  pollChunks();
});

async function pollChunks() {
  while (true) {
    try {
      const latestIndexBN = await contract.getLatestIndex();
      const latestIndex = Number(latestIndexBN);

      for (let i = lastIndex + 1; i < latestIndex; i++) {
        try {
          const [, , data] = await contract.getChunk(i);
          if (data && data.length > 0) {
            const buffer = ethers.getBytes(data);
            appendChunk(buffer);
            lastIndex = i;
          }
        } catch (chunkErr) {
          showError(`⚠️ Chunk ${i} fetch failed: ${chunkErr.message}`);
        }
      }
    } catch (err) {
      showError(`⚠️ Fetch error: ${err.message}`);
    }

    await delay(3000); // 3 second delay between polls
  }
}

function appendChunk(chunk) {
  if (sourceBuffer.updating) {
    setTimeout(() => appendChunk(chunk), 100);
    return;
  }
  try {
    sourceBuffer.appendBuffer(new Uint8Array(chunk));
  } catch (e) {
    showError("⚠️ AppendBuffer error: " + e.message);
  }
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function showError(message) {
  console.error(message);
  errorBox.textContent = message;
}

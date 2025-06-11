const RPC_URL = "https://testnet.skalenodes.com/v1/giant-half-dual-testnet";
const CONTRACT_ADDRESS = "0x218Ec19C81A1bd392e8a544780d206563909200a";
const ABI = [
  "function getChunk(uint256) view returns (uint256 index, uint256 timestamp, bytes data)",
  "function getLatestIndex() view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

const video = document.getElementById("video");
const errorBox = document.getElementById("error-box");

function showError(message) {
  errorBox.textContent = `⚠️ ${message}`;
  console.error("⚠️", message);
}

let mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener("sourceopen", () => {
  const mime = 'video/mp2t; codecs="avc1.42E01E, mp4a.40.2"';
  const sourceBuffer = mediaSource.addSourceBuffer(mime);

  async function fetchAndStream() {
    try {
      const latestIndexBN = await contract.getLatestIndex();
      let currentIndex = latestIndexBN.toNumber() - 3;
      if (currentIndex < 0) currentIndex = 0;

      setInterval(async () => {
        try {
          const chunk = await contract.getChunk(currentIndex);
          const blob = new Blob([chunk.data], { type: "video/mp2t" });
          const arrayBuffer = await blob.arrayBuffer();

          if (!sourceBuffer.updating) {
            sourceBuffer.appendBuffer(arrayBuffer);
            currentIndex++;
          }
        } catch (err) {
          showError(`Chunk ${currentIndex} fetch failed: ${err.message}`);
        }
      }, 1000);
    } catch (e) {
      showError(`Fetch error: ${e.message}`);
    }
  }

  fetchAndStream();
});

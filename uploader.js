const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

class BlockchainUploader {

  // string
  streamName = "TestStream";
  nonce = 0;

  constructor(config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.ABI = [
      "function pushChunk(string calldata streamName, bytes calldata data) external",
      "function getLatestIndex(string memory streamName) view returns (uint256)",
      "function getChunk(uint256 index) view returns (uint256, uint256, bytes)"
    ];
    
    this.contract = new ethers.Contract(config.contractAddress, this.ABI, this.wallet);
    this.uploadQueue = [];
    this.isProcessing = false;

    this.setupNonce();
  }

  async setupNonce() {
    const n= await this.provider.getTransactionCount(this.wallet.address);
    console.log ("nonce ",n)
    this.nonce=n
  }

  async uploadChunk(filepath) {
    return new Promise((resolve, reject) => {
      this.uploadQueue.push({ filepath, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (!this.nonce) {
      await this.setupNonce()
    }
    if (this.isProcessing || this.uploadQueue.length === 0) return;
    
    this.isProcessing = true;
    const { filepath, resolve, reject } = this.uploadQueue.shift();
    
    try {
      const chunkData = fs.readFileSync(filepath);
      
      if (!chunkData || chunkData.length === 0) {
        throw new Error('Empty chunk file');
      }
      
      if (chunkData.length > 256 * 1024) {
        throw new Error(`Chunk too large: ${chunkData.length} bytes`);
      }
      
      const tx = await this.contract.pushChunk(this.streamName, chunkData, {
        nonce: this.nonce++, 
        gasLimit: 150_000_000
      });

       await tx.wait(); // Remove to speed things up
      
      // Clean up uploaded chunk
      fs.unlinkSync(filepath);
      
      resolve({
        success: true,
        txHash: tx.hash,
        filename: path.basename(filepath),
        size: chunkData.length
      });
      
    } catch (error) {
      reject({
        success: false,
        error: error.message,
        filename: path.basename(filepath)
      });
    } finally {
      this.isProcessing = false;
      // Process next item in queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  async getLatestIndex() {
    try {
      const index = await this.contract.getLatestIndex(this.streamName);
      return Number(index);
    } catch (error) {
      throw new Error(`Failed to get latest index: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      await this.getLatestIndex();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = BlockchainUploader;
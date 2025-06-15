const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

class BlockchainUploader {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.ABI = [
      "function pushChunk(bytes calldata data) external",
      "function getLatestIndex() view returns (uint256)",
      "function getChunk(uint256 index) view returns (uint256, uint256, bytes)"
    ];
    
    this.contract = new ethers.Contract(config.contractAddress, this.ABI, this.wallet);
    this.uploadQueue = [];
    this.isProcessing = false;
  }

  async uploadChunk(filepath) {
    return new Promise((resolve, reject) => {
      this.uploadQueue.push({ filepath, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
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
      
      const tx = await this.contract.pushChunk(chunkData);
      await tx.wait();
      
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
      const index = await this.contract.getLatestIndex();
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
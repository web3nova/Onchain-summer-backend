// src/models/NFT.js
const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema({
  // Wallet and user info
  walletAddress: {
    type: String,
    required: [true, 'Wallet address is required'],
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'],
    index: true // For faster queries
  },
  
  // IPFS data
  ipfsCid: {
    type: String,
    required: [true, 'IPFS CID is required'],
    match: [/^Qm[a-zA-Z0-9]{44}$/, 'Invalid IPFS CID format']
  },
  
  metadataUri: {
    type: String,
    required: [true, 'Metadata URI is required'],
    match: [/^ipfs:\/\/Qm[a-zA-Z0-9]{44}$/, 'Invalid IPFS URI format']
  },
  
  // Blockchain data
  tokenId: {
    type: String,
    required: [true, 'Token ID is required']
  },
  
  contractAddress: {
    type: String,
    required: [true, 'Contract address is required'],
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address format']
  },
  
  transactionHash: {
    type: String,
    required: [true, 'Transaction hash is required'],
    unique: true, // Prevent duplicate transactions
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'],
    index: true
  },
  
  // Event metadata
  eventData: {
    eventName: {
      type: String,
      default: 'Onchain Summer Lagos',
      enum: ['Onchain Summer Lagos'] // Only allow this event for now
    },
    mintedAt: {
      type: Date,
      required: [true, 'Mint timestamp is required']
    }
  },
  
  // Additional metadata
  networkChainId: {
    type: Number,
    default: 8453, // Base mainnet
    enum: [8453, 84532] // Base mainnet and sepolia testnet
  },
  
  imageUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https:\/\/.*\.pinata\.cloud\/ipfs\/Qm[a-zA-Z0-9]{44}$/.test(v);
      },
      message: 'Invalid Pinata image URL format'
    }
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'confirmed'
  },
  
  // User agent and IP for analytics (optional)
  userAgent: String,
  ipAddress: String,
  
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
nftSchema.index({ walletAddress: 1, createdAt: -1 });
nftSchema.index({ 'eventData.eventName': 1, createdAt: -1 });
nftSchema.index({ networkChainId: 1 });

// Virtual for IPFS gateway URL
nftSchema.virtual('pinataImageUrl').get(function() {
  if (this.ipfsCid) {
    return `https://gateway.pinata.cloud/ipfs/${this.ipfsCid}`;
  }
  return null;
});

// Virtual for block explorer URL
nftSchema.virtual('blockExplorerUrl').get(function() {
  const baseUrl = this.networkChainId === 8453 
    ? 'https://basescan.org/tx/' 
    : 'https://sepolia.basescan.org/tx/';
  return `${baseUrl}${this.transactionHash}`;
});

// Static method to get user's NFT count
nftSchema.statics.getUserNFTCount = function(walletAddress) {
  return this.countDocuments({ 
    walletAddress: walletAddress.toLowerCase(),
    status: 'confirmed'
  });
};

// Static method to get event statistics
nftSchema.statics.getEventStats = function() {
  return this.aggregate([
    { $match: { status: 'confirmed' } },
    {
      $group: {
        _id: '$eventData.eventName',
        totalMints: { $sum: 1 },
        uniqueUsers: { $addToSet: '$walletAddress' },
        firstMint: { $min: '$eventData.mintedAt' },
        lastMint: { $max: '$eventData.mintedAt' }
      }
    },
    {
      $project: {
        eventName: '$_id',
        totalMints: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        firstMint: 1,
        lastMint: 1
      }
    }
  ]);
};

// Instance method to update status
nftSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  return this.save();
};

// Pre-save middleware to ensure lowercase addresses
nftSchema.pre('save', function(next) {
  if (this.walletAddress) {
    this.walletAddress = this.walletAddress.toLowerCase();
  }
  if (this.contractAddress) {
    this.contractAddress = this.contractAddress.toLowerCase();
  }
  if (this.transactionHash) {
    this.transactionHash = this.transactionHash.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('NFT', nftSchema);
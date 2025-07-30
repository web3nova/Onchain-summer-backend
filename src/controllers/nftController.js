// src/controllers/nftController.js
const NFT = require('../models/NFT');

// Save a new minted NFT
exports.saveNFT = async (req, res) => {
  try {
    const {
      walletAddress,
      ipfsCid,
      metadataUri,
      tokenId,
      contractAddress,
      transactionHash,
      eventData
    } = req.body;

    // Validation
    if (!walletAddress || !ipfsCid || !metadataUri || !tokenId || !contractAddress || !transactionHash) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['walletAddress', 'ipfsCid', 'metadataUri', 'tokenId', 'contractAddress', 'transactionHash']
      });
    }

    // Check if NFT already exists (by transaction hash)
    const existingNFT = await NFT.findOne({ 
      transactionHash: transactionHash.toLowerCase() 
    });

    if (existingNFT) {
      return res.status(409).json({
        success: false,
        message: 'NFT already recorded',
        data: existingNFT
      });
    }

    // Create new NFT record
    const nftData = {
      walletAddress,
      ipfsCid,
      metadataUri,
      tokenId,
      contractAddress,
      transactionHash,
      eventData: {
        eventName: eventData?.eventName || 'Onchain Summer Lagos',
        mintedAt: eventData?.mintedAt ? new Date(eventData.mintedAt) : new Date()
      },
      // Optional metadata
      imageUrl: `https://gateway.pinata.cloud/ipfs/${ipfsCid}`,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress
    };

    const newNFT = new NFT(nftData);
    const savedNFT = await newNFT.save();

    // Get user's total NFT count
    const userNFTCount = await NFT.getUserNFTCount(walletAddress);

    res.status(201).json({
      success: true,
      message: 'NFT saved successfully',
      data: savedNFT,
      meta: {
        userTotalNFTs: userNFTCount,
        isFirstNFT: userNFTCount === 1
      }
    });

  } catch (error) {
    console.error('Error saving NFT:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate transaction hash',
        error: 'This NFT has already been recorded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to save NFT',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get NFTs for a specific wallet address
exports.getUserNFTs = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Validate wallet address format
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address format'
      });
    }

    // Get NFTs with pagination
    const nfts = await NFT.find({ 
      walletAddress: walletAddress.toLowerCase(),
      status: 'confirmed'
    })
    .sort({ createdAt: -1 }) // Most recent first
    .skip(skip)
    .limit(limit)
    .select('-userAgent -ipAddress') // Exclude sensitive data
    .lean(); // Return plain objects for better performance

    // Get total count for pagination
    const totalCount = await NFT.getUserNFTCount(walletAddress);
    const totalPages = Math.ceil(totalCount / limit);

    // Add computed fields
    const enrichedNFTs = nfts.map(nft => ({
      ...nft,
      pinataImageUrl: `https://gateway.pinata.cloud/ipfs/${nft.ipfsCid}`,
      blockExplorerUrl: nft.networkChainId === 8453 
        ? `https://basescan.org/tx/${nft.transactionHash}`
        : `https://sepolia.basescan.org/tx/${nft.transactionHash}`,
      daysAgo: Math.floor((Date.now() - new Date(nft.eventData.mintedAt).getTime()) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: {
        nfts: enrichedNFTs,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        },
        meta: {
          walletAddress: walletAddress.toLowerCase(),
          firstNFTDate: enrichedNFTs.length > 0 ? enrichedNFTs[enrichedNFTs.length - 1].eventData.mintedAt : null,
          latestNFTDate: enrichedNFTs.length > 0 ? enrichedNFTs[0].eventData.mintedAt : null
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch NFTs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get event statistics (bonus endpoint)
exports.getEventStats = async (req, res) => {
  try {
    const stats = await NFT.getEventStats();
    
    const totalStats = {
      totalMints: 0,
      totalUniqueUsers: 0,
      events: stats
    };

    // Calculate totals
    stats.forEach(event => {
      totalStats.totalMints += event.totalMints;
      totalStats.totalUniqueUsers += event.uniqueUserCount;
    });

    res.json({
      success: true,
      data: totalStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching event stats:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
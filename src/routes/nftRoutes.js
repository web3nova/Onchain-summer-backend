// src/routes/nftRoutes.js
const express = require('express');
const router = express.Router();
const nftController = require('../controllers/nftController');

// Middleware for request logging
const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
};

// Apply logging middleware to all routes
router.use(requestLogger);

// POST /api/nfts - Save a new minted NFT
router.post('/', nftController.saveNFT);

// GET /api/nfts/:walletAddress - Get NFTs for a wallet
router.get('/:walletAddress', nftController.getUserNFTs);

// GET /api/nfts/stats/event - Get event statistics (bonus endpoint)
router.get('/stats/event', nftController.getEventStats);

module.exports = router;
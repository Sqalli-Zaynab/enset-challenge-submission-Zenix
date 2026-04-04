const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');

// POST /api/profile/analyze [cite: 211, 313]
router.post('/analyze', profileController.analyze);

module.exports = router;
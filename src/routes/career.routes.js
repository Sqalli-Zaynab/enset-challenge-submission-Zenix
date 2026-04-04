const express = require('express');
const router = express.Router();
const careerController = require('../controllers/career.controller');

// Block 2: Suggest career paths based on the analyzed profile
router.post('/recommend', careerController.recommendCareers);

module.exports = router;
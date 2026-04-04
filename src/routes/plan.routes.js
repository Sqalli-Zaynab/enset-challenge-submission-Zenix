const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan.controller');

// Block 3: Generate the roadmap and find opportunities for the chosen path
router.post('/generate', planController.generatePlan);

module.exports = router;
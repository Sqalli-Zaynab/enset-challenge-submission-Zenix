const express = require("express");
const router = express.Router();
const aiService = require("../services/ai.service");

router.post("/message", async (req, res) => {
	try {
		const payload = req.body || {};
		const response = await aiService.runChatAdvisor(payload);
		return res.status(200).json(response);
	} catch (error) {
		console.error("Chat advisor failed:", error);
		return res.status(500).json({ error: "Chat advisor failed" });
	}
});

module.exports = router;

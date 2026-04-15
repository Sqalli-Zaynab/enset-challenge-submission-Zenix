// This is the RAG service your friend's agent is importing
// It can be MOCK for now (no API keys needed)

const logger = require('../utils/logger'); // Adjust path as needed

// MOCK RAG service - no API keys required
async function query(question, topK = 3) {
  console.log(`📚 RAG Query: ${question.substring(0, 100)}...`);
  
  // Mock responses based on keywords
  const mockDocs = [];
  
  if (question.toLowerCase().includes("career")) {
    mockDocs.push({
      content: "Software Engineering careers typically require problem-solving skills and knowledge of programming languages like JavaScript, Python, or Java.",
      source: "career_guide.pdf",
      score: 0.95
    });
    mockDocs.push({
      content: "Data Science roles combine statistics, programming, and domain expertise. Growing demand in finance, healthcare, and tech.",
      source: "industry_report.pdf",
      score: 0.87
    });
  }
  
  if (question.toLowerCase().includes("study") || question.toLowerCase().includes("learn")) {
    mockDocs.push({
      content: "Recommended learning path: Start with fundamentals, then build projects, finally specialize in your chosen field.",
      source: "learning_guide.pdf",
      score: 0.92
    });
  }
  
  // Default mock
  if (mockDocs.length === 0) {
    mockDocs.push({
      content: "Focus on building practical skills through projects and internships. Consider your interests and market demand.",
      source: "general_advice.pdf",
      score: 0.80
    });
  }
  
  return mockDocs.slice(0, topK);
}

// Store document function (for ingestion)
async function storeDocument(text, metadata) {
  console.log(`📝 Storing document: ${metadata.source}`);
  return { success: true, id: `mock_${Date.now()}` };
}

module.exports = {
  query,
  storeDocument
};
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const trustedSourcesPath = path.join(__dirname, '../knowledge/trusted_sources.txt');

let trustedSourcesCache = null;

function loadTrustedSources() {
  if (!trustedSourcesCache) {
    try {
      trustedSourcesCache = fs.readFileSync(trustedSourcesPath, 'utf8');
    } catch (err) {
      console.warn('Could not load trusted_sources.txt:', err.message);
      trustedSourcesCache = '';
    }
  }
  return trustedSourcesCache;
}

export const ragService = {
  async query(question, topK = 3) {
    console.log(`📚 RAG Query: ${question.substring(0, 100)}...`);

    const trustedSources = loadTrustedSources();
    const mockDocs = [];

    // Always include trusted sources if available
    if (trustedSources) {
      mockDocs.push({
        content: `Trusted sources for Moroccan students:\n${trustedSources}`,
        source: 'trusted_sources.txt',
        score: 0.99,
      });
    }

    // ... keep your existing keyword-based mock logic (career, study, etc.)
    if (question.toLowerCase().includes("career")) {
      mockDocs.push({
        content: "Software Engineering careers typically require problem-solving skills and knowledge of programming languages like JavaScript, Python, or Java.",
        source: "career_guide.pdf",
        score: 0.95,
      });
      // ... rest
    }

    if (mockDocs.length === 0) {
      mockDocs.push({
        content: "Focus on building practical skills through projects and internships. Consider your interests and market demand.",
        source: "general_advice.pdf",
        score: 0.80,
      });
    }

    return mockDocs.slice(0, topK);
  },

  async storeDocument(text, metadata) {
    console.log(`📝 Storing document: ${metadata.source}`);
    return { success: true, id: `mock_${Date.now()}` };
  },
};
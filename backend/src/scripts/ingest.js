require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { storeDocument } = require('../services/rag.service');

const KNOWLEDGE_DIR = path.join(__dirname, '../../data/knowledge');

/**
 * Read and parse PDF file
 */
const readPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};

/**
 * Read and parse TXT file
 */
const readTXT = (filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
};

/**
 * Ingest all documents in knowledge folder
 */
const ingestAllDocuments = async () => {
  console.log('🚀 Starting document ingestion...');
  
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`❌ Knowledge directory not found: ${KNOWLEDGE_DIR}`);
    console.log('📁 Creating directory...');
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    return;
  }
  
  const files = fs.readdirSync(KNOWLEDGE_DIR);
  console.log(`📄 Found ${files.length} files`);
  
  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    const ext = path.extname(file).toLowerCase();
    
    try {
      console.log(`📖 Processing: ${file}`);
      
      let text = '';
      if (ext === '.pdf') {
        text = await readPDF(filePath);
      } else if (ext === '.txt') {
        text = readTXT(filePath);
      } else {
        console.log(`⚠️ Skipping unsupported file: ${file}`);
        continue;
      }
      
      // Store in vector database
      const result = await storeDocument(text, {
        source: file,
        type: ext,
        ingestedAt: new Date().toISOString()
      });
      
      if (result.success) {
        console.log(`✅ Ingested ${file}: ${result.chunks} chunks`);
      } else {
        console.log(`❌ Failed to ingest ${file}: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log('🎉 Ingestion complete!');
};

// Run if called directly
if (require.main === module) {
  ingestAllDocuments().catch(console.error);
}

module.exports = { ingestAllDocuments };
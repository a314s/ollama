import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import mammoth from 'mammoth';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const createApp = async () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const app = express();
    const port = 3000;

    // Initialize database connection
    const dbPath = path.join(__dirname, 'db', 'vectors.db');
    const db = new Database(dbPath);

    // Configure paths
    const uploadsDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Helper Functions
    async function retryWithDelay(fn, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async function checkOllamaStatus() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (!response.ok) throw new Error('Ollama API not responding');
            
            const data = await response.json();
            if (!data.models?.includes('phi4')) {
                throw new Error('phi4 model not found');
            }
            
            return true;
        } catch (error) {
            console.error('Ollama status check failed:', error);
            throw new Error('Ollama server not ready. Please ensure Ollama is running and phi4 model is installed.');
        }
    }

    // Lazy load pdf-parse
    let pdfParse;
    async function getPdfParse() {
        if (!pdfParse) {
            const module = await import('pdf-parse');
            pdfParse = module.default;
        }
        return pdfParse;
    }

    async function safeReadFile(filePath) {
        try {
            return await fs.readFile(filePath);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    async function safeDeleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`Deleted file: ${filePath}`);
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
        }
    }

    async function extractPdfText(buffer) {
        try {
            console.log('Starting PDF text extraction...');
            const parse = await getPdfParse();
            console.log('PDF parser loaded, processing document...');
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('PDF processing timeout after 30 seconds')), 30000);
            });

            const parsePromise = parse(buffer);
            const data = await Promise.race([parsePromise, timeoutPromise]);

            if (!data || !data.text) {
                throw new Error('PDF parsing returned no data');
            }

            const text = data.text.trim();
            if (text.length === 0) {
                throw new Error('PDF contains no extractable text');
            }

            console.log(`Successfully extracted ${text.length} characters from PDF`);
            return text;
        } catch (error) {
            console.error('PDF extraction error:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error stack:', error.stack);
            throw new Error(`PDF extraction failed: ${error.message}`);
        }
    }

    async function extractDocxText(buffer) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            if (!result.value || result.value.trim().length === 0) {
                throw new Error('No text content found in DOCX');
            }
            return result.value;
        } catch (error) {
            console.error('Error extracting DOCX text:', error);
            throw new Error('Failed to extract text from DOCX: ' + error.message);
        }
    }

    function chunkText(text, maxChunkSize = 500) {
        if (!text || text.trim().length === 0) return [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const chunks = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            currentChunk += sentence + ' ';
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    async function getEmbeddings(text) {
        return retryWithDelay(async () => {
            try {
                await checkOllamaStatus();

                const response = await fetch('http://localhost:11434/api/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'phi4',
                        prompt: text,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Embeddings API error (${response.status}): ${errorData}`);
                }

                const data = await response.json();
                if (!data.embedding || !Array.isArray(data.embedding)) {
                    throw new Error('Invalid embedding response format');
                }

                return data.embedding;
            } catch (error) {
                console.error('Error getting embeddings:', error);
                throw new Error(`Failed to generate embeddings: ${error.message}`);
            }
        }, 3, 2000);
    }

    function cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    function findSimilarDocuments(embedding, limit = 3) {
        const documents = db.prepare('SELECT d.*, e.vector FROM documents d JOIN embeddings e ON d.id = e.document_id').all();
        
        const similarities = documents.map(doc => ({
            ...doc,
            similarity: cosineSimilarity(embedding, JSON.parse(doc.vector))
        }));

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static(__dirname));

    // Configure multer
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            cb(null, `${Date.now()}-${sanitizedName}`);
        }
    });

    const upload = multer({ 
        storage: storage,
        fileFilter: (req, file, cb) => {
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
            }
        },
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB limit
        }
    });

    // API Routes
    app.post('/api/upload', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            console.log(`File uploaded: ${req.file.originalname}`);
            const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
            res.json({ fileId, message: 'File uploaded successfully' });
        } catch (error) {
            console.error('Error handling upload:', error);
            res.status(500).json({ error: error.message || 'Failed to upload file' });
        }
    });

    app.post('/api/process', async (req, res) => {
        const { fileId } = req.body;
        let filePath = null;

        try {
            console.log('\n=== Starting file processing ===');
            
            // First check if Ollama is ready
            console.log('Checking Ollama status...');
            await checkOllamaStatus();
            console.log('Ollama is ready');

            if (!fileId) {
                throw new Error('File ID is required');
            }

            console.log('Looking for file in uploads directory...');
            const files = await fs.readdir(uploadsDir);
            const file = files.find(f => f.startsWith(fileId));

            if (!file) {
                throw new Error(`File not found. Available files: ${files.join(', ')}`);
            }

            filePath = path.join(uploadsDir, file);
            console.log(`Found file: ${file}`);
            console.log(`Full path: ${filePath}`);

            console.log('Reading file content...');
            const fileContent = await safeReadFile(filePath);
            console.log(`Read ${fileContent.length} bytes`);

            let text;
            if (file.toLowerCase().endsWith('.pdf')) {
                console.log('Processing PDF file...');
                text = await extractPdfText(fileContent);
            } else if (file.toLowerCase().endsWith('.docx')) {
                console.log('Processing DOCX file...');
                text = await extractDocxText(fileContent);
            } else {
                throw new Error('Unsupported file type');
            }

            console.log('Chunking text...');
            const chunks = chunkText(text);
            if (chunks.length === 0) {
                throw new Error('No text content found in file');
            }
            console.log(`Created ${chunks.length} text chunks`);

            // Process chunks and store in database
            const insertDoc = db.prepare('INSERT INTO documents (id, filename, chunk_text) VALUES (?, ?, ?)');
            const insertEmbedding = db.prepare('INSERT INTO embeddings (id, document_id, vector) VALUES (?, ?, ?)');

            console.log('Processing chunks...');
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const docId = `${fileId}-${i}`;
                
                try {
                    console.log(`\nProcessing chunk ${i + 1}/${chunks.length}`);
                    console.log(`Chunk length: ${chunk.length} characters`);
                    console.log('Getting embeddings...');
                    
                    const embedding = await getEmbeddings(chunk);
                    console.log(`Got embedding with ${embedding.length} dimensions`);

                    console.log('Storing in database...');
                    db.transaction(() => {
                        insertDoc.run(docId, file, chunk);
                        insertEmbedding.run(docId, docId, JSON.stringify(embedding));
                    })();
                    console.log('Chunk processed successfully');

                } catch (error) {
                    console.error(`Error processing chunk ${i}:`, error);
                    throw new Error(`Failed to process chunk ${i + 1}: ${error.message}`);
                }
            }

            console.log('\nFile processing completed successfully');
            res.json({ message: 'File processed successfully' });

        } catch (error) {
            console.error('\nError processing file:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({ 
                error: error.message || 'Failed to process file',
                details: error.stack,
                type: error.constructor.name
            });
        } finally {
            if (filePath) {
                console.log('Cleaning up temporary file...');
                await safeDeleteFile(filePath);
            }
            console.log('=== Processing complete ===\n');
        }
    });

    app.get('/api/documents', async (req, res) => {
        try {
            const documents = db.prepare(`
                SELECT filename, COUNT(*) as chunks, MIN(created_at) as timestamp
                FROM documents
                GROUP BY filename
            `).all();

            const result = documents.map(doc => ({
                name: doc.filename,
                type: path.extname(doc.filename).slice(1).toUpperCase(),
                chunks: doc.chunks,
                timestamp: doc.timestamp
            }));

            res.json(result);
        } catch (error) {
            console.error('Error getting documents:', error);
            res.status(500).json({ error: error.message || 'Failed to get documents' });
        }
    });

    app.post('/api/chat', async (req, res) => {
        try {
            const { messages } = req.body;
            if (!messages || messages.length === 0) {
                throw new Error('No messages provided');
            }

            const userMessage = messages[messages.length - 1].content;
            const questionEmbedding = await getEmbeddings(userMessage);

            const similarDocs = findSimilarDocuments(questionEmbedding);
            if (similarDocs.length === 0) {
                throw new Error('No relevant documents found');
            }

            const context = similarDocs.map(doc => doc.chunk_text).join('\n\n');

            const prompt = `Context from documents:
${context}

Based on the above context, please answer the following question:
${userMessage}

If the context doesn't contain relevant information to answer the question, please say so.`;

            res.setHeader('Content-Type', 'text/event-stream');
            
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'phi4',
                    prompt: prompt,
                    stream: true
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to get response from model: ${response.status}`);
            }

            for await (const chunk of response.body) {
                res.write(chunk);
            }
            res.end();

        } catch (error) {
            console.error('Error in chat:', error);
            res.status(500).json({ error: error.message || 'Failed to process chat message' });
        }
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message || 'Something went wrong!' });
    });

    // Start the server
    const server = app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Database location: ${dbPath}`);
        console.log(`Uploads directory: ${uploadsDir}`);
    });

    return { app, server, port };
};

export default createApp;
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupDatabase() {
    const dbPath = path.join(__dirname, 'db');
    const uploadsPath = path.join(__dirname, 'uploads');

    try {
        // Create directories if they don't exist
        await fs.mkdir(dbPath, { recursive: true });
        await fs.mkdir(uploadsPath, { recursive: true });

        console.log('Created database and uploads directories');

        // Initialize SQLite database
        const db = new Database(path.join(dbPath, 'vectors.db'));

        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                vector TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id)
            );

            CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
            CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id);
        `);

        console.log('Successfully initialized database tables');
        console.log('Database location:', path.join(dbPath, 'vectors.db'));
        console.log('Uploads location:', uploadsPath);

        // Close database connection
        db.close();

    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    }
}

console.log('Setting up Navi RAG database...');
setupDatabase().then(() => {
    console.log('Database setup complete!');
    console.log('\nYou can now start the server with:');
    console.log('npm start');
});
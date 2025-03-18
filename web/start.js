import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function checkNpmInstall() {
    try {
        await fs.access(join(__dirname, 'node_modules'));
    } catch {
        console.log('Installing dependencies...');
        await new Promise((resolve, reject) => {
            exec('npm install', { cwd: __dirname }, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }
}

async function checkOllama() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) throw new Error('Ollama not responding');
    } catch {
        console.log('Starting Ollama server...');
        exec('ollama serve');
        // Wait for Ollama to start
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

async function pullModel() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        if (!data.models?.includes('llama3.2')) {
            console.log('Pulling llama3.2 model...');
            await new Promise((resolve, reject) => {
                exec('ollama pull llama3.2', (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
    } catch (error) {
        console.error('Error checking/pulling model:', error);
        throw new Error('Failed to setup model');
    }
}

async function setupDatabase() {
    try {
        // Check if database exists
        const dbPath = join(__dirname, 'db');
        try {
            await fs.access(dbPath);
        } catch {
            console.log('Initializing database...');
            await new Promise((resolve, reject) => {
                exec('node setup-db.js', { cwd: __dirname }, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
    } catch (error) {
        console.error('Error setting up database:', error);
        throw new Error('Failed to setup database');
    }
}

async function openBrowser() {
    const url = 'http://localhost:3000';
    const command = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    exec(`${command} ${url}`);
}

async function main() {
    try {
        console.log('Starting Navi AI Assistant...\n');
        
        // Check and install npm dependencies
        console.log('Step 1/5: Checking dependencies...');
        await checkNpmInstall();

        // Check and start Ollama if needed
        console.log('\nStep 2/5: Checking Ollama server...');
        await checkOllama();

        // Check and pull model if needed
        console.log('\nStep 3/5: Checking model...');
        await pullModel();

        // Setup database if needed
        console.log('\nStep 4/5: Setting up database...');
        await setupDatabase();

        // Start the web server
        console.log('\nStep 5/5: Starting web server...');
        await import('./server.js');

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\nNavi AI Assistant is ready!');
        console.log('Database location:', join(__dirname, 'db'));
        console.log('Server URL: http://localhost:3000');
        
        // Open browser
        await openBrowser();
        
        console.log('\nPress Ctrl+C to stop the server');

    } catch (error) {
        console.error('\nError starting Navi:', error.message);
        console.error('Please check the error and try again.');
        process.exit(1);
    }
}

main();
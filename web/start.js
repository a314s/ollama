// ... [Previous imports remain the same] ...

async function waitForService(url, maxAttempts = 20, interval = 2000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return true;
        } catch {
            if (i === maxAttempts - 1) throw new Error(`Service at ${url} not responding`);
            await new Promise(resolve => setTimeout(resolve, interval));
            console.log(`Waiting for service at ${url}... (${i + 1}/${maxAttempts})`);
        }
    }
    return false;
}

async function checkOllama() {
    try {
        console.log('Checking Ollama server...');
        
        // First try to start Ollama
        console.log('Starting Ollama server...');
        exec('ollama serve');
        
        // Wait longer for initial startup
        console.log('Waiting for Ollama server to start (this may take a minute)...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if server is responding
        await waitForService('http://localhost:11434/api/tags');
        console.log('Ollama server is running');
        
        return true;
    } catch (error) {
        console.error('Failed to start Ollama:', error);
        throw new Error('Could not start Ollama server. Please run "ollama serve" manually in another terminal.');
    }
}

async function pullModel() {
    try {
        console.log('Checking for phi4 model...');
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        
        if (!data.models?.includes('phi4')) {
            console.log('Pulling phi4 model (this may take several minutes)...');
            await executeCommand('ollama pull phi4');
            
            // Verify model was pulled successfully
            const verifyResponse = await fetch('http://localhost:11434/api/tags');
            const verifyData = await verifyResponse.json();
            if (!verifyData.models?.includes('phi4')) {
                throw new Error('Model pull completed but phi4 not found in available models');
            }
            
            console.log('Model pulled and verified successfully');
        } else {
            console.log('phi4 model is already installed');
        }
    } catch (error) {
        console.error('Error pulling model:', error);
        throw new Error(`Failed to setup model: ${error.message}. Try running "ollama pull phi4" manually.`);
    }
}

// ... [Rest of the code remains the same until main function] ...

async function main() {
    try {
        console.log('\n=== Starting Navi AI Assistant ===\n');
        
        // Check and install npm dependencies
        console.log('Step 1/5: Checking dependencies...');
        await checkNpmInstall();

        // Check and start Ollama if needed
        console.log('\nStep 2/5: Initializing Ollama...');
        await checkOllama();

        // Check and pull model if needed
        console.log('\nStep 3/5: Setting up model...');
        await pullModel();

        // Verify Ollama and model one final time
        console.log('\nVerifying Ollama and model status...');
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        if (!data.models?.includes('phi4')) {
            throw new Error('Final verification failed: phi4 model not found');
        }
        console.log('Verification successful');

        // Setup database if needed
        console.log('\nStep 4/5: Setting up database...');
        await setupDatabase();

        // Start the web server
        console.log('\nStep 5/5: Starting web server...');
        const server = await startServer();

        console.log('\n=== Navi AI Assistant is ready! ===');
        
        // Open browser
        await openBrowser();
        
        console.log('\nPress Ctrl+C to stop all services\n');

        // Handle cleanup on exit
        process.on('SIGINT', async () => {
            console.log('\nShutting down services...');
            server.close();
            process.exit();
        });

    } catch (error) {
        console.error('\nError starting Navi:', error.message);
        console.error('Please check the error and try again.');
        process.exit(1);
    }
}

main();
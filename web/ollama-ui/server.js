import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3002; // Changed port to 3002 to avoid conflict with existing server

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Create the assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple logo SVG if it doesn't exist
const logoPath = path.join(assetsDir, 'navi-logo.png');
if (!fs.existsSync(logoPath)) {
  try {
    const defaultLogo = path.join(__dirname, '..', '..', 'branding', 'navi_Logo-white-text.png');
    if (fs.existsSync(defaultLogo)) {
      fs.copyFileSync(defaultLogo, logoPath);
      console.log('Copied logo from branding directory');
    } else {
      console.log('Logo not found in branding directory');
    }
  } catch (error) {
    console.error('Error creating logo:', error);
  }
}

// Create a simple favicon if it doesn't exist
const faviconPath = path.join(assetsDir, 'favicon.ico');
if (!fs.existsSync(faviconPath)) {
  // Copy favicon from a known location or create a placeholder
  try {
    const defaultFavicon = path.join(__dirname, '..', '..', 'branding', 'favicon.ico');
    if (fs.existsSync(defaultFavicon)) {
      fs.copyFileSync(defaultFavicon, faviconPath);
      console.log('Copied favicon from branding directory');
    } else {
      // Create a placeholder favicon (1x1 transparent pixel)
      const emptyFavicon = Buffer.from('AAABAAEAAQEAAAEAIAAwAAAAFgAAACgAAAABAAAAAgAAAAEAIAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAA==', 'base64');
      fs.writeFileSync(faviconPath, emptyFavicon);
      console.log('Created placeholder favicon');
    }
  } catch (error) {
    console.error('Error creating favicon:', error);
  }
}

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Parse URL
  let url = req.url;
  
  // Handle root URL
  if (url === '/') {
    url = '/index.html';
  }
  
  // Resolve file path
  const filePath = path.join(__dirname, url);
  const extname = path.extname(filePath);
  
  // Get content type based on file extension
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read file and serve
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        fs.readFile(path.join(__dirname, '404.html'), (err, content) => {
          if (err) {
            // No 404 page found, send simple message
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>404 Not Found</h1></body></html>');
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content);
          }
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`NaviTechAid Web UI server running at http://localhost:${PORT}/`);
  console.log(`Make sure your NaviTechAid server is running at http://localhost:11434/`);
});

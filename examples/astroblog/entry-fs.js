// Static file server for Astro build using Node.js fs polyfill
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let filepath = url.pathname;
    
    // Default to index.html for root
    if (filepath === '/' || filepath === '') {
      filepath = '/index.html';
    }
    
    // Remove leading slash and map to dist directory
    const localPath = './dist' + filepath;
    
    // Map file extensions to content types
    const ext = filepath.substring(filepath.lastIndexOf('.'));
    let contentType = 'text/plain';
    
    if (ext === '.html') contentType = 'text/html';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    
    try {
      // Use Node.js fs polyfill to read from local filesystem
      const fs = require('fs');
      const content = fs.readFileSync(localPath, 'utf8');
      
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': contentType }
      });
    } catch (e) {
      console.error('Error reading file:', localPath, e.message);
      return new Response(`Not found: ${filepath}`, { status: 404 });
    }
  }
};

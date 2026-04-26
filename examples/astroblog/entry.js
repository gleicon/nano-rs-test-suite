// Static file server for Astro build
export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;
    
    // Default to index.html for root
    if (path === '/' || path === '') {
      path = '/index.html';
    }
    
    // Map file extensions to content types
    const ext = path.substring(path.lastIndexOf('.'));
    let contentType = 'text/plain';
    
    if (ext === '.html') contentType = 'text/html';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    
    try {
      // Try to read from VFS
      const content = await Nano.fs.readFile(`/dist${path}`, 'utf8');
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': contentType }
      });
    } catch (e) {
      // File not found
      return new Response(`Not found: ${path}`, { status: 404 });
    }
  }
};

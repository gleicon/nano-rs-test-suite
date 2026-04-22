const items = new Map();
let nextId = 1;
items.set(1, { id: 1, title: 'Initial', content: 'Content' });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/api/items' && request.method === 'GET') {
      return new Response(JSON.stringify({ items: Array.from(items.values()) }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/items' && request.method === 'POST') {
      const body = await request.json();
      const id = nextId++;
      const item = { id, ...body };
      items.set(id, item);
      return new Response(JSON.stringify(item), {
        status: 201, headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const match = path.match(/^/api/items/(d+)$/);
    if (match) {
      const id = parseInt(match[1]);
      
      if (request.method === 'GET') {
        const item = items.get(id);
        if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        return new Response(JSON.stringify(item), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      if (request.method === 'PUT') {
        const item = items.get(id);
        if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
        const updates = await request.json();
        const updated = { ...item, ...updates };
        items.set(id, updated);
        return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      if (request.method === 'DELETE') {
        items.delete(id);
        return new Response(null, { status: 204 });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
};
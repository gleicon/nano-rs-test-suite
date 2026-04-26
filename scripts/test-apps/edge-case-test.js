
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Edge Case 1: Empty body POST
    if (url.pathname === '/empty-body') {
      const body = await request.text();
      return new Response(JSON.stringify({ received: body.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 2: Very large headers
    if (url.pathname === '/large-headers') {
      const largeValue = 'x'.repeat(8000);
      return new Response('OK', {
        headers: { 'X-Large-Header': largeValue }
      });
    }
    
    // Edge Case 3: Unicode in body
    if (url.pathname === '/unicode') {
      return new Response(JSON.stringify({ 
        message: 'Hello 世界 🌍 ñoño',
        emoji: '🚀🔥💯'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 4: Special characters in URL
    if (url.pathname === '/special-chars') {
      const params = Object.fromEntries(url.searchParams);
      return new Response(JSON.stringify(params), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 5: Empty JSON response
    if (url.pathname === '/empty-json') {
      return new Response('{}', {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 6: Null/undefined handling
    if (url.pathname === '/null-values') {
      return new Response(JSON.stringify({ 
        nullValue: null,
        undefinedValue: undefined,
        zero: 0,
        emptyString: '',
        falseValue: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 7: Deeply nested JSON
    if (url.pathname === '/deep-nested') {
      const deep = { 
        level1: { 
          level2: { 
            level3: { 
              level4: { 
                level5: 'deep value' 
              } 
            } 
          } 
        } 
      };
      return new Response(JSON.stringify(deep), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 8: Many concurrent headers
    if (url.pathname === '/many-headers') {
      const headers = {};
      for (let i = 0; i < 20; i++) {
        headers['X-Custom-' + i] = 'value-' + i;
      }
      return new Response('OK', { headers });
    }
    
    // Edge Case 9: Binary-ish data (base64)
    if (url.pathname === '/binary-data') {
      const base64 = Buffer.from('Hello World!').toString('base64');
      return new Response(JSON.stringify({ base64 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Edge Case 10: URL with fragments and special chars
    if (url.pathname === '/url-parsing') {
      return new Response(JSON.stringify({
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        host: url.host
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

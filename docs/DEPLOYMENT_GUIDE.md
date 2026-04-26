# NANO-RS Deployment Guide

Production deployment guide for the nano-rs JavaScript edge runtime.

## Quick Start

```bash
# Download binary
wget https://github.com/nano-rs/nano-rs/releases/download/v1.2.4/nano-rs-linux-x64
chmod +x nano-rs-linux-x64

# Create app
mkdir -p /var/www/myapp
cat > /var/www/myapp/index.js << 'EOF'
export default {
  async fetch(request) {
    return new Response('Hello from nano-rs!', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
EOF

# Create config
cat > /etc/nano-rs/config.json << 'EOF'
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  },
  "apps": [
    {
      "hostname": "example.com",
      "entrypoint": "/var/www/myapp/index.js",
      "limits": {
        "workers": 4,
        "memory_mb": 128,
        "timeout_secs": 30
      }
    }
  ]
}
EOF

# Run
./nano-rs-linux-x64 run --config /etc/nano-rs/config.json
```

## System Requirements

### Minimum
- Linux kernel 4.19+ / macOS 10.15+ / Windows 10+
- 512MB RAM
- 1 CPU core

### Recommended for Production
- 2GB+ RAM
- 2+ CPU cores
- SSD storage for app files

## Configuration Reference

### Server Options
```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "tls": {
      "cert": "/path/to/cert.pem",
      "key": "/path/to/key.pem"
    }
  }
}
```

### App Limits
```json
{
  "limits": {
    "workers": 4,
    "memory_mb": 128,
    "timeout_secs": 30
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| workers | 2 | Number of worker threads per app |
| memory_mb | 64 | Memory limit per worker in MB |
| timeout_secs | 30 | Request timeout in seconds |

### Multi-tenant Configuration
```json
{
  "apps": [
    {
      "hostname": "app1.example.com",
      "entrypoint": "/var/www/app1/index.js"
    },
    {
      "hostname": "app2.example.com",
      "entrypoint": "/var/www/app2/index.js"
    }
  ]
}
```

## Process Management

### Systemd Service

Create `/etc/systemd/system/nano-rs.service`:

```ini
[Unit]
Description=nano-rs JavaScript Runtime
After=network.target

[Service]
Type=simple
User=nano
Group=nano
ExecStart=/usr/local/bin/nano-rs run --config /etc/nano-rs/config.json
Restart=always
RestartSec=5
Environment="RUST_LOG=info"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable nano-rs
sudo systemctl start nano-rs
sudo systemctl status nano-rs
```

### Docker

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y ca-certificates

COPY nano-rs /usr/local/bin/
COPY config.json /etc/nano-rs/
COPY apps/ /var/www/

EXPOSE 8080

CMD ["nano-rs", "run", "--config", "/etc/nano-rs/config.json"]
```

```bash
docker build -t nano-rs-app .
docker run -p 8080:8080 nano-rs-app
```

## Reverse Proxy Setup

### Nginx

```nginx
upstream nano_rs {
    server 127.0.0.1:8080;
    keepalive 32;
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://nano_rs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```caddy
example.com {
    reverse_proxy localhost:8080
}
```

### Traefik

```yaml
# docker-compose.yml
services:
  nano-rs:
    image: nano-rs-app
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nano-rs.rule=Host(`example.com`)"
```

## Monitoring

### Health Check Endpoint

Add to your worker:

```javascript
if (url.pathname === '/health') {
  return new Response(JSON.stringify({ 
    status: 'healthy',
    timestamp: Date.now()
  }), { status: 200 });
}
```

### Prometheus Metrics

nano-rs exports metrics at `/_metrics`:

```
nano_requests_total{app="myapp"} 1234
nano_request_duration_seconds{quantile="0.5"} 0.02
nano_memory_bytes{app="myapp"} 52428800
```

### Logging

Set log level:

```bash
RUST_LOG=debug nano-rs run --config config.json
```

Levels: `error`, `warn`, `info`, `debug`, `trace`

## Security Considerations

### App Isolation
- Each app runs in separate V8 isolate
- Memory limits enforced
- No filesystem access (unless explicitly granted)

### Network Security
- Bind to localhost if behind reverse proxy
- Use TLS termination at proxy or nano-rs
- Implement rate limiting at proxy level

### Code Security
```javascript
// Validate all inputs
const url = new URL(request.url);
const id = url.searchParams.get('id');

if (!id || !/^\d+$/.test(id)) {
  return new Response('Invalid ID', { status: 400 });
}
```

## Performance Tuning

### Worker Count
```json
{
  "limits": {
    "workers": 8  // Match CPU cores
  }
}
```

### Memory Tuning
```json
{
  "limits": {
    "memory_mb": 256  // Increase for memory-intensive apps
  }
}
```

### Connection Pooling
- Use `keepalive` in nginx upstream
- Enable HTTP/2 for multiplexing
- Consider connection limits per IP

## Troubleshooting

### App Won't Start
```bash
# Check syntax
node --check /var/www/myapp/index.js

# Check config
nano-rs run --config config.json --dry-run

# Check logs
journalctl -u nano-rs -f
```

### High Memory Usage
- Reduce `memory_mb` limit
- Check for memory leaks in app code
- Monitor with `/_metrics` endpoint

### Slow Requests
- Check worker count vs CPU cores
- Profile app code
- Check database/external service latency

## Production Checklist

- [ ] Binary downloaded and verified
- [ ] Config file created and validated
- [ ] Systemd service configured
- [ ] Reverse proxy configured
- [ ] Health check endpoint implemented
- [ ] Monitoring configured (Prometheus/Grafana)
- [ ] Logging configured
- [ ] TLS certificates configured
- [ ] Rate limiting implemented
- [ ] Backup/recovery plan in place

## Getting Help

- Documentation: https://docs.nano-rs.io
- Issues: https://github.com/nano-rs/nano-rs/issues
- Discussions: https://github.com/nano-rs/nano-rs/discussions

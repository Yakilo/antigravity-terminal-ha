import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import httpProxy from 'http-proxy';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8099;
const ttydPort = 8098;

// ─── API Routes ────────────────────────────────────────────────────────────

// Endpoint to fetch the current app version
app.get('/api/version', (req, res) => {
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    res.json({ version: packageData.version });
  } catch (err) {
    res.json({ version: 'unknown' });
  }
});

// ─── Proxy to ttyd (Raw Terminal) ──────────────────────────────────────────

const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${ttydPort}`,
  ws: true
});

proxy.on('error', (err) => {
  console.error('[Proxy] Connection error:', err.message);
});

// Proxy HTTP requests for /terminal
app.all('/terminal*', (req, res) => {
  req.url = req.url.replace(/^\/terminal/, '') || '/';
  proxy.web(req, res, {}, (err) => {
    console.error('[Proxy] Error forwarding HTTP request:', err.message);
    res.status(502).send('Terminal server unavailable');
  });
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for single page app routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── HTTP Server ───────────────────────────────────────────────────────────

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[Backend] Web Console server listening on port ${port}`);
});

// ─── WebSocket Server ──────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

// Handle manual upgrade events
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname.includes('/terminal')) {
    // Proxy WebSocket to ttyd
    request.url = request.url.replace(/\/terminal/, '');
    proxy.ws(request, socket, head, {}, (err) => {
      console.error('[Proxy] Error forwarding WebSocket upgrade:', err.message);
      socket.destroy();
    });
  } else {
    // Handle Chat WebSocket connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// ─── Shared Tmux Screen Capture Engine ─────────────────────────────────────
// Single capture loop shared across all connected WebSocket clients.
// This prevents spawning N processes per interval with N clients.

const connectedClients = new Set();
let lastCapturedText = '';
let captureInterval = null;

// Helper to strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function captureTmuxScreen() {
  const tmuxCapture = spawn('tmux', ['capture-pane', '-t', 'agy', '-p']);
  let output = '';

  tmuxCapture.stdout.on('data', (data) => {
    output += data.toString();
  });

  tmuxCapture.on('close', (code) => {
    if (code === 0 && output !== lastCapturedText) {
      lastCapturedText = output;

      const cleanText = stripAnsi(output);
      const isPrompt = cleanText.includes('[y/N]') || cleanText.includes('Select login method:');

      const payload = JSON.stringify({
        type: 'output',
        data: output,
        clean: cleanText,
        isPrompt: isPrompt
      });

      // Broadcast to all connected clients
      for (const client of connectedClients) {
        if (client.readyState === client.OPEN) {
          client.send(payload);
        }
      }
    }
  });

  tmuxCapture.on('error', (err) => {
    // tmux may not be ready yet on first connect
    if (err.code !== 'ENOENT') {
      console.error('[Tmux] Capture error:', err.message);
    }
  });
}

function startCaptureLoop() {
  if (captureInterval) return; // Already running
  console.log('[Capture] Starting shared tmux capture loop (500ms interval)');
  captureInterval = setInterval(captureTmuxScreen, 500);
  captureTmuxScreen(); // Immediate first capture
}

function stopCaptureLoop() {
  if (captureInterval && connectedClients.size === 0) {
    console.log('[Capture] No clients connected, stopping capture loop');
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

// ─── WebSocket Connection Handler ──────────────────────────────────────────

wss.on('connection', (ws) => {
  console.log(`[WebSocket] Client connected (total: ${connectedClients.size + 1})`);
  connectedClients.add(ws);
  startCaptureLoop();

  // Send last known screen state immediately so new clients aren't blank
  if (lastCapturedText) {
    const cleanText = stripAnsi(lastCapturedText);
    ws.send(JSON.stringify({
      type: 'output',
      data: lastCapturedText,
      clean: cleanText,
      isPrompt: cleanText.includes('[y/N]') || cleanText.includes('Select login method:')
    }));
  }

  // Handle incoming messages from frontend
  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (payload.type === 'input') {
        const inputText = payload.data;
        console.log(`[WebSocket] Input → tmux: ${inputText.substring(0, 80)}`);

        const tmuxSend = spawn('tmux', ['send-keys', '-t', 'agy', inputText, 'Enter']);

        tmuxSend.on('close', (code) => {
          if (code !== 0) {
            console.error(`[Tmux] Failed to send keys. Code: ${code}`);
          } else {
            // Quick capture after input for responsive feel
            setTimeout(captureTmuxScreen, 100);
          }
        });

        tmuxSend.on('error', (err) => {
          console.error('[Tmux] Send error:', err.message);
        });
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing client message:', err.message);
    }
  });

  // Clean up on disconnect
  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WebSocket] Client disconnected (remaining: ${connectedClients.size})`);
    stopCaptureLoop();
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Error:', err.message);
    connectedClients.delete(ws);
    stopCaptureLoop();
  });
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(`[Backend] Received ${signal}, shutting down gracefully...`);

  // Stop capture loop
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  // Close all WebSocket connections
  for (const client of connectedClients) {
    client.close(1001, 'Server shutting down');
  }
  connectedClients.clear();

  // Close HTTP server
  server.close(() => {
    console.log('[Backend] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful close hangs
  setTimeout(() => {
    console.error('[Backend] Forced exit after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

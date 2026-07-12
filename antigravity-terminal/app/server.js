import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import httpProxy from 'http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8099;
const ttydPort = 8098;

// Create http proxy
const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${ttydPort}`,
  ws: true
});

// Proxy HTTP requests for /terminal
app.all('/terminal*', (req, res) => {
  // Rewrite path to remove /terminal prefix when passing to ttyd
  req.url = req.url.replace(/^\/terminal/, '') || '/';
  proxy.web(req, res, {}, (err) => {
    console.error('[Proxy] Error forwarding HTTP request:', err);
    res.status(502).send('Terminal server unavailable');
  });
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for single page app routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[Backend] Web GUI server listening on port ${port}`);
});

// Create WebSocket server (not attached to HTTP server directly, we handle upgrades manually)
const wss = new WebSocketServer({ noServer: true });

// Handle manual upgrade events
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  // If path contains /terminal, proxy WebSocket to ttyd
  if (pathname.includes('/terminal')) {
    // Rewrite path for ttyd
    request.url = request.url.replace(/\/terminal/, '');
    proxy.ws(request, socket, head, {}, (err) => {
      console.error('[Proxy] Error forwarding WebSocket upgrade:', err);
    });
  } else {
    // Handle standard Chat WebSocket connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Helper to strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');

  let captureInterval = null;
  let lastCapturedText = '';

  // Function to capture the current tmux terminal screen
  const captureTmuxScreen = () => {
    if (process.platform === 'win32') {
      // Local Windows fallback simulation
      ws.send(JSON.stringify({
        type: 'output',
        clean: 'Windows mode: Tmux emulation is active. Type commands in input.'
      }));
      return;
    }

    // Execute tmux capture-pane to fetch the screen content of the terminal
    // -t agy: targeted pane
    // -p: print to stdout
    const tmuxCapture = spawn('tmux', ['capture-pane', '-t', 'agy', '-p']);
    let output = '';

    tmuxCapture.stdout.on('data', (data) => {
      output += data.toString();
    });

    tmuxCapture.on('close', (code) => {
      if (code === 0 && output !== lastCapturedText) {
        lastCapturedText = output;
        
        // Strip ANSI codes if needed (or let the terminal render them)
        const cleanText = stripAnsi(output);
        
        // Check if there is an active prompt
        let isPrompt = cleanText.includes('[y/N]') || cleanText.includes('Select login method:');

        ws.send(JSON.stringify({
          type: 'output',
          data: output,
          clean: cleanText,
          isPrompt: isPrompt
        }));
      }
    });
  };

  // Start polling the tmux screen state (every 800ms for fast feedback)
  if (process.platform !== 'win32') {
    captureInterval = setInterval(captureTmuxScreen, 800);
    // Initial capture
    captureTmuxScreen();
  }

  // Handle incoming messages from frontend
  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (payload.type === 'input') {
        const inputText = payload.data;
        console.log(`[WebSocket] Received input to send to tmux: ${inputText.trim()}`);

        if (process.platform === 'win32') {
          // Windows simulator echoing back input
          ws.send(JSON.stringify({
            type: 'output',
            clean: `Echo (Windows): ${inputText}`
          }));
          return;
        }

        // Send the input keys directly into the running tmux panel
        // tmux send-keys -t agy "keys" Enter
        const tmuxSend = spawn('tmux', ['send-keys', '-t', 'agy', inputText, 'Enter']);
        
        tmuxSend.on('close', (code) => {
          if (code !== 0) {
            console.error(`[Tmux] Failed to send keys to session. Code: ${code}`);
          } else {
            // Instantly capture after sending keys to make the UI feel fast
            setTimeout(captureTmuxScreen, 100);
          }
        });
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing client message:', err);
    }
  });

  // Clean up on disconnect
  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    if (captureInterval) {
      clearInterval(captureInterval);
    }
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Error:', err);
    if (captureInterval) {
      clearInterval(captureInterval);
    }
  });
});

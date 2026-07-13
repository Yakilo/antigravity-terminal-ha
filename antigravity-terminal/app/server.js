import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import httpProxy from 'http-proxy';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8099;
const ttydPort = 8098;

const SESSIONS_FILE = fs.existsSync('/data') 
  ? '/data/sessions.json' 
  : path.join(__dirname, 'sessions.json');

// Helper to load sessions metadata
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Sessions] Error loading sessions:', err.message);
  }
  // Default to a single session if none exists
  return [{ id: 'agy', title: 'Default Chat', createdAt: Date.now() }];
}

// Helper to save sessions metadata
function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err) {
    console.error('[Sessions] Error saving sessions:', err.message);
  }
}

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

// ─── Shared Multi-Session Tmux Screen Capture Engine ────────────────────────

const connectedClients = new Set();
const lastCapturedTextMap = new Map();
let captureInterval = null;

// Helper to strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

// Verify dynamic tmux sessions match list
function ensureTmuxSessionExists(sessionId) {
  try {
    execSync(`tmux has-session -t ${sessionId} 2>/dev/null`);
  } catch (err) {
    console.log(`[Tmux] Spawning new session: ${sessionId}`);
    const launchCmd = 'if command -v agy &>/dev/null; then agy; else exec bash; fi';
    spawn('tmux', ['new-session', '-d', '-s', sessionId, '-c', '/config', 'bash', '-c', launchCmd]);
  }
}

function captureTmuxSession(sessionId) {
  ensureTmuxSessionExists(sessionId);
  const tmuxCapture = spawn('tmux', ['capture-pane', '-t', sessionId, '-p']);
  let output = '';

  tmuxCapture.stdout.on('data', (data) => {
    output += data.toString();
  });

  tmuxCapture.on('close', (code) => {
    const lastText = lastCapturedTextMap.get(sessionId) || '';
    if (code === 0 && output !== lastText) {
      lastCapturedTextMap.set(sessionId, output);

      const cleanText = stripAnsi(output);
      const isPrompt = cleanText.includes('[y/N]') || 
                       cleanText.includes('Select login method:') ||
                       cleanText.includes('Choose your color scheme:') ||
                       cleanText.includes('Do you trust the contents of this project?');

      const payload = JSON.stringify({
        type: 'output',
        sessionId: sessionId,
        data: output,
        clean: cleanText,
        isPrompt: isPrompt
      });

      // Broadcast only to clients viewing this session
      for (const client of connectedClients) {
        if (client.readyState === client.OPEN && client.sessionId === sessionId) {
          client.send(payload);
        }
      }
    }
  });

  tmuxCapture.on('error', (err) => {
    if (err.code !== 'ENOENT') {
      console.error(`[Tmux] Capture error on session ${sessionId}:`, err.message);
    }
  });
}

function captureAllActiveSessions() {
  const activeSessions = new Set();
  for (const client of connectedClients) {
    if (client.sessionId) {
      activeSessions.add(client.sessionId);
    }
  }
  for (const sessionId of activeSessions) {
    captureTmuxSession(sessionId);
  }
}

function startCaptureLoop() {
  if (captureInterval) return;
  console.log('[Capture] Starting shared multi-session capture loop (500ms)');
  captureInterval = setInterval(captureAllActiveSessions, 500);
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
  connectedClients.add(ws);
  startCaptureLoop();

  // Load session list and active session
  let sessions = loadSessions();
  
  // Default to the first session in the list
  ws.sessionId = sessions[0]?.id || 'agy';
  ensureTmuxSessionExists(ws.sessionId);

  // Send initial session list and active state
  ws.send(JSON.stringify({
    type: 'sessions',
    sessions: sessions,
    activeSessionId: ws.sessionId
  }));

  // Send last known screen state for active session immediately
  const lastText = lastCapturedTextMap.get(ws.sessionId);
  if (lastText) {
    const cleanText = stripAnsi(lastText);
    ws.send(JSON.stringify({
      type: 'output',
      sessionId: ws.sessionId,
      data: lastText,
      clean: cleanText,
      isPrompt: cleanText.includes('[y/N]') || 
               cleanText.includes('Select login method:') ||
               cleanText.includes('Choose your color scheme:') ||
               cleanText.includes('Do you trust the contents of this project?')
    }));
  }

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (payload.type === 'select_session') {
        const targetSessionId = payload.sessionId;
        ensureTmuxSessionExists(targetSessionId);
        ws.sessionId = targetSessionId;
        
        // Write active session configuration for ttyd to attach to
        try {
          fs.writeFileSync('/tmp/active_ttyd_session', targetSessionId, 'utf8');
        } catch (e) {
          // ignore
        }

        // Send confirmation and current screen state
        ws.send(JSON.stringify({
          type: 'active_session_changed',
          activeSessionId: targetSessionId
        }));

        const lastText = lastCapturedTextMap.get(targetSessionId) || '';
        const cleanText = stripAnsi(lastText);
        ws.send(JSON.stringify({
          type: 'output',
          sessionId: targetSessionId,
          data: lastText,
          clean: cleanText,
          isPrompt: cleanText.includes('[y/N]') || 
                   cleanText.includes('Select login method:') ||
                   cleanText.includes('Choose your color scheme:') ||
                   cleanText.includes('Do you trust the contents of this project?')
        }));
      } 
      
      else if (payload.type === 'create_session') {
        let sessions = loadSessions();
        const newId = `agy-${Date.now()}`;
        const newTitle = payload.title || `Chat ${sessions.length + 1}`;
        
        sessions.push({
          id: newId,
          title: newTitle,
          createdAt: Date.now()
        });
        saveSessions(sessions);
        ensureTmuxSessionExists(newId);

        // Switch this client's active session
        ws.sessionId = newId;

        // Broadcast updated session lists to all connected clients
        const listPayload = JSON.stringify({
          type: 'sessions',
          sessions: sessions
        });
        for (const client of connectedClients) {
          if (client.readyState === client.OPEN) {
            client.send(listPayload);
            if (client === ws) {
              client.send(JSON.stringify({
                type: 'active_session_changed',
                activeSessionId: newId
              }));
            }
          }
        }
      } 

      else if (payload.type === 'delete_session') {
        const deleteId = payload.sessionId;
        let sessions = loadSessions();
        
        // Keep at least one default session
        if (sessions.length <= 1) {
          return;
        }

        sessions = sessions.filter(s => s.id !== deleteId);
        saveSessions(sessions);

        // Kill corresponding tmux session
        try {
          execSync(`tmux kill-session -t ${deleteId} 2>/dev/null`);
        } catch (err) {
          // ignore
        }

        // Remove from output cache
        lastCapturedTextMap.delete(deleteId);

        // Broadcast updated session list
        const listPayload = JSON.stringify({
          type: 'sessions',
          sessions: sessions
        });
        
        for (const client of connectedClients) {
          if (client.readyState === client.OPEN) {
            client.send(listPayload);
            // If the deleted session was active for this client, switch to fallback
            if (client.sessionId === deleteId) {
              const fallbackId = sessions[0].id;
              client.sessionId = fallbackId;
              client.send(JSON.stringify({
                type: 'active_session_changed',
                activeSessionId: fallbackId
              }));
            }
          }
        }
      } 

      else if (payload.type === 'rename_session') {
        const renameId = payload.sessionId;
        const newTitle = payload.title;
        let sessions = loadSessions();
        
        const session = sessions.find(s => s.id === renameId);
        if (session) {
          session.title = newTitle;
          saveSessions(sessions);

          // Broadcast updated session lists
          const listPayload = JSON.stringify({
            type: 'sessions',
            sessions: sessions
          });
          for (const client of connectedClients) {
            if (client.readyState === client.OPEN) {
              client.send(listPayload);
            }
          }
        }
      }

      else if (payload.type === 'input') {
        const inputData = payload.data;
        const keys = Array.isArray(inputData) ? inputData : [inputData];
        if (payload.sendEnter !== false) {
          keys.push('Enter');
        }
        console.log(`[WebSocket] Input → tmux [${ws.sessionId}]: send-keys ${keys.join(' ')}`);

        const tmuxSend = spawn('tmux', ['send-keys', '-t', ws.sessionId, ...keys]);

        tmuxSend.on('close', (code) => {
          if (code === 0) {
            setTimeout(() => captureTmuxSession(ws.sessionId), 100);
          }
        });
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing client message:', err.message);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
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
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  for (const client of connectedClients) {
    client.close(1001, 'Server shutting down');
  }
  connectedClients.clear();
  server.close(() => {
    console.log('[Backend] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Backend] Forced exit after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

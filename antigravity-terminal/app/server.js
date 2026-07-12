import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8099;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for single page app routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[Backend] Web GUI server listening on port ${port}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Helper to strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');

  // Environment variables for agy
  const env = {
    ...process.env,
    HOME: '/root',
    PATH: '/root/.local/bin:/usr/local/bin:' + (process.env.PATH || ''),
    TERM: 'xterm-256color',
    FORCE_COLOR: '1'
  };

  // Spawn agy process
  // We use bash -c wrapper so that PATH is fully resolved and agy runs in a shell context
  const agyProcess = spawn('bash', ['-c', 'agy'], {
    env,
    cwd: '/config'
  });

  console.log(`[Process] Spawned agy (PID: ${agyProcess.pid})`);

  // Handle data from agy stdout
  agyProcess.stdout.on('data', (data) => {
    const rawText = data.toString();
    const cleanText = stripAnsi(rawText);

    // Parse potential interactive questions/permission prompts
    // e.g., "Do you want to run this command? [y/N]" or OAuth login prompts
    let isPrompt = false;
    if (cleanText.includes('[y/N]') || cleanText.includes('[Use arrow keys') || cleanText.includes('Select login method:')) {
      isPrompt = true;
    }

    // Send payload to frontend
    ws.send(JSON.stringify({
      type: 'output',
      data: rawText,
      clean: cleanText,
      isPrompt: isPrompt
    }));
  });

  // Handle data from agy stderr
  agyProcess.stderr.on('data', (data) => {
    const rawText = data.toString();
    ws.send(JSON.stringify({
      type: 'error',
      data: rawText,
      clean: stripAnsi(rawText)
    }));
  });

  // Handle process exit
  agyProcess.on('exit', (code) => {
    console.log(`[Process] agy exited with code ${code}`);
    ws.send(JSON.stringify({
      type: 'exit',
      code: code
    }));
  });

  // Handle incoming messages from frontend
  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (payload.type === 'input') {
        console.log(`[WebSocket] Received input: ${payload.data.trim()}`);
        agyProcess.stdin.write(payload.data + '\n');
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing client message:', err);
    }
  });

  // Clean up on disconnect
  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected. Terminating agy process...');
    agyProcess.kill('SIGTERM');
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Error:', err);
    agyProcess.kill('SIGKILL');
  });
});

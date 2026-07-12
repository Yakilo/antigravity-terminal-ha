// WebSocket management
let socket = null;
let currentAgentMessageElement = null;
let isStreaming = false;

const chatMessages = document.getElementById('chat-messages');
const inputForm = document.getElementById('input-form');
const userInput = document.getElementById('user-input');
const connectionStatus = document.getElementById('connection-status');
const promptHelper = document.getElementById('prompt-helper');
const promptHelperText = document.getElementById('prompt-helper-text');
const btnApprove = document.getElementById('btn-approve');
const btnDeny = document.getElementById('btn-deny');

// Connect to WebSocket server
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WebSocket] Connected');
    setConnectionState(true);
    addSystemMessage('🔌 Verbindung zur Antigravity CLI hergestellt.');
  };

  socket.onclose = () => {
    console.log('[WebSocket] Disconnected. Reconnecting in 3s...');
    setConnectionState(false);
    addSystemMessage('❌ Verbindung getrennt. Reconnect wird versucht...');
    promptHelper.classList.add('hidden');
    setTimeout(connect, 3000);
  };

  socket.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
    setConnectionState(false);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'output') {
        handleAgentOutput(message.clean, message.isPrompt);
      } else if (message.type === 'error') {
        handleAgentOutput(message.clean, false, true);
      } else if (message.type === 'exit') {
        addSystemMessage(`⏹️ CLI-Prozess beendet (Exit Code: ${message.code})`);
        promptHelper.classList.add('hidden');
        isStreaming = false;
        currentAgentMessageElement = null;
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing server message:', err);
    }
  };
}

// Update connection badge UI
function setConnectionState(connected) {
  if (connected) {
    connectionStatus.className = 'status-indicator connected';
    connectionStatus.querySelector('.status-label').innerText = 'Verbunden';
  } else {
    connectionStatus.className = 'status-indicator disconnected';
    connectionStatus.querySelector('.status-label').innerText = 'Getrennt';
  }
}

// Simple markdown formatter
function formatMarkdown(text) {
  let html = text;

  // Escape HTML characters to prevent XSS (except links/codes we generate)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold text: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Bullet lists: - item or * item
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Convert URLs to links (Linkify)
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  html = html.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');

  return html;
}

// Append or stream text from Agent
function handleAgentOutput(text, isPrompt, isError = false) {
  if (!text || text.trim() === '') return;

  // Auto-scroll to bottom
  const shouldScroll = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 100;

  // Detect and format prompt choices
  if (isPrompt) {
    showPromptHelper(text);
  }

  // If we are currently streaming and have an active agent bubble, append
  if (isStreaming && currentAgentMessageElement) {
    const bubble = currentAgentMessageElement.querySelector('.message-content');
    const updatedRaw = bubble.getAttribute('data-raw') + text;
    bubble.setAttribute('data-raw', updatedRaw);
    bubble.innerHTML = formatMarkdown(updatedRaw);
  } else {
    // Start a new agent message bubble
    isStreaming = true;
    currentAgentMessageElement = document.createElement('div');
    currentAgentMessageElement.className = `message ${isError ? 'system' : 'agent'}`;

    const content = document.createElement('div');
    content.className = 'message-content';
    content.setAttribute('data-raw', text);
    content.innerHTML = formatMarkdown(text);

    currentAgentMessageElement.appendChild(content);
    chatMessages.appendChild(currentAgentMessageElement);
  }

  if (shouldScroll) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Append a system notification
function addSystemMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'message system';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerText = text;
  msg.appendChild(content);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show the quick y/N confirmation panel
function showPromptHelper(promptText) {
  // Strip trailing prompts if clean
  const cleanPrompt = promptText.replace(/\[y\/N\]/gi, '').trim();
  promptHelperText.innerText = cleanPrompt || 'Aktion bestätigen:';
  promptHelper.classList.remove('hidden');
}

// Send user input to server
function sendInput(text) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    addSystemMessage('⚠️ Senden fehlgeschlagen: Keine Serververbindung.');
    return;
  }

  // Create user bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerText = text;
  userMsg.appendChild(content);
  chatMessages.appendChild(userMsg);
  
  // Reset streaming state so next output creates a new bubble
  isStreaming = false;
  currentAgentMessageElement = null;

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Send payload
  socket.send(JSON.stringify({
    type: 'input',
    data: text
  }));
}

// Auto-adjust height of textarea while typing
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = (userInput.scrollHeight - 4) + 'px';
});

// Handle form submission (Enter or Send Button)
inputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (text === '') return;

  sendInput(text);

  userInput.value = '';
  userInput.style.height = 'auto';
});

// Submit on Enter key (without Shift)
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    inputForm.requestSubmit();
  }
});

// Hook prompt helper buttons
btnApprove.addEventListener('click', () => {
  sendInput('y');
  promptHelper.classList.add('hidden');
});

btnDeny.addEventListener('click', () => {
  sendInput('n');
  promptHelper.classList.add('hidden');
});

// Start connection
connect();

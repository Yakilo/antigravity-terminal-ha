// ─── DOM Elements ──────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chat-messages');
const inputForm = document.getElementById('input-form');
const userInput = document.getElementById('user-input');
const connectionStatus = document.getElementById('connection-status');
const promptHelper = document.getElementById('prompt-helper');
const promptHelperText = document.getElementById('prompt-helper-text');
const btnApprove = document.getElementById('btn-approve');
const btnDeny = document.getElementById('btn-deny');

const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const sessionsList = document.getElementById('sessions-list');
const chatContainer = document.getElementById('chat-container');
const setupWizardContainer = document.getElementById('setup-wizard-container');
const inputAreaContainer = document.getElementById('input-area-container');

const toggleViewBtn = document.getElementById('toggle-view');
const terminalFrame = document.getElementById('terminal-frame');
const appVersion = document.getElementById('app-version');

// ─── App State ──────────────────────────────────────────────────────────────
let socket = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

let currentSessionId = 'agy';
let allSessions = [];
let isTerminalView = false;
let highlightedChoiceIdx = -1;

// ─── Version Fetcher ────────────────────────────────────────────────────────
async function fetchVersion() {
  try {
    const res = await fetch('./api/version');
    const data = await res.json();
    if (data.version && appVersion) {
      appVersion.innerText = `v${data.version}`;
    }
  } catch (err) {
    console.error('Error fetching version:', err);
  }
}
fetchVersion();

// ─── Sidebar Toggle ─────────────────────────────────────────────────────────
if (toggleSidebarBtn) {
  toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

// ─── Raw Terminal View Toggle ───────────────────────────────────────────────
if (toggleViewBtn) {
  toggleViewBtn.addEventListener('click', () => {
    isTerminalView = !isTerminalView;
    if (isTerminalView) {
      toggleViewBtn.innerText = 'Show Chat';
      toggleViewBtn.classList.add('active');
      terminalFrame.classList.remove('hidden');
      
      // Load current ttyd session url
      const path = window.location.pathname.replace(/\/$/, '');
      terminalFrame.src = `${path}/terminal/`;
    } else {
      toggleViewBtn.innerText = 'Show Terminal';
      toggleViewBtn.classList.remove('active');
      terminalFrame.classList.add('hidden');
      terminalFrame.src = '';
    }
  });
}

// ─── WebSocket Management ──────────────────────────────────────────────────
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = window.location.pathname.replace(/\/$/, '');
  const wsUrl = `${protocol}//${window.location.host}${path}/ws`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WebSocket] Connected');
    reconnectDelay = 1000;
    setConnectionState(true);
  };

  socket.onclose = () => {
    console.log(`[WebSocket] Disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
    setConnectionState(false);
    promptHelper.classList.add('hidden');
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5 + Math.random() * 500, MAX_RECONNECT_DELAY);
  };

  socket.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
    setConnectionState(false);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'sessions') {
        allSessions = message.sessions;
        if (message.activeSessionId) {
          currentSessionId = message.activeSessionId;
        }
        renderSessionsList();
      } 
      
      else if (message.type === 'active_session_changed') {
        currentSessionId = message.activeSessionId;
        updateActiveSessionUI();
        
        // If viewing terminal, reload the terminal to point to new tmux attachment
        if (isTerminalView) {
          const path = window.location.pathname.replace(/\/$/, '');
          terminalFrame.src = `${path}/terminal/`;
        }
      } 
      
      else if (message.type === 'output') {
        if (message.sessionId === currentSessionId) {
          processOutput(message.clean, message.isPrompt);
        }
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing message:', err);
    }
  };
}

function setConnectionState(connected) {
  if (connected) {
    connectionStatus.className = 'status-indicator connected';
    connectionStatus.querySelector('.status-label').innerText = 'Connected';
  } else {
    connectionStatus.className = 'status-indicator disconnected';
    connectionStatus.querySelector('.status-label').innerText = 'Disconnected';
  }
}

// ─── Sidebar Sessions List Rendering ─────────────────────────────────────────────
function renderSessionsList() {
  sessionsList.innerHTML = '';
  
  allSessions.forEach(session => {
    const item = document.createElement('div');
    item.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
    item.setAttribute('data-id', session.id);

    // Title label
    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'session-title-wrapper';
    
    // Bubble Icon
    titleWrapper.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="session-title">${escapeHtml(session.title)}</span>
    `;

    // Action buttons (rename & delete)
    const actions = document.createElement('div');
    actions.className = 'session-actions';

    // Rename
    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn-session-action rename';
    renameBtn.title = 'Rename Chat';
    renameBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/>
      </svg>
    `;
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newTitle = prompt('Enter new name:', session.title);
      if (newTitle && newTitle.trim() !== '') {
        socket.send(JSON.stringify({
          type: 'rename_session',
          sessionId: session.id,
          title: newTitle.trim()
        }));
      }
    });

    // Delete (only show if multiple sessions exist)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-session-action delete';
    deleteBtn.title = 'Delete Chat';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
      </svg>
    `;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete "${session.title}"?`)) {
        socket.send(JSON.stringify({
          type: 'delete_session',
          sessionId: session.id
        }));
      }
    });

    actions.appendChild(renameBtn);
    if (allSessions.length > 1) {
      actions.appendChild(deleteBtn);
    }

    item.appendChild(titleWrapper);
    item.appendChild(actions);

    item.addEventListener('click', () => {
      if (session.id !== currentSessionId) {
        socket.send(JSON.stringify({
          type: 'select_session',
          sessionId: session.id
        }));
      }
    });

    sessionsList.appendChild(item);
  });
}

function updateActiveSessionUI() {
  document.querySelectorAll('.session-item').forEach(item => {
    if (item.getAttribute('data-id') === currentSessionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

if (newChatBtn) {
  newChatBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
      type: 'create_session'
    }));
  });
}

// ─── Wizard Sniffer & Output Router ─────────────────────────────────────────
function processOutput(cleanText, isPrompt) {
  // Sniff setup screens
  if (cleanText.includes('Select login method:')) {
    renderLoginWizard();
  } else if (cleanText.includes('paste the authorization code below:')) {
    renderAuthCodeWizard(cleanText);
  } else if (cleanText.includes('Choose your color scheme:')) {
    renderThemeWizard(cleanText);
  } else if (cleanText.includes('Terms of Service & Data Use')) {
    renderTermsWizard(cleanText);
  } else if (cleanText.includes('Do you trust the contents of this project?')) {
    renderTrustFolderWizard(cleanText);
  } else {
    // Regular chat output
    setupWizardContainer.classList.add('hidden');
    chatMessages.classList.remove('hidden');
    inputAreaContainer.classList.remove('hidden');
    
    renderChatMessages(cleanText, isPrompt);
  }
}

// ─── Render Setup Wizard Views ──────────────────────────────────────────────

function drawWizardHeader(title, subtitle) {
  return `
    <div class="wizard-header">
      <div class="wizard-logo-float">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22H22L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M12 8L6 20H18L12 8Z" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
  `;
}

// 1. Login selection
function renderLoginWizard() {
  setupWizardContainer.innerHTML = `
    <div class="wizard-card">
      ${drawWizardHeader('Welcome to Antigravity CLI', 'Select a login method to authenticate with Google.')}
      <div class="wizard-content">
        <div class="wizard-grid">
          <div class="wizard-choice-card" id="login-oauth">
            <span class="badge">Recommended</span>
            <h3>Google OAuth</h3>
            <p>Log in dynamically using your personal Google Account web flow.</p>
          </div>
          <div class="wizard-choice-card" id="login-cloud">
            <h3>Google Cloud Project</h3>
            <p>Connect using an existing service account or custom Google Cloud configuration.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  setupWizardContainer.classList.remove('hidden');
  chatMessages.classList.add('hidden');
  inputAreaContainer.classList.add('hidden');

  document.getElementById('login-oauth').addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: '1' }));
  });
  document.getElementById('login-cloud').addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: '2' }));
  });
}

// 2. Auth code entry
function renderAuthCodeWizard(cleanText) {
  // Extract long oauth URL
  const urlRegex = /(https:\/\/accounts\.google\.com\/o\/oauth2\/auth\S+)/;
  const match = cleanText.match(urlRegex);
  const authUrl = match ? match[1] : '#';

  setupWizardContainer.innerHTML = `
    <div class="wizard-card">
      ${drawWizardHeader('Authenticate Account', 'Please authorize Antigravity CLI to access your Google services.')}
      <div class="wizard-content">
        <p style="font-size:13.5px;color:var(--text-muted);text-align:center;">
          Click the button below to sign in and copy the authorization code.
        </p>
        <a href="${authUrl}" target="_blank" rel="noopener" class="wizard-btn-submit" style="text-decoration:none;">
          🌐 Open Authorization Link
        </a>
        <div class="wizard-input-wrapper" style="margin-top:16px;">
          <label style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Authorization Code</label>
          <input type="text" class="wizard-input-field" id="wizard-auth-code" placeholder="Paste the code here..." autocomplete="off">
        </div>
        <button class="wizard-btn-submit" id="wizard-auth-submit" style="margin-top:8px;">
          Verify & Continue
        </button>
      </div>
    </div>
  `;
  setupWizardContainer.classList.remove('hidden');
  chatMessages.classList.add('hidden');
  inputAreaContainer.classList.add('hidden');

  const inputField = document.getElementById('wizard-auth-code');
  const submitBtn = document.getElementById('wizard-auth-submit');

  const submitCode = () => {
    const code = inputField.value.trim();
    if (code !== '') {
      socket.send(JSON.stringify({ type: 'input', data: code }));
    }
  };

  submitBtn.addEventListener('click', submitCode);
  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCode();
  });
}

// 3. Theme selector
function renderThemeWizard(cleanText) {
  // Parse theme choices and active state
  const lines = cleanText.split('\n');
  const themes = [
    'terminal', 'light', 'solarized light', 'colorblind-friendly light',
    'dark', 'solarized dark', 'colorblind-friendly dark', 'tokyo night'
  ];
  
  // Find which theme currently has the active highlight ">"
  let activeThemeIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    for (let t = 0; t < themes.length; t++) {
      if (trimmed === `> ${themes[t]}` || trimmed === themes[t]) {
        if (trimmed.startsWith('>')) {
          activeThemeIdx = t;
        }
      }
    }
  }

  // Predefined code preview snippets per theme to look stunning
  const codePreviews = {
    terminal: `<span style="color:#4e9a06;">> you: add a greeting function</span>\n\n<span style="color:#8ae234;">Here's the change:</span>\n3  import "fmt"\n4  \n5  <span style="color:#cc0000;">- func main() {</span>\n5  <span style="color:#4e9a06;">+ func greet(name string) {</span>\n6  <span style="color:#4e9a06;">+     fmt.Printf("Hello, %s!\\n", name)</span>\n7  }`,
    light: `<span style="color:#008000;">> you: add a greeting function</span>\n\n<span style="color:#0000ff;">Here's the change:</span>\n3  import "fmt"\n4  \n5  <span style="color:#ff0000;">- func main() {</span>\n5  <span style="color:#008000;">+ func greet(name string) {</span>\n6  <span style="color:#008000;">+     fmt.Printf("Hello, %s!\\n", name)</span>\n7  }`,
    dark: `<span style="color:#50fa7b;">> you: add a greeting function</span>\n\n<span style="color:#8be9fd;">Here's the change:</span>\n3  import "fmt"\n4  \n5  <span style="color:#ff5555;">- func main() {</span>\n5  <span style="color:#50fa7b;">+ func greet(name string) {</span>\n6  <span style="color:#50fa7b;">+     fmt.Printf("Hello, %s!\\n", name)</span>\n7  }`
  };
  const defaultPreview = codePreviews.dark;

  let themesListHtml = '';
  themes.forEach((theme, idx) => {
    themesListHtml += `
      <button class="theme-option-btn ${idx === activeThemeIdx ? 'active' : ''}" data-idx="${idx}">
        ${theme}
      </button>
    `;
  });

  setupWizardContainer.innerHTML = `
    <div class="wizard-card" style="max-width: 680px;">
      ${drawWizardHeader('Console Theme', 'Choose your preferred TUI and layout visual presentation.')}
      <div class="wizard-content">
        <div class="theme-wizard-layout">
          <div class="theme-options-list">
            ${themesListHtml}
          </div>
          <div class="theme-preview-box">
            ${codePreviews[themes[activeThemeIdx]] || defaultPreview}
          </div>
        </div>
        <button class="wizard-btn-submit" id="theme-wizard-confirm" style="margin-top:12px;">
          Confirm Theme
        </button>
      </div>
    </div>
  `;
  setupWizardContainer.classList.remove('hidden');
  chatMessages.classList.add('hidden');
  inputAreaContainer.classList.add('hidden');

  // Add click handlers on theme options
  document.querySelectorAll('.theme-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const clickedIdx = parseInt(btn.getAttribute('data-idx'));
      const diff = clickedIdx - activeThemeIdx;
      
      const commands = [];
      if (diff > 0) {
        for (let i = 0; i < diff; i++) commands.push('Down');
      } else if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) commands.push('Up');
      }
      
      if (commands.length > 0) {
        socket.send(JSON.stringify({
          type: 'input',
          data: commands,
          sendEnter: false
        }));
      }
    });
  });

  document.getElementById('theme-wizard-confirm').addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'Enter', sendEnter: false }));
  });
}

// 4. Terms of Service
function renderTermsWizard(cleanText) {
  setupWizardContainer.innerHTML = `
    <div class="wizard-card">
      ${drawWizardHeader('Terms of Service', 'Review the terms and data collection agreement.')}
      <div class="wizard-content">
        <div class="wizard-tos-box">
          Terms of Service & Data Use\n\nAI coding agents are known to have certain security risks, including autonomous code execution, data exfiltration, prompt injection and supply chain risks. Ensure that you monitor and verify all actions taken by the agent.
        </div>
        <label class="tos-checkbox-label">
          <input type="checkbox" id="tos-checkbox">
          I agree to help improve Antigravity CLI by allowing Google to collect and use my interactions data.
        </label>
        <div class="wizard-button-group">
          <button class="wizard-btn-secondary" id="tos-wizard-prev">Previous</button>
          <button class="wizard-btn-primary" id="tos-wizard-done">Accept & Continue</button>
        </div>
      </div>
    </div>
  `;
  setupWizardContainer.classList.remove('hidden');
  chatMessages.classList.add('hidden');
  inputAreaContainer.classList.add('hidden');

  const checkbox = document.getElementById('tos-checkbox');
  const doneBtn = document.getElementById('tos-wizard-done');
  const prevBtn = document.getElementById('tos-wizard-prev');

  const isChecked = cleanText.includes('[x] Yes');
  checkbox.checked = isChecked;

  checkbox.addEventListener('change', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'Space', sendEnter: false }));
  });

  prevBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'Left', sendEnter: false }));
  });

  doneBtn.addEventListener('click', () => {
    if (!checkbox.checked) {
      alert('You must accept the terms to continue.');
      return;
    }
    socket.send(JSON.stringify({ type: 'input', data: 'Enter', sendEnter: false }));
  });
}

// 5. Workspace trust dialog
function renderTrustFolderWizard(cleanText) {
  setupWizardContainer.innerHTML = `
    <div class="wizard-card">
      ${drawWizardHeader('Trust Workspace Directory', 'Permission required to perform file actions.')}
      <div class="wizard-content">
        <p style="font-size:14.5px;color:var(--text-muted);text-align:center;">
          Do you trust the contents of the folder <code style="font-size:15px;color:var(--accent);">/config</code>?
        </p>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.5;text-align:center;padding:0 12px;">
          Antigravity Console needs full read, edit, and execution permissions in this workspace folder to run terminal tasks.
        </p>
        <div class="wizard-button-group" style="margin-top:12px;">
          <button class="wizard-btn-secondary" id="trust-deny">No, Exit</button>
          <button class="wizard-btn-primary" id="trust-confirm">Yes, I trust this folder</button>
        </div>
      </div>
    </div>
  `;
  setupWizardContainer.classList.remove('hidden');
  chatMessages.classList.add('hidden');
  inputAreaContainer.classList.add('hidden');

  document.getElementById('trust-confirm').addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'Enter', sendEnter: false }));
  });
  document.getElementById('trust-deny').addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'Down', sendEnter: false }));
    setTimeout(() => {
      socket.send(JSON.stringify({ type: 'input', data: 'Enter', sendEnter: false }));
    }, 100);
  });
}

// ─── Markdown Formatter ────────────────────────────────────────────────────
function formatMarkdown(text) {
  let html = text;

  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Interactive numbered choice buttons
  html = html.replace(/^\s*(?:&gt;\s*)?(\d+)\.\s+(.+)$/gm, '<button class="choice-btn" data-choice="$1">$1. $2</button>');

  // Code blocks with copy button
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-lang">code</span>
          <button class="copy-code-btn" type="button" aria-label="Copy code block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
          </button>
        </div>
        <pre><code>${code.trim()}</code></pre>
      </div>
    `;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  html = html.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  return html;
}

// ─── Chat Messages Rendering & In-Place Reconciliation ──────────────────────
function renderChatMessages(text, isPrompt) {
  const lines = text.split('\n');
  let currentBubbleType = null;
  let currentBubbleText = [];
  const parsedBubbles = [];

  const addParsedBubble = (type, linesArray) => {
    if (linesArray.length === 0) return;
    const cleanBubbleText = linesArray.join('\n').trim();
    if (cleanBubbleText === '') return;
    parsedBubbles.push({ type, text: cleanBubbleText });
  };

  const userPromptRegex = /^(\s*agy\s*>|>\s*|\$\s*|root@.*:~#\s*)/;

  const isBannedLine = (line) => {
    const trimmed = line.trim();
    if (trimmed === '') return true;
    if (/[▄▀█]/.test(trimmed)) return true;
    if (/Antigravity\s+CLI/i.test(trimmed)) return true;
    if (/^\/\w+$/.test(trimmed)) return true;
    if (/^[─\-_=]{3,}$/.test(trimmed)) return true;
    if (trimmed.startsWith('────')) return true;
    if (/\?\s*for shortcuts/i.test(trimmed)) return true;
    if (/Gemini\s+\d/i.test(trimmed)) return true;
    if (/ctrl\+[a-z]\s+to\s+/i.test(trimmed)) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isBannedLine(line)) continue;

    const isUserLine = userPromptRegex.test(line) && !/^\s*>\s*\d+\./.test(line);

    if (isUserLine) {
      if (currentBubbleType === 'agent') {
        addParsedBubble('agent', currentBubbleText);
        currentBubbleText = [];
      }
      currentBubbleType = 'user';
      const cleanCmd = line.replace(userPromptRegex, '').trim();
      if (cleanCmd !== '') {
        currentBubbleText.push(cleanCmd);
      }
    } else {
      if (currentBubbleType === 'user') {
        addParsedBubble('user', currentBubbleText);
        currentBubbleText = [];
      }
      currentBubbleType = 'agent';
      let processedLine = line;
      if (processedLine.trim().startsWith('●')) {
        processedLine = processedLine.replace('●', '⚙️ Tool call:');
      }
      currentBubbleText.push(processedLine);
    }
  }

  if (currentBubbleType && currentBubbleText.length > 0) {
    addParsedBubble(currentBubbleType, currentBubbleText);
  }

  // Check scroll position before modifying DOM
  const isNearBottom = (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) < 150;

  // DOM Reconciliation: update existing nodes in-place to prevent flicker & stutter
  const existingBubbles = Array.from(chatMessages.querySelectorAll('.message:not(.system):not(.pending)'));

  parsedBubbles.forEach((pb, idx) => {
    let bubbleEl = existingBubbles[idx];

    if (!bubbleEl || !bubbleEl.classList.contains(pb.type)) {
      bubbleEl = document.createElement('div');
      bubbleEl.className = `message ${pb.type} animate-in`;

      const content = document.createElement('div');
      content.className = 'message-content';
      content.setAttribute('data-raw', pb.text);

      if (pb.type === 'user') {
        content.innerText = pb.text;
        const pendings = chatMessages.querySelectorAll('.message.user.pending');
        pendings.forEach(p => {
          const pRaw = p.querySelector('.message-content').getAttribute('data-raw');
          if (pRaw === pb.text) p.remove();
        });
      } else {
        content.innerHTML = formatMarkdown(pb.text);
      }

      bubbleEl.appendChild(content);

      if (existingBubbles[idx]) {
        chatMessages.insertBefore(bubbleEl, existingBubbles[idx]);
        existingBubbles.splice(idx, 0, bubbleEl);
      } else {
        chatMessages.appendChild(bubbleEl);
        existingBubbles.push(bubbleEl);
      }
    } else {
      // Update contents in-place ONLY if changed
      const contentDiv = bubbleEl.querySelector('.message-content');
      const oldRaw = contentDiv.getAttribute('data-raw') || '';

      if (oldRaw !== pb.text) {
        contentDiv.setAttribute('data-raw', pb.text);
        if (pb.type === 'user') {
          contentDiv.innerText = pb.text;
        } else {
          contentDiv.innerHTML = formatMarkdown(pb.text);
        }
      }
    }
  });

  // Remove trailing extra bubbles
  while (existingBubbles.length > parsedBubbles.length) {
    const extra = existingBubbles.pop();
    extra.remove();
  }

  highlightedChoiceIdx = -1;

  if (isPrompt) {
    promptHelperText.innerText = 'Approval required:';
    promptHelper.classList.remove('hidden');
  } else {
    promptHelper.classList.add('hidden');
  }

  // Auto-scroll only if user was near bottom
  if (isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// ─── Input Form Submission ────────────────────────────────────────────────
if (inputForm) {
  inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = userInput.value.trim();
    if (value === '') return;

    socket.send(JSON.stringify({ type: 'input', data: value }));

    const pendingMsg = document.createElement('div');
    pendingMsg.className = 'message user pending animate-in';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.setAttribute('data-raw', value);
    content.innerText = value;
    
    pendingMsg.appendChild(content);
    chatMessages.appendChild(pendingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    userInput.value = '';
    userInput.rows = 1;
  });
}

// Submit via Enter key
if (userInput) {
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputForm.requestSubmit();
    }
  });

  userInput.addEventListener('input', () => {
    userInput.rows = 1;
    const lines = Math.min(6, Math.floor(userInput.scrollHeight / 24));
    userInput.rows = lines || 1;
  });
}

// ─── Keyboard Nav in Interactive Options ────────────────────────────────────
function getChoiceButtons() {
  const lastAgentMessage = chatMessages.querySelector('.message.agent:last-of-type');
  if (!lastAgentMessage) return [];
  return Array.from(lastAgentMessage.querySelectorAll('.choice-btn'));
}

function clearChoiceHighlighting() {
  getChoiceButtons().forEach(btn => btn.classList.remove('highlighted'));
  highlightedChoiceIdx = -1;
}

window.addEventListener('keydown', (e) => {
  const choices = getChoiceButtons();
  if (choices.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedChoiceIdx = (highlightedChoiceIdx + 1) % choices.length;
    choices.forEach((btn, idx) => {
      btn.classList.toggle('highlighted', idx === highlightedChoiceIdx);
    });
  } 
  
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedChoiceIdx = (highlightedChoiceIdx - 1 + choices.length) % choices.length;
    choices.forEach((btn, idx) => {
      btn.classList.toggle('highlighted', idx === highlightedChoiceIdx);
    });
  } 
  
  else if (e.key === 'Enter' && highlightedChoiceIdx !== -1) {
    e.preventDefault();
    choices[highlightedChoiceIdx].click();
    clearChoiceHighlighting();
  }
});

// Click delegation handlers (choices & code copy)
document.addEventListener('click', (e) => {
  // Choice button click
  if (e.target && e.target.classList.contains('choice-btn')) {
    const choiceNum = e.target.getAttribute('data-choice');
    socket.send(JSON.stringify({ type: 'input', data: choiceNum }));
  }

  // Copy code block click
  const copyBtn = e.target.closest('.copy-code-btn');
  if (copyBtn) {
    const container = copyBtn.closest('.code-block-container');
    const codeEl = container ? container.querySelector('code') : null;
    if (codeEl) {
      navigator.clipboard.writeText(codeEl.innerText).then(() => {
        const textSpan = copyBtn.querySelector('span') || copyBtn;
        const originalText = textSpan.innerText;
        textSpan.innerText = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          textSpan.innerText = originalText;
          copyBtn.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy code:', err);
      });
    }
  }
});

// Inline helper bar buttons
if (btnApprove) {
  btnApprove.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'y' }));
  });
}
if (btnDeny) {
  btnDeny.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'input', data: 'n' }));
  });
}

// ─── HTML Utility Helpers ───────────────────────────────────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize on load
connect();

const express = require('express');
const http = require('http');
const https = require('https');
const { WebSocketServer } = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Client: SSHClient } = require('ssh2');
const { StringDecoder } = require('string_decoder');

const fs = require('fs');

const app = express();

// --- TLS: use HTTPS if cert files are available ---
const CERTS_DIR = path.join(__dirname, 'certs');
const TLS_CERT = process.env.TLS_CERT || path.join(CERTS_DIR, 'cert.pem');
const TLS_KEY = process.env.TLS_KEY || path.join(CERTS_DIR, 'key.pem');

let server;
let usingTLS = false;
if (fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY)) {
  server = https.createServer({
    cert: fs.readFileSync(TLS_CERT),
    key: fs.readFileSync(TLS_KEY),
  }, app);
  usingTLS = true;
} else {
  server = http.createServer(app);
}

const wss = new WebSocketServer({ server });

// Periodic WebSocket-level ping to detect dead connections early.
// The ws library handles protocol-level pong responses automatically.
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 25000);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Saved Connections Store (JSON file) ---
const DATA_DIR = path.join(__dirname, 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json');

function loadConnections() {
  try {
    return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveConnections(connections) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
}

// List saved connections
app.get('/api/connections', (req, res) => {
  const connections = loadConnections();
  // Don't send passwords/keys in list response
  res.json(connections.map(c => ({
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    username: c.username,
    hasPassword: !!c.password,
    hasPrivateKey: !!c.privateKey,
  })));
});

// Get single connection (with credentials for connecting)
app.get('/api/connections/:id', (req, res) => {
  const connections = loadConnections();
  const conn = connections.find(c => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: 'Not found' });
  res.json(conn);
});

// Save new connection
app.post('/api/connections', (req, res) => {
  const { name, host, port = 22, username, password, privateKey } = req.body;
  if (!host || !username) {
    return res.status(400).json({ error: 'host and username are required' });
  }
  const connections = loadConnections();
  const conn = {
    id: uuidv4(),
    name: name || `${username}@${host}`,
    host,
    port: parseInt(port, 10),
    username,
    password: password || '',
    privateKey: privateKey || '',
  };
  connections.push(conn);
  saveConnections(connections);
  res.json({ id: conn.id, name: conn.name, host: conn.host, port: conn.port, username: conn.username });
});

// Update saved connection
app.put('/api/connections/:id', (req, res) => {
  const connections = loadConnections();
  const idx = connections.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { name, host, port, username, password, privateKey } = req.body;
  if (name !== undefined) connections[idx].name = name;
  if (host !== undefined) connections[idx].host = host;
  if (port !== undefined) connections[idx].port = parseInt(port, 10);
  if (username !== undefined) connections[idx].username = username;
  if (password !== undefined) connections[idx].password = password;
  if (privateKey !== undefined) connections[idx].privateKey = privateKey;
  saveConnections(connections);
  res.json({ ok: true });
});

// Delete saved connection
app.delete('/api/connections/:id', (req, res) => {
  let connections = loadConnections();
  connections = connections.filter(c => c.id !== req.params.id);
  saveConnections(connections);
  res.json({ ok: true });
});

// --- Session Store ---
// sessionId -> { ssh, stream, buffer, cols, rows, config, createdAt, lastActivity }
const sessions = new Map();

const BUFFER_MAX = 512 * 1024; // 512KB scrollback buffer per session
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS, 10) || 24 * 60 * 60 * 1000; // default 24h idle timeout

// Cleanup idle sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      console.log(`[cleanup] Closing idle session ${id}`);
      destroySession(id);
    }
  }
}, 60 * 1000);

function destroySession(id) {
  const session = sessions.get(id);
  if (!session) return;
  try { session.stream?.close(); } catch {}
  try { session.ssh?.end(); } catch {}
  sessions.delete(id);
}

// --- REST API ---

// List active sessions
app.get('/api/sessions', (req, res) => {
  const list = [];
  for (const [id, s] of sessions) {
    list.push({
      id,
      host: s.config.host,
      port: s.config.port,
      username: s.config.username,
      type: s.type || 'tab',
      parentSessionId: s.parentSessionId || null,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
    });
  }
  res.json(list);
});

// Create new SSH session
app.post('/api/sessions', (req, res) => {
  const { host, port = 22, username, password, privateKey, type = 'tab', parentSessionId } = req.body;

  if (!host || !username) {
    return res.status(400).json({ error: 'host and username are required' });
  }

  const sessionId = uuidv4();
  const ssh = new SSHClient();
  const config = { host, port, username };

  const connectConfig = {
    host,
    port: parseInt(port, 10),
    username,
    readyTimeout: 10000,
    keepaliveInterval: 15000,
    keepaliveCountMax: 3,
  };

  if (privateKey) {
    connectConfig.privateKey = privateKey;
  } else if (password) {
    connectConfig.password = password;
  }

  // Try keyboard-interactive as fallback
  connectConfig.tryKeyboard = true;

  ssh.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
    // Auto-respond with password for keyboard-interactive auth
    finish([password || '']);
  });

  ssh.on('ready', () => {
    ssh.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
      if (err) {
        ssh.end();
        return res.status(500).json({ error: `Shell error: ${err.message}` });
      }

      // StringDecoder buffers incomplete multi-byte UTF-8 sequences
      // across chunk boundaries, preventing replacement characters.
      const decoder = new StringDecoder('utf8');

      const session = {
        ssh,
        stream,
        decoder,
        buffer: '',
        cols: 80,
        rows: 24,
        config: { host, port, username },
        type,
        parentSessionId: parentSessionId || null,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        wsClients: new Set(),
        activeWs: null,
      };

      stream.on('data', (data) => {
        const str = decoder.write(data);
        session.buffer += str;
        // Cap buffer size
        if (session.buffer.length > BUFFER_MAX) {
          session.buffer = session.buffer.slice(-BUFFER_MAX);
        }
        session.lastActivity = Date.now();
        // Broadcast to connected WebSocket clients
        for (const ws of session.wsClients) {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'output', data: str }));
          }
        }
      });

      stream.on('close', () => {
        for (const ws of session.wsClients) {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'closed' }));
          }
        }
        sessions.delete(sessionId);
      });

      const stderrDecoder = new StringDecoder('utf8');
      stream.stderr.on('data', (data) => {
        const str = stderrDecoder.write(data);
        session.buffer += str;
        for (const ws of session.wsClients) {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'output', data: str }));
          }
        }
      });

      sessions.set(sessionId, session);
      res.json({ sessionId, host, port, username, type, parentSessionId: parentSessionId || null });
    });
  });

  ssh.on('error', (err) => {
    console.error(`[ssh] Connection error for ${host}: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: `SSH error: ${err.message}` });
    }
    sessions.delete(sessionId);
  });

  ssh.connect(connectConfig);
});

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  if (!sessions.has(id)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  destroySession(id);
  res.json({ ok: true });
});

// Resize session
app.post('/api/sessions/:id/resize', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { cols, rows } = req.body;
  if (cols && rows) {
    session.cols = cols;
    session.rows = rows;
    try {
      session.stream.setWindow(rows, cols, 0, 0);
    } catch {}
  }
  res.json({ ok: true });
});

// --- WebSocket ---
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId || !sessions.has(sessionId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid session' }));
    ws.close();
    return;
  }

  const session = sessions.get(sessionId);
  session.wsClients.add(ws);
  session.lastActivity = Date.now();

  // Per-client pending resize (applied when this client becomes active)
  ws._pendingCols = null;
  ws._pendingRows = null;

  // Track liveness for WebSocket-level ping/pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Send buffered output so client catches up (skip for resume connections
  // where the terminal already has the content)
  const resume = url.searchParams.get('resume') === '1';
  if (!resume && session.buffer.length > 0) {
    ws.send(JSON.stringify({ type: 'output', data: session.buffer }));
  }

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'input' && session.stream) {
        session.stream.write(msg.data);
        session.lastActivity = Date.now();
        if (session.activeWs !== ws) {
          session.activeWs = ws;
          if (ws._pendingCols != null && ws._pendingRows != null) {
            session.cols = ws._pendingCols;
            session.rows = ws._pendingRows;
            try { session.stream.setWindow(ws._pendingRows, ws._pendingCols, 0, 0); } catch {}
          }
        }
      } else if (msg.type === 'resize' && session.stream) {
        const { cols, rows } = msg;
        ws._pendingCols = cols;
        ws._pendingRows = rows;
        if (!session.activeWs || session.activeWs === ws) {
          session.activeWs = ws;
          session.cols = cols;
          session.rows = rows;
          try { session.stream.setWindow(rows, cols, 0, 0); } catch {}
        }
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {}
  });

  ws.on('close', () => {
    session.wsClients.delete(ws);
    if (session.activeWs === ws) {
      session.activeWs = null;
    }
  });
});

const PORT = process.env.PORT || (usingTLS ? 443 : 3000);
server.listen(PORT, '0.0.0.0', () => {
  const proto = usingTLS ? 'https' : 'http';
  console.log(`Web SSH client running on ${proto}://0.0.0.0:${PORT}`);
  if (!usingTLS) {
    console.log('  TLS disabled (no certs found in ./certs/)');
    console.log('  To enable: tailscale cert <hostname>.ts.net');
    console.log('             cp <hostname>.ts.net.crt certs/cert.pem');
    console.log('             cp <hostname>.ts.net.key certs/key.pem');
  }
});

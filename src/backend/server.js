import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { initDatabase, dbRun, dbAll, dbGet } from './db.js';
import { createRouter } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// Allow CORS for local dev and public tunnels
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join_branch', (branchId) => {
    socket.join(branchId);
    console.log(`[Socket.io] Client ${socket.id} joined branch ${branchId}`);
  });

  socket.on('disconnect', () => {
    // client disconnected
  });
});

// Setup API routes
const apiRouter = createRouter(io);
app.use('/api', apiRouter);

// Serve static frontend build if dist/ exists
const distPath = join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(join(distPath, 'index.html'));
  });
}

// Background Task: Auto-forfeit check (Every 60 seconds)
// Tickets in PENDING_CHECKIN older than 20 minutes are forfeited to protect counter capacity
setInterval(async () => {
  try {
    const expiredTickets = await dbAll(`
      SELECT id, ticket_number, branch_id FROM tickets 
      WHERE status = 'PENDING_CHECKIN' 
      AND (strftime('%s', 'now') - strftime('%s', created_at)) > 1200
    `);

    if (expiredTickets && expiredTickets.length > 0) {
      for (const t of expiredTickets) {
        await dbRun(
          "UPDATE tickets SET status = 'NO_SHOW', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          [t.id]
        );
        console.log(`[Auto-Forfeit] Ticket ${t.ticket_number} auto-forfeited due to check-in timeout.`);
      }
      io.emit('tickets_auto_forfeited', { count: expiredTickets.length });
    }
  } catch (err) {
    console.error('[Auto-Forfeit Worker Error]:', err.message);
  }
}, 60000);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`  SmartQueueJPN Engine running on port ${PORT}`);
      console.log(`  Local Access:  http://localhost:${PORT}`);
      console.log(`  Network Access: http://0.0.0.0:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

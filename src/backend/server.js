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
app.use(express.json({ limit: '100kb' }));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join_branch', (branchId) => {
    if (!branchId || typeof branchId !== 'string') return;
    // A socket only ever watches one branch at a time
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.join(branchId);
    console.log(`[Socket.io] Client ${socket.id} joined branch ${branchId}`);
  });

  socket.on('join_ticket', (ticketId) => {
    const id = Number(ticketId);
    if (!Number.isInteger(id) || id <= 0) return;
    // A device tracks at most one of its own tickets at a time
    for (const room of socket.rooms) {
      if (room.startsWith('ticket:')) socket.leave(room);
    }
    socket.join(`ticket:${id}`);
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
// Tickets still in PENDING_CHECKIN after the 15-minute arrival safeguard are
// forfeited to protect counter capacity (matches the 15-min UI countdown).
setInterval(async () => {
  try {
    const expiredTickets = await dbAll(`
      SELECT id, ticket_number, branch_id FROM tickets 
      WHERE status = 'PENDING_CHECKIN' 
      AND (strftime('%s', 'now') - strftime('%s', created_at)) > 900
    `);

    if (expiredTickets && expiredTickets.length > 0) {
      const affectedBranches = new Set();

      for (const t of expiredTickets) {
        await dbRun(
          "UPDATE tickets SET status = 'NO_SHOW', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
          [t.id]
        );

        const updatedTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [t.id]);
        if (updatedTicket) {
          io.to(`ticket:${t.id}`).emit('ticket_update', updatedTicket);
        }
        affectedBranches.add(t.branch_id);
        console.log(`[Auto-Forfeit] Ticket ${t.ticket_number} auto-forfeited due to check-in timeout.`);
      }

      for (const branchId of affectedBranches) {
        io.to(branchId).emit('tickets_auto_forfeited', { branchId, count: expiredTickets.length });
      }
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

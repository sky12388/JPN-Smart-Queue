import express from 'express';
import { dbRun, dbGet, dbAll, nextTicketNumber } from './db.js';

const DEFAULT_BRANCH = 'PUTRAJAYA';
const ACTIVE_STATUSES = "('PENDING_CHECKIN', 'WAITING', 'CALLED', 'SERVING')";

// SQLite CURRENT_TIMESTAMP is UTC without a timezone marker (e.g. "2026-11-13 01:33:01").
// Parse it explicitly as UTC so comparisons are correct regardless of server timezone.
const parseUtc = (value) => {
  if (!value) return null;
  const t = Date.parse(String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(t) ? null : t;
};

// Haversine distance in metres
const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371e3 * c;
};

export function createRouter(io) {
  const router = express.Router();

  // Helper for branch statistics (scoped to the current Malaysian day)
  const getBranchStats = async (branchId) => {
    const today = "date(created_at, '+8 hours') = date('now', '+8 hours')";
    const countWhere = async (extra) =>
      (await dbGet(`SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND ${extra}`, [branchId]))?.count || 0;

    const totalIssued = await countWhere(today);
    const completed = await countWhere(`status = 'COMPLETED' AND ${today}`);
    const noShow = await countWhere(`status = 'NO_SHOW' AND ${today}`);
    const waiting = await countWhere(`status = 'WAITING' AND ${today}`);
    const pendingCheckin = await countWhere(`status = 'PENDING_CHECKIN' AND ${today}`);
    const serving = await countWhere(`status IN ('CALLED', 'SERVING') AND ${today}`);

    const noShowRate = totalIssued > 0 ? ((noShow / totalIssued) * 100).toFixed(1) : '0.0';
    // Calculate paper saved: each ticket saves approx 12cm thermal paper
    const paperSavedMeters = (totalIssued * 0.12).toFixed(1);
    const costSavedMYR = (totalIssued * 0.35).toFixed(2);
    const activeCounters = (await dbGet(
      "SELECT COUNT(*) as count FROM counters WHERE branch_id = ? AND status != 'OFFLINE'",
      [branchId]
    ))?.count || 0;

    const avgRow = await dbGet(
      `SELECT AVG((strftime('%s', completed_at) - strftime('%s', served_at)) / 60.0) as avg_mins
       FROM tickets
       WHERE branch_id = ? AND status = 'COMPLETED' AND served_at IS NOT NULL AND completed_at IS NOT NULL AND ${today}`,
      [branchId]
    );
    const avgServiceMins = avgRow?.avg_mins ? Number(avgRow.avg_mins).toFixed(1) : '0.0';

    return {
      totalIssued,
      completed,
      noShow,
      waiting,
      pendingCheckin,
      serving,
      noShowRate: `${noShowRate}%`,
      paperSavedMeters: `${paperSavedMeters} m`,
      costSavedMYR: `RM ${costSavedMYR}`,
      avgServiceMins,
      activeCounters
    };
  };

  // Helper to broadcast branch state changes to everyone watching that branch
  const broadcastUpdate = async (branchId = DEFAULT_BRANCH) => {
    try {
      const stats = await getBranchStats(branchId);
      const activeTickets = await dbAll(
        `SELECT * FROM tickets WHERE branch_id = ? AND status IN ('CALLED', 'SERVING') ORDER BY called_at DESC`,
        [branchId]
      );
      const waitingTickets = await dbAll(
        `SELECT * FROM tickets WHERE branch_id = ? AND status IN ('WAITING', 'PENDING_CHECKIN') ORDER BY id ASC`,
        [branchId]
      );
      const counters = await dbAll(`SELECT * FROM counters WHERE branch_id = ? ORDER BY number ASC`, [branchId]);

      io.to(branchId).emit('queue_update', {
        branchId,
        stats,
        activeTickets,
        waitingTickets,
        counters,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error broadcasting queue update:', err);
    }
  };

  // Helper to push the latest state of a single ticket to its own tracker(s).
  // This is what lets a citizen's phone see COMPLETED / NO_SHOW / CANCELLED,
  // which are intentionally absent from the branch-level queue_update payload.
  const emitTicketUpdate = async (ticketId) => {
    try {
      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) return;

      if (ticket.status === 'WAITING') {
        ticket.peopleAhead = (await dbGet(
          "SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND category_id = ? AND status = 'WAITING' AND id < ?",
          [ticket.branch_id, ticket.category_id, ticket.id]
        ))?.count || 0;
      }

      io.to(`ticket:${ticketId}`).emit('ticket_update', ticket);
    } catch (err) {
      console.error('Error emitting ticket update:', err);
    }
  };

  // 1. Meta information
  router.get('/meta', async (req, res) => {
    try {
      const branches = await dbAll('SELECT * FROM branches');
      const categories = await dbAll('SELECT * FROM categories');
      const counters = await dbAll('SELECT * FROM counters ORDER BY number ASC');
      res.json({ success: true, branches, categories, counters });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Issue new ticket
  router.post('/tickets/issue', async (req, res) => {
    try {
      const { branch_id = DEFAULT_BRANCH, category_id, citizen_name, ic_number, phone } = req.body;

      if (!category_id || !citizen_name || !ic_number) {
        return res.status(400).json({ error: 'Sila lengkapkan semua butiran pemohon.' });
      }

      const branch = await dbGet('SELECT id FROM branches WHERE id = ?', [branch_id]);
      if (!branch) return res.status(400).json({ error: 'Cawangan tidak sah.' });

      const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [category_id]);
      if (!cat) return res.status(404).json({ error: 'Kategori tidak sah.' });

      const cleanIc = String(ic_number).trim();

      // Strike Rule (proposal §4.3): 2 consecutive no-shows -> 14-day suspension
      const recent = await dbAll(
        'SELECT status, completed_at FROM tickets WHERE ic_number = ? ORDER BY id DESC LIMIT 2',
        [cleanIc]
      );
      if (recent.length === 2 && recent.every((r) => r.status === 'NO_SHOW')) {
        const lastAt = parseUtc(recent[0].completed_at);
        const withinWindow = lastAt === null || Date.now() - lastAt < 14 * 24 * 60 * 60 * 1000;
        if (withinWindow) {
          return res.status(403).json({
            error:
              'Akaun No. Kad Pengenalan ini digantung sementara selama 14 hari kerana kegagalan hadir 2 kali berturut-turut (Strike Rule).'
          });
        }
      }

      // One active ticket per MyKad at a time (proposal §4.1)
      const existing = await dbGet(
        `SELECT id, ticket_number FROM tickets WHERE ic_number = ? AND status IN ${ACTIVE_STATUSES} ORDER BY id DESC LIMIT 1`,
        [cleanIc]
      );
      if (existing) {
        return res.status(409).json({
          error: `Anda sudah mempunyai tiket aktif (${existing.ticket_number}). Sila selesaikan atau batalkan tiket tersebut sebelum mengambil yang baharu.`
        });
      }

      // Atomic, concurrency-safe ticket number
      const ticket_number = await nextTicketNumber(branch_id, category_id, cat.code);

      // Estimated wait time based on how many people are waiting in this category
      const waitingCount = (await dbGet(
        "SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND category_id = ? AND status IN ('WAITING', 'PENDING_CHECKIN')",
        [branch_id, category_id]
      ))?.count || 0;

      const estimated_wait_mins = Math.max(5, waitingCount * cat.avg_duration_mins);

      const result = await dbRun(
        `INSERT INTO tickets (branch_id, category_id, ticket_number, citizen_name, ic_number, phone, status, estimated_wait_mins)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING_CHECKIN', ?)`,
        [branch_id, category_id, ticket_number, citizen_name, cleanIc, phone || '', estimated_wait_mins]
      );

      const newTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [result.lastID]);

      await broadcastUpdate(branch_id);
      await emitTicketUpdate(result.lastID);

      res.json({
        success: true,
        message: 'Tiket maya berjaya dijana.',
        ticket: newTicket
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Check-in (GPS geofence or on-premises QR kiosk)
  router.post('/tickets/checkin', async (req, res) => {
    try {
      const { ticket_id, method = 'GPS', lat, lng, qr_code } = req.body;
      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticket_id]);

      if (!ticket) return res.status(404).json({ error: 'Tiket tidak dijumpai.' });

      if (ticket.status !== 'PENDING_CHECKIN') {
        return res.json({ success: true, message: 'Tiket sudah disahkan.', ticket });
      }

      let checkin_method;

      if (method === 'GPS') {
        const branch = await dbGet('SELECT * FROM branches WHERE id = ?', [ticket.branch_id]);
        if (!branch) return res.status(400).json({ error: 'Cawangan tiket tidak sah.' });

        const latN = Number(lat);
        const lngN = Number(lng);
        if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
          return res.status(400).json({ error: 'Koordinat GPS diperlukan untuk pengesahan kehadiran.' });
        }

        const distance = distanceMeters(latN, lngN, branch.lat, branch.lng);
        const allowedMeters = (branch.radius_meters || 150) + 100;

        if (distance > allowedMeters) {
          return res.status(403).json({
            error: `Anda berada ~${Math.round(distance)}m dari ${branch.name_ms}. Pengesahan GPS hanya dibenarkan dalam lingkungan ${allowedMeters}m. Sila gunakan imbasan Kod QR Kiosk di pintu masuk.`
          });
        }

        checkin_method = `GPS: Disahkan pada ~${Math.round(distance)}m dari premis JPN.`;
      } else {
        // QR_KIOSK (or any kiosk method) is verified on-premises by definition
        checkin_method = `QR_KIOSK: Disahkan melalui imbasan Kod QR di Kiosk Pintu Masuk (${qr_code || 'KIOSK'}).`;
      }

      await dbRun(
        `UPDATE tickets SET status = 'WAITING', checked_in_at = CURRENT_TIMESTAMP, checkin_method = ? WHERE id = ?`,
        [checkin_method, ticket_id]
      );

      const updatedTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticket_id]);
      await broadcastUpdate(ticket.branch_id);
      await emitTicketUpdate(ticket_id);

      res.json({
        success: true,
        message: 'Kehadiran berjaya disahkan! Anda kini berada dalam giliran aktif.',
        ticket: updatedTicket
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3b. Voluntary cancel ticket
  router.post('/tickets/cancel', async (req, res) => {
    try {
      const { ticket_id } = req.body;
      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticket_id]);
      if (!ticket) return res.status(404).json({ error: 'Tiket tidak dijumpai.' });

      if (!['PENDING_CHECKIN', 'WAITING'].includes(ticket.status)) {
        return res.status(400).json({
          error: 'Tiket yang sedang dipanggil atau dilayan tidak boleh dibatalkan. Sila berhubung dengan pegawai kaunter.'
        });
      }

      await dbRun("UPDATE tickets SET status = 'CANCELLED', completed_at = CURRENT_TIMESTAMP WHERE id = ?", [ticket_id]);
      const updatedTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticket_id]);

      await broadcastUpdate(ticket.branch_id);
      await emitTicketUpdate(ticket_id);

      res.json({ success: true, message: 'Tiket giliran telah dibatalkan.', ticket: updatedTicket });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Get Ticket Status
  router.get('/tickets/:id', async (req, res) => {
    try {
      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
      if (!ticket) return res.status(404).json({ error: 'Tiket tidak dijumpai.' });

      // Count how many are ahead of this ticket in WAITING status
      const ahead = (await dbGet(
        "SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND category_id = ? AND status = 'WAITING' AND id < ?",
        [ticket.branch_id, ticket.category_id, ticket.id]
      ))?.count || 0;

      // Current serving ticket in this category
      const currentServing = await dbGet(
        "SELECT ticket_number, counter_number FROM tickets WHERE branch_id = ? AND category_id = ? AND status IN ('CALLED', 'SERVING') ORDER BY called_at DESC LIMIT 1",
        [ticket.branch_id, ticket.category_id]
      );

      res.json({
        success: true,
        ticket,
        peopleAhead: ahead,
        currentServing: currentServing || null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4b. Find Existing Ticket by Ticket Number or MyKad (Quno-style lookup)
  router.post('/tickets/find', async (req, res) => {
    try {
      const { query = '', branch_id = DEFAULT_BRANCH } = req.body;
      const cleanQuery = query.trim();
      if (!cleanQuery) {
        return res.status(400).json({ error: 'Sila masukkan No. Giliran atau No. MyKad.' });
      }

      const ticket = await dbGet(
        `SELECT * FROM tickets
         WHERE branch_id = ?
         AND (UPPER(ticket_number) = UPPER(?) OR ic_number = ?)
         ORDER BY id DESC LIMIT 1`,
        [branch_id, cleanQuery, cleanQuery]
      );

      if (!ticket) {
        return res.status(404).json({ error: 'Tiada tiket dijumpai untuk maklumat tersebut.' });
      }

      res.json({
        success: true,
        ticket
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Officer calls next ticket
  router.post('/counter/call-next', async (req, res) => {
    try {
      const { counter_number, branch_id = DEFAULT_BRANCH } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);
      if (!counter) return res.status(404).json({ error: 'Kaunter tidak dijumpai.' });

      // Parse assigned categories
      let categories = ['MYKAD', 'KELAHIRAN', 'KAHWIN', 'KHAS'];
      try {
        if (counter.assigned_categories) categories = JSON.parse(counter.assigned_categories);
      } catch (e) {}

      const placeholders = categories.map(() => '?').join(',');

      // Prioritize checked-in WAITING tickets first
      const nextTicket = await dbGet(
        `SELECT * FROM tickets
         WHERE branch_id = ? AND category_id IN (${placeholders}) AND status = 'WAITING'
         ORDER BY id ASC LIMIT 1`,
        [branch_id, ...categories]
      );

      if (!nextTicket) {
        return res.json({
          success: false,
          message: 'Tiada pemohon yang sedang menunggu dalam kategori kaunter ini.',
          ticket: null
        });
      }

      // If counter had a previous serving ticket, complete it
      let previousTicketId = null;
      if (counter.current_ticket_id) {
        previousTicketId = counter.current_ticket_id;
        await dbRun(
          "UPDATE tickets SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('CALLED', 'SERVING')",
          [counter.current_ticket_id]
        );
      }

      // Update ticket to CALLED
      await dbRun(
        `UPDATE tickets SET status = 'CALLED', called_at = CURRENT_TIMESTAMP, counter_id = ?, counter_number = ? WHERE id = ?`,
        [counter.id, counter.number, nextTicket.id]
      );

      // Update counter current ticket
      await dbRun(
        `UPDATE counters SET current_ticket_id = ?, status = 'SERVING' WHERE id = ?`,
        [nextTicket.id, counter.id]
      );

      const updatedTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [nextTicket.id]);

      // Emit specific high-priority calling chime & announcement event to this branch's TV and screens
      io.to(branch_id).emit('ticket_called', {
        ticket: updatedTicket,
        counterNumber: counter.number,
        officerName: counter.officer_name,
        timestamp: new Date().toISOString()
      });

      await broadcastUpdate(branch_id);
      if (previousTicketId) await emitTicketUpdate(previousTicketId);
      await emitTicketUpdate(nextTicket.id);

      res.json({
        success: true,
        message: `Memanggil ${updatedTicket.ticket_number} ke Kaunter ${counter.number}`,
        ticket: updatedTicket
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Officer recalls ticket
  router.post('/counter/recall', async (req, res) => {
    try {
      const { counter_number, branch_id = DEFAULT_BRANCH } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif sedang dilayan di kaunter ini.' });
      }

      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [counter.current_ticket_id]);
      if (!ticket) return res.status(404).json({ error: 'Tiket tidak dijumpai.' });

      // Re-emit ticket_called event for buzzer/voice chime
      io.to(branch_id).emit('ticket_called', {
        ticket,
        counterNumber: counter.number,
        officerName: counter.officer_name,
        isRecall: true,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Panggilan semula ${ticket.ticket_number} dihantar ke skrin TV.`,
        ticket
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Officer start serving
  router.post('/counter/start-serving', async (req, res) => {
    try {
      const { counter_number, branch_id = DEFAULT_BRANCH } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif.' });
      }

      const result = await dbRun(
        "UPDATE tickets SET status = 'SERVING', served_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'CALLED'",
        [counter.current_ticket_id]
      );

      if (result.changes === 0) {
        return res.status(400).json({ error: 'Tiket ini tidak berada dalam status panggilan.' });
      }

      await broadcastUpdate(branch_id);
      await emitTicketUpdate(counter.current_ticket_id);
      res.json({ success: true, message: 'Status dikemaskini: Sedang Dilayan.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Officer complete ticket
  router.post('/counter/complete', async (req, res) => {
    try {
      const { counter_number, branch_id = DEFAULT_BRANCH } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif untuk diselesaikan.' });
      }

      const ticketId = counter.current_ticket_id;

      await dbRun(
        "UPDATE tickets SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [ticketId]
      );

      await dbRun(
        "UPDATE counters SET current_ticket_id = NULL, status = 'ONLINE' WHERE id = ?",
        [counter.id]
      );

      await broadcastUpdate(branch_id);
      await emitTicketUpdate(ticketId);
      res.json({ success: true, message: 'Urusan selesai.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Officer mark No-Show
  router.post('/counter/no-show', async (req, res) => {
    try {
      const { counter_number, branch_id = DEFAULT_BRANCH } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif.' });
      }

      const ticketId = counter.current_ticket_id;

      await dbRun(
        "UPDATE tickets SET status = 'NO_SHOW', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [ticketId]
      );

      await dbRun(
        "UPDATE counters SET current_ticket_id = NULL, status = 'ONLINE' WHERE id = ?",
        [counter.id]
      );

      await broadcastUpdate(branch_id);
      await emitTicketUpdate(ticketId);
      res.json({ success: true, message: 'Pemohon ditandakan sebagai Tidak Hadir (No-Show). Slot dilepaskan.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Dashboard Stats
  router.get('/stats', async (req, res) => {
    try {
      const branchId = req.query.branch_id || DEFAULT_BRANCH;
      const stats = await getBranchStats(branchId);
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Simulation demo helper (Seed test tickets)
  router.post('/simulation/seed', async (req, res) => {
    try {
      const branchId = req.body?.branch_id || DEFAULT_BRANCH;
      const sampleCitizens = [
        { name: 'Nurul Ain binti Yusof', ic: '940512-10-5432', cat: 'MYKAD', phone: '012-3456789' },
        { name: 'Muhammad Danial bin Azman', ic: '010324-14-6781', cat: 'KELAHIRAN', phone: '019-8765432' },
        { name: 'Chong Kah Seng', ic: '881104-08-5521', cat: 'MYKAD', phone: '016-2345678' },
        { name: 'Haji Ramli bin Mahmud (Warga Emas)', ic: '520815-10-5011', cat: 'KHAS', phone: '013-9871234' },
        { name: 'Siti Sarah binti Zamri', ic: '960920-01-6100', cat: 'KAHWIN', phone: '017-6543210' },
      ];

      for (const c of sampleCitizens) {
        const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [c.cat]);
        if (!cat) continue;
        const ticket_number = await nextTicketNumber(branchId, c.cat, cat.code);
        await dbRun(
          `INSERT INTO tickets (branch_id, category_id, ticket_number, citizen_name, ic_number, phone, status, checked_in_at, checkin_method)
           VALUES (?, ?, ?, ?, ?, ?, 'WAITING', CURRENT_TIMESTAMP, 'GPS: Simulasi Hadir di Lobi')`,
          [branchId, c.cat, ticket_number, c.name, c.ic, c.phone]
        );
      }

      await broadcastUpdate(branchId);
      res.json({ success: true, message: '5 tiket simulasi berjaya ditambah ke senarai giliran.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Simulation Reset
  router.post('/simulation/reset', async (req, res) => {
    try {
      const branchId = req.body?.branch_id || DEFAULT_BRANCH;
      await dbRun('DELETE FROM tickets');
      await dbRun('DELETE FROM ticket_sequences');
      await dbRun("UPDATE counters SET current_ticket_id = NULL, status = 'ONLINE'");
      await broadcastUpdate(branchId);
      res.json({ success: true, message: 'Giliran hari ini telah diset semula kepada sifar.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

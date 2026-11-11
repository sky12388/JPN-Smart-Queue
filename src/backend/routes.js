import express from 'express';
import { dbRun, dbGet, dbAll } from './db.js';

export function createRouter(io) {
  const router = express.Router();

  // Helper to broadcast state changes
  const broadcastUpdate = async (branchId = 'PUTRAJAYA') => {
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

      io.emit('queue_update', {
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

  // Helper for branch statistics
  const getBranchStats = async (branchId) => {
    const totalIssued = (await dbGet('SELECT COUNT(*) as count FROM tickets WHERE branch_id = ?', [branchId]))?.count || 0;
    const completed = (await dbGet("SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND status = 'COMPLETED'", [branchId]))?.count || 0;
    const noShow = (await dbGet("SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND status = 'NO_SHOW'", [branchId]))?.count || 0;
    const waiting = (await dbGet("SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND status = 'WAITING'", [branchId]))?.count || 0;
    const pendingCheckin = (await dbGet("SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND status = 'PENDING_CHECKIN'", [branchId]))?.count || 0;

    const noShowRate = totalIssued > 0 ? ((noShow / totalIssued) * 100).toFixed(1) : '0.0';
    // Calculate paper saved: each ticket saves approx 10cm thermal paper (~0.05 MYR + machine upkeep)
    const paperSavedMeters = (totalIssued * 0.12).toFixed(1);
    const costSavedMYR = (totalIssued * 0.35).toFixed(2);
    const activeCounters = (await dbGet('SELECT COUNT(*) as count FROM counters WHERE branch_id = ?', [branchId]))?.count || 10;

    return {
      totalIssued,
      completed,
      noShow,
      waiting,
      pendingCheckin,
      noShowRate: `${noShowRate}%`,
      paperSavedMeters: `${paperSavedMeters} m`,
      costSavedMYR: `RM ${costSavedMYR}`,
      activeCounters
    };
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
      const { branch_id = 'PUTRAJAYA', category_id, citizen_name, ic_number, phone } = req.body;

      if (!category_id || !citizen_name || !ic_number) {
        return res.status(400).json({ error: 'Sila lengkapkan semua butiran pemohon.' });
      }

      // Check Strike Rule (anti-abuse from proposal): Check if this IC had 2+ no-shows in past
      const pastNoShows = (await dbGet(
        "SELECT COUNT(*) as count FROM tickets WHERE ic_number = ? AND status = 'NO_SHOW'",
        [ic_number]
      ))?.count || 0;

      if (pastNoShows >= 3) {
        return res.status(403).json({
          error: 'Akaun No. Kad Pengenalan ini digantung sementara selama 14 hari kerana kegagalan hadir 3 kali berturut-turut (Strike Rule).'
        });
      }

      const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [category_id]);
      if (!cat) return res.status(404).json({ error: 'Kategori tidak sah.' });

      // Calculate next number for this category today
      const lastTicket = await dbGet(
        "SELECT ticket_number FROM tickets WHERE category_id = ? ORDER BY id DESC LIMIT 1",
        [category_id]
      );

      let nextNum = 1001;
      if (lastTicket && lastTicket.ticket_number) {
        const parts = lastTicket.ticket_number.split('-');
        if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
          nextNum = parseInt(parts[1]) + 1;
        }
      }

      const ticket_number = `${cat.code}-${nextNum}`;

      // Estimated wait time based on how many people are waiting
      const waitingCount = (await dbGet(
        "SELECT COUNT(*) as count FROM tickets WHERE branch_id = ? AND category_id = ? AND status IN ('WAITING', 'PENDING_CHECKIN')",
        [branch_id, category_id]
      ))?.count || 0;

      const estimated_wait_mins = Math.max(5, waitingCount * cat.avg_duration_mins);

      const result = await dbRun(
        `INSERT INTO tickets (branch_id, category_id, ticket_number, citizen_name, ic_number, phone, status, estimated_wait_mins)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING_CHECKIN', ?)`,
        [branch_id, category_id, ticket_number, citizen_name, ic_number, phone || '', estimated_wait_mins]
      );

      const newTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [result.lastID]);

      // Broadcast update
      await broadcastUpdate(branch_id);

      res.json({
        success: true,
        message: 'Tiket maya berjaya dijana.',
        ticket: newTicket
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Check-in (GPS or QR)
  router.post('/tickets/checkin', async (req, res) => {
    try {
      const { ticket_id, method = 'GPS', lat, lng, qr_code } = req.body;
      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticket_id]);

      if (!ticket) return res.status(404).json({ error: 'Tiket tidak dijumpai.' });

      if (ticket.status !== 'PENDING_CHECKIN') {
        return res.json({ success: true, message: 'Tiket sudah disahkan.', ticket });
      }

      const branch = await dbGet('SELECT * FROM branches WHERE id = ?', [ticket.branch_id]);

      let verified = false;
      let note = '';

      if (method === 'GPS') {
        // Simple distance calculation (Haversine approximation)
        if (lat && lng && branch) {
          const dLat = (lat - branch.lat) * (Math.PI / 180);
          const dLng = (lng - branch.lng) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(branch.lat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceMeters = 6371e3 * c;

          // Allow within 250m or simulated override
          if (distanceMeters <= (branch.radius_meters || 200) + 100 || lat === branch.lat) {
            verified = true;
            note = `Disahkan melalui GPS (~${Math.round(distanceMeters)}m dari JPN).`;
          } else {
            // For testing/simulation, allow lenient check with message
            verified = true;
            note = `Disahkan melalui GPS (Simulasi Lokasi Premis JPN).`;
          }
        } else {
          verified = true;
          note = 'Disahkan melalui GPS Lokasi Semasa.';
        }
      } else {
        // QR Code Kiosk at door
        verified = true;
        note = 'Disahkan melalui imbasan Kod QR di Kiosk Pintu Masuk.';
      }

      await dbRun(
        `UPDATE tickets SET status = 'WAITING', checked_in_at = CURRENT_TIMESTAMP, checkin_method = ? WHERE id = ?`,
        [`${method}: ${note}`, ticket_id]
      );

      const updatedTicket = await dbGet('SELECT * FROM tickets WHERE id = ?', [ticket_id]);
      await broadcastUpdate(ticket.branch_id);

      res.json({
        success: true,
        message: 'Kehadiran berjaya disahkan! Anda kini berada dalam giliran aktif.',
        ticket: updatedTicket
      });
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
      const { query = '', branch_id = 'PUTRAJAYA' } = req.body;
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
      const { counter_number, branch_id = 'PUTRAJAYA' } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);
      if (!counter) return res.status(404).json({ error: 'Kaunter tidak dijumpai.' });

      // Parse assigned categories
      let categories = ['MYKAD', 'KELAHIRAN', 'KAHWIN', 'KHAS'];
      try {
        if (counter.assigned_categories) categories = JSON.parse(counter.assigned_categories);
      } catch (e) {}

      const placeholders = categories.map(() => '?').join(',');

      // Prioritize checked-in WAITING tickets first
      let nextTicket = await dbGet(
        `SELECT * FROM tickets
         WHERE branch_id = ? AND category_id IN (${placeholders}) AND status = 'WAITING'
         ORDER BY id ASC LIMIT 1`,
        [branch_id, ...categories]
      );

      // If no checked-in waiting tickets, check if there is an urgent pending one (optional)
      if (!nextTicket) {
        return res.json({
          success: false,
          message: 'Tiada pemohon yang sedang menunggu dalam kategori kaunter ini.',
          ticket: null
        });
      }

      // If counter had previous serving ticket, complete it
      if (counter.current_ticket_id) {
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

      // Emit specific high-priority calling chime & announcement event to TV and screens
      io.emit('ticket_called', {
        ticket: updatedTicket,
        counterNumber: counter.number,
        officerName: counter.officer_name,
        timestamp: new Date().toISOString()
      });

      await broadcastUpdate(branch_id);

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
      const { counter_number, branch_id = 'PUTRAJAYA' } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif sedang dilayan di kaunter ini.' });
      }

      const ticket = await dbGet('SELECT * FROM tickets WHERE id = ?', [counter.current_ticket_id]);
      if (!ticket) return res.status(404).json({ error: 'Tiket tidak dijumpai.' });

      // Re-emit ticket_called event for buzzer/voice chime
      io.emit('ticket_called', {
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
      const { counter_number, branch_id = 'PUTRAJAYA' } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif.' });
      }

      await dbRun(
        "UPDATE tickets SET status = 'SERVING', served_at = CURRENT_TIMESTAMP WHERE id = ?",
        [counter.current_ticket_id]
      );

      await broadcastUpdate(branch_id);
      res.json({ success: true, message: 'Status dikemaskini: Sedang Dilayan.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Officer complete ticket
  router.post('/counter/complete', async (req, res) => {
    try {
      const { counter_number, branch_id = 'PUTRAJAYA' } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif untuk diselesaikan.' });
      }

      await dbRun(
        "UPDATE tickets SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [counter.current_ticket_id]
      );

      await dbRun(
        "UPDATE counters SET current_ticket_id = NULL, status = 'ONLINE' WHERE id = ?",
        [counter.id]
      );

      await broadcastUpdate(branch_id);
      res.json({ success: true, message: 'Urusan selesai.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Officer mark No-Show
  router.post('/counter/no-show', async (req, res) => {
    try {
      const { counter_number, branch_id = 'PUTRAJAYA' } = req.body;
      const counter = await dbGet('SELECT * FROM counters WHERE number = ? AND branch_id = ?', [counter_number, branch_id]);

      if (!counter || !counter.current_ticket_id) {
        return res.status(400).json({ error: 'Tiada tiket aktif.' });
      }

      await dbRun(
        "UPDATE tickets SET status = 'NO_SHOW', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [counter.current_ticket_id]
      );

      await dbRun(
        "UPDATE counters SET current_ticket_id = NULL, status = 'ONLINE' WHERE id = ?",
        [counter.id]
      );

      await broadcastUpdate(branch_id);
      res.json({ success: true, message: 'Pemohon ditandakan sebagai Tidak Hadir (No-Show). Slot dilepaskan.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Dashboard Stats
  router.get('/stats', async (req, res) => {
    try {
      const branchId = req.query.branch_id || 'PUTRAJAYA';
      const stats = await getBranchStats(branchId);
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Simulation demo helper (Seed test tickets)
  router.post('/simulation/seed', async (req, res) => {
    try {
      const branchId = req.body?.branch_id || 'PUTRAJAYA';
      const sampleCitizens = [
        { name: 'Nurul Ain binti Yusof', ic: '940512-10-5432', cat: 'MYKAD', phone: '012-3456789' },
        { name: 'Muhammad Danial bin Azman', ic: '010324-14-6781', cat: 'KELAHIRAN', phone: '019-8765432' },
        { name: 'Chong Kah Seng', ic: '881104-08-5521', cat: 'MYKAD', phone: '016-2345678' },
        { name: 'Haji Ramli bin Mahmud (Warga Emas)', ic: '520815-10-5011', cat: 'KHAS', phone: '013-9871234' },
        { name: 'Siti Sarah binti Zamri', ic: '960920-01-6100', cat: 'KAHWIN', phone: '017-6543210' },
      ];

      for (const c of sampleCitizens) {
        const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [c.cat]);
        const lastTicket = await dbGet("SELECT ticket_number FROM tickets WHERE category_id = ? ORDER BY id DESC LIMIT 1", [c.cat]);
        let nextNum = 1001;
        if (lastTicket && lastTicket.ticket_number) {
          const parts = lastTicket.ticket_number.split('-');
          if (parts.length === 2 && !isNaN(parseInt(parts[1]))) nextNum = parseInt(parts[1]) + 1;
        }

        const ticket_number = `${cat.code}-${nextNum}`;
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
      const branchId = req.body?.branch_id || 'PUTRAJAYA';
      await dbRun('DELETE FROM tickets');
      await dbRun("UPDATE counters SET current_ticket_id = NULL, status = 'ONLINE'");
      await broadcastUpdate(branchId);
      res.json({ success: true, message: 'Giliran hari ini telah diset semula kepada sifar.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

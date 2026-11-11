import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import Navbar from './components/Navbar';
import CitizenView from './components/CitizenView';
import KioskView from './components/KioskView';
import CounterView from './components/CounterView';
import TvView from './components/TvView';
import SupervisorView from './components/SupervisorView';

// Socket instance
const socket = io(window.location.origin, {
  transports: ['websocket', 'polling']
});

export default function App() {
  // Theme & Language State
  const [lang, setLang] = useState(() => localStorage.getItem('smartqueue_lang') || 'ms');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('smartqueue_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Navigation View State (default to citizen or hash if present)
  const [activeView, setActiveView] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['citizen', 'kiosk', 'counter', 'tv', 'supervisor'].includes(hash) ? hash : 'citizen';
  });

  // Selected Branch State
  const [selectedBranch, setSelectedBranch] = useState(() => {
    return localStorage.getItem('smartqueue_branch') || 'PUTRAJAYA';
  });

  // App Data State
  const [isConnected, setIsConnected] = useState(false);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counters, setCounters] = useState([]);
  const [stats, setStats] = useState(null);
  const [waitingTickets, setWaitingTickets] = useState([]);
  const [activeTickets, setActiveTickets] = useState([]);
  const [lastCalledTicket, setLastCalledTicket] = useState(null);

  // User's own ticket (persisted in localStorage for Citizen PWA)
  const [activeTicket, setActiveTicket] = useState(() => {
    const saved = localStorage.getItem('smartqueue_my_ticket');
    return saved ? JSON.parse(saved) : null;
  });

  // Apply Theme Class
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('smartqueue_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('smartqueue_theme', 'light');
    }
  }, [isDark]);

  // Persist Language
  useEffect(() => {
    localStorage.setItem('smartqueue_lang', lang);
  }, [lang]);

  // Persist Branch
  useEffect(() => {
    localStorage.setItem('smartqueue_branch', selectedBranch);
    if (socket.connected) {
      socket.emit('join_branch', selectedBranch);
    }
  }, [selectedBranch]);

  // Persist Active Ticket
  useEffect(() => {
    if (activeTicket) {
      localStorage.setItem('smartqueue_my_ticket', JSON.stringify(activeTicket));
    } else {
      localStorage.removeItem('smartqueue_my_ticket');
    }
  }, [activeTicket]);

  // Sync Hash with View
  useEffect(() => {
    window.location.hash = activeView;
  }, [activeView]);

  // Fetch Initial Meta & Stats
  const fetchMeta = async () => {
    try {
      const res = await fetch('/api/meta');
      const data = await res.json();
      if (data.success) {
        setBranches(data.branches || []);
        setCategories(data.categories || []);
        setCounters(data.counters || []);
      }
    } catch (e) {
      console.error('Failed to fetch meta:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  // Socket.io Real-Time Synchronization
  useEffect(() => {
    fetchMeta();
    fetchStats();

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_branch', 'PUTRAJAYA');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('queue_update', (data) => {
      if (data.stats) setStats(data.stats);
      if (data.counters) setCounters(data.counters);
      if (data.waitingTickets) setWaitingTickets(data.waitingTickets);
      if (data.activeTickets) setActiveTickets(data.activeTickets);

      // If user has an active ticket, refresh its status from update
      setActiveTicket((prev) => {
        if (!prev) return null;
        const all = [...(data.waitingTickets || []), ...(data.activeTickets || [])];
        const found = all.find((t) => t.id === prev.id);
        if (found) {
          // If called, celebrate with confetti on user's phone!
          if (found.status === 'CALLED' && prev.status !== 'CALLED') {
            confetti({ particleCount: 70, spread: 60 });
          }
          return found;
        }
        return prev;
      });
    });

    socket.on('ticket_called', (event) => {
      setLastCalledTicket(event);
      // Trigger subtle vibration on mobile devices if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('queue_update');
      socket.off('ticket_called');
    };
  }, []);

  // Action: Issue Virtual Ticket
  const handleIssueTicket = async (ticketData) => {
    try {
      const res = await fetch('/api/tickets/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setActiveTicket(data.ticket);
        confetti({ particleCount: 50, spread: 50 });
        return data;
      } else {
        alert(data.error || 'Gagal menjana tiket.');
      }
    } catch (e) {
      alert('Ralat rangkaian semasa menjana tiket.');
    }
  };

  // Action: Check-in (GPS or QR)
  const handleCheckinTicket = async (ticketId, method, lat, lng, qrCode) => {
    try {
      const res = await fetch('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          method,
          lat,
          lng,
          qr_code: qrCode
        })
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setActiveTicket(data.ticket);
        return data;
      }
      return data;
    } catch (e) {
      return { message: 'Ralat mengesahkan kehadiran.' };
    }
  };

  // Action: Cancel Ticket
  const handleCancelTicket = (ticketId) => {
    if (confirm('Adakah anda pasti mahu membatalkan tiket giliran ini?')) {
      setActiveTicket(null);
    }
  };

  // Actions for Counter Officers
  const handleCallNext = async (counterNumber) => {
    const res = await fetch('/api/counter/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter_number: counterNumber, branch_id: selectedBranch })
    });
    return res.json();
  };

  const handleRecall = async (counterNumber) => {
    const res = await fetch('/api/counter/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter_number: counterNumber, branch_id: selectedBranch })
    });
    return res.json();
  };

  const handleStartServe = async (counterNumber) => {
    const res = await fetch('/api/counter/start-serving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter_number: counterNumber, branch_id: selectedBranch })
    });
    return res.json();
  };

  const handleComplete = async (counterNumber) => {
    const res = await fetch('/api/counter/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter_number: counterNumber, branch_id: selectedBranch })
    });
    return res.json();
  };

  const handleNoShow = async (counterNumber) => {
    const res = await fetch('/api/counter/no-show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counter_number: counterNumber, branch_id: selectedBranch })
    });
    return res.json();
  };

  // Actions for Demo Simulation
  const handleSeedDemo = async () => {
    const res = await fetch('/api/simulation/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: selectedBranch })
    });
    return res.json();
  };

  const handleResetQueue = async () => {
    if (confirm('Peringatan: Ini akan mengosongkan semua rekod giliran hari ini. Teruskan?')) {
      const res = await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: selectedBranch })
      });
      setActiveTicket(null);
      return res.json();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        lang={lang}
        setLang={setLang}
        isDark={isDark}
        setIsDark={setIsDark}
        isConnected={isConnected}
        branches={branches}
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeView === 'citizen' && (
          <CitizenView
            lang={lang}
            branches={branches}
            categories={categories}
            activeTicket={activeTicket}
            setActiveTicket={setActiveTicket}
            selectedBranch={selectedBranch}
            setSelectedBranch={setSelectedBranch}
            onIssueTicket={handleIssueTicket}
            onCheckinTicket={handleCheckinTicket}
            onCancelTicket={handleCancelTicket}
          />
        )}

        {activeView === 'kiosk' && (
          <KioskView
            lang={lang}
            branches={branches}
            selectedBranch={selectedBranch}
            setSelectedBranch={setSelectedBranch}
            waitingTickets={waitingTickets}
            onCheckinTicket={handleCheckinTicket}
          />
        )}

        {activeView === 'counter' && (
          <CounterView
            lang={lang}
            branches={branches}
            selectedBranch={selectedBranch}
            counters={counters.filter(c => c.branch_id === selectedBranch)}
            activeTickets={activeTickets.filter(t => t.branch_id === selectedBranch)}
            waitingTickets={waitingTickets.filter(t => t.branch_id === selectedBranch)}
            onCallNext={handleCallNext}
            onRecall={handleRecall}
            onStartServe={handleStartServe}
            onComplete={handleComplete}
            onNoShow={handleNoShow}
          />
        )}

        {activeView === 'tv' && (
          <TvView
            lang={lang}
            branches={branches}
            selectedBranch={selectedBranch}
            activeTickets={activeTickets.filter(t => t.branch_id === selectedBranch)}
            waitingTickets={waitingTickets.filter(t => t.branch_id === selectedBranch)}
            lastCalledTicket={lastCalledTicket}
            counters={counters.filter(c => c.branch_id === selectedBranch)}
          />
        )}

        {activeView === 'supervisor' && (
          <SupervisorView
            lang={lang}
            branches={branches}
            selectedBranch={selectedBranch}
            stats={stats}
            counters={counters.filter(c => c.branch_id === selectedBranch)}
            onSeedDemo={handleSeedDemo}
            onResetQueue={handleResetQueue}
          />
        )}
      </main>

      {/* Footer (hidden on TV display) */}
      {activeView !== 'tv' && (
        <footer className="py-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50">
          <p>
            Sistem Pengurusan Giliran Pintar & Maya (Smart Virtual Queue) • Jabatan Pendaftaran Negara
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Standalone Appliance Mode • NetBird Secure Mesh Enabled
          </p>
        </footer>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { translations } from '../i18n';
import { playChime, speakAnnouncement, unlockAudio } from '../audio';
import { 
  Volume2, 
  VolumeX, 
  Clock, 
  Maximize2, 
  ArrowRight, 
  Bell,
  Users,
  Tv,
  Play
} from 'lucide-react';

export default function TvView({ 
  lang, 
  branches = [],
  selectedBranch = 'PUTRAJAYA',
  activeTickets = [], 
  waitingTickets = [],
  lastCalledTicket, 
  counters = []
}) {
  const t = translations[lang];

  const currentBranchObj = branches.find(b => b.id === selectedBranch) || {
    name_ms: 'JPN Ibu Pejabat Putrajaya',
    name_en: 'JPN Headquarters Putrajaya'
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Check URL params (?autostart=1&zone=MYKAD) or saved localStorage for zero-touch Android TV boot
  const [tvStarted, setTvStarted] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    return localStorage.getItem('smartqueue_tv_autostart') === 'true';
  });

  const [selectedZone, setSelectedZone] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlZone = params.get('zone')?.toUpperCase();
    if (urlZone && ['ALL', 'MYKAD', 'KELAHIRAN', 'KAHWIN', 'KHAS'].includes(urlZone)) {
      return urlZone;
    }
    return localStorage.getItem('smartqueue_tv_zone') || 'ALL';
  });

  const [isFlashing, setIsFlashing] = useState(false);

  // Save TV Zone choice to localStorage so TV remembers its zone after power off/on
  useEffect(() => {
    localStorage.setItem('smartqueue_tv_zone', selectedZone);
  }, [selectedZone]);

  // Also unlock audio on any remote control key press (OK/Enter button on Android TV remote)
  useEffect(() => {
    const handleRemoteKey = () => {
      if (!tvStarted) {
        unlockAudio();
        setAudioEnabled(true);
        setTvStarted(true);
        localStorage.setItem('smartqueue_tv_autostart', 'true');
      }
    };
    window.addEventListener('keydown', handleRemoteKey);
    return () => window.removeEventListener('keydown', handleRemoteKey);
  }, [tvStarted]);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter tickets by selected TV Zone (for 5-TV setups across different halls)
  const filteredActive = selectedZone === 'ALL'
    ? activeTickets
    : activeTickets.filter(tk => tk.category_id === selectedZone);

  const filteredWaiting = selectedZone === 'ALL'
    ? waitingTickets.filter(tk => tk.status === 'WAITING')
    : waitingTickets.filter(tk => tk.status === 'WAITING' && tk.category_id === selectedZone);

  // Whenever lastCalledTicket changes or triggers recall: Flash and play audio chime + 2x speech
  useEffect(() => {
    if (lastCalledTicket && lastCalledTicket.ticket) {
      // Only ring if ticket belongs to this branch and matches TV zone filter
      if (lastCalledTicket.ticket.branch_id && lastCalledTicket.ticket.branch_id !== selectedBranch) {
        return;
      }
      if (selectedZone !== 'ALL' && lastCalledTicket.ticket.category_id !== selectedZone) {
        return;
      }

      setIsFlashing(true);
      if (audioEnabled) {
        playChime();
        speakAnnouncement(lastCalledTicket.ticket.ticket_number, lastCalledTicket.counterNumber, lang, 2);
      }
      const timeout = setTimeout(() => setIsFlashing(false), 6000);
      return () => clearTimeout(timeout);
    }
  }, [lastCalledTicket, audioEnabled, lang, selectedBranch, selectedZone]);

  // Fullscreen trigger helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Start TV with Sound (Quno-style browser audio unlock)
  const handleStartTvWithSound = () => {
    unlockAudio();
    setAudioEnabled(true);
    setTvStarted(true);
    localStorage.setItem('smartqueue_tv_autostart', 'true');
  };

  // Test sound button
  const handleTestSound = () => {
    playChime();
    speakAnnouncement(featuredTicket.ticket_number, featuredCounter, lang, 1);
  };

  // Main featured ticket
  const featuredTicket = (
    lastCalledTicket?.ticket &&
    (selectedZone === 'ALL' || lastCalledTicket.ticket.category_id === selectedZone)
      ? lastCalledTicket.ticket
      : filteredActive?.[0]
  ) || {
    ticket_number: 'A-1001',
    category_id: 'MYKAD',
    counter_number: 1
  };

  const featuredCounter = lastCalledTicket?.counterNumber || featuredTicket.counter_number || 1;

  // Recent history (other called tickets)
  const recentHistory = filteredActive?.slice(0, 4) || [];

  // Next in line (up to 4 waiting tickets)
  const nextInLine = filteredWaiting?.slice(0, 4) || [];

  const citizenJoinUrl = `${window.location.origin}/#citizen`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden relative">
      
      {/* Quno-style "Tap to Start Screen with Sound" Overlay (Ensures Smart TV Audio Never Blocks) */}
      {!tvStarted && (
        <div 
          onClick={handleStartTvWithSound}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer p-6 text-center"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl ring-4 ring-amber-400 mb-6 animate-bounce">
            <Volume2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-2">
            {lang === 'ms' ? 'Sentuh untuk Mula Skrin TV dengan Suara' : 'Tap to Start TV Screen with Sound'}
          </h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            {lang === 'ms'
              ? 'Mengaktifkan sistem pengumuman suara automatik (2x ulangan panggilan) dan loceng lobi.'
              : 'Activates automatic voice calling (2x repeat) and lobby chime.'}
          </p>
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-8 py-4 rounded-2xl text-base flex items-center space-x-2 shadow-xl"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{lang === 'ms' ? 'AKTIFKAN SKRIN TV SEKARANG' : 'START TV DISPLAY NOW'}</span>
          </button>
        </div>
      )}

      {/* Top TV Bar: Agency Identity, TV Zone Filter (5 TVs), Audio Control, Time & Fullscreen */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-900 to-indigo-900 flex items-center justify-center text-white shadow-xl ring-2 ring-amber-400">
            <span className="font-black text-lg tracking-tighter">JPN</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center space-x-2">
              <span>{t.tvDisplayTitle}</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {lang === 'ms' ? currentBranchObj.name_ms : currentBranchObj.name_en}
            </p>
          </div>
        </div>

        {/* Center/Right: TV Unit Zone Filter (Supports 5 TV Units across different zones) */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <Tv className="w-4 h-4 text-amber-400" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">TV 1: Semua Zon (Lobi Utama)</option>
              <option value="MYKAD" className="bg-slate-900">TV 2: Zon A — MyKad (K1-K4)</option>
              <option value="KELAHIRAN" className="bg-slate-900">TV 3: Zon B — Kelahiran (K5-K6)</option>
              <option value="KAHWIN" className="bg-slate-900">TV 4: Zon C — Perkahwinan (K7-K8)</option>
              <option value="KHAS" className="bg-slate-900">TV 5: Zon D — Kaunter Khas (K9-K10)</option>
            </select>
          </div>

          {/* Test Sound Button */}
          <button
            onClick={handleTestSound}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 transition"
          >
            🔊 {lang === 'ms' ? 'Uji Suara' : 'Test Sound'}
          </button>

          {/* Audio Announcer Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              audioEnabled
                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-400'
                : 'bg-rose-950/70 border-rose-700 text-rose-400'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline">{audioEnabled ? '2x Suara Aktif' : 'Bisu'}</span>
          </button>

          {/* Clock */}
          <div className="text-right pl-2">
            <div className="text-lg sm:text-xl font-black font-mono tracking-wider text-amber-400">
              {currentTime.toLocaleTimeString('en-MY', { hour12: false })}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              {currentTime.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Main Board Center Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-4 items-stretch">
        
        {/* Giant Featured Called Number + Active Counters Grid (8 Columns) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
          <div className={`rounded-3xl p-6 sm:p-10 text-center transition-all duration-300 relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-900/90 border-4 flex-1 flex flex-col justify-center ${
            isFlashing 
              ? 'border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.5)] scale-[1.01]' 
              : 'border-slate-800 shadow-2xl'
          }`}>
            
            {/* Top Glow Ribbon */}
            <div>
              <div className="inline-flex items-center space-x-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                <Bell className="w-4 h-4 animate-bounce" />
                <span>{t.nowCalling}</span>
              </div>
            </div>

            {/* Huge Number & Counter Split */}
            <div className="flex flex-col md:flex-row items-center justify-around gap-6 my-2">
              
              {/* Ticket Big Box */}
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {t.ticketNumber}
                </span>
                <div className={`text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tighter text-amber-400 ${
                  isFlashing ? 'animate-pulse' : ''
                }`}>
                  {featuredTicket.ticket_number}
                </div>
                <span className="text-xs sm:text-sm font-bold text-blue-400 tracking-wider">
                  {featuredTicket.category_id}
                </span>
              </div>

              {/* Arrow divider */}
              <div className="hidden md:flex items-center justify-center">
                <ArrowRight className="w-12 h-12 text-slate-700 stroke-[3]" />
              </div>

              {/* Counter Target Box */}
              <div className="bg-blue-950/60 border-2 border-blue-600/60 rounded-3xl p-6 sm:p-8 min-w-[200px]">
                <span className="text-xs sm:text-sm font-extrabold text-blue-300 uppercase tracking-widest block mb-1">
                  {t.counterLabel}
                </span>
                <div className="text-7xl sm:text-8xl font-black font-mono text-white">
                  {featuredCounter}
                </div>
              </div>

            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-400 font-medium">
              {t.pleaseProceed}
            </p>
          </div>

          {/* Recent Calls Strip (4 boxes across bottom of left column) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const item = recentHistory[idx];
              return (
                <div
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      {lang === 'ms' ? 'Sedang Layan' : 'Serving'}
                    </span>
                    <span className="text-xl font-black font-mono text-white">
                      {item ? item.ticket_number : '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-blue-400 font-bold uppercase block">
                      {t.counterLabel}
                    </span>
                    <span className="text-xl font-black font-mono text-amber-400">
                      {item ? item.counter_number : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side Column (4 Columns): Quno-style "Next in Line" + Scannable QR Code */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          
          {/* Next in Line Panel (Seterusnya Dalam Giliran) */}
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>{lang === 'ms' ? 'GILIRAN SETERUSNYA (NEXT)' : 'NEXT IN LINE'}</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {filteredWaiting.length} {lang === 'ms' ? 'Menunggu' : 'Waiting'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {nextInLine.length > 0 ? (
                  nextInLine.map((item, i) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center"
                    >
                      <span className="text-[10px] text-slate-500 font-bold block">
                        #{i + 1} • {item.category_id}
                      </span>
                      <span className="text-2xl font-black font-mono text-sky-400">
                        {item.ticket_number}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-8 text-center text-slate-500 text-xs font-medium">
                    {lang === 'ms' ? 'Tiada pemohon sedang menunggu' : 'No applicants waiting'}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>{lang === 'ms' ? 'Kaunter Beroperasi:' : 'Active Counters:'}</span>
              <span className="font-black text-white">10 Kaunter (K1 – K10)</span>
            </div>
          </div>

          {/* Real Scannable Lobby QR Code for Rakyat */}
          <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-3xl p-5 border border-blue-900 shadow-xl flex items-center space-x-4">
            <div className="bg-white rounded-2xl p-2.5 flex items-center justify-center flex-shrink-0 shadow-lg">
              <QRCodeSVG value={citizenJoinUrl} size={84} level="M" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {t.scanForVirtualTicket}
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Imbas kod QR ini menggunakan kamera telefon untuk ambil nombor & pantau giliran.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Announcement Marquee Ticker */}
      <div className="bg-blue-950/80 border border-blue-900/80 rounded-2xl p-2.5 flex items-center space-x-3 overflow-hidden">
        <div className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex-shrink-0">
          INFO JPN
        </div>
        <div className="overflow-hidden whitespace-nowrap text-xs text-blue-200 font-medium w-full">
          {t.tickerNotice} ••• 10 Kaunter Beroperasi & 5 Paparan TV Zon Pintar Aktif.
        </div>
      </div>

    </div>
  );
}

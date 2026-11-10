import React, { useState, useEffect } from 'react';
import { translations } from '../i18n';
import { playChime, speakAnnouncement } from '../audio';
import { 
  Volume2, 
  VolumeX, 
  Clock, 
  Maximize2, 
  QrCode, 
  Radio, 
  ArrowRight, 
  Bell,
  Sparkles
} from 'lucide-react';

export default function TvView({ 
  lang, 
  branches = [],
  selectedBranch = 'PUTRAJAYA',
  activeTickets, 
  lastCalledTicket, 
  counters 
}) {
  const t = translations[lang];

  const currentBranchObj = branches.find(b => b.id === selectedBranch) || {
    name_ms: 'JPN Ibu Pejabat Putrajaya',
    name_en: 'JPN Headquarters Putrajaya'
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Whenever lastCalledTicket changes or triggers recall: Flash and play audio chime + speech
  useEffect(() => {
    if (lastCalledTicket) {
      setIsFlashing(true);
      if (audioEnabled) {
        playChime();
        speakAnnouncement(lastCalledTicket.ticket.ticket_number, lastCalledTicket.counterNumber, lang);
      }
      const timeout = setTimeout(() => setIsFlashing(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [lastCalledTicket, audioEnabled, lang]);

  // Fullscreen trigger helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Main featured ticket is either the last called ticket or the first active ticket
  const featuredTicket = lastCalledTicket?.ticket || activeTickets?.[0] || {
    ticket_number: 'A-1001',
    category_id: 'MYKAD',
    counter_number: 1
  };

  const featuredCounter = lastCalledTicket?.counterNumber || featuredTicket.counter_number || 1;

  // Recent history (other tickets)
  const recentHistory = activeTickets?.slice(1, 5) || [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 select-none overflow-hidden relative">
      
      {/* Top TV Bar: Agency Identity, Audio Control, Time & Fullscreen */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        
        {/* Brand */}
        <div className="flex items-center space-x-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-900 to-indigo-900 flex items-center justify-center text-white shadow-xl ring-2 ring-amber-400">
            <span className="font-black text-xl tracking-tighter">JPN</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center space-x-2">
              <span>{t.tvDisplayTitle}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              {lang === 'ms' ? currentBranchObj.name_ms : currentBranchObj.name_en}
            </p>
          </div>
        </div>

        {/* Right side: Audio, Clock & Fullscreen button */}
        <div className="flex items-center space-x-4">
          
          {/* Audio Announcer Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              audioEnabled
                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-400 shadow-sm'
                : 'bg-rose-950/70 border-rose-700 text-rose-400'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioEnabled ? t.audioEnabled : t.audioDisabled}</span>
          </button>

          {/* Clock */}
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-amber-400">
              {currentTime.toLocaleTimeString('en-MY', { hour12: false })}
            </div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              {currentTime.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

        </div>

      </div>

      {/* Main Board Center Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6 items-center">
        
        {/* Giant Featured Called Number (8 Columns) */}
        <div className="lg:col-span-8">
          <div className={`rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-900/90 border-4 ${
            isFlashing 
              ? 'border-amber-400 shadow-[0_0_80px_rgba(245,158,11,0.5)] scale-[1.01]' 
              : 'border-slate-800 shadow-2xl'
          }`}>
            
            {/* Top Glow Ribbon */}
            <div className="inline-flex items-center space-x-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-6">
              <Bell className="w-4 h-4 animate-bounce" />
              <span>{t.nowCalling}</span>
            </div>

            {/* Huge Number & Counter Split */}
            <div className="flex flex-col md:flex-row items-center justify-around gap-6">
              
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

            <p className="mt-8 text-xs sm:text-sm text-slate-400 font-medium">
              {t.pleaseProceed}
            </p>

          </div>
        </div>

        {/* Right Side Column (4 Columns): Recent Calls & QR Kiosk Banner */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Previous Calls Box */}
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{t.previousCalls}</span>
            </h3>

            <div className="space-y-3">
              {recentHistory.length > 0 ? (
                recentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800"
                  >
                    <div>
                      <span className="text-xl font-black font-mono text-white">
                        {item.ticket_number}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2 font-mono">
                        {item.category_id}
                      </span>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-blue-950 text-blue-300 border border-blue-800 text-xs font-black">
                      {t.counterLabel} {item.counter_number || 1}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs font-medium">
                  Tiada panggilan terdahulu
                </div>
              )}
            </div>
          </div>

          {/* Lobby QR Code Prompt for Rakyat */}
          <div className="bg-gradient-to-br from-blue-950 to-indigo-950 rounded-3xl p-5 border border-blue-900 shadow-xl flex items-center space-x-4">
            <div className="w-20 h-20 bg-white rounded-2xl p-2 flex items-center justify-center flex-shrink-0 shadow-lg">
              <QrCode className="w-16 h-16 text-slate-900" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {t.scanForVirtualTicket}
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Imbas kod ini menggunakan kamera telefon untuk memantau giliran anda di mana-mana sahaja.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Announcement Marquee Ticker */}
      <div className="bg-blue-950/80 border border-blue-900/80 rounded-2xl p-3 flex items-center space-x-3 overflow-hidden">
        <div className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex-shrink-0">
          INFO JPN
        </div>
        <div className="overflow-hidden whitespace-nowrap text-xs text-blue-200 font-medium">
          <marquee scrollamount="6" className="w-full">
            {t.tickerNotice} &nbsp;&nbsp;•••&nbsp;&nbsp; Waktu Operasi: 8.00 Pagi - 5.00 Petang (Isnin - Jumaat) &nbsp;&nbsp;•••&nbsp;&nbsp; Terima kasih kerana menggunakan Sistem Giliran Pintar JPN Putrajaya.
          </marquee>
        </div>
      </div>

    </div>
  );
}

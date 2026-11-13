import React, { useState } from 'react';
import { translations } from '../i18n';
import { 
  BellRing, 
  Volume2, 
  Play, 
  CheckCircle, 
  UserX, 
  ArrowRightLeft, 
  Clock, 
  Users, 
  ShieldCheck, 
  Building,
  User,
  Hash
} from 'lucide-react';

export default function CounterView({
  lang,
  counters = [],
  activeTickets = [],
  waitingTickets = [],
  stats,
  onCallNext,
  onRecall,
  onStartServe,
  onComplete,
  onNoShow
}) {
  const t = translations[lang];

  const [selectedCounterNum, setSelectedCounterNum] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCounter = parseInt(params.get('counter'), 10);
    if (!isNaN(urlCounter) && urlCounter >= 1 && urlCounter <= 20) return urlCounter;
    const saved = parseInt(localStorage.getItem('smartqueue_counter_num'), 10);
    return !isNaN(saved) ? saved : 1;
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const handleSelectCounter = (num) => {
    setSelectedCounterNum(num);
    localStorage.setItem('smartqueue_counter_num', num.toString());
  };

  const counterNumbers = counters.length > 0
    ? counters.map(c => c.number)
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const activeCounter = counters.find(c => c.number === selectedCounterNum) || counters[0] || {
    number: selectedCounterNum,
    officer_name: 'Pegawai Bertugas JPN',
    status: 'ONLINE'
  };

  // Find currently serving ticket for this counter if any
  const allPool = [...(activeTickets || []), ...(waitingTickets || [])];
  const currentServingTicket = allPool.find(
    t => t.id === activeCounter.current_ticket_id || (t.counter_number === activeCounter.number && ['CALLED', 'SERVING'].includes(t.status))
  );

  const executeAction = async (fn, ...args) => {
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fn(...args);
      if (res && res.message) setFeedbackMsg(res.message);
    } catch (e) {
      setFeedbackMsg(e.message || 'Ralat berlaku.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      
      {/* Top Bar: Counter Selection & Officer Info */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-lg border border-slate-200 dark:border-slate-800 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Counter Number Pill Selector (1 - 10 Counters) */}
        <div className="flex items-center flex-wrap gap-1.5 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">
            {t.selectCounter}:
          </span>
          {counterNumbers.map((num) => (
            <button
              key={num}
              onClick={() => handleSelectCounter(num)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1 ${
                selectedCounterNum === num
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>K{num}</span>
            </button>
          ))}
        </div>

        {/* Right: Active Officer Status */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div className="text-right">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              {activeCounter.officer_name}
            </h3>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              {t.counterStatusOnline} (Kaunter {activeCounter.number})
            </span>
          </div>
        </div>

      </div>

      {/* Main Grid: Left Side Controls & Serving Card, Right Side Waiting Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Active Applicant & Touch Control Station */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Serving Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center space-x-1.5">
                <Hash className="w-4 h-4 text-blue-500" />
                <span>{t.currentApplicant}</span>
              </span>
              {currentServingTicket && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  currentServingTicket.status === 'CALLED'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse'
                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {currentServingTicket.status === 'CALLED' ? 'MEMANGGIL...' : 'SEDANG DILAYAN'}
                </span>
              )}
            </div>

            {currentServingTicket ? (
              <div className="py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Nombor Giliran:</span>
                    <div className="text-5xl sm:text-6xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
                      {currentServingTicket.ticket_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Kategori:</span>
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                      {currentServingTicket.category_id}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Pemohon:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{currentServingTicket.citizen_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. MyKad:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{currentServingTicket.ic_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kaedah Saringan:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{currentServingTicket.checkin_method || 'Disahkan'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-12 h-12 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-semibold">{t.noApplicantServing}</p>
              </div>
            )}

            {/* Action Feedback message */}
            {feedbackMsg && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 text-xs font-semibold rounded-xl text-center border border-blue-200 dark:border-blue-900">
                {feedbackMsg}
              </div>
            )}

            {/* Big Tablet Touch Actions Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              
              {/* Call Next Button (Primary) */}
              <button
                onClick={() => executeAction(onCallNext, activeCounter.number)}
                disabled={actionLoading}
                className="col-span-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold py-4 px-6 rounded-2xl shadow-xl shadow-blue-500/25 active:scale-[0.98] transition flex items-center justify-center space-x-3 text-base sm:text-lg disabled:opacity-50"
              >
                <BellRing className="w-6 h-6 animate-bounce" />
                <span>{t.btnCallNext}</span>
              </button>

              {/* Recall Buzzer */}
              <button
                onClick={() => executeAction(onRecall, activeCounter.number)}
                disabled={actionLoading || !currentServingTicket}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-amber-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-40"
              >
                <Volume2 className="w-4 h-4" />
                <span>{t.btnRecall}</span>
              </button>

              {/* Start Serving */}
              <button
                onClick={() => executeAction(onStartServe, activeCounter.number)}
                disabled={actionLoading || !currentServingTicket || currentServingTicket.status === 'SERVING'}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-sky-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-40"
              >
                <Play className="w-4 h-4" />
                <span>{t.btnStartServe}</span>
              </button>

              {/* Complete Transaction */}
              <button
                onClick={() => executeAction(onComplete, activeCounter.number)}
                disabled={actionLoading || !currentServingTicket}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-emerald-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-40"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t.btnComplete}</span>
              </button>

              {/* Mark No-Show */}
              <button
                onClick={() => executeAction(onNoShow, activeCounter.number)}
                disabled={actionLoading || !currentServingTicket}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md shadow-rose-500/20 active:scale-[0.98] transition flex items-center justify-center space-x-2 text-xs sm:text-sm disabled:opacity-40"
              >
                <UserX className="w-4 h-4" />
                <span>{t.btnNoShow}</span>
              </button>

            </div>

          </div>

          {/* Quick Counter Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-semibold">{t.servedCount}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{stats?.completed ?? 0} Selesai</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-semibold">{t.avgTime}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{stats?.avgServiceMins ?? '0.0'} minit</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (5 cols): Live Waiting Queue List */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 h-full flex flex-col">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>{t.waitingQueueList}</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                {waitingTickets?.length || 0} Pemohon
              </span>
            </div>

            {/* Scrollable list */}
            <div className="space-y-2.5 overflow-y-auto max-h-[500px] flex-1 pr-1">
              {waitingTickets && waitingTickets.length > 0 ? (
                waitingTickets.map((ticket, idx) => (
                  <div
                    key={ticket.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                      ticket.status === 'WAITING'
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-black text-slate-400 w-4">#{idx + 1}</span>
                      <div>
                        <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                          {ticket.ticket_number}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                          {ticket.citizen_name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        ticket.status === 'WAITING'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {ticket.status === 'WAITING' ? 'Disahkan Hadir' : 'Menunggu Check-in'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {ticket.category_id}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <p className="text-xs">Tiada pemohon dalam giliran buat masa ini.</p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

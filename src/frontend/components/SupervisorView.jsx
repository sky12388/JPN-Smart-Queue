import React, { useState } from 'react';
import { translations } from '../i18n';
import { 
  BarChart3, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertOctagon, 
  TrendingDown, 
  Leaf, 
  DollarSign, 
  Play, 
  RotateCcw, 
  RefreshCw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

export default function SupervisorView({ 
  lang, 
  stats, 
  counters, 
  onSeedDemo, 
  onResetQueue 
}) {
  const t = translations[lang];

  const [loadingAction, setLoadingAction] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleAction = async (fn) => {
    setLoadingAction(true);
    setMsg(null);
    try {
      const res = await fn();
      if (res && res.message) setMsg(res.message);
    } catch (e) {
      setMsg(e.message || 'Ralat berlaku');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg">
        <div>
          <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900 mb-2">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Pusat Kawalan Operasi Cawangan</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {t.supervisorTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Data metrik masa nyata bagi menilai keberkesanan sistem rintis di JPN Putrajaya.
          </p>
        </div>

        {/* Action Controls for Demo */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => handleAction(onSeedDemo)}
            disabled={loadingAction}
            className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{t.btnSeedTickets}</span>
          </button>

          <button
            onClick={() => handleAction(onResetQueue)}
            disabled={loadingAction}
            className="flex-1 sm:flex-initial bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-rose-500/20 active:scale-95 transition disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.btnResetQueue}</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-semibold text-center">
          {msg}
        </div>
      )}

      {/* KPI Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Total Issued */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.metricTotalIssued}</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats?.totalIssued || 0}
          </div>
          <span className="text-[10px] text-slate-400">Hari ini</span>
        </div>

        {/* Waiting */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.metricWaiting}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {stats?.waiting || 0}
          </div>
          <span className="text-[10px] text-slate-400">Dalam giliran</span>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.metricCompleted}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.completed || 0}
          </div>
          <span className="text-[10px] text-slate-400">Selesai berurusan</span>
        </div>

        {/* No-Show Rate */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.metricNoShowRate}</span>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats?.noShowRate || '0.0%'}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Sasaran &lt; 5%</span>
        </div>

        {/* Paper Saved */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.metricPaperSaved}</span>
            <Leaf className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats?.paperSavedMeters || '0 m'}
          </div>
          <span className="text-[10px] text-slate-400">Kertas dielakkan</span>
        </div>

        {/* Cost Saved */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t.metricCostSaved}</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {stats?.costSavedMYR || 'RM 0'}
          </div>
          <span className="text-[10px] text-slate-400">Penjimatan terma</span>
        </div>

      </div>

      {/* Counters Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
          <span>{t.counterOverview}</span>
          <span className="text-xs font-normal text-slate-400">(6 Kaunter Operasi)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {counters && counters.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  Kaunter {c.number}
                </span>
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  {c.status}
                </span>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">{c.officer_name}</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Urusan: {c.assigned_categories ? JSON.parse(c.assigned_categories).join(', ') : 'SEMUA'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-400">Tiket Semasa:</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                  {c.current_ticket_id ? `Sedang Layan #${c.current_ticket_id}` : 'Sedia (Menunggu)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

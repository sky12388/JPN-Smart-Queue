import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { translations } from '../i18n';
import { playScanBeep, startPhoneAlarm, stopPhoneAlarm } from '../audio';
import confetti from 'canvas-confetti';
import { 
  QrCode, 
  MapPin, 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  XCircle,
  Camera,
  X,
  ScanLine,
  Sparkles,
  Bell,
  BellOff,
  Volume2,
  VolumeX
} from 'lucide-react';

export default function CitizenView({ 
  lang, 
  branches, 
  categories, 
  activeTicket, 
  setActiveTicket, 
  onIssueTicket, 
  onCheckinTicket,
  onCancelTicket
}) {
  const t = translations[lang];

  const [selectedBranch, setSelectedBranch] = useState('PUTRAJAYA');
  const [selectedCategory, setSelectedCategory] = useState('MYKAD');
  const [citizenName, setCitizenName] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState(null);
  
  // Live Wait Countdown State (for WAITING tickets) & Check-in Safeguard State
  const [waitCountdownSeconds, setWaitCountdownSeconds] = useState(600); // 10 mins default
  const [checkinTimerSeconds, setCheckinTimerSeconds] = useState(900); // 15 mins safeguard

  // QR Scanner Modal State
  const [showQrModal, setShowQrModal] = useState(false);

  // Ticket Lookup State (Quno-style "Already have a number?")
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupError, setLookupError] = useState(null);

  const handleFindTicket = async (e) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupError(null);
    try {
      const res = await fetch('/api/tickets/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: lookupQuery.trim(), branch_id: selectedBranch })
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        playScanBeep();
        setActiveTicket(data.ticket);
      } else {
        setLookupError(data.error || 'Tiket tidak dijumpai.');
      }
    } catch (err) {
      setLookupError('Ralat mencari tiket.');
    }
  };

  // Phone Alarm & Notification State
  const [alarmSounding, setAlarmSounding] = useState(false);
  const [notifPermission, setNotifPermission] = useState(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });

  // Request browser notification permission
  const handleEnableNotification = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        playScanBeep();
      }
    }
  };

  // Trigger Phone Alarm & Vibration when status is CALLED
  useEffect(() => {
    if (activeTicket && activeTicket.status === 'CALLED') {
      setAlarmSounding(true);
      startPhoneAlarm();

      // Vibrate mobile device (repeating pulse)
      if ('vibrate' in navigator) {
        navigator.vibrate([500, 250, 500, 250, 800]);
      }

      // Fire OS Lockscreen Notification if granted
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`🚨 GILIRAN ANDA DIPANGGIL: KAUNTER ${activeTicket.counter_number || 1}`, {
            body: `Nombor ${activeTicket.ticket_number} (${activeTicket.citizen_name}). Sila ke Kaunter sekarang!`,
            vibrate: [500, 250, 500],
            requireInteraction: true
          });
        } catch (e) {
          console.warn('Notification error:', e);
        }
      }
    } else {
      setAlarmSounding(false);
      stopPhoneAlarm();
    }

    return () => {
      stopPhoneAlarm();
    };
  }, [activeTicket?.status, activeTicket?.counter_number]);

  const handleDismissAlarm = () => {
    setAlarmSounding(false);
    stopPhoneAlarm();
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  };

  // Auto-format Malaysian MyKad / No. KP (YYMMDD-PB-###G)
  const handleIcChange = (e) => {
    const raw = e.target.value;
    // Strip non-digits and limit to 12 numeric digits
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    
    let formatted = digits;
    if (digits.length > 8) {
      formatted = `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 6)}-${digits.slice(6)}`;
    }
    setIcNumber(formatted);
  };

  // Auto-format Mobile Phone (01X-XXXXXXX)
  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (digits.length > 3) {
      setPhone(`${digits.slice(0, 3)}-${digits.slice(3)}`);
    } else {
      setPhone(digits);
    }
  };

  // Live countdown intervals: Runs live for both WAITING and PENDING_CHECKIN
  useEffect(() => {
    if (!activeTicket) return;

    // 1. Calculate remaining wait time for WAITING status
    if (activeTicket.status === 'WAITING') {
      const estimatedSecs = (activeTicket.estimated_wait_mins || 10) * 60;
      let elapsedSecs = 0;
      if (activeTicket.checked_in_at) {
        const t = new Date(activeTicket.checked_in_at).getTime();
        if (!isNaN(t)) {
          elapsedSecs = Math.max(0, Math.floor((Date.now() - t) / 1000));
        }
      }
      const remaining = Math.max(0, estimatedSecs - elapsedSecs);
      setWaitCountdownSeconds(remaining > 0 ? remaining : estimatedSecs);
    }

    // 2. Calculate remaining check-in time for PENDING_CHECKIN status
    if (activeTicket.status === 'PENDING_CHECKIN') {
      let elapsedSecs = 0;
      if (activeTicket.created_at) {
        const t = new Date(activeTicket.created_at).getTime();
        if (!isNaN(t)) {
          elapsedSecs = Math.max(0, Math.floor((Date.now() - t) / 1000));
        }
      }
      const remaining = Math.max(0, 900 - elapsedSecs);
      setCheckinTimerSeconds(remaining > 0 ? remaining : 900);
    }

    // Second-by-second countdown ticker
    const interval = setInterval(() => {
      setWaitCountdownSeconds(prev => (prev > 0 ? prev - 1 : 0));
      setCheckinTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTicket?.status, activeTicket?.estimated_wait_mins, activeTicket?.checked_in_at, activeTicket?.created_at]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    if (!citizenName || !icNumber) return;

    setIsSubmitting(true);
    await onIssueTicket({
      branch_id: selectedBranch,
      category_id: selectedCategory,
      citizen_name: citizenName,
      ic_number: icNumber,
      phone: phone
    });
    setIsSubmitting(false);
  };

  const handleGpsCheckin = async () => {
    setIsCheckingIn(true);
    setCheckinMessage(null);

    // Try HTML5 Geolocation API with fallback
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const res = await onCheckinTicket(activeTicket.id, 'GPS', position.coords.latitude, position.coords.longitude);
          setCheckinMessage(res.message);
          playScanBeep();
          confetti({ particleCount: 50, spread: 50 });
          setIsCheckingIn(false);
        },
        async () => {
          const branch = branches.find(b => b.id === activeTicket.branch_id) || { lat: 2.9234, lng: 101.6888 };
          const res = await onCheckinTicket(activeTicket.id, 'GPS', branch.lat, branch.lng);
          setCheckinMessage(res.message);
          playScanBeep();
          confetti({ particleCount: 50, spread: 50 });
          setIsCheckingIn(false);
        },
        { timeout: 5000 }
      );
    } else {
      const res = await onCheckinTicket(activeTicket.id, 'GPS', 2.9234, 101.6888);
      setCheckinMessage(res.message);
      playScanBeep();
      confetti({ particleCount: 50, spread: 50 });
      setIsCheckingIn(false);
    }
  };

  // Triggered when scanning premises QR code
  const handleConfirmQrScan = async (scannedCode = 'JPN-GATE-KIOSK-01') => {
    setIsCheckingIn(true);
    playScanBeep();
    confetti({ particleCount: 70, spread: 60 });

    const res = await onCheckinTicket(activeTicket.id, 'QR_KIOSK', null, null, scannedCode);
    setCheckinMessage(res.message);
    setIsCheckingIn(false);
    setShowQrModal(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-8">
      
      {/* If No Active Ticket: Show Ticket Application Form */}
      {!activeTicket ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl" />
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-amber-300 border border-white/10 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sistem Giliran Pintar & Maya</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{t.citizenTitle}</h2>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1.5 max-w-sm mx-auto">
              {t.citizenSubtitle}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleIssue} className="p-6 space-y-5">
            
            {/* Branch Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                {t.selectBranch}
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {lang === 'ms' ? b.name_ms : b.name_en}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                {t.selectCategory}
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start space-x-3.5 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {cat.code}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {lang === 'ms' ? cat.name_ms : cat.name_en}
                          </h4>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                            ~{cat.avg_duration_mins} min
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {lang === 'ms' ? cat.description_ms : cat.description_en}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Applicant Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                {t.fullName} *
              </label>
              <input
                type="text"
                required
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                placeholder="Contoh: Muhammad Ali bin Ismail"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* MyKad Number & Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  {t.icNumber} *
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={14}
                  value={icNumber}
                  onChange={handleIcChange}
                  placeholder="Contoh: 900101-14-5566"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  {t.phoneNumber}
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  maxLength={12}
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={t.phonePlaceholder}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Dilindungi keselamatan Anti-Abuse (Strike Rule & Pengesahan MyKad).</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 active:scale-[0.99] transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.processing}</span>
                </>
              ) : (
                <>
                  <span>{t.btnGetTicket}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quno-style "Already have a number?" Lookup */}
          <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800">
            <details className="group bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/60">
              <summary className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center justify-between">
                <span>🎫 {lang === 'ms' ? 'Sudah ada nombor tiket? Jejak di sini' : 'Already have a ticket number? Track here'}</span>
                <span className="text-blue-600 dark:text-blue-400 text-[11px] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <form onSubmit={handleFindTicket} className="mt-3 space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'ms'
                    ? 'Masukkan No. Giliran (cth: A-1001) atau No. MyKad anda untuk memaparkan semula tiket:'
                    : 'Enter your Ticket No. (e.g. A-1001) or MyKad number to restore your ticket:'}
                </p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    placeholder="Contoh: A-1001 atau 940512-10-5432"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs"
                  >
                    {lang === 'ms' ? 'Cari' : 'Find'}
                  </button>
                </div>
                {lookupError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{lookupError}</p>
                )}
              </form>
            </details>
          </div>
        </div>
      ) : (
        /* Active Virtual Ticket Card */
        <div className="space-y-4">
          
          {/* Permission Prompt for Smartphone Alarm & Notification */}
          {notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={handleEnableNotification}
              className="w-full p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 active:scale-[0.99] transition shadow-sm"
            >
              <div className="flex items-center space-x-2.5">
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-bounce flex-shrink-0" />
                <div className="text-left">
                  <span className="font-bold block">Aktifkan Penggera Telefon</span>
                  <span className="text-[10px] text-amber-700/80 dark:text-amber-400">Telefon akan berbunyi & bergetar semasa nombor dipanggil</span>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[11px] shadow-sm flex-shrink-0">
                BENARKAN
              </span>
            </button>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            {/* Top Status Header */}
            <div className={`p-4 text-center transition-colors ${
              activeTicket.status === 'CALLED'
                ? 'bg-amber-500 text-white animate-pulse-fast'
                : activeTicket.status === 'WAITING'
                ? 'bg-blue-600 text-white'
                : activeTicket.status === 'SERVING'
                ? 'bg-emerald-600 text-white'
                : activeTicket.status === 'PENDING_CHECKIN'
                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              <div className="text-xs font-bold uppercase tracking-widest">
                {activeTicket.status === 'PENDING_CHECKIN' && t.statusPendingCheckin}
                {activeTicket.status === 'WAITING' && t.statusWaiting}
                {activeTicket.status === 'CALLED' && t.statusCalled}
                {activeTicket.status === 'SERVING' && t.statusServing}
                {activeTicket.status === 'COMPLETED' && t.statusCompleted}
                {activeTicket.status === 'NO_SHOW' && t.statusNoShow}
              </div>
            </div>

            {/* Ticket Body */}
            <div className="p-6 text-center space-y-4">
              
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.yourTicketNumber}
                </p>
                <div className={`text-5xl sm:text-6xl font-black font-mono tracking-tight my-2 ${
                  activeTicket.status === 'CALLED'
                    ? 'text-amber-600 dark:text-amber-400 scale-105 transition-transform'
                    : 'text-slate-900 dark:text-white'
                }`}>
                  {activeTicket.ticket_number}
                </div>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {activeTicket.citizen_name}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  MyKad: {activeTicket.ic_number}
                </p>
              </div>

              {/* Called Highlight Alert & Loud Alarm Dismiss */}
              {activeTicket.status === 'CALLED' && (
                <div className="p-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-3xl shadow-2xl border-4 border-amber-300 animate-pulse text-left space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-5 h-5 animate-spin" />
                      <span className="text-[11px] font-black uppercase tracking-widest bg-black/30 px-3 py-1 rounded-full">
                        PENGGERA GILIRAN BERBUNYI!
                      </span>
                    </div>
                    {alarmSounding && (
                      <span className="flex items-center space-x-1 text-xs font-bold bg-white/20 px-2.5 py-1 rounded-xl">
                        <Volume2 className="w-4 h-4 animate-bounce" />
                        <span>BUNYI AKTIF</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-2xl shadow-lg border border-amber-400 flex-shrink-0">
                      {activeTicket.counter_number || 1}
                    </div>
                    <div>
                      <h4 className="text-base font-black">
                        SILA KE KAUNTER {activeTicket.counter_number || 1} SEKARANG!
                      </h4>
                      <p className="text-xs text-white/90 font-medium mt-0.5">
                        Pegawai sedang menunggu anda di kaunter. Sila hadir segera.
                      </p>
                    </div>
                  </div>

                  {alarmSounding && (
                    <button
                      type="button"
                      onClick={handleDismissAlarm}
                      className="w-full bg-slate-950 hover:bg-black text-amber-300 font-black py-3.5 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xl active:scale-95 transition border border-amber-400"
                    >
                      <VolumeX className="w-4 h-4 text-rose-400" />
                      <span>HENTIKAN PENGGERA (SAYA SEDANG MENUJU KE KAUNTER)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Waiting Information (People Ahead & Estimated Wait Live Countdown) */}
              {activeTicket.status === 'WAITING' && (
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 dark:border-slate-800">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
                    <div className="flex items-center justify-center space-x-1.5 text-slate-500 dark:text-slate-400 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-[11px] font-semibold">{t.peopleAhead}</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {activeTicket.peopleAhead ?? 1}
                    </div>
                    <span className="text-[10px] text-slate-400">orang di hadapan</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl relative overflow-hidden">
                    <div className="flex items-center justify-center space-x-1.5 text-slate-500 dark:text-slate-400 mb-1">
                      <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                      <span className="text-[11px] font-semibold">{t.estimatedWait}</span>
                    </div>
                    {waitCountdownSeconds > 0 ? (
                      <div>
                        <div className="text-2xl font-black font-mono tracking-wider text-blue-600 dark:text-blue-400">
                          {formatTimer(waitCountdownSeconds)}
                        </div>
                        <span className="text-[10px] text-slate-400 flex items-center justify-center space-x-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>Kiraan Masa Nyata</span>
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 animate-pulse">
                          Bersedia!
                        </div>
                        <span className="text-[10px] text-slate-400">Giliran bila-bila masa</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Check-in Section (Arrival Safeguard 15-Minute) */}
              {activeTicket.status === 'PENDING_CHECKIN' && (
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                        {t.arrivalSafeguardTitle}
                      </h4>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300 mt-1">
                        {t.arrivalSafeguardDesc}
                      </p>
                    </div>
                  </div>

                  {/* Countdown Warning */}
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Masa Baki Sahkan Kehadiran:</span>
                    <span className="text-base font-black font-mono text-red-600 dark:text-red-400">
                      {formatTimer(checkinTimerSeconds)}
                    </span>
                  </div>

                  {/* Verification Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleGpsCheckin}
                      disabled={isCheckingIn}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition disabled:opacity-50"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{t.btnGpsCheckin}</span>
                    </button>

                    <button
                      onClick={() => setShowQrModal(true)}
                      disabled={isCheckingIn}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{t.btnQrCheckin}</span>
                    </button>
                  </div>

                  {checkinMessage && (
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg font-medium text-center">
                      {checkinMessage}
                    </div>
                  )}
                </div>
              )}

              {/* Real Scannable Dynamic QR Code for Citizen */}
              <div className="py-2 flex flex-col items-center justify-center">
                <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-slate-200 dark:border-slate-700">
                  <QRCodeSVG
                    value={JSON.stringify({
                      ticket_id: activeTicket.id,
                      ticket_number: activeTicket.ticket_number,
                      branch: activeTicket.branch_id,
                      ic: activeTicket.ic_number
                    })}
                    size={140}
                    level="M"
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-mono">
                  Tiket Maya #{activeTicket.ticket_number}
                </span>
                <span className="text-[10px] text-slate-400">
                  Tunjukkan kod ini kepada pegawai kaunter atau imbas di kiosk pintu masuk
                </span>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={() => onCancelTicket(activeTicket.id)}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center space-x-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{t.btnCancelTicket}</span>
              </button>

              <button
                onClick={() => setActiveTicket(null)}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:underline flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ambil Tiket Lain</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Interactive QR Camera Scanner Viewfinder Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Pengimbas Kod QR Premis</span>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated Camera Viewfinder */}
            <div className="p-6 text-center space-y-4">
              <div className="relative w-56 h-56 mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-slate-800">
                {/* Viewfinder crosshairs */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />

                {/* Animated Laser Scanning Line */}
                <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse-fast top-1/2 -translate-y-1/2" />

                <div className="text-center p-4">
                  <QrCode className="w-20 h-20 text-slate-700 mx-auto" />
                  <p className="text-[11px] text-emerald-400 font-mono mt-2 animate-pulse">
                    Mencari Kod QR Kiosk...
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arahkan kamera ke tablet kiosk di pintu masuk JPN Putrajaya untuk mengesahkan kehadiran anda.
              </p>

              {/* Simulation One-Click Button */}
              <button
                onClick={() => handleConfirmQrScan('JPN-PUTRAJAYA-GATE-1')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulasikan Imbasan QR Berjaya</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

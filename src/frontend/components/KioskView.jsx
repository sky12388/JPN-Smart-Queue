import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { translations } from '../i18n';
import { playScanBeep } from '../audio';
import confetti from 'canvas-confetti';
import { 
  QrCode, 
  Camera, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  Smartphone,
  ScanLine
} from 'lucide-react';

export default function KioskView({ lang, onCheckinTicket, waitingTickets }) {
  const t = translations[lang];

  const [dynamicToken, setDynamicToken] = useState(() => Date.now().toString());
  const [manualTicketInput, setManualTicketInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Dynamic token rotates every 30 seconds for anti-fraud (cannot be screenshotted remotely)
  useEffect(() => {
    const interval = setInterval(() => {
      setDynamicToken(Date.now().toString());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const kioskCheckinUrl = `${window.location.origin}/#citizen?kiosk_checkin=1&token=${dynamicToken}`;

  const handleSimulatedScan = async (ticket) => {
    setIsScanning(true);
    playScanBeep();
    confetti({ particleCount: 60, spread: 60 });

    try {
      const res = await onCheckinTicket(ticket.id, 'QR_KIOSK', null, null, `KIOSK-MAIN-DOOR-${dynamicToken.slice(-4)}`);
      setScanResult({
        success: true,
        message: `Tiket ${ticket.ticket_number} (${ticket.citizen_name}) berjaya disahkan di Kiosk Pintu Masuk!`,
        ticket: ticket
      });
    } catch (e) {
      setScanResult({ success: false, message: 'Gagal mengesahkan tiket.' });
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanResult(null), 6000);
    }
  };

  const handleManualCheckin = async (e) => {
    e.preventDefault();
    if (!manualTicketInput) return;

    const matched = waitingTickets?.find(
      t => t.ticket_number.toLowerCase() === manualTicketInput.trim().toLowerCase() && t.status === 'PENDING_CHECKIN'
    );

    if (matched) {
      await handleSimulatedScan(matched);
      setManualTicketInput('');
    } else {
      setScanResult({
        success: false,
        message: `Nombor tiket "${manualTicketInput}" tidak dijumpai atau sudah pun disahkan hadir.`
      });
      setTimeout(() => setScanResult(null), 5000);
    }
  };

  // Find tickets waiting for check-in
  const pendingCheckinTickets = waitingTickets?.filter(t => t.status === 'PENDING_CHECKIN') || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 select-none">
      
      {/* Kiosk Tablet Outer Frame */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-4 border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Kiosk Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 p-6 text-white text-center relative overflow-hidden">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-amber-300 border border-white/10 mb-3">
            <ScanLine className="w-4 h-4 animate-pulse" />
            <span>Kiosk Tablet Pintu Masuk (Entrance Check-in)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Selamat Datang ke JPN Putrajaya
          </h2>
          <p className="text-xs sm:text-sm text-blue-200 mt-1 max-w-lg mx-auto">
            Sila sahkan kehadiran anda untuk mengaktifkan giliran kaunter.
          </p>
        </div>

        {/* Content Split: Left (QR Code for Rakyat Phone), Right (Kiosk Tablet Scanner) */}
        <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          {/* Left Column: Dynamic Premises QR Code */}
          <div className="flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700/80">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 mb-3">
              <Smartphone className="w-4 h-4" />
              <span>KAEDAH 1: IMBAS DARI TELEFON ANDA</span>
            </div>

            {/* Real Dynamic Scannable QR Code */}
            <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-slate-200 dark:border-slate-700 relative group">
              <QRCodeSVG
                value={kioskCheckinUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
              <div className="absolute inset-0 bg-blue-600/5 rounded-2xl pointer-events-none" />
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Arahkan Kamera Telefon Pintar Anda
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                Kod QR ini bertukar secara dinamik dengan token keselamatan anti-penipuan.
              </p>
              <div className="inline-flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Token Sah: {dynamicToken.slice(-6)} (Segar 30s)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Tablet Scanner for Citizen Ticket */}
          <div className="flex flex-col justify-between h-full p-6 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-5">
            <div>
              <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mb-3">
                <Camera className="w-4 h-4" />
                <span>KAEDAH 2: TUNJUK TIKET PADA KIOSK</span>
              </div>

              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Simulasi Imbasan Pengimbas Kiosk
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Pilih tiket pemohon di bawah untuk mensimulasikan imbasan kamera kiosk di pintu masuk:
              </p>
            </div>

            {/* List of Pending Check-in tickets to test 1-click scan */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pendingCheckinTickets.length > 0 ? (
                pendingCheckinTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                        {t.ticket_number}
                      </span>
                      <p className="text-[11px] text-slate-500 truncate max-w-[120px]">{t.citizen_name}</p>
                    </div>

                    <button
                      onClick={() => handleSimulatedScan(t)}
                      disabled={isScanning}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm flex items-center space-x-1 active:scale-95 transition"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>Imbas Sekarang</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  Tiada tiket dalam status "Pending Check-in". Ambil tiket baharu di menu Tiket Maya untuk mencuba.
                </div>
              )}
            </div>

            {/* Manual Ticket Input Fallback */}
            <form onSubmit={handleManualCheckin} className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                Atau Masukkan No. Tiket:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={manualTicketInput}
                  onChange={(e) => setManualTicketInput(e.target.value)}
                  placeholder="Contoh: A-1001"
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs"
                >
                  Sahkan
                </button>
              </div>
            </form>

            {/* Feedback alert */}
            {scanResult && (
              <div className={`p-3 rounded-xl text-xs font-bold text-center border ${
                scanResult.success
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
              }`}>
                {scanResult.message}
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

// Audio Chime & Speech Synthesis Utility for SmartQueueJPN

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Generates a crisp scanner beep (like a retail / kiosk scanner)
export function playScanBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (err) {
    console.warn('Beep audio error:', err);
  }
}

// Generates an elegant airport/station dual-tone Ding-Dong chime
export function playChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: High chime (880Hz / A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tone 2: Harmonious low chime (587.33Hz / D5) after 0.25s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587.33, now + 0.25);
    gain2.gain.setValueAtTime(0.35, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.85);
  } catch (err) {
    console.warn('Web Audio error:', err);
  }
}

// Speak the ticket call in BM or EN
export function speakAnnouncement(ticketNumber, counterNumber, lang = 'ms') {
  if (!('speechSynthesis' in window)) return;

  // Let the chime finish first before speaking
  setTimeout(() => {
    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      // Format ticket for natural speech: "A-1002" -> "A, satu, kosong, kosong, dua" in BM
      let speechText = '';
      if (lang === 'ms') {
        const parts = ticketNumber.split('-');
        const prefix = parts[0];
        const digits = parts[1] ? parts[1].split('').join(' ') : '';
        speechText = `Nombor giliran ${prefix} ${digits}. Sila ke Kaunter ${counterNumber}.`;
      } else {
        const parts = ticketNumber.split('-');
        const prefix = parts[0];
        const digits = parts[1] ? parts[1].split('').join(' ') : '';
        speechText = `Ticket ${prefix} ${digits}. Please proceed to Counter ${counterNumber}.`;
      }

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.lang = lang === 'ms' ? 'ms-MY' : 'en-US';

      // Pick Malay or standard voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        lang === 'ms' ? (v.lang.includes('ms') || v.lang.includes('id')) : (v.lang.includes('en-US') || v.lang.includes('en-GB'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  }, 750);
}

// Looping Phone Alarm / Ringtone for Citizen Device
let alarmTimer = null;

export function startPhoneAlarm() {
  stopPhoneAlarm(); // clear any previous

  const playAlarmPulse = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Note 1 (E6 - 1318 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1318.51, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2 (G6 - 1567 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1567.98, now + 0.15);
      gain2.gain.setValueAtTime(0.45, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);

      // Note 3 (C7 - 2093 Hz) - loud alert
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(2093.00, now + 0.3);
      gain3.gain.setValueAtTime(0.5, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.3);
      osc3.stop(now + 0.7);
    } catch (e) {
      console.warn('Alarm audio error:', e);
    }
  };

  playAlarmPulse();
  alarmTimer = setInterval(playAlarmPulse, 1200);
}

export function stopPhoneAlarm() {
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }
}

/**
 * Browser voice: speech-to-text, text-to-speech, sound cues and a mic level meter.
 * Uses only what Chrome/Android already ships, so there is no key and no bill.
 */

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib).
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { isFinal: boolean; length: number; [i: number]: SRAlternative }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function sttSupported(): boolean {
  return typeof window !== 'undefined' && recognitionCtor() !== null;
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface Heard {
  text: string;
  alternatives: string[];
  confidence: number;
}

export type ListenError = 'mic-denied' | 'network' | 'no-mic' | 'unsupported' | 'aborted';

export interface ListenHandle {
  result: Promise<Heard>;
  stop: () => void;
  abort: () => void;
}

/** Listen for one sentence. Resolves with empty text on silence. */
export function listen(lang: string, onInterim?: (text: string) => void, onSpeechStart?: () => void): ListenHandle {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return { result: Promise.reject<Heard>('unsupported' satisfies ListenError), stop() {}, abort() {} };
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 4;

  let finalText = '';
  let alternatives: string[] = [];
  let confidence = 0;
  let failed: ListenError | null = null;

  const result = new Promise<Heard>((resolve, reject) => {
    rec.onspeechstart = () => onSpeechStart?.();
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalText += r[0].transcript;
          confidence = r[0].confidence;
          alternatives = Array.from({ length: r.length }, (_, k) => r[k].transcript).slice(1);
        } else {
          interim += r[0].transcript;
        }
      }
      onInterim?.((finalText + ' ' + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') failed = 'mic-denied';
      else if (e.error === 'network') failed = 'network';
      else if (e.error === 'audio-capture') failed = 'no-mic';
      else if (e.error === 'aborted') failed = 'aborted';
      // 'no-speech' is not an error for us: it is silence.
    };
    rec.onend = () => {
      if (failed) reject(failed);
      else resolve({ text: finalText.trim(), alternatives, confidence });
    };
  });

  try {
    rec.start();
  } catch {
    return { result: Promise.reject<Heard>('aborted' satisfies ListenError), stop() {}, abort() {} };
  }
  return { result, stop: () => rec.stop(), abort: () => rec.abort() };
}

// ---------- Text to speech ----------

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  voicesReady ??= new Promise((resolve) => {
    const now = speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
  return voicesReady;
}

/**
 * How clear a voice is likely to sound. Neural "Natural/Online" voices (Edge: Swara,
 * Madhur, Aarohi, Manohar) beat Google's online voices, which beat offline system voices.
 */
export function voiceScore(v: { name: string; lang: string; localService?: boolean }, lang: string): number {
  const base = lang.split('-')[0];
  let score = 0;
  if (v.lang === lang) score += 100;
  else if (v.lang.startsWith(base)) score += 80;
  else if (base !== 'en' && v.lang === 'hi-IN') score += 40; // Marathi text still reads well in a Hindi voice
  else if (v.lang.endsWith('-IN')) score += 10;
  else return 0;
  if (/natural|neural/i.test(v.name)) score += 30;
  if (/online/i.test(v.name)) score += 10;
  if (/google/i.test(v.name)) score += 20;
  if (/swara|madhur|aarohi|manohar|kalpana|hemant|heera|neerja|prabhat/i.test(v.name)) score += 5;
  return score;
}

/** Voices worth offering for a language, clearest first. */
export async function voicesFor(lang: string): Promise<SpeechSynthesisVoice[]> {
  const voices = await loadVoices();
  return voices.filter((v) => voiceScore(v, lang) > 0).sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang));
}

/** This phone's own choice of voice and pace (a device setting, not group data). */
export interface VoicePrefs { voice?: string; rate: number }
const PREFS_KEY = 'bk.voice';

export function loadVoicePrefs(): VoicePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { rate: 0.95, ...JSON.parse(raw) };
  } catch {
    // storage blocked: use defaults
  }
  return { rate: 0.95 };
}

export function saveVoicePrefs(p: VoicePrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

async function pickVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
  const ranked = await voicesFor(lang);
  const wanted = loadVoicePrefs().voice;
  return ranked.find((v) => v.name === wanted) ?? ranked[0] ?? null;
}

export async function voiceAvailable(lang: string): Promise<boolean> {
  const v = await pickVoice(lang);
  return !!v && v.lang.startsWith(lang.split('-')[0]);
}

let speakToken = 0;

export function stopSpeaking(): void {
  speakToken++;
  if (ttsSupported()) speechSynthesis.cancel();
}

/**
 * Split a reply into sentences. Short utterances sound clearer, get a natural pause
 * between them, and avoid Chrome cutting off speech after about 15 seconds.
 */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[।.?!])\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Speak and resolve when finished. A newer call cancels an older one. */
export async function speak(text: string, lang: string, rate?: number, pitch = 1): Promise<void> {
  if (!ttsSupported() || !text) return;
  const token = ++speakToken;
  speechSynthesis.cancel();
  const voice = await pickVoice(lang);
  const pace = rate ?? loadVoicePrefs().rate;
  for (const part of sentences(text)) {
    if (token !== speakToken) return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voice?.lang ?? lang;
      if (voice) u.voice = voice;
      u.rate = pace;
      u.pitch = pitch;
      const timeout = setTimeout(resolve, 2000 + part.length * 120 / pace);
      u.onend = () => { clearTimeout(timeout); resolve(); };
      u.onerror = () => { clearTimeout(timeout); resolve(); };
      speechSynthesis.speak(u);
    });
    // A short breath between sentences.
    await new Promise((r) => setTimeout(r, 140));
  }
}

// ---------- Sound cues ----------

let audio: AudioContext | null = null;

function tone(freqs: number[], dur = 0.12, type: OscillatorType = 'sine', gain = 0.08) {
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    freqs.forEach((f, i) => {
      const osc = audio!.createOscillator();
      const g = audio!.createGain();
      osc.type = type;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * dur);
      g.gain.linearRampToValueAtTime(gain, t0 + i * dur + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur + 0.08);
      osc.connect(g).connect(audio!.destination);
      osc.start(t0 + i * dur);
      osc.stop(t0 + (i + 1) * dur + 0.1);
    });
  } catch {
    // No audio output: the spoken reply still carries the meaning.
  }
}

/** Bell-like rising notes: entry written into the khata. */
export const cueSaved = () => tone([660, 880, 1320], 0.1, 'triangle');
/** A rubber stamp landing on paper: a short low thump. */
export function cueStamp() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start();
  } catch {
    // no audio output
  }
}

/** One soft note: your turn to speak. */
export const cueListen = () => tone([740], 0.09, 'sine', 0.05);
/** Low double note: something is wrong or was not heard. */
export const cueError = () => tone([300, 220], 0.14, 'square', 0.035);

// ---------- Mic level meter ----------

/**
 * Live input level 0..1, so speakers can see the phone is hearing them,
 * and a noisy room shows up before it ruins an entry.
 */
export async function micLevel(onLevel: (level: number) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) return () => {};
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return () => {};
  }
  audio ??= new AudioContext();
  const ctx = audio;
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
  };
}

/**
 * Web Audio API crowd roar synthesizer.
 * Layered approach:
 *   1. Mid crowd noise  — white noise → bandpass 300–3000 Hz → reverb → gain
 *   2. Low rumble layer — white noise → lowpass 80 Hz → gain
 *   3. Master gain envelope: 200ms attack, sustain, 1.5s release
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

function createNoiseBuffer(ac: AudioContext, durationSec: number): AudioBuffer {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * durationSec);
  const buf = ac.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Simple synthetic reverb impulse response */
function createImpulse(ac: AudioContext): AudioBuffer {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * 2.5);
  const impulse = ac.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
  }
  return impulse;
}

export async function playRoar(durationSec = 5): Promise<void> {
  const ac = getCtx();
  if (ac.state === 'suspended') await ac.resume();

  const now = ac.currentTime;
  const attackTime = 0.25;
  const releaseTime = 1.8;
  const sustainTime = durationSec - attackTime - releaseTime;
  const end = now + durationSec;

  // ── Shared reverb convolver ─────────────────────────────────────────────────
  const convolver = ac.createConvolver();
  convolver.buffer = createImpulse(ac);

  // ── Master gain (envelope) ──────────────────────────────────────────────────
  const master = ac.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(1, now + attackTime);
  master.gain.setValueAtTime(1, now + attackTime + sustainTime);
  master.gain.linearRampToValueAtTime(0, end);
  master.connect(ac.destination);

  // ── Mid crowd noise ─────────────────────────────────────────────────────────
  const midNoise = ac.createBufferSource();
  midNoise.buffer = createNoiseBuffer(ac, durationSec + 0.5);
  midNoise.loop = false;

  const bandpass = ac.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1100;
  bandpass.Q.value = 0.8;

  const midGain = ac.createGain();
  midGain.gain.value = 0.85;

  midNoise.connect(bandpass);
  bandpass.connect(convolver);
  convolver.connect(midGain);
  midGain.connect(master);

  // ── Low rumble layer ────────────────────────────────────────────────────────
  const lowNoise = ac.createBufferSource();
  lowNoise.buffer = createNoiseBuffer(ac, durationSec + 0.5);
  lowNoise.loop = false;

  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 90;

  const lowGain = ac.createGain();
  lowGain.gain.value = 0.4;

  lowNoise.connect(lowpass);
  lowpass.connect(lowGain);
  lowGain.connect(master);

  // ── Chant texture (narrow bandpass pulsed around 600 Hz) ───────────────────
  const chantNoise = ac.createBufferSource();
  chantNoise.buffer = createNoiseBuffer(ac, durationSec + 0.5);

  const chantFilter = ac.createBiquadFilter();
  chantFilter.type = 'bandpass';
  chantFilter.frequency.value = 600;
  chantFilter.Q.value = 3;

  const chantGain = ac.createGain();
  chantGain.gain.value = 0.3;

  chantNoise.connect(chantFilter);
  chantFilter.connect(chantGain);
  chantGain.connect(master);

  // ── Start & auto-stop ──────────────────────────────────────────────────────
  midNoise.start(now);
  lowNoise.start(now);
  chantNoise.start(now);

  midNoise.stop(end + 0.1);
  lowNoise.stop(end + 0.1);
  chantNoise.stop(end + 0.1);
}

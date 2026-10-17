const fs = require('fs');
const path = require('path');

// Romantic Acoustic Grand Piano + Warm Cello/String Pad Synthesizer (44.1kHz Stereo WAV, exact 30.0s)
// Inspired by Richard Clayderman's romantic piano style (original composition, copyright-safe)
// Emotional arc:
// 00:00 - 00:03: Delicate sparse high piano notes (Hook)
// 00:03 - 00:08: Gentle flowing left-hand arpeggios + tender melody
// 00:08 - 00:13: Rhythmic 3-part phrasing matching the 3 flower-crafting cuts (8.0s, 9.67s, 11.33s)
// 00:13 - 00:19: Warmer, more emotional progression upon receiving the order notification
// 00:19 - 00:25: Emotional romantic climax (Clayderman-style octave melody + warm harmonic swell)
// 00:25 - 00:30: Gentle poetic resolution and lingering warm chord fade-out

const SAMPLE_RATE = 44100;
const DURATION = 30.0;
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

const leftChannel = new Float32Array(NUM_SAMPLES);
const rightChannel = new Float32Array(NUM_SAMPLES);

function midiToFreq(midi) {
  return 440.0 * Math.pow(2.0, (midi - 69.0) / 12.0);
}

// Realistic warm grand piano note synthesis with inharmonicity, velocity-dependent harmonics, and damper decay
function addPianoNote(startTime, duration, midi, velocity = 0.5, pan = 0.0) {
  const freq = midiToFreq(midi);
  const startIdx = Math.max(0, Math.floor(startTime * SAMPLE_RATE));
  const maxDur = Math.min(DURATION - startTime, duration + 1.8); // sustain pedal tail
  const endIdx = Math.min(NUM_SAMPLES, startIdx + Math.floor(maxDur * SAMPLE_RATE));

  // Piano string inharmonicity coefficient
  const B = 0.00012 * Math.pow(freq / 261.63, 1.3);
  const partials = [
    { n: 1, amp: 1.00, decay: 1.8 },
    { n: 2, amp: 0.42 * (0.6 + 0.4 * velocity), decay: 2.3 },
    { n: 3, amp: 0.20 * (0.5 + 0.5 * velocity), decay: 3.0 },
    { n: 4, amp: 0.10 * velocity, decay: 4.0 },
    { n: 5, amp: 0.05 * velocity, decay: 5.2 },
    { n: 6, amp: 0.025 * velocity, decay: 6.5 }
  ];

  // Slight stereo spread from low (left) to high (right) like a grand piano
  const notePan = Math.max(-0.45, Math.min(0.45, pan + ((midi - 64) / 48) * 0.35));
  const gainL = velocity * 0.16 * Math.cos((notePan + 1) * Math.PI / 4);
  const gainR = velocity * 0.16 * Math.sin((notePan + 1) * Math.PI / 4);

  // Higher notes decay faster naturally
  const pitchDecayFactor = Math.pow(261.63 / freq, 0.35);

  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / SAMPLE_RATE;

    // Soft felt hammer attack envelope
    const attackTime = 0.008;
    const attack = t < attackTime ? Math.sin((t / attackTime) * (Math.PI / 2)) : 1.0;

    // Release after pedal hold
    let release = 1.0;
    if (t > duration) {
      const relT = t - duration;
      release = Math.exp(-relT * 3.2);
    }

    let sample = 0.0;
    for (let p = 0; p < partials.length; p++) {
      const part = partials[p];
      const pf = freq * part.n * Math.sqrt(1.0 + B * part.n * part.n);
      if (pf > SAMPLE_RATE * 0.45) continue;
      const env = Math.exp(-t * (part.decay / pitchDecayFactor));
      // Subtle detuned unison strings for richness
      const s1 = Math.sin(2.0 * Math.PI * pf * t);
      const s2 = Math.sin(2.0 * Math.PI * (pf * 1.0005) * t + 0.3);
      sample += 0.5 * (s1 + s2) * part.amp * env;
    }

    // Subtle wooden soundboard knock on attack
    const hammer = t < 0.015 ? Math.sin(2.0 * Math.PI * (freq * 0.5) * t) * Math.exp(-t * 180.0) * 0.08 * velocity : 0.0;

    const val = (sample + hammer) * attack * release;
    leftChannel[i] += val * gainL;
    rightChannel[i] += val * gainR;
  }
}

// Warm cinematic string pad (very soft underneath Scenes 4 & 5 to elevate emotion)
function addWarmPad(startTime, duration, midiNotes, amplitude = 0.04) {
  const startIdx = Math.max(0, Math.floor(startTime * SAMPLE_RATE));
  const endIdx = Math.min(NUM_SAMPLES, startIdx + Math.floor(duration * SAMPLE_RATE));

  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / SAMPLE_RATE;
    const fadeIn = Math.min(1.0, t / 1.2);
    const fadeOut = Math.min(1.0, (duration - t) / 1.4);
    const env = Math.sin(fadeIn * Math.PI / 2) * Math.sin(fadeOut * Math.PI / 2);

    let sumL = 0.0;
    let sumR = 0.0;
    for (let m = 0; m < midiNotes.length; m++) {
      const f = midiToFreq(midiNotes[m]);
      const vibrato = 1.0 + 0.0012 * Math.sin(2 * Math.PI * 4.5 * t + m);
      const sig = Math.sin(2 * Math.PI * f * vibrato * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * vibrato * t);
      sumL += sig * (m % 2 === 0 ? 0.7 : 0.4);
      sumR += sig * (m % 2 === 0 ? 0.4 : 0.7);
    }
    leftChannel[i] += sumL * amplitude * env / midiNotes.length;
    rightChannel[i] += sumR * amplitude * env / midiNotes.length;
  }
}

// MIDI Helper Notes (Key of F Major / D Minor Romantic Ballad - warm, nostalgic, hopeful)
// F3=53, G3=55, A3=57, Bb3=58, C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, Bb4=70, C5=72, D5=74, E5=76, F5=77, G5=79, A5=81

// --- SCENE 1 (00:00 - 00:03): Delicate crystalline opening piano notes (Hook) ---
addPianoNote(0.10, 2.6, 65, 0.48); // F4
addPianoNote(0.55, 2.3, 69, 0.50); // A4
addPianoNote(1.05, 2.0, 72, 0.54); // C5
addPianoNote(1.60, 1.8, 76, 0.58); // E5 (Fmaj7 warm nostalgic color)
addPianoNote(2.25, 1.4, 74, 0.52); // D5

// --- SCENE 2 (00:03 - 00:08): Gentle arpeggios & intimate melody ("و دارم با دستام، رویامو می‌سازم") ---
// Bar 1 (3.0s - 5.5s): Dm9 -> Bbmaj7
const s2_arps1 = [50, 57, 62, 64, 65, 62, 57, 62]; // D3 A3 D4 E4 F4 D4 A3 D4
s2_arps1.forEach((n, idx) => addPianoNote(3.0 + idx * 0.31, 1.1, n, 0.42));
addPianoNote(3.3, 1.4, 77, 0.58); // F5
addPianoNote(4.2, 1.2, 76, 0.55); // E5
addPianoNote(4.8, 1.2, 74, 0.54); // D5

// Bar 2 (5.5s - 8.0s): Gm7 -> C7sus4 -> C7
const s2_arps2 = [55, 58, 62, 65, 48, 55, 60, 64]; // G3 Bb3 D4 F4 -> C3 G3 C4 E4
s2_arps2.forEach((n, idx) => addPianoNote(5.5 + idx * 0.31, 1.1, n, 0.44));
addPianoNote(5.6, 1.3, 74, 0.56); // D5
addPianoNote(6.5, 0.9, 72, 0.54); // C5
addPianoNote(7.2, 1.0, 76, 0.56); // E5

// --- SCENE 3 (00:08 - 00:13): Three rhythmic cuts synced with music (8.0s, 9.67s, 11.33s) ---
// Cut 3A (8.00s - 9.67s): Shaping petals (Fmaj7)
addPianoNote(8.00, 1.6, 53, 0.55); // F3 bass accent on cut
addPianoNote(8.00, 1.6, 77, 0.64); // F5 melody accent
[60, 65, 69, 72, 69].forEach((n, idx) => addPianoNote(8.28 + idx * 0.27, 0.9, n, 0.45));
addPianoNote(9.10, 0.6, 79, 0.60); // G5

// Cut 3B (9.67s - 11.33s): Assembling flower (Dm7)
addPianoNote(9.67, 1.6, 50, 0.56); // D3 bass accent on cut
addPianoNote(9.67, 1.6, 81, 0.66); // A5 melody accent
[57, 62, 65, 69, 65].forEach((n, idx) => addPianoNote(9.95 + idx * 0.27, 0.9, n, 0.46));
addPianoNote(10.75, 0.6, 79, 0.60); // G5

// Cut 3C (11.33s - 13.00s): Arranging bouquet (Bbmaj7 -> C)
addPianoNote(11.33, 1.6, 46, 0.58); // Bb2 bass accent on cut
addPianoNote(11.33, 1.2, 77, 0.65); // F5 melody accent
[53, 58, 62, 65].forEach((n, idx) => addPianoNote(11.60 + idx * 0.26, 0.9, n, 0.46));
addPianoNote(12.25, 0.8, 76, 0.62); // E5
addPianoNote(12.60, 0.7, 79, 0.64); // G5

// --- SCENE 4 (00:13 - 00:19): Order Notification & Growing Hope ("حالا هر سفارشی که می‌گیرم، بهم امید می‌ده") ---
// Warm pad enters softly to heighten emotion
addWarmPad(13.0, 6.0, [53, 60, 65, 69], 0.025);

// Gentle shimmering notification motif at 13.4s integrated musically into the piano
addPianoNote(13.0, 2.0, 50, 0.55); // D3
[57, 62, 65, 69, 74, 69, 65, 62].forEach((n, idx) => addPianoNote(13.0 + idx * 0.36, 1.2, n, 0.48));
addPianoNote(13.40, 1.2, 81, 0.68); // A5 (sparkle of hope)
addPianoNote(14.15, 1.4, 79, 0.65); // G5
addPianoNote(15.10, 1.0, 77, 0.64); // F5

// Second half of Scene 4 (16.0s - 19.0s): Building toward climax (Gm7 -> C9 -> C7b9)
addPianoNote(16.0, 1.5, 43, 0.58); // G2
[50, 55, 58, 62, 67, 62].forEach((n, idx) => addPianoNote(16.0 + idx * 0.25, 1.1, n, 0.50));
addPianoNote(16.2, 1.2, 74, 0.66); // D5
addPianoNote(17.1, 0.8, 77, 0.68); // F5

// Uplifting Clayderman-style romantic run into 19.0s climax
addPianoNote(17.5, 1.5, 48, 0.62); // C3
[60, 64, 67, 70, 72, 76, 79].forEach((n, idx) => addPianoNote(17.6 + idx * 0.20, 1.0, n, 0.52 + idx * 0.025));

// --- SCENE 5 (00:19 - 00:25): EMOTIONAL CLIMAX ("شاید کوچیک شروع کرده باشم، ولی رؤیام خیلی بزرگه") ---
// Rich Clayderman-style octave right-hand melody with sweeping left-hand arpeggios
addWarmPad(19.0, 6.2, [53, 57, 60, 65, 72], 0.038);

// 19.0s - 21.0s: Grand F Major / Dm swell
addPianoNote(19.0, 2.2, 41, 0.72); // F2 deep bass
addPianoNote(19.0, 2.2, 53, 0.68); // F3
[57, 60, 65, 69, 72, 69, 65, 60].forEach((n, idx) => addPianoNote(19.0 + idx * 0.24, 1.3, n, 0.56));
// Octave melody
addPianoNote(19.00, 1.4, 72, 0.66); addPianoNote(19.02, 1.4, 84, 0.78); // C5 + C6
addPianoNote(20.15, 0.9, 70, 0.64); addPianoNote(20.17, 0.9, 82, 0.75); // Bb4 + Bb5
addPianoNote(20.60, 0.8, 69, 0.65); addPianoNote(20.62, 0.8, 81, 0.76); // A4 + A5

// 21.0s - 23.0s: Emotional peak on Bbmaj7 -> Gm7
addPianoNote(21.0, 2.2, 46, 0.74); // Bb2
[53, 58, 62, 65, 70, 65, 62, 58].forEach((n, idx) => addPianoNote(21.0 + idx * 0.24, 1.3, n, 0.56));
addPianoNote(21.00, 1.3, 74, 0.70); addPianoNote(21.02, 1.3, 86, 0.82); // D5 + D6 (Peak emotional note!)
addPianoNote(22.10, 0.9, 72, 0.66); addPianoNote(22.12, 0.9, 84, 0.78); // C5 + C6
addPianoNote(22.60, 0.8, 69, 0.64); addPianoNote(22.62, 0.8, 81, 0.74); // A4 + A5

// 23.0s - 25.0s: Warm resolution phrase (C11 -> Fmaj7)
addPianoNote(23.0, 2.0, 48, 0.68); // C3
[55, 58, 60, 64, 67, 72, 67, 64].forEach((n, idx) => addPianoNote(23.0 + idx * 0.24, 1.2, n, 0.52));
addPianoNote(23.00, 1.2, 67, 0.64); addPianoNote(23.02, 1.2, 79, 0.75); // G4 + G5
addPianoNote(24.00, 1.1, 69, 0.62); addPianoNote(24.02, 1.1, 81, 0.72); // A4 + A5

// --- SCENE 6 (00:25 - 00:30): Tender, lingering finale ("این تازه شروع داستان منه...") ---
addWarmPad(25.0, 4.8, [53, 60, 65, 69], 0.022);

// 25.0s - 27.5s: Gentle descending nostalgic motif
addPianoNote(25.0, 2.8, 41, 0.56); // F2
[53, 57, 60, 64, 65, 69, 72].forEach((n, idx) => addPianoNote(25.0 + idx * 0.30, 1.8, n, 0.46));
addPianoNote(25.00, 1.5, 77, 0.64); // F5
addPianoNote(26.10, 1.2, 76, 0.58); // E5
addPianoNote(26.85, 1.2, 72, 0.54); // C5

// 27.5s - 30.0s: Final rolled warm Fmaj9 chord that gently rings and fades to silence at 30.0s
const finalChord = [41, 48, 53, 57, 60, 64, 67, 69, 72, 77]; // F2 C3 F3 A3 C4 E4 G4 A4 C5 F5
finalChord.forEach((n, idx) => {
  addPianoNote(27.50 + idx * 0.09, 2.3 - idx * 0.08, n, 0.44 + (idx === finalChord.length - 1 ? 0.14 : 0.0));
});

// Add lush stereo Schroeder/Moorer concert hall reverb
function applyConcertHallReverb(L, R) {
  const delaysMs = [29.7, 37.1, 41.1, 43.7, 53.3, 67.7, 79.3];
  const outL = new Float32Array(L.length);
  const outR = new Float32Array(R.length);
  for (let i = 0; i < L.length; i++) {
    outL[i] = L[i];
    outR[i] = R[i];
  }
  delaysMs.forEach((ms, dIdx) => {
    const delaySamples = Math.floor((ms / 1000.0) * SAMPLE_RATE);
    const decay = 0.24 * Math.pow(0.86, dIdx);
    for (let i = delaySamples; i < L.length; i++) {
      if (dIdx % 2 === 0) {
        outL[i] += outR[i - delaySamples] * decay;
        outR[i] += outL[i - delaySamples] * (decay * 0.92);
      } else {
        outL[i] += outL[i - delaySamples] * decay;
        outR[i] += outR[i - delaySamples] * decay;
      }
    }
  });
  return { outL, outR };
}

const { outL, outR } = applyConcertHallReverb(leftChannel, rightChannel);

// Smooth fade-in (first 0.15s) and gentle lingering fade-out (28.8s -> 30.0s)
let maxPeak = 0.01;
for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  let env = 1.0;
  if (t < 0.15) env = t / 0.15;
  if (t > 28.6) env = Math.max(0.0, Math.pow((30.0 - t) / 1.4, 1.6));
  outL[i] *= env;
  outR[i] *= env;
  const p = Math.max(Math.abs(outL[i]), Math.abs(outR[i]));
  if (p > maxPeak) maxPeak = p;
}

// Normalize to -3dB peak
const normGain = 0.72 / maxPeak;

// Write 16-bit PCM Stereo WAV
const wavBuffer = Buffer.alloc(44 + NUM_SAMPLES * 4);
wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(36 + NUM_SAMPLES * 4, 4);
wavBuffer.write('WAVE', 8);
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20); // PCM
wavBuffer.writeUInt16LE(2, 22); // 2 channels
wavBuffer.writeUInt32LE(SAMPLE_RATE, 24);
wavBuffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
wavBuffer.writeUInt16LE(4, 32);
wavBuffer.writeUInt16LE(16, 34);
wavBuffer.write('data', 36);
wavBuffer.writeUInt32LE(NUM_SAMPLES * 4, 40);

let offset = 44;
for (let i = 0; i < NUM_SAMPLES; i++) {
  const sL = Math.max(-1.0, Math.min(1.0, outL[i] * normGain));
  const sR = Math.max(-1.0, Math.min(1.0, outR[i] * normGain));
  wavBuffer.writeInt16LE(Math.floor(sL * 32767), offset);
  wavBuffer.writeInt16LE(Math.floor(sR * 32767), offset + 2);
  offset += 4;
}

const outPath = path.join(__dirname, 'audio', 'piano_soundtrack_30s.wav');
fs.writeFileSync(outPath, wavBuffer);
console.log('Successfully generated romantic piano soundtrack:', outPath);

/* ==========================================================================
           SEZIONE 6: MOTORE AUDIO PROCEDURALE (Web Audio)
           - Bus: SFX / Musica / Ambiente → master → compressore. Riverbero a convoluzione con impulso sintetico.
           - Musica: sequencer a 16esimi con look-ahead; ogni bioma ha tonalità, progressione, BPM, timbri e stile.
           - Ambiente: rumore filtrato + LFO + eventi casuali (uccellini, crepitii, bolle, campanelli…).
           - Tutte le funzioni accettano un tempo `at` esplicito: lo stesso motore funziona anche su OfflineAudioContext.
           - L'AudioContext viene creato solo al primo gesto dell'utente (policy autoplay).
           ========================================================================== */
        const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
        function createAudioEngine(ctx) {
            const master = ctx.createGain(); master.gain.value = 0.9;
            const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
            master.connect(comp); comp.connect(ctx.destination);
            const sfxBus = ctx.createGain(), musicBus = ctx.createGain(), ambBus = ctx.createGain();
            sfxBus.connect(master); musicBus.connect(master); ambBus.connect(master);
            const musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 18000; // abbassato nei menu "skins" per un effetto ovattato
            const musicIn = ctx.createGain(); musicIn.connect(musicLP); musicLP.connect(musicBus);

            const reverb = ctx.createConvolver();
            (function makeImpulse(dur, decay) {
                const rate = ctx.sampleRate, len = Math.floor(rate * dur), buf = ctx.createBuffer(2, len, rate);
                for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
                reverb.buffer = buf;
            })(1.8, 2.6);
            const reverbOut = ctx.createGain(); reverbOut.gain.value = 0.9; reverb.connect(reverbOut); reverbOut.connect(master);
            const noiseBuf = (() => { const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; })();
            const now = () => ctx.currentTime;

            /* ---- primitive ---- */
            function envGain(dest, at, attack, peak, dur, curve = 'exp') {
                const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + attack);
                if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, at + dur); else g.gain.linearRampToValueAtTime(0.0001, at + dur);
                g.connect(dest); return g;
            }
            function voice(type, f0, at, dur, o = {}) {
                const dest = o.bus || sfxBus, osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(f0, at);
                if (o.f1) { const st = at + (o.sweepT || dur * 0.5); if (o.sweep === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, st); else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), st); }
                if (o.detune) osc.detune.value = o.detune;
                let node = osc;
                if (o.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.filter, at); if (o.filterEnd) f.frequency.exponentialRampToValueAtTime(o.filterEnd, at + dur); f.Q.value = o.q || 0.8; osc.connect(f); node = f; }
                const g = envGain(dest, at, o.a || 0.005, o.gain || 0.3, dur, o.curve); node.connect(g);
                if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(reverb); }
                if (o.vibrato) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibrato; lg.gain.value = o.vibratoDepth || 6; l.connect(lg); lg.connect(osc.frequency); l.start(at); l.stop(at + dur + 0.05); }
                osc.start(at); osc.stop(at + dur + 0.05); return osc;
            }
            function noiseBurst(at, dur, o = {}) {
                const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
                const f = ctx.createBiquadFilter(); f.type = o.hp ? 'highpass' : o.bp ? 'bandpass' : 'lowpass'; f.frequency.setValueAtTime(o.hp || o.bp || o.lp || 1000, at); f.Q.value = o.q || 0.7;
                if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, at + dur);
                const g = envGain(o.bus || sfxBus, at, o.a || 0.003, o.gain || 0.2, dur); src.connect(f); f.connect(g);
                if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(reverb); }
                src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.05);
            }

            /* ---- effetti sonori ---- */
            const sfx = {
                jump(at = now()) { voice('sine', 300, at, 0.22, { gain: 0.28, f1: 640, sweepT: 0.12 }); voice('triangle', 600, at, 0.12, { gain: 0.08, f1: 1200, sweepT: 0.08 }); noiseBurst(at, 0.035, { hp: 2500, gain: 0.05 }); },
                land(at = now(), k = 0.5) { k = clamp(k, 0.15, 1); voice('sine', 140, at, 0.16, { gain: 0.26 * k, f1: 50, sweepT: 0.1 }); noiseBurst(at, 0.09, { lp: 700 + 600 * k, gain: 0.16 * k }); },
                bounce(at = now()) { voice('triangle', 170, at, 0.38, { gain: 0.3, f1: 950, sweep: 'lin', sweepT: 0.3, vibrato: 18, vibratoDepth: 25 }); voice('sine', 90, at, 0.18, { gain: 0.2, f1: 55 }); noiseBurst(at, 0.05, { bp: 1200, gain: 0.06 }); },
                checkpoint(at = now()) { [0, 4, 7, 12].forEach((s, i) => voice('triangle', mtof(72 + s), at + i * 0.07, 0.5, { gain: 0.2, send: 0.5 })); voice('sine', mtof(84), at + 0.3, 0.9, { gain: 0.14, send: 0.7 }); voice('sine', mtof(79), at + 0.3, 0.9, { gain: 0.09, send: 0.7 }); },
                death(at = now()) { voice('sawtooth', 240, at, 0.45, { gain: 0.26, f1: 38, sweepT: 0.35, filter: 1400, filterEnd: 200 }); noiseBurst(at, 0.32, { lp: 2400, lpEnd: 180, gain: 0.22 }); voice('square', 120, at + 0.05, 0.2, { gain: 0.08, f1: 40 }); },
                record(at = now()) { [[0, 0], [4, 0.09], [7, 0.18], [12, 0.27], [16, 0.42]].forEach(([s, d]) => { voice('sine', mtof(72 + s), at + d, 0.55, { gain: 0.2, send: 0.5 }); voice('triangle', mtof(60 + s), at + d, 0.55, { gain: 0.1, send: 0.5 }); }); },
                tick(at = now()) { voice('square', 1000, at, 0.05, { gain: 0.1, filter: 3000 }); },
                ui(at = now()) { voice('sine', 820, at, 0.07, { gain: 0.11, f1: 1150, sweepT: 0.03 }); noiseBurst(at, 0.018, { hp: 3500, gain: 0.03 }); },
                uiBack(at = now()) { voice('sine', 700, at, 0.08, { gain: 0.1, f1: 480, sweepT: 0.05 }); },
                biome(at = now()) { voice('sine', mtof(76), at, 0.7, { gain: 0.15, send: 0.7 }); voice('triangle', mtof(83), at + 0.12, 0.9, { gain: 0.13, send: 0.7 }); voice('sine', mtof(88), at + 0.24, 1.1, { gain: 0.1, send: 0.8 }); },
                gameover(at = now()) { [[7, 0], [3, 0.26], [0, 0.52]].forEach(([s, d]) => voice('triangle', mtof(60 + s), at + d, 0.75, { gain: 0.2, send: 0.5, filter: 1800 })); voice('sawtooth', mtof(36), at + 0.52, 1.4, { gain: 0.13, filter: 380 }); },
                fanfare(at = now()) { [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.6], [12, 0.72], [16, 0.84], [19, 1.05]].forEach(([s, d]) => { voice('triangle', mtof(72 + s), at + d, 0.6, { gain: 0.18, send: 0.6 }); voice('sawtooth', mtof(60 + s), at + d, 0.6, { gain: 0.06, filter: 1500, send: 0.6 }); }); },
                lavaWarn(at = now()) { voice('sawtooth', 70, at, 0.5, { gain: 0.12, f1: 110, sweep: 'lin', sweepT: 0.4, filter: 500 }); }
            };
            // Rotolamento: rumore filtrato continuo, intensità proporzionale alla velocità a terra
            const roll = { src: ctx.createBufferSource(), f: ctx.createBiquadFilter(), g: ctx.createGain() };
            roll.src.buffer = noiseBuf; roll.src.loop = true; roll.f.type = 'bandpass'; roll.f.frequency.value = 320; roll.f.Q.value = 0.9; roll.g.gain.value = 0;
            roll.src.connect(roll.f); roll.f.connect(roll.g); roll.g.connect(sfxBus); roll.src.start();
            function setRoll(speed, onGround) { const t = now(), target = onGround ? Math.min(0.11, speed / 25 * 0.11) : 0; roll.g.gain.setTargetAtTime(target, t, 0.08); roll.f.frequency.setTargetAtTime(220 + speed * 22, t, 0.1); }

            /* ---- ambiente per bioma ---- */
            const AMB = {
                meadow:  { noise: { type: 'lowpass', f: 650, q: 0.5, g: 0.28, lfo: 0.15, depth: 0.5 }, events: [{ kind: 'chirp', rate: 0.45 }] },
                wind:    { noise: { type: 'bandpass', f: 520, q: 0.8, g: 0.42, lfo: 0.08, depth: 0.7, fLfo: 320 }, events: [] },
                cold:    { noise: { type: 'bandpass', f: 1500, q: 2.5, g: 0.3, lfo: 0.12, depth: 0.8, fLfo: 700 }, events: [{ kind: 'crack', rate: 0.15 }] },
                rumble:  { noise: { type: 'lowpass', f: 150, q: 0.7, g: 0.6, lfo: 0.3, depth: 0.4 }, events: [{ kind: 'pop', rate: 1.2 }] },
                hum:     { tone: { f: 55, type: 'sawtooth', g: 0.05, filter: 260 }, noise: { type: 'bandpass', f: 3000, q: 6, g: 0.035, lfo: 2, depth: 0.5 }, events: [{ kind: 'zap', rate: 0.25 }] },
                sparkle: { noise: { type: 'highpass', f: 4000, q: 0.5, g: 0.03, lfo: 0.5, depth: 0.5 }, events: [{ kind: 'bell', rate: 0.7 }] },
                bubbles: { noise: { type: 'lowpass', f: 380, q: 0.5, g: 0.26, lfo: 0.4, depth: 0.5 }, events: [{ kind: 'bubble', rate: 1.5 }] },
                waves:   { noise: { type: 'lowpass', f: 420, q: 0.6, g: 0.5, lfo: 0.09, depth: 0.85, fLfo: 260 }, events: [] },
                shimmer: { tone: { f: 880, type: 'sine', g: 0.012, chord: [0, 7, 12] }, noise: { type: 'bandpass', f: 2500, q: 1, g: 0.05, lfo: 0.2, depth: 0.6 }, events: [{ kind: 'bell', rate: 0.25 }] },
                digital: { tone: { f: 110, type: 'square', g: 0.025, filter: 480 }, noise: { type: 'highpass', f: 6000, q: 0.5, g: 0.025, lfo: 4, depth: 0.6 }, events: [{ kind: 'blip', rate: 1.3 }] },
                heart:   { noise: { type: 'lowpass', f: 300, q: 0.5, g: 0.3, lfo: 0.1, depth: 0.5 }, events: [{ kind: 'heartbeat', rate: 1.05, periodic: true }] },
                breeze:  { noise: { type: 'bandpass', f: 950, q: 0.6, g: 0.26, lfo: 0.1, depth: 0.7, fLfo: 420 }, events: [] },
                space:   { tone: { f: 41, type: 'sine', g: 0.09 }, noise: { type: 'lowpass', f: 200, q: 0.5, g: 0.12, lfo: 0.05, depth: 0.5 }, events: [{ kind: 'ping', rate: 0.2 }] },
                crystal: { noise: { type: 'highpass', f: 3000, q: 0.5, g: 0.04, lfo: 0.3, depth: 0.6 }, events: [{ kind: 'bell', rate: 0.55, high: true }] },
                heaven:  { tone: { f: 261.6, type: 'sine', g: 0.02, chord: [0, 4, 7, 12] }, noise: { type: 'bandpass', f: 1200, q: 0.7, g: 0.16, lfo: 0.07, depth: 0.6 }, events: [{ kind: 'bell', rate: 0.3 }] }
            };
            const amb = { key: null, nodes: [], events: [], rng: makeRng(7) };
            function ambStop(at) {
                for (const n of amb.nodes) { try { n.g.gain.cancelScheduledValues(at); n.g.gain.setValueAtTime(n.g.gain.value, at); n.g.gain.linearRampToValueAtTime(0.0001, at + 1.6); n.srcs.forEach(s => s.stop(at + 1.7)); } catch (e) {} }
                amb.nodes = []; amb.events = [];
            }
            function ambSet(key, at = now()) {
                if (key === amb.key) return; amb.key = key; ambStop(at);
                const cfg = AMB[key]; if (!cfg) return;
                if (cfg.noise) {
                    const c = cfg.noise, src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
                    const f = ctx.createBiquadFilter(); f.type = c.type; f.frequency.value = c.f; f.Q.value = c.q;
                    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(c.g, at + 2.5);
                    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = c.lfo; lg.gain.value = c.g * c.depth * 0.5; lfo.connect(lg); lg.connect(g.gain);
                    const srcs = [src, lfo];
                    if (c.fLfo) { const l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = c.lfo * 1.7; l2g.gain.value = c.fLfo; l2.connect(l2g); l2g.connect(f.frequency); l2.start(at); srcs.push(l2); }
                    src.connect(f); f.connect(g); g.connect(ambBus); src.start(at); lfo.start(at); amb.nodes.push({ g, srcs });
                }
                if (cfg.tone) {
                    const c = cfg.tone, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(c.g, at + 3);
                    const srcs = [], notes = c.chord || [0];
                    for (const n of notes) { for (const det of [-5, 5]) { const o = ctx.createOscillator(); o.type = c.type; o.frequency.value = c.f * Math.pow(2, n / 12); o.detune.value = det; let node = o; if (c.filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = c.filter; o.connect(f); node = f; } node.connect(g); o.start(at); srcs.push(o); } }
                    g.connect(ambBus); amb.nodes.push({ g, srcs });
                }
                amb.events = cfg.events.map(e => ({ ...e, acc: 0 }));
            }
            const PENTA_HI = [0, 2, 4, 7, 9, 12, 14, 16];
            function ambEvent(kind, at, ev) {
                const r = amb.rng;
                if (kind === 'chirp') { const base = 2200 + r() * 1400, n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) voice('sine', base * (0.9 + r() * 0.2), at + i * 0.09, 0.09, { gain: 0.05, f1: base * 1.3, sweepT: 0.05, bus: ambBus, send: 0.4 }); }
                else if (kind === 'crack') { noiseBurst(at, 0.06, { hp: 3500, gain: 0.09, bus: ambBus, send: 0.6 }); voice('square', 1800 + r() * 800, at, 0.03, { gain: 0.03, bus: ambBus }); }
                else if (kind === 'pop') { voice('sine', 60 + r() * 60, at, 0.18, { gain: 0.12, f1: 30, bus: ambBus }); noiseBurst(at, 0.05, { lp: 900, gain: 0.05, bus: ambBus }); }
                else if (kind === 'zap') { voice('square', 1400, at, 0.06, { gain: 0.03, f1: 180, sweepT: 0.05, bus: ambBus }); noiseBurst(at, 0.03, { hp: 5000, gain: 0.02, bus: ambBus }); }
                else if (kind === 'bell') { const m = (ev.high ? 84 : 76) + PENTA_HI[Math.floor(r() * PENTA_HI.length)]; voice('sine', mtof(m), at, 1.6, { gain: 0.05, bus: ambBus, send: 0.9 }); voice('sine', mtof(m) * 2.76, at, 0.5, { gain: 0.012, bus: ambBus }); }
                else if (kind === 'bubble') { const f = 260 + r() * 300; voice('sine', f, at, 0.08, { gain: 0.06, f1: f * 2.2, sweepT: 0.07, bus: ambBus }); }
                else if (kind === 'blip') { voice('square', 600 + r() * 1800, at, 0.04, { gain: 0.025, filter: 4000, bus: ambBus, send: 0.3 }); }
                else if (kind === 'heartbeat') { voice('sine', 62, at, 0.16, { gain: 0.22, f1: 38, bus: ambBus }); voice('sine', 58, at + 0.16, 0.14, { gain: 0.15, f1: 36, bus: ambBus }); }
                else if (kind === 'ping') { voice('sine', 1500 + r() * 800, at, 2.2, { gain: 0.035, bus: ambBus, send: 1.0 }); }
            }
            function ambUpdate(dt, t) {
                for (const ev of amb.events) {
                    if (ev.periodic) { ev.acc += dt; if (ev.acc >= 1 / ev.rate) { ev.acc -= 1 / ev.rate; ambEvent(ev.kind, t, ev); } }
                    else if (amb.rng() < dt * ev.rate) ambEvent(ev.kind, t, ev);
                }
            }

            /* ---- musica: sequencer ---- */
            // Tema "Only Ball" (menu / crediti): melodia in ottavi (MIDI, null = pausa), 8 battute
            const THEME = [
                72, 76, 79, 81, 79, 76, 72, null,   74, 77, 81, 84, 81, 77, 74, null,
                72, 76, 79, 81, 83, 81, 79, 76,     74, null, 77, null, 79, null, null, null,
                84, 83, 81, 79, 81, 79, 76, null,   77, 79, 81, 77, 76, 74, 72, null,
                69, 72, 76, 79, 81, 79, 76, 72,     74, 76, 79, null, 72, null, null, null
            ];
            const TRACK_MENU = { root: 60, scale: MAJ, prog: [0, 5, 3, 4, 0, 2, 1, 4], bpm: 108, lead: 'triangle', pad: 'triangle', bass: 'sine', style: 'theme', drums: 'light', theme: THEME };
            const TRACK_CREDITS = { root: 60, scale: MAJ, prog: [0, 5, 3, 4, 0, 2, 1, 4], bpm: 68, lead: 'sine', pad: 'sawtooth', bass: 'sine', style: 'theme', drums: 'none', theme: THEME, dreamy: true };
            const music = { mood: null, track: null, step: 0, nextTime: 0, rng: makeRng(1), melody: null, zen: false };
            const degToMidi = (tr, deg) => tr.root + 12 * Math.floor(deg / tr.scale.length) + tr.scale[((deg % tr.scale.length) + tr.scale.length) % tr.scale.length];
            function genMelody(tr, r) {
                const out = []; let prev = 2;
                for (let bar = 0; bar < 8; bar++) {
                    const chord = tr.prog[bar % tr.prog.length];
                    for (let e = 0; e < 8; e++) {
                        const strong = e % 4 === 0;
                        if (!strong && r() < 0.3) { out.push(null); continue; }
                        let deg;
                        if (strong || r() < 0.55) deg = chord + [0, 2, 4][Math.floor(r() * 3)]; else deg = prev + (r() < 0.5 ? -1 : 1);
                        while (deg - prev > 4) deg -= 7; while (prev - deg > 4) deg += 7;
                        deg = clamp(deg, 0, 13); prev = deg; out.push(degToMidi(tr, deg) + 12);
                    }
                }
                return out;
            }
            function pluck(midi, t, dur, type, gain, cutoff, send = 0.35, detune = 0) { voice(type, mtof(midi), t, dur, { gain, filter: cutoff, filterEnd: Math.max(200, cutoff * 0.35), a: 0.008, send, bus: musicIn, detune }); }
            function pad(midis, t, dur, type, gain, cutoff) {
                for (const m of midis) for (const det of [-7, 7]) {
                    const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
                    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff * 0.6, t); f.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.5); f.frequency.linearRampToValueAtTime(cutoff * 0.5, t + dur);
                    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.8, dur * 0.3)); g.gain.setValueAtTime(gain, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
                    const s = ctx.createGain(); s.gain.value = 0.5; o.connect(f); f.connect(g); g.connect(musicIn); g.connect(s); s.connect(reverb); o.start(t); o.stop(t + dur + 0.5);
                }
            }
            function bass(midi, t, dur, type, gain) { voice(type, mtof(midi), t, dur, { gain, filter: 420, a: 0.01, bus: musicIn }); voice('sine', mtof(midi), t, dur, { gain: gain * 0.7, a: 0.01, bus: musicIn }); }
            function kick(t, g = 0.5) { voice('sine', 150, t, 0.16, { gain: g, f1: 42, sweepT: 0.1, bus: musicIn }); }
            function hat(t, g = 0.08) { noiseBurst(t, 0.045, { hp: 7000, gain: g, bus: musicIn }); }
            function snare(t, g = 0.22) { noiseBurst(t, 0.13, { bp: 1900, q: 0.8, gain: g, bus: musicIn, send: 0.3 }); voice('triangle', 190, t, 0.1, { gain: g * 0.6, f1: 120, bus: musicIn }); }

            function musicSet(mood, at = now()) {
                if (mood === music.mood) return; music.mood = mood;
                const isMenu = (mood === 'menu' || mood === 'skins' || mood === 'console');
                const tr = mood === null ? null : isMenu ? TRACK_MENU : mood === 'credits' ? TRACK_CREDITS : Object.assign({}, BIOMES[mood].music);
                music.track = tr; music.step = 0; music.nextTime = at + 0.08;
                musicLP.frequency.setTargetAtTime(mood === 'skins' ? 900 : 18000, at, 0.4);
                if (tr) { music.rng = makeRng(hashString('onlyball-music-' + mood)); music.melody = tr.style === 'theme' ? tr.theme : genMelody(tr, music.rng); music.varRng = makeRng(hashString('var-' + mood)); }
            }
            function playStep(step, t) {
                const tr = music.track, zen = music.zen && typeof tr.root === 'number' && tr !== TRACK_MENU && tr !== TRACK_CREDITS;
                const bpm = tr.bpm * (zen ? 0.82 : 1), sd = 60 / bpm / 4, bar = Math.floor(step / 16), pos = step % 16, r = music.varRng;
                const chordDeg = tr.prog[bar % tr.prog.length], chord = [0, 2, 4].map(k => degToMidi(tr, chordDeg + k));
                const drums = zen ? 'none' : tr.drums, lead = tr.lead, style = tr.style, dreamy = !!tr.dreamy;
                if (pos === 0) pad(chord, t, sd * 16, tr.pad, tr.pad === 'sawtooth' ? 0.045 : 0.075, dreamy ? 900 : (style === 'arp' || style === 'riff') ? 1400 : 1100);
                const rootM = degToMidi(tr, chordDeg) - 12, bassGain = style === 'riff' || style === 'arp' ? 0.2 : 0.16;
                if (pos === 0) bass(rootM, t, sd * 3.5, tr.bass, bassGain);
                if (pos === 8) bass(rootM, t, sd * 2.5, tr.bass, bassGain * 0.85);
                if ((style === 'riff' || style === 'arp') && (pos === 6 || pos === 14)) bass(rootM + (pos === 14 ? 7 : 0), t, sd * 1.5, tr.bass, bassGain * 0.7);
                if (drums === 'light') { if (pos === 0 || pos === 8) kick(t, 0.32); if (pos === 4 || pos === 12) hat(t, 0.06); if (pos === 10) hat(t, 0.04); }
                else if (drums === 'perc') { if (pos === 0 || pos === 6 || pos === 8) kick(t, 0.36); if (pos === 4 || pos === 12) snare(t, 0.12); if (pos % 2 === 1) hat(t, 0.03); }
                else if (drums === 'heavy') { if (pos % 4 === 0) kick(t, 0.5); if (pos === 4 || pos === 12) snare(t, 0.24); if (pos % 2 === 0) hat(t, 0.06); if (pos === 14 && bar % 2 === 1) snare(t + sd / 2, 0.14); }
                else if (drums === 'electro') { if (pos === 0 || pos === 8 || (pos === 11 && bar % 2 === 1)) kick(t, 0.45); if (pos === 4 || pos === 12) snare(t, 0.2); hat(t, pos % 2 === 0 ? 0.07 : 0.035); }
                const leadGain = zen ? 0.1 : 0.16, cutoff = lead === 'sawtooth' ? 2200 : lead === 'square' ? 1800 : 3200;
                if (style === 'theme' && pos % 2 === 0) { const n = tr.theme[(bar * 8 + pos / 2) % tr.theme.length]; if (n !== null) { pluck(n, t, sd * (dreamy ? 7 : 3.2), lead, dreamy ? 0.12 : 0.17, dreamy ? 1800 : 3000, dreamy ? 0.9 : 0.4); if (dreamy) pluck(n - 12, t, sd * 6, 'sine', 0.05, 1500, 0.9); } }
                else if (style === 'melody' && pos % 2 === 0) { const n = music.melody[(bar * 8 + pos / 2) % music.melody.length]; if (n !== null) pluck(n, t, sd * 3, lead, leadGain, cutoff); }
                else if (style === 'arp' && pos % 2 === 0) { const oct = [0, 0, 12, 0, 12, 24, 12, 0][pos / 2]; pluck(chord[(pos / 2) % 3] + 12 + oct, t, sd * 1.8, lead, leadGain * 0.8, cutoff, 0.3); if (pos % 4 === 2 && r() < 0.25) pluck(chord[2] + 24, t + sd, sd, lead, leadGain * 0.4, cutoff, 0.3); }
                else if (style === 'sparse') { if (pos % 4 === 0 && r() < 0.55) pluck(chord[Math.floor(r() * 3)] + 12 + (r() < 0.3 ? 12 : 0), t, sd * 8, lead, leadGain * 0.7, 2600, 0.9); }
                else if (style === 'riff') { const pat = [0, 0, 1, 0, 4, 3], hits = [0, 3, 6, 8, 11, 14], i = hits.indexOf(pos); if (i >= 0) pluck(degToMidi(tr, chordDeg + pat[i]) + (i === 4 ? 12 : 0), t, sd * 2, lead, leadGain, 1600, 0.25, r() < 0.5 ? -4 : 4); }
                if (bar % 4 === 3 && pos === 14 && style !== 'sparse' && !dreamy) pluck(chord[2] + 24, t, sd * 2, 'sine', 0.08, 4000, 0.8);
            }
            function musicSchedule(until) {
                if (!music.track) return; let guard = 0;
                while (music.nextTime < until && guard++ < 64) { const bpm = music.track.bpm * (music.zen && music.mood !== 'menu' ? 0.82 : 1); playStep(music.step, music.nextTime); music.nextTime += 60 / bpm / 4; music.step++; }
            }

            return {
                ctx, sfx, setRoll, now,
                music: { set: musicSet, schedule: musicSchedule, setZen: (z) => { music.zen = z; }, state: music },
                amb: { set: ambSet, update: ambUpdate, schedule: (from, to, dt = 0.1) => { for (let t = from; t < to; t += dt) ambUpdate(dt, t); } },
                setVolumes(s) { const m = s.mute ? 0 : 1; sfxBus.gain.setTargetAtTime(m * s.sfx / 100, now(), 0.05); musicBus.gain.setTargetAtTime(m * s.music / 100 * 0.9, now(), 0.05); ambBus.gain.setTargetAtTime(m * s.amb / 100 * 0.85, now(), 0.05); },
                update(dt) { musicSchedule(now() + 0.35); ambUpdate(dt, now()); }
            };
        }

        // Facciata globale: nessun AudioContext finché l'utente non interagisce (autoplay policy)
        const Audio = {
            ctx: null, eng: null, pendingMood: null, pendingAmb: null, unlocked: false,
            unlock() {
                if (!this.ctx) {
                    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.eng = createAudioEngine(this.ctx); this.eng.setVolumes(settings); } catch (e) { return; }
                }
                if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
                if (!this.unlocked) { this.unlocked = true; this.eng.music.set(this.pendingMood, this.eng.now()); if (this.pendingAmb) this.eng.amb.set(this.pendingAmb); this.eng.music.setZen(!!MODE().zen); }
            },
            music(mood) { this.pendingMood = mood; if (this.eng) this.eng.music.set(mood); },
            ambience(key) { this.pendingAmb = key; if (this.eng) this.eng.amb.set(key); },
            setZen(z) { if (this.eng) this.eng.music.setZen(z); },
            applyVolumes() { if (this.eng) this.eng.setVolumes(settings); },
            update(dt) { if (this.eng && this.ctx.state === 'running') this.eng.update(dt); },
            roll(speed, onGround) { if (this.eng && this.ctx.state === 'running') this.eng.setRoll(speed, onGround); }
        };
        const sfxCall = (name, ...args) => { if (Audio.eng && Audio.ctx.state === 'running') Audio.eng.sfx[name](undefined, ...args); };
        const AudioEngine = {
            playJump: () => sfxCall('jump'), playLand: (k) => sfxCall('land', k), playBounce: () => sfxCall('bounce'), playCheckpoint: () => sfxCall('checkpoint'),
            playDeath: () => sfxCall('death'), playRecord: () => sfxCall('record'), playTick: () => sfxCall('tick'), playUI: () => sfxCall('ui'), playUIBack: () => sfxCall('uiBack'),
            playBiome: () => sfxCall('biome'), playGameOver: () => sfxCall('gameover'), playFanfare: () => sfxCall('fanfare'), playLavaWarn: () => sfxCall('lavaWarn')
        };
        // Compatibilità con il vecchio nome
        const MusicEngine = { playMood: (m) => Audio.music(m) };
        function initAudio() { Audio.unlock(); }
        ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, initAudio, { passive: true }));
        Audio.pendingMood = 'menu';
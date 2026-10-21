/* ==========================================================================
           SEZIONE 2: CONFIGURAZIONE, RILEVAMENTO DISPOSITIVO E IMPOSTAZIONI
           ========================================================================== */
        const $ = (id) => document.getElementById(id);
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const lerp = (a, b, t) => a + (b - a) * t;
        const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
        const icon = (name) => `<svg class="i"><use href="#i-${name}"/></svg>`;

        const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const hasTouchPoints = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
        const isSmallScreen = Math.min(window.screen.width, window.screen.height) < 700;
        const lowEndDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

        const DEFAULT_SETTINGS = { sfx: 60, music: 40, amb: 50, mute: false, sens: 100, quality: (isMobileUA || (hasCoarsePointer && isSmallScreen)) ? 'medium' : 'high', shadows: true, vibrate: true, touch: 'auto' };
        let settings = Object.assign({}, DEFAULT_SETTINGS);
        try { settings = Object.assign(settings, JSON.parse(localStorage.getItem('onlyball_settings') || '{}')); } catch (e) {}
        if (settings.quality === 'ultra' && lowEndDevice && isMobileUA) settings.quality = 'medium';
        const saveSettings = () => { try { localStorage.setItem('onlyball_settings', JSON.stringify(settings)); } catch (e) {} };

        function getPlayerName() {
            try {
                return (localStorage.getItem('onlyball_player_name') || 'Giocatore 1').trim() || 'Giocatore 1';
            } catch (e) {
                return 'Giocatore 1';
            }
        }
        window.getPlayerName = getPlayerName;

        let touchUI = settings.touch === 'on' ? true : settings.touch === 'off' ? false : (hasCoarsePointer && hasTouchPoints) || isMobileUA;
        function setTouchUI(on) {
            touchUI = on;
            document.body.classList.toggle('touch-ui', on);
            $('btn-fullscreen').classList.toggle('hidden', !on || !document.fullscreenEnabled && !document.documentElement.webkitRequestFullscreen);
            if (on && gameState === 'playing') $('mobile-controls').classList.remove('hidden');
            if (!on) $('mobile-controls').classList.add('hidden');
        }
        // Un dispositivo desktop con touch (o un browser in "modalità desktop") attiva i controlli al primo tocco
        window.addEventListener('touchstart', () => { if (settings.touch === 'auto' && !touchUI) setTouchUI(true); }, { passive: true, once: true });

        const vibrate = (pattern) => {
            if (settings.vibrate && navigator.vibrate) {
                try { navigator.vibrate(pattern); } catch (e) {}
            }
        };

        let camYaw = Math.PI, camPitch = 0.3, camDistance = 12;
        let gameState = 'menu', lastGameState = 'menu', previousState = 'menu';
        let checkpoints = [], lastCheckpoint = { x: 0, y: 5, z: 0 }, nextTargetCheckpoint = 70;
        let highestScore = 0, runPeak = 0, genCurrentX = 0, genCurrentY = 0, genCurrentZ = 0, platformIndex = 0, highestPlatformY = 0;
        let currentVisualBiome = 0, isRTX = false;
        const platforms = [], platformMeshes = [], movingObstacles = [], sceneProps = [], landmarks = [], flags = [];
        let coyoteTimer = 0, jumpBufferTimer = 0;
        const COYOTE_FRAMES = 9, JUMP_BUFFER_FRAMES = 9;
        let wasOnGround = false, lastVelY = 0, screenShakeIntensity = 0;
        let currentBiomeNotified = -1, displayedScore = 0, customTexture = null, biomeToastTimer = 0;
        let canJump = false, hitDeathZone = false, lastSafePos = { x: 0, y: 2, z: 0 };
        let runTime = 0, modeTimeLeft = 0, lavaY = -15, lavaSpeed = 0, recordAnnounced = false, hintsTimer = 0, worldModeKey = null;
        let lastGpButtons = [], focusIndex = 0;

/* ==========================================================================
           SEZIONE 3: MODALITÀ DI GIOCO, RECORD E BIOMI
           ========================================================================== */
        const MODES = {
            classic:    { name: 'Classica',        icon: 'flag',     color: '#37e0b0', desc: 'Checkpoint ogni 70 m. Se cadi riparti dall\'ultimo checkpoint.', checkpoints: true,  hazards: true,  fall: 'checkpoint' },
            hardcore:   { name: 'Hardcore',        icon: 'skull',    color: '#ff2e63', desc: 'Nessun checkpoint: una caduta e la partita è finita.',        checkpoints: false, hazards: true,  fall: 'gameover' },
            timeattack: { name: 'Contro il Tempo', icon: 'timer',    color: '#38b6ff', desc: 'Hai 3 minuti per salire il più in alto possibile.',           checkpoints: true,  hazards: true,  fall: 'checkpoint', timer: 180 },
            lava:       { name: 'Lava Crescente',  icon: 'flame',    color: '#ff5c4d', desc: 'La lava sale senza sosta e accelera ogni bioma. Non fermarti!', checkpoints: false, hazards: true,  fall: 'gameover', lava: true },
            zen:        { name: 'Zen',             icon: 'lotus',    color: '#8a5cff', desc: 'Niente ostacoli letali, niente game over. Solo tu e la vetta.', checkpoints: true,  hazards: false, fall: 'safe', zen: true },
            daily:      { name: 'Sfida del Giorno',icon: 'calendar', color: '#ffb830', desc: 'Stessa mappa per tutti, cambia ogni giorno. Batti il record!',  checkpoints: true,  hazards: true,  fall: 'checkpoint', seeded: true }
        };
        let modeKey = localStorage.getItem('onlyball_mode') || 'classic'; if (!MODES[modeKey]) modeKey = 'classic';
        const MODE = () => MODES[modeKey];
        const modeHTML = (m) => `${icon(m.icon)} ${m.name}`;
        const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
        const bestKey = (k) => k === 'daily' ? `onlyball_best_daily_${todayKey()}` : `onlyball_best_${k}`;
        const legacyBest = parseInt(localStorage.getItem('onlyball_best') || '0');
        if (legacyBest > 0 && !localStorage.getItem('onlyball_best_classic')) localStorage.setItem('onlyball_best_classic', legacyBest);
        const getBest = (k) => parseInt(localStorage.getItem(bestKey(k)) || '0');
        const setBest = (k, v) => localStorage.setItem(bestKey(k), v);
        let bestScore = getBest(modeKey);

        // RNG con seed (mulberry32) per la sfida giornaliera; per le altre modalità è casuale
        let rngState = 1;
        function seedRng(seed) { rngState = seed >>> 0; }
        function rng() { rngState = (rngState + 0x6D2B79F5) >>> 0; let t = rngState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
        const rngRange = (a, b) => a + rng() * (b - a);
        const rngPick = (arr) => arr[Math.floor(rng() * arr.length)];
        function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
        // RNG indipendente per texture e musica (non deve influenzare la mappa della sfida del giorno)
        function makeRng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

        function renderModeCards() {
            const list = $('mode-list'); list.innerHTML = '';
            Object.entries(MODES).forEach(([key, m]) => {
                const card = document.createElement('button');
                card.className = 'mode-card' + (key === modeKey ? ' selected' : ''); card.id = 'mode-card-' + key; card.type = 'button'; card.style.setProperty('--c', m.color);
                const best = getBest(key);
                card.innerHTML = `<span class="mode-icon">${icon(m.icon)}</span><span class="mode-name">${m.name}</span><span class="mode-best">${best > 0 ? '🏆 ' + best + ' m' : (key === 'daily' ? todayKey() : 'Nessun record')}</span>`;
                card.addEventListener('click', () => { AudioEngine.playUI(); selectMode(key); });
                list.appendChild(card);
            });
            updateModeUI();
        }
        function selectMode(key) {
            modeKey = key; localStorage.setItem('onlyball_mode', key); bestScore = getBest(key);
            document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('selected', c.id === 'mode-card-' + key));
            const sel = $('mode-card-' + key); if (sel && sel.scrollIntoView) { try { sel.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) {} }
            updateModeUI();
            if (gameState === 'menu' && typeof worldModeKey !== 'undefined' && worldModeKey !== modeKey) fullGameReset();
        }
        function updateModeUI() {
            const m = MODE();
            $('mode-desc').textContent = m.desc + (m.seeded ? ` (${todayKey()})` : '');
            $('menu-best-val').textContent = bestScore;
            $('mode-chip').innerHTML = modeHTML(m);
        }
        function cycleMode(dir) { const keys = Object.keys(MODES); selectMode(keys[(keys.indexOf(modeKey) + dir + keys.length) % keys.length]); }

        const menuGroups = {
            'menu': [...Object.keys(MODES).map(k => 'mode-card-' + k), 'btn-play', 'btn-open-skins', 'btn-open-leaderboard', 'btn-settings-main'],
            'skins': ['btn-skin-prev', 'btn-skin-next', 'btn-custom-skin', 'btn-close-skin'],
            'paused': ['btn-resume', 'btn-restart', 'btn-settings-pause', 'btn-home'],
            'settings': ['vol-slider', 'music-slider', 'amb-slider', 'mute-toggle', 'sens-slider', 'res-select', 'shadow-toggle', 'vibrate-toggle', 'touch-select', 'btn-close-settings'],
            'gameover': ['btn-gameover-restart', 'btn-gameover-lb', 'btn-gameover-share', 'btn-gameover-home']
        };

        /* Biomi: palette, cielo, pattern texture, particelle, ambiente sonoro e musica — tutto in un'unica tabella.
           music: root (MIDI), scale (intervalli), prog (gradi accordi, uno per battuta), bpm, lead/pad/bass (forma d'onda), style, drums */
        const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], PHR = [0, 1, 4, 5, 7, 8, 10], PENT = [0, 2, 4, 7, 9], LYD = [0, 2, 4, 6, 7, 9, 11];
        const BIOMES = [
            { name: 'Prato',           emoji: '🌿', sky: 0x8ae2f5, c1: '#2ed573', c2: '#7bed9f', accent: '#2ed573', pattern: 'grass',   fog: 0.0030, sun: 0xfff2dc, stars: 0, clouds: 0.55, particle: { size: 0.9, mode: 'float' },  amb: 'meadow',   music: { root: 60, scale: MAJ, prog: [0, 5, 3, 4], bpm: 104, lead: 'triangle', pad: 'triangle', bass: 'sine', style: 'melody', drums: 'light' } },
            { name: 'Deserto',         emoji: '🏜️', sky: 0xffd384, c1: '#ffa502', c2: '#eccc68', accent: '#ffa502', pattern: 'sand',    fog: 0.0028, sun: 0xffe0b0, stars: 0, clouds: 0.15, particle: { size: 0.7, mode: 'wind' },   amb: 'wind',     music: { root: 62, scale: PHR, prog: [0, 1, 0, 4], bpm: 96,  lead: 'sawtooth', pad: 'sawtooth', bass: 'triangle', style: 'melody', drums: 'perc' } },
            { name: 'Ghiaccio',        emoji: '🧊', sky: 0x82ccdd, c1: '#1e90ff', c2: '#70a1ff', accent: '#70d6ff', pattern: 'ice',     fog: 0.0034, sun: 0xe8f4ff, stars: 0, clouds: 0.35, particle: { size: 1.2, mode: 'snow' },   amb: 'cold',     music: { root: 69, scale: MIN, prog: [0, 5, 2, 6], bpm: 84,  lead: 'sine', pad: 'triangle', bass: 'sine', style: 'sparse', drums: 'none' } },
            { name: 'Vulcano',         emoji: '🌋', sky: 0xeb4d4b, c1: '#ff4757', c2: '#ff6b81', accent: '#ff6b3d', pattern: 'basalt',  fog: 0.0040, sun: 0xffb090, stars: 0, clouds: 0.7,  particle: { size: 0.8, mode: 'embers' }, amb: 'rumble',   music: { root: 52, scale: PHR, prog: [0, 0, 1, 0], bpm: 122, lead: 'sawtooth', pad: 'sawtooth', bass: 'square', style: 'riff', drums: 'heavy' } },
            { name: 'Neon',            emoji: '💜', sky: 0x2c2c54, c1: '#9b59b6', c2: '#8e44ad', accent: '#ff4fd8', pattern: 'neon',    fog: 0.0030, sun: 0xff80ff, stars: 0.6, clouds: 0.1, particle: { size: 0.55, mode: 'rise' }, amb: 'hum',      music: { root: 54, scale: MIN, prog: [0, 5, 3, 4], bpm: 118, lead: 'square', pad: 'sawtooth', bass: 'sawtooth', style: 'arp', drums: 'electro' } },
            { name: 'Caramella',       emoji: '🍬', sky: 0xfd79a8, c1: '#e84393', c2: '#fd79a8', accent: '#ff6fb5', pattern: 'candy',   fog: 0.0028, sun: 0xfff0f8, stars: 0, clouds: 0.5,  particle: { size: 1.0, mode: 'float' },  amb: 'sparkle',  music: { root: 67, scale: MAJ, prog: [0, 3, 4, 0], bpm: 128, lead: 'triangle', pad: 'triangle', bass: 'sine', style: 'melody', drums: 'light' } },
            { name: 'Tossico',         emoji: '☢️', sky: 0x1b2a1b, c1: '#badc58', c2: '#b8e994', accent: '#c6ff3d', pattern: 'toxic',   fog: 0.0045, sun: 0xc8ffa0, stars: 0.2, clouds: 0.6, particle: { size: 0.9, mode: 'rise' },   amb: 'bubbles',  music: { root: 58, scale: MIN, prog: [0, 3, 0, 6], bpm: 108, lead: 'square', pad: 'sawtooth', bass: 'sawtooth', style: 'riff', drums: 'electro' } },
            { name: 'Oceano Profondo', emoji: '🌊', sky: 0x0984e3, c1: '#0984e3', c2: '#74b9ff', accent: '#4dd2ff', pattern: 'waves',   fog: 0.0042, sun: 0xa0d8ff, stars: 0, clouds: 0.25, particle: { size: 0.8, mode: 'rise' },   amb: 'waves',    music: { root: 63, scale: MAJ, prog: [0, 3, 5, 4], bpm: 78,  lead: 'sine', pad: 'triangle', bass: 'sine', style: 'sparse', drums: 'none' } },
            { name: 'Solare',          emoji: '☀️', sky: 0xf1c40f, c1: '#f39c12', c2: '#f1c40f', accent: '#ffd23f', pattern: 'solar',   fog: 0.0026, sun: 0xffffff, stars: 0, clouds: 0.2,  particle: { size: 0.7, mode: 'wind' },   amb: 'shimmer',  music: { root: 69, scale: MAJ, prog: [0, 4, 5, 3], bpm: 112, lead: 'sawtooth', pad: 'triangle', bass: 'triangle', style: 'melody', drums: 'light' } },
            { name: 'Cyberpunk',       emoji: '🤖', sky: 0x111a2e, c1: '#00cec9', c2: '#81ecec', accent: '#2ef2e6', pattern: 'circuit', fog: 0.0034, sun: 0x40ffe8, stars: 0.7, clouds: 0.05, particle: { size: 0.55, mode: 'rise' }, amb: 'digital',  music: { root: 60, scale: MIN, prog: [0, 6, 3, 4], bpm: 132, lead: 'square', pad: 'sawtooth', bass: 'square', style: 'arp', drums: 'electro' } },
            { name: 'Sangue',          emoji: '🩸', sky: 0x2d3436, c1: '#d63031', c2: '#ff7675', accent: '#ff3b4a', pattern: 'blood',   fog: 0.0046, sun: 0xff8080, stars: 0.1, clouds: 0.75, particle: { size: 0.8, mode: 'embers' }, amb: 'heart',    music: { root: 50, scale: PHR, prog: [0, 1, 0, 5], bpm: 92,  lead: 'sawtooth', pad: 'sawtooth', bass: 'sawtooth', style: 'sparse', drums: 'heavy' } },
            { name: 'Nuvole',          emoji: '☁️', sky: 0xe8f1ff, c1: '#dfe6e9', c2: '#b2bec3', accent: '#9fd0ff', pattern: 'cloud',   fog: 0.0024, sun: 0xffffff, stars: 0, clouds: 0.9,  particle: { size: 1.3, mode: 'snow' },   amb: 'breeze',   music: { root: 65, scale: LYD, prog: [0, 1, 4, 0], bpm: 72,  lead: 'sine', pad: 'triangle', bass: 'sine', style: 'sparse', drums: 'none' } },
            { name: 'Spazio Profondo', emoji: '🪐', sky: 0x192a56, c1: '#273c75', c2: '#487eb0', accent: '#7fb2ff', pattern: 'hull',    fog: 0.0020, sun: 0xc0d8ff, stars: 1.0, clouds: 0,   particle: { size: 0.5, mode: 'drift' },  amb: 'space',    music: { root: 56, scale: MIN, prog: [0, 3, 6, 5], bpm: 86,  lead: 'sine', pad: 'sawtooth', bass: 'sine', style: 'sparse', drums: 'none' } },
            { name: 'Cristallo',       emoji: '💎', sky: 0x3B3B98, c1: '#82589F', c2: '#D6A2E8', accent: '#e0a8ff', pattern: 'crystal', fog: 0.0028, sun: 0xffe0ff, stars: 0.5, clouds: 0.2, particle: { size: 0.9, mode: 'float' },  amb: 'crystal',  music: { root: 71, scale: MAJ, prog: [0, 5, 1, 4], bpm: 100, lead: 'sine', pad: 'triangle', bass: 'triangle', style: 'arp', drums: 'light' } },
            { name: 'Paradiso',        emoji: '🌟', sky: 0xf5f6fa, c1: '#fbc531', c2: '#e1b12c', accent: '#ffd76a', pattern: 'marble',  fog: 0.0018, sun: 0xffffff, stars: 0, clouds: 0.8,  particle: { size: 1.0, mode: 'float' },  amb: 'heaven',   music: { root: 60, scale: MAJ, prog: [0, 3, 5, 4], bpm: 76,  lead: 'triangle', pad: 'sawtooth', bass: 'sine', style: 'melody', drums: 'none' } }
        ];
        const biomeDefs = BIOMES;
        const biomeNames = BIOMES.map(b => `${b.emoji} ${b.name}`);
        function applyBiomeTheme(b) {
            const root = document.documentElement, acc = BIOMES[b].accent;
            root.style.setProperty('--biome', acc);
            const c = new THREE.Color(acc); root.style.setProperty('--biome-soft', `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.4)`);
        }
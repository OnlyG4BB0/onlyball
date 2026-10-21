/* ==========================================================================
           SEZIONE 4: TOAST, FEEDBACK E VIEWPORT
           ========================================================================== */
        let eventToastTimer = null;
        function showEvent(html, cls = 'good', ms = 1800) {
            const t = $('event-toast'); $('event-toast-text').innerHTML = html;
            t.className = 'toast toast-event show ' + cls; clearTimeout(eventToastTimer);
            eventToastTimer = setTimeout(() => { t.classList.remove('show'); t.classList.add('hide'); setTimeout(() => t.classList.add('hidden'), 400); }, ms);
        }
        function flashScreen(kind = 'bad') { const f = $('flash'); f.classList.remove('on'); f.classList.toggle('good', kind === 'good'); void f.offsetWidth; f.classList.add('on'); }
        let scorePopTimer = 0;
        function popScore() { if (scorePopTimer) return; const s = $('score'); s.classList.add('pop'); scorePopTimer = setTimeout(() => { s.classList.remove('pop'); scorePopTimer = 0; }, 240); }

        function updateViewportVars() {
            const vv = window.visualViewport;
            const h = vv ? vv.height : window.innerHeight;
            document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
            document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
        }
        updateViewportVars();

        let rotateHintShown = false;
        function maybeShowRotateHint() {
            if (!touchUI || rotateHintShown || window.innerWidth >= window.innerHeight) return;
            rotateHintShown = true; const h = $('rotate-hint'); h.classList.remove('hidden');
            setTimeout(() => h.classList.add('hidden'), 4500);
        }

/* ==========================================================================
           SEZIONE 5: CONTROLLI TOUCH E JOYSTICK
           ========================================================================== */
        function requestFullscreenAndLandscape() {
            const doc = document.documentElement;
            const reqFS = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.mozRequestFullScreen || doc.msRequestFullscreen;
            if (reqFS) { try { const p = reqFS.call(doc); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
            if (screen.orientation && screen.orientation.lock) { try { const p = screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
        }
        $('btn-fullscreen').addEventListener('click', requestFullscreenAndLandscape);

        let joystickData = { x: 0, y: 0, active: false }, joyCenter = { x: 0, y: 0 };
        let joyTouchId = null, camTouchId = null, lastTouchCam = { x: 0, y: 0 };
        const joyZone = $('joystick-zone'), joyKnob = $('joystick-knob'), camZone = $('camera-zone'), jumpBtn = $('jump-btn');

        function updateJoystick(touch) {
            let dx = touch.clientX - joyCenter.x, dy = touch.clientY - joyCenter.y;
            const maxDist = joyZone.offsetWidth / 2 - joyKnob.offsetWidth / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
            joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            joystickData.x = dx / maxDist; joystickData.y = dy / maxDist; joystickData.active = true;
        }
        joyZone.addEventListener('touchstart', (e) => {
            e.preventDefault(); joyTouchId = e.changedTouches[0].identifier;
            const rect = joyZone.getBoundingClientRect(); joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            updateJoystick(e.changedTouches[0]);
        }, { passive: false });
        joyZone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joyTouchId) updateJoystick(t); }, { passive: false });
        const releaseJoy = (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joyTouchId) { joyTouchId = null; joystickData = { x: 0, y: 0, active: false }; joyKnob.style.transform = 'translate(-50%, -50%)'; } };
        joyZone.addEventListener('touchend', releaseJoy, { passive: false }); joyZone.addEventListener('touchcancel', releaseJoy, { passive: false });

        camZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (camTouchId === null) { camTouchId = e.changedTouches[0].identifier; lastTouchCam.x = e.changedTouches[0].clientX; lastTouchCam.y = e.changedTouches[0].clientY; }
        }, { passive: false });
        camZone.addEventListener('touchmove', (e) => {
            e.preventDefault(); if (gameState !== 'playing') return;
            const sens = 0.008 * (settings.sens / 100);
            for (const t of e.changedTouches) {
                if (t.identifier === camTouchId) {
                    camYaw -= (t.clientX - lastTouchCam.x) * sens; camPitch += (t.clientY - lastTouchCam.y) * sens;
                    camPitch = clamp(camPitch, 0.1, Math.PI / 2 - 0.1); lastTouchCam.x = t.clientX; lastTouchCam.y = t.clientY;
                }
            }
        }, { passive: false });
        const releaseCam = (e) => { for (const t of e.changedTouches) if (t.identifier === camTouchId) camTouchId = null; };
        camZone.addEventListener('touchend', releaseCam, { passive: false }); camZone.addEventListener('touchcancel', releaseCam, { passive: false });

        jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.space = true; jumpBtn.classList.add('pressed'); }, { passive: false });
        const releaseJump = (e) => { e.preventDefault(); keys.space = false; jumpBtn.classList.remove('pressed'); };
        jumpBtn.addEventListener('touchend', releaseJump, { passive: false }); jumpBtn.addEventListener('touchcancel', releaseJump, { passive: false });
        jumpBtn.addEventListener('mousedown', (e) => { e.preventDefault(); keys.space = true; }); jumpBtn.addEventListener('mouseup', () => { keys.space = false; });
        $('btn-respawn-mob').addEventListener('click', () => { if (gameState === 'playing' && MODE().fall !== 'gameover') triggerRespawn(true); });
        $('btn-pause-mob').addEventListener('click', () => { if (gameState === 'playing') openPauseMenu(); });

        // Anteprima skin: trascina per ruotare
        let skinDrag = null;
        window.addEventListener('pointerdown', (e) => { if (gameState !== 'skins' || (e.target.closest && e.target.closest('.panel'))) return; skinDrag = { x: e.clientX }; });
        window.addEventListener('pointermove', (e) => { if (skinDrag && gameState === 'skins') { camYaw -= (e.clientX - skinDrag.x) * 0.01; skinDrag.x = e.clientX; } });
        window.addEventListener('pointerup', () => { skinDrag = null; });

/* ==========================================================================
           SEZIONE 13: MENU, IMPOSTAZIONI E PAUSA
           ========================================================================== */
        $('btn-open-skins').addEventListener('click', () => { AudioEngine.playUI(); gameState = 'skins'; showScreen('skin-menu'); camDistance = 5; camPitch = 0.15; Audio.music('skins'); });
        $('btn-close-skin').addEventListener('click', () => {
            AudioEngine.playUI();
            if (currentSkinIndex >= 0 && !isSkinUnlocked(currentSkinIndex)) {
                currentSkinIndex = firstUnlockedSkinIndex();
                applySkin(currentSkinIndex);
            }
            gameState = 'menu'; showScreen('main-menu'); camDistance = 12; camPitch = 0.3; Audio.music('menu');
        });

        function loadSettingsUI() {
            $('vol-slider').value = settings.sfx; $('music-slider').value = settings.music; $('amb-slider').value = settings.amb; $('mute-toggle').checked = !settings.mute; $('sens-slider').value = settings.sens; $('res-select').value = settings.quality;
            $('shadow-toggle').checked = settings.shadows; $('vibrate-toggle').checked = settings.vibrate; $('touch-select').value = settings.touch;
        }
        loadSettingsUI();
        function openSettings(from) { previousState = from; gameState = 'settings'; loadSettingsUI(); showScreen('settings-menu'); }
        $('btn-settings-main').addEventListener('click', () => { AudioEngine.playUI(); openSettings('menu'); });
        $('btn-settings-pause').addEventListener('click', () => { AudioEngine.playUI(); openSettings('paused'); });
        function closeSettings() {
            settings.quality = $('res-select').value; settings.shadows = $('shadow-toggle').checked; settings.vibrate = $('vibrate-toggle').checked; settings.touch = $('touch-select').value;
            settings.sens = parseInt($('sens-slider').value); saveSettings();
            setTouchUI(settings.touch === 'on' ? true : settings.touch === 'off' ? false : (hasCoarsePointer && hasTouchPoints) || isMobileUA);
            gameState = previousState; showScreen(previousState === 'menu' ? 'main-menu' : 'pause-menu'); applyGraphicsSettings();
        }
        $('btn-close-settings').addEventListener('click', () => { AudioEngine.playUI(); closeSettings(); });
        $('settings-menu').addEventListener('click', (e) => { if (e.target === $('settings-menu')) closeSettings(); });
        $('vol-slider').addEventListener('input', (e) => { settings.sfx = parseInt(e.target.value); Audio.applyVolumes(); saveSettings(); });
        $('vol-slider').addEventListener('change', () => AudioEngine.playUI());
        $('music-slider').addEventListener('input', (e) => { settings.music = parseInt(e.target.value); Audio.applyVolumes(); saveSettings(); });
        $('amb-slider').addEventListener('input', (e) => { settings.amb = parseInt(e.target.value); Audio.applyVolumes(); saveSettings(); });
        $('mute-toggle').addEventListener('change', (e) => { settings.mute = !e.target.checked; Audio.applyVolumes(); saveSettings(); });

        function openPauseMenu() {
            tutorial.active = false; renderTutorial();
            gameState = 'paused'; if (!touchUI) { try { document.exitPointerLock(); } catch (e) {} }
            $('pause-mode').innerHTML = modeHTML(MODE()); $('pause-alt').textContent = highestScore + ' m'; $('pause-time').textContent = fmtTime(runTime);
            keys.space = false; joystickData = { x: 0, y: 0, active: false }; showScreen('pause-menu'); Audio.roll(0, false);
        }
        function resumeGame() { gameState = 'playing'; showScreen(null); if (!touchUI) { try { document.body.requestPointerLock(); } catch (e) {} } }
        $('btn-resume').addEventListener('click', () => { AudioEngine.playUI(); resumeGame(); });
        $('btn-restart').addEventListener('click', () => { AudioEngine.playUI(); if (runPeak >= 1) recordLeaderboardRun(modeKey, runPeak, runTime); showScreen(null); fullGameReset(); startGame(); });
        $('btn-home').addEventListener('click', () => { AudioEngine.playUIBack(); if (runPeak >= 1) recordLeaderboardRun(modeKey, runPeak, runTime); goHome(); });

        document.addEventListener('pointerlockchange', () => {
            if (touchUI) return;
            if (document.pointerLockElement === document.body) { if (gameState === 'paused') { gameState = 'playing'; showScreen(null); } }
            else if (gameState === 'playing') openPauseMenu();
        });
        document.addEventListener('visibilitychange', () => { if (document.hidden && gameState === 'playing') openPauseMenu(); });
        setTouchUI(touchUI);

        /* ---------- Classifica Migliori Giocatori (Modalità + Vetta + Tempo) ---------- */
        const LB_STORAGE_KEY = 'onlyball_leaderboard_v2';
        try { localStorage.removeItem('onlyball_leaderboard_v1'); } catch (e) {}
        const MODE_MULT = { hardcore: 1.50, lava: 1.40, daily: 1.25, timeattack: 1.20, classic: 1.00, zen: 0.75 };
        let lbFilter = 'all';

        function getPlayerName() {
            return (localStorage.getItem('onlyball_player_name') || 'Giocatore 1').trim() || 'Giocatore 1';
        }
        function setPlayerName(n) {
            const clean = (n || '').trim().slice(0, 16) || 'Giocatore 1';
            try { localStorage.setItem('onlyball_player_name', clean); } catch (e) {}
        }
        function fmtTimePrecise(s) {
            s = Math.max(0, Number(s) || 0);
            const m = Math.floor(s / 60), sec = Math.floor(s % 60), d = Math.floor((s - Math.floor(s)) * 10);
            return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${d}`;
        }
        function calcRankScore(mode, peak, time) {
            const mult = MODE_MULT[mode] || 1.0;
            const heightPts = peak * 10;
            const summitBonus = peak >= 1000 ? 1500 : 0;
            const speedRate = peak / Math.max(15, time || 60);
            const speedBonus = Math.min(950, speedRate * 190);
            return Math.round((heightPts + summitBonus + speedBonus) * mult);
        }
        function loadPlayerLb() {
            try {
                const arr = JSON.parse(localStorage.getItem(LB_STORAGE_KEY) || '[]');
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                return [];
            }
        }
        function savePlayerLb(arr) {
            try { localStorage.setItem(LB_STORAGE_KEY, JSON.stringify(arr.slice(0, 50))); } catch (e) {}
        }
        function recordLeaderboardRun(mode, peak, time) {
            peak = Math.floor(Number(peak) || 0);
            time = Math.max(0.5, +(Number(time) || 1).toFixed(1));
            if (peak < 1) return;
            const list = loadPlayerLb();
            const pName = getPlayerName();
            list.push({ name: pName, mode, peak, time, date: todayKey() });
            savePlayerLb(list);
        }
        function renderLeaderboard() {
            const tabsEl = $('lb-tabs'), rowsEl = $('lb-rows'), nameInput = $('lb-player-name');
            if (!tabsEl || !rowsEl) return;
            const activeName = getPlayerName();
            if (nameInput && document.activeElement !== nameInput) nameInput.value = activeName;

            const tabDefs = [{ key: 'all', label: '🏆 Tutte' }, ...Object.entries(MODES).map(([k, m]) => ({ key: k, label: `${icon(m.icon)} ${m.name}` }))];
            tabsEl.innerHTML = '';
            tabDefs.forEach(t => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'lb-tab' + (lbFilter === t.key ? ' active' : '');
                btn.innerHTML = t.label;
                btn.addEventListener('click', () => { AudioEngine.playUI(); lbFilter = t.key; renderLeaderboard(); });
                tabsEl.appendChild(btn);
            });

            const playerRuns = loadPlayerLb();
            const bestOverall = playerRuns.reduce((mx, r) => Math.max(mx, r.peak || 0), 0);
            if ($('lb-best-peak')) $('lb-best-peak').textContent = bestOverall + ' m';
            if ($('lb-count-chip')) $('lb-count-chip').textContent = `${playerRuns.length} ${playerRuns.length === 1 ? 'scalata' : 'scalate'}`;

            let filtered = lbFilter === 'all' ? [...playerRuns] : playerRuns.filter(r => r.mode === lbFilter);
            const enriched = filtered.map(r => Object.assign({}, r, { score: calcRankScore(r.mode, r.peak, r.time) }));

            enriched.sort((a, b) => {
                if (lbFilter === 'all') {
                    if (b.score !== a.score) return b.score - a.score;
                }
                if (b.peak !== a.peak) return b.peak - a.peak;
                return a.time - b.time;
            });

            rowsEl.innerHTML = '';
            if (enriched.length === 0) {
                rowsEl.innerHTML = `<div style="text-align:center; padding: 42px 14px; color: var(--muted); font-size: .88rem;">Nessuna scalata registrata${lbFilter !== 'all' ? ' in questa modalità' : ''}.<br><span style="opacity:.75; font-size:.8rem;">Completa una partita per inserire il tuo primo record in classifica!</span></div>`;
                return;
            }
            enriched.slice(0, 20).forEach((r, idx) => {
                const rank = idx + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                const m = MODES[r.mode] || MODES.classic;
                const isMe = r.name === activeName;
                const row = document.createElement('div');
                row.className = 'lb-row' + (isMe ? ' me' : '') + (rank <= 3 ? ` top-${rank}` : '');
                const summitCrown = r.peak >= 1000 ? ' 👑' : '';
                row.innerHTML = `
                    <span class="lb-rank">${medal}</span>
                    <span class="lb-player">${r.name}</span>
                    <span class="lb-mode" style="color:${m.color}">${icon(m.icon)} ${m.name}</span>
                    <span class="lb-peak">${r.peak} m${summitCrown}</span>
                    <span class="lb-time">${fmtTimePrecise(r.time)}</span>
                    <span class="lb-pts">${r.score} pt</span>
                `;
                rowsEl.appendChild(row);
            });
        }
        function openLeaderboard(defaultFilter) {
            AudioEngine.playUI();
            if (gameState === 'playing') openPauseMenu();
            if (defaultFilter) lbFilter = defaultFilter;
            if ($('leaderboard-modal')) $('leaderboard-modal').classList.remove('hidden');
            try { renderLeaderboard(); } catch (err) { console.error(err); }
        }
        function closeLeaderboard() {
            AudioEngine.playUIBack();
            if ($('lb-player-name')) setPlayerName($('lb-player-name').value);
            if ($('leaderboard-modal')) $('leaderboard-modal').classList.add('hidden');
        }
        if ($('btn-open-leaderboard')) $('btn-open-leaderboard').addEventListener('click', () => openLeaderboard('all'));
        if ($('btn-gameover-lb')) $('btn-gameover-lb').addEventListener('click', () => openLeaderboard(modeKey));
        if ($('btn-close-leaderboard')) $('btn-close-leaderboard').addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboard(); });
        if ($('lb-player-name')) {
            $('lb-player-name').value = getPlayerName();
            $('lb-player-name').addEventListener('change', (e) => { setPlayerName(e.target.value); renderLeaderboard(); });
            $('lb-player-name').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { setPlayerName(e.target.value); e.target.blur(); renderLeaderboard(); } });
        }
        $('leaderboard-modal').addEventListener('click', (e) => { if (e.target === $('leaderboard-modal')) closeLeaderboard(); });

        /* ---------- Version Badge & Patch Notes Pop-up ---------- */
        const GAME_VERSION = '2.4.0';
        const seenPatch = localStorage.getItem('onlyball_seen_patch') === GAME_VERSION;
        if (seenPatch && $('version-dot')) $('version-dot').classList.add('hidden');
        function openPatchNotes() {
            AudioEngine.playUI();
            if (gameState === 'playing') openPauseMenu();
            $('patch-modal').classList.remove('hidden');
            if ($('version-dot')) $('version-dot').classList.add('hidden');
            try { localStorage.setItem('onlyball_seen_patch', GAME_VERSION); } catch (e) {}
        }
        function closePatchNotes() {
            AudioEngine.playUIBack();
            $('patch-modal').classList.add('hidden');
        }
        $('version-badge').addEventListener('click', (e) => { e.stopPropagation(); openPatchNotes(); });
        if ($('btn-patch-menu')) $('btn-patch-menu').addEventListener('click', (e) => { e.stopPropagation(); openPatchNotes(); });
        $('btn-close-patch').addEventListener('click', (e) => { e.stopPropagation(); closePatchNotes(); });
        $('patch-modal').addEventListener('click', (e) => { if (e.target === $('patch-modal')) closePatchNotes(); });

/* ==========================================================================
           SEZIONE 14: CONSOLE SEGRETA E CREDITI
           ========================================================================== */
        // Teletrasporto a un bioma: genera il livello fino a quell'altezza e appoggia la pallina sulla piattaforma più vicina
        function gotoBiome(b) {
            const targetY = clamp(b, 0, 14) * 70 + 6; let guard = 0;
            while (genCurrentY < targetY + 30 && genCurrentY < 1000 && guard++ < 40) generateMorePlatforms(20);
            let best = null; for (const p of platforms) { if (!best || Math.abs(p.topY - targetY) < Math.abs(best.topY - targetY)) best = p; }
            if (!best) return;
            const pos = best.body.position; sphereBody.position.set(pos.x, best.topY + 3, pos.z); sphereBody.velocity.set(0, 0, 0); sphereBody.angularVelocity.set(0, 0, 0);
            highestScore = Math.floor(best.topY); displayedScore = highestScore; $('score').textContent = highestScore; lastCheckpoint = { x: pos.x, y: best.topY + 1, z: pos.z }; lastSafePos = { x: pos.x, y: best.topY + 1.5, z: pos.z };
            checkpoints.forEach(cp => { if (cp.y <= highestScore) cp.reached = true; });
            ballGroup.position.copy(sphereBody.position); syncCameraToBall(); camera.position.set(pos.x, best.topY + 6, pos.z + 12); resetParticles(pos.x, best.topY, pos.z);
        }
        function closeConsole() { $('dev-console').classList.add('hidden'); if (gameState === 'console') { gameState = lastGameState; if (gameState === 'playing' && !touchUI) try { document.body.requestPointerLock(); } catch (e) {} } }
        $('console-input').addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return; const val = e.target.value.trim(), low = val.toLowerCase();
            if (low === '/fine') { closeConsole(); triggerEnding(); }
            else if (low === '/fly') { world.gravity.set(0, -5, 0); closeConsole(); }
            else if (low === '/nofly') { world.gravity.set(0, -35, 0); closeConsole(); }
            else if (low.startsWith('/speed ')) { const s = parseFloat(val.split(' ')[1]); if (!isNaN(s)) window._speedMult = s; closeConsole(); }
            else if (low.startsWith('/biome ')) { const b = parseInt(val.split(' ')[1]); if (!isNaN(b) && b >= 0 && b <= 14) gotoBiome(b); closeConsole(); }
            else if (low.startsWith('/mode ')) { const k = val.split(' ')[1]; if (MODES[k]) selectMode(k); closeConsole(); }
            else if (low === '/reset') { closeConsole(); fullGameReset(); startGame(); }
            else if (low === '/help') { e.target.value = '  /fine | /fly | /nofly | /speed N | /biome N | /mode classic|hardcore|timeattack|lava|zen|daily | /reset'; return; }
            else closeConsole();
        });

        function triggerEnding() {
            gameState = 'credits'; if (!touchUI) { try { document.exitPointerLock(); } catch (e) {} }
            $('ui-layer').classList.add('hidden'); $('mobile-controls').classList.add('hidden');
            sphereBody.type = CANNON.Body.STATIC; sphereBody.velocity.set(0, 0, 0); sphereBody.angularVelocity.set(0, 0, 0);
            runPeak = Math.max(runPeak, 1000);
            const prevBest = getBest(modeKey); if (runPeak > prevBest) { setBest(modeKey, runPeak); bestScore = runPeak; }
            noteProgressHeight(runPeak);
            recordLeaderboardRun(modeKey, 1000, runTime);
            $('credits-stats').textContent = `${MODE().name} · Tempo: ${fmtTime(runTime)}`;
            const cs = $('credits-screen'); cs.classList.remove('hidden'); cs.classList.add('fade-in-overlay');
            const ct = $('credits-text'); ct.classList.remove('animate-credits'); void ct.offsetWidth; ct.classList.add('animate-credits');
            const blocks = document.querySelectorAll('.credit-block'); blocks.forEach(b => b.classList.remove('visible'));
            const observer = new IntersectionObserver((entries) => { entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('visible'); }); }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
            blocks.forEach(b => observer.observe(b)); AudioEngine.playFanfare(); Audio.music('credits'); Audio.ambience('heaven'); Audio.roll(0, false);
        }
        function returnToMenuFromCredits() {
            const cs = $('credits-screen'); cs.classList.add('hidden'); cs.classList.remove('fade-in-overlay'); $('credits-text').classList.remove('animate-credits'); goHome();
        }
        $('credits-screen').addEventListener('click', () => { if (gameState === 'credits') returnToMenuFromCredits(); });


/* ---------- Multigiocatore Online (P2P) UI & Gestione Stanze ---------- */
function initHostRoom() {
    const codeEl = $('mp-create-code');
    const statusEl = $('mp-host-status');
    if (codeEl) codeEl.textContent = '...';
    if (statusEl) statusEl.innerHTML = '<span class="status-dot pulse"></span> Creazione stanza sui server P2P...';
    Multiplayer.updateLobbyUI();

    Multiplayer.createRoom(
        (code) => {
            if (codeEl) codeEl.textContent = code;
        },
        (code) => {
            if (statusEl) statusEl.innerHTML = '<span class="status-dot pulse"></span> Stanza pronta! In attesa che gli amici inseriscano il codice...';
            Multiplayer.updateLobbyUI();
        },
        () => {
            Multiplayer.updateLobbyUI();
        },
        (err) => {
            if (statusEl) statusEl.innerHTML = '<span class="status-dot" style="background:var(--coral)"></span> Errore connessione P2P. Riprova.';
        }
    );
}

function openMultiplayerModal() {
    AudioEngine.playUI();
    const modal = $('multiplayer-modal');
    if (modal) modal.classList.remove('hidden');
    selectMpTab('create');
}

function closeMultiplayerModal() {
    AudioEngine.playUIBack();
    const modal = $('multiplayer-modal');
    if (modal) modal.classList.add('hidden');
    Multiplayer.leaveRoom();
}

function selectMpTab(tab) {
    AudioEngine.playUI();
    if (tab === 'create') {
        if ($('mp-tab-create')) $('mp-tab-create').classList.add('active');
        if ($('mp-tab-join')) $('mp-tab-join').classList.remove('active');
        if ($('mp-view-create')) $('mp-view-create').classList.remove('hidden');
        if ($('mp-view-join')) $('mp-view-join').classList.add('hidden');
        if (!Multiplayer.isHost || !Multiplayer.peer || Multiplayer.peer.destroyed) {
            initHostRoom();
        }
    } else {
        if ($('mp-tab-create')) $('mp-tab-create').classList.remove('active');
        if ($('mp-tab-join')) $('mp-tab-join').classList.add('active');
        if ($('mp-view-create')) $('mp-view-create').classList.add('hidden');
        if ($('mp-view-join')) $('mp-view-join').classList.remove('hidden');
        if (Multiplayer.isHost) {
            Multiplayer.leaveRoom();
        }
        setTimeout(() => { if ($('mp-join-input')) $('mp-join-input').focus(); }, 100);
    }
}

if ($('btn-open-multiplayer')) $('btn-open-multiplayer').addEventListener('click', openMultiplayerModal);
if ($('btn-close-multiplayer')) $('btn-close-multiplayer').addEventListener('click', closeMultiplayerModal);
if ($('multiplayer-modal')) $('multiplayer-modal').addEventListener('click', (e) => { if (e.target === $('multiplayer-modal')) closeMultiplayerModal(); });
if ($('mp-tab-create')) $('mp-tab-create').addEventListener('click', () => selectMpTab('create'));
if ($('mp-tab-join')) $('mp-tab-join').addEventListener('click', () => selectMpTab('join'));
if ($('btn-start-mp-game')) $('btn-start-mp-game').addEventListener('click', () => { AudioEngine.playUI(); Multiplayer.startMatchAsHost(); });

if ($('btn-copy-code')) $('btn-copy-code').addEventListener('click', () => {
    const code = $('mp-create-code') ? $('mp-create-code').textContent : '';
    if (code && code !== '...' && code !== '------') {
        if (navigator.clipboard) navigator.clipboard.writeText(code);
        showToast('Codice stanza copiato!', 'good');
    }
    AudioEngine.playUI();
});

if ($('btn-copy-link')) $('btn-copy-link').addEventListener('click', () => {
    const code = $('mp-create-code') ? $('mp-create-code').textContent : '';
    if (code && code !== '...' && code !== '------') {
        const url = window.location.origin + window.location.pathname + '?room=' + code;
        if (navigator.clipboard) navigator.clipboard.writeText(url);
        showToast('Link gara copiato negli appunti!', 'good');
    }
    AudioEngine.playUI();
});

if ($('mp-join-input')) {
    $('mp-join-input').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    });
    $('mp-join-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if ($('btn-join-room')) $('btn-join-room').click();
        }
    });
}

if ($('btn-join-room')) $('btn-join-room').addEventListener('click', () => {
    const input = $('mp-join-input');
    const rawVal = input ? input.value.trim() : '';
    const clean = Multiplayer.normalizeRoomCode(rawVal);
    if (!clean || clean.length < 3) {
        showToast('Inserisci un codice valido (es. OB-8K4F o 8K4F)', 'bad');
        return;
    }
    const displayCode = Multiplayer.formatRoomCode(clean);
    AudioEngine.playUI();
    const statusEl = $('mp-join-status');
    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = `<span class="status-dot pulse"></span> Connessione alla stanza ${displayCode}...`;
    }
    Multiplayer.joinRoom(rawVal, () => {
        if (statusEl) statusEl.innerHTML = '<span class="status-dot" style="background:var(--mint)"></span> Connesso! Avvio gara...';
    }, (progressMsg) => {
        if (statusEl) statusEl.innerHTML = `<span class="status-dot pulse"></span> ${progressMsg}`;
    }, (err) => {
        if (statusEl) {
            const msg = (err && err.message) ? err.message : 'Stanza non trovata o non raggiungibile.';
            statusEl.innerHTML = `<span class="status-dot" style="background:var(--coral)"></span> ${msg}`;
        }
    });
});

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('room')) {
        const rawCode = params.get('room');
        const clean = Multiplayer.normalizeRoomCode(rawCode);
        if (clean) {
            setTimeout(() => {
                const modal = $('multiplayer-modal');
                if (modal) modal.classList.remove('hidden');
                selectMpTab('join');
                if ($('mp-join-input')) $('mp-join-input').value = Multiplayer.formatRoomCode(clean);
                if ($('btn-join-room')) $('btn-join-room').click();
            }, 600);
        }
    }
});

/* ==========================================================================
           SEZIONE 12: RESET, AVVIO E FINE PARTITA
           ========================================================================== */
        function applyGraphicsSettings() {
            const quality = settings.quality, useShadows = settings.shadows; let resScale = 1; isRTX = false;
            const dpr = window.devicePixelRatio || 1;
            if (quality === 'ultra') { resScale = dpr; isRTX = true; } else if (quality === 'high') { resScale = Math.min(dpr, 1.5); } else if (quality === 'medium') { resScale = Math.min(dpr, 1.0); } else { resScale = Math.min(dpr, 0.6); }
            renderer.setPixelRatio(resScale); renderer.setSize(window.innerWidth, window.innerHeight);
            const shadowSize = quality === 'ultra' ? 4096 : quality === 'low' ? 512 : (touchUI ? 1024 : 2048);
            if (dirLight.shadow.mapSize.width !== shadowSize) { dirLight.shadow.mapSize.set(shadowSize, shadowSize); if (dirLight.shadow.map) { dirLight.shadow.map.dispose(); dirLight.shadow.map = null; } }
            sphereMesh.material.envMap = isRTX ? cubeRenderTarget.texture : null;
            [...biomeMaterials, bouncerMaterial].forEach(m => { m.top.metalness = isRTX ? Math.min(0.9, m.top.userData.baseMetal + 0.25) : m.top.userData.baseMetal; m.top.envMap = isRTX ? cubeRenderTarget.texture : null; m.top.needsUpdate = true; });
            applySkin(currentSkinIndex);
            renderer.shadowMap.enabled = useShadows; dirLight.castShadow = useShadows;
            scene.traverse((c) => { if (c.isMesh && c !== skyMesh && c !== lavaMesh && !c.userData.noShadow) { c.castShadow = useShadows; c.receiveShadow = useShadows; } });
            renderer.shadowMap.needsUpdate = true;
        }

        function fullGameReset() {
            for (const p of platforms) { scene.remove(p.mesh); world.removeBody(p.body); p.flagMeshes.forEach(m => scene.remove(m)); }
            for (const o of movingObstacles) { scene.remove(o.mesh); if (o.guideMesh) scene.remove(o.guideMesh); world.removeBody(o.body); }
            platforms.length = 0; platformMeshes.length = 0; movingObstacles.length = 0; sceneProps.length = 0; landmarks.length = 0; flags.length = 0; camDistEff = 12;
            genCurrentX = 0; genCurrentY = 0; genCurrentZ = 0; platformIndex = 0; highestPlatformY = 0; highestScore = 0; runPeak = 0; displayedScore = 0;
            Object.assign(gen, { angle: 0, prevW: 25, prevD: 25, lastPattern: "", nextRestY: 35, sinceCheckpoint: 0, pendingSigLabel: null });
            $('score').textContent = '0'; checkpoints = []; lastCheckpoint = { x: 0, y: 5, z: 0 }; lastSafePos = { x: 0, y: 2, z: 0 }; nextTargetCheckpoint = 70; $('cp-score').textContent = '0';
            currentVisualBiome = 0; currentBiomeNotified = -1; $('progress-bar').style.width = '0%'; $('progress-pct').textContent = '0'; $('biome-chip').textContent = biomeNames[0]; applyBiomeTheme(0);
            $('biome-toast').classList.add('hidden'); jumpBufferTimer = 0; coyoteTimer = 0; screenShakeIntensity = 0; biomeToastTimer = 0;
            runTime = 0; recordAnnounced = false; hintsTimer = 0; $('desktop-hints').classList.remove('faded');
            const m = MODE(); worldModeKey = modeKey;
            seedRng(m.seeded ? hashString('onlyball-' + todayKey()) : (Math.random() * 4294967295) >>> 0);
            modeTimeLeft = m.timer || 0; lavaY = -18; lavaSpeed = 0; lavaMesh.visible = !!m.lava; lavaLight.intensity = m.lava ? 2.2 : 0;
            createPlatform(0, 0, 0, 25, 2, 25, 0, { noProps: true }); generateMorePlatforms(40);
            sphereBody.type = CANNON.Body.DYNAMIC; sphereBody.position.set(0, 5, 0); sphereBody.velocity.set(0, 0, 0); sphereBody.angularVelocity.set(0, 0, 0); sphereBody.torque.set(0, 0, 0);
            ballGroup.position.copy(sphereBody.position); ballSquash.x = ballSquash.y = 1;
            camYaw = Math.PI; camPitch = 0.3; camDistance = 12; syncCameraToBall(); scene.fog.color.setHex(0x8ae2f5); scene.fog.density = BIOMES[0].fog; setSkyTargets(0);
            skyUniforms.topColor.value.copy(skyTarget.top); skyUniforms.horizonColor.value.copy(skyTarget.horizon); skyUniforms.bottomColor.value.copy(skyTarget.bottom); skyUniforms.sunColor.value.copy(skyTarget.sun); skyUniforms.stars.value = skyTarget.stars; skyUniforms.clouds.value = skyTarget.clouds;
            camera.position.set(camDistance * Math.sin(camYaw) * Math.cos(camPitch), 5 + camDistance * Math.sin(camPitch), camDistance * Math.cos(camYaw) * Math.cos(camPitch));
            applyGraphicsSettings(); resetParticles(0, 5, 0); Audio.setZen(!!m.zen);
        }

        function setSkyTargets(biome) {
            const b = BIOMES[biome], base = new THREE.Color(b.sky);
            skyTarget.top.copy(base).offsetHSL(0, 0.12, -0.2); skyTarget.horizon.copy(base).offsetHSL(0, -0.06, 0.14); skyTarget.bottom.copy(base).offsetHSL(0.02, -0.15, -0.12);
            skyTarget.sun.setHex(b.sun); skyTarget.stars = b.stars; skyTarget.clouds = b.clouds;
        }

        function showScreen(id) {
            ['main-menu', 'skin-menu', 'settings-menu', 'pause-menu', 'gameover'].forEach(s => $(s).classList.toggle('hidden', s !== id));
            const vb = $('version-badge'); if (vb) vb.classList.toggle('in-play', id === null);
        }

        function startGame() {
            if (worldModeKey !== modeKey) fullGameReset();
            showScreen(null); $('ui-layer').classList.remove('hidden'); $('best-score-val').textContent = bestScore;
            const m = MODE();
            $('checkpoint-hud').classList.toggle('hidden', !m.checkpoints); $('lava-hud').classList.toggle('hidden', !m.lava); $('zen-hud').classList.toggle('hidden', !m.zen);
            $('timer-hud').classList.toggle('hidden', !m.timer); $('timer-hud').classList.remove('warn'); if (m.timer) $('timer-hud').textContent = fmtTime(m.timer);
            $('mode-chip').innerHTML = modeHTML(m);
            if (touchUI) $('mobile-controls').classList.remove('hidden');
            camYaw = Math.PI; camPitch = 0.3; camDistance = 12;
            gameState = 'playing';
            if (!touchUI && tutorial.done) { try { document.body.requestPointerLock(); } catch (e) {} }
            initAudio(); Audio.setZen(!!m.zen); Audio.music(currentVisualBiome); Audio.ambience(BIOMES[currentVisualBiome].amb); maybeShowRotateHint();
            beginTutorialIfNeeded();
        }
        $('btn-play').addEventListener('click', () => { AudioEngine.playUI(); startGame(); });

        /* ---------- Tutorial onboarding (prima partita) ---------- */
        const TUTORIAL_STEPS = [
            {
                title: 'Muoviti',
                desktop: 'Usa <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o le frecce per rotolare sulla piattaforma.',
                touch: 'Usa il joystick in basso a sinistra per rotolare.'
            },
            {
                title: 'Salta',
                desktop: 'Premi <kbd>Spazio</kbd> per saltare. Puoi bufferizzare il salto un attimo prima di atterrare.',
                touch: 'Tocca <b>SALTA</b> per saltare sulla prossima piattaforma.'
            },
            {
                title: 'Coyote time',
                desktop: 'Puoi ancora saltare per un istante dopo aver lasciato il bordo. Prova a saltare “in ritardo”!',
                touch: 'Anche dopo aver lasciato il bordo hai un attimo per saltare. Provalo!'
            }
        ];
        const tutorial = {
            done: localStorage.getItem('onlyball_tutorial_done') === '1',
            active: false,
            step: 0,
            jumps: 0,
            moved: false
        };
        function renderTutorial() {
            const coach = $('tutorial-coach');
            if (!tutorial.active) { coach.classList.add('hidden'); return; }
            const s = TUTORIAL_STEPS[tutorial.step];
            $('tutorial-step-label').textContent = `Passo ${tutorial.step + 1} di ${TUTORIAL_STEPS.length}`;
            $('tutorial-title').textContent = s.title;
            $('tutorial-body').innerHTML = touchUI ? s.touch : s.desktop;
            $('btn-tutorial-next').textContent = tutorial.step >= TUTORIAL_STEPS.length - 1 ? 'Inizia!' : 'Ok, ho capito';
            coach.classList.remove('hidden');
        }
        function beginTutorialIfNeeded() {
            if (tutorial.done) { tutorial.active = false; renderTutorial(); return; }
            tutorial.active = true; tutorial.step = 0; tutorial.jumps = 0; tutorial.moved = false;
            hintsTimer = 100; $('desktop-hints').classList.add('faded');
            renderTutorial();
        }
        function finishTutorial(skipped = false) {
            tutorial.active = false; tutorial.done = true;
            try { localStorage.setItem('onlyball_tutorial_done', '1'); } catch (e) {}
            renderTutorial();
            if (!skipped) showEvent(`${icon('flag')} Tutorial completato — alla vetta!`, 'good', 2200);
            if (gameState === 'playing' && !touchUI) { try { document.body.requestPointerLock(); } catch (e) {} }
        }
        function advanceTutorial() {
            if (!tutorial.active) return;
            if (tutorial.step < TUTORIAL_STEPS.length - 1) { tutorial.step++; renderTutorial(); AudioEngine.playUI(); }
            else finishTutorial(false);
        }
        function tutorialOnMove() {
            if (!tutorial.active || tutorial.step !== 0 || tutorial.moved) return;
            tutorial.moved = true;
            setTimeout(() => { if (tutorial.active && tutorial.step === 0) advanceTutorial(); }, 700);
        }
        function tutorialOnJump() {
            if (!tutorial.active) return;
            tutorial.jumps++;
            if (tutorial.step === 1) advanceTutorial();
            else if (tutorial.step === 2 && tutorial.jumps >= 3) finishTutorial(false);
        }
        $('btn-tutorial-skip').addEventListener('click', (e) => { e.stopPropagation(); AudioEngine.playUIBack(); finishTutorial(true); });
        $('btn-tutorial-next').addEventListener('click', (e) => { e.stopPropagation(); advanceTutorial(); });

        async function shareRunCard() {
            const m = MODE();
            const title = modeKey === 'daily' ? `Sfida del Giorno ${todayKey()}` : m.name;
            const text = `Ho raggiunto ${runPeak} m in Only Ball — ${title}! 🏀\nGioca anche tu: https://github.com/OnlyG4BB0/onlyball`;
            const canvas = document.createElement('canvas');
            canvas.width = 1080; canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            const grd = ctx.createLinearGradient(0, 0, 1080, 1080);
            grd.addColorStop(0, '#0a0d1a'); grd.addColorStop(0.45, '#1a1240'); grd.addColorStop(1, '#3a1028');
            ctx.fillStyle = grd; ctx.fillRect(0, 0, 1080, 1080);
            ctx.fillStyle = 'rgba(255,184,48,.18)'; ctx.beginPath(); ctx.arc(820, 220, 260, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,92,77,.16)'; ctx.beginPath(); ctx.arc(180, 900, 300, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff7ee'; ctx.font = '700 42px Fredoka, sans-serif'; ctx.fillText('ONLY BALL', 80, 120);
            ctx.fillStyle = '#ffb830'; ctx.font = '400 28px Bungee, sans-serif'; ctx.fillText('ULTIMATE EDITION', 80, 168);
            ctx.fillStyle = '#ffe4a8'; ctx.font = '400 120px Bungee, sans-serif'; ctx.fillText(runPeak + ' m', 80, 420);
            ctx.fillStyle = '#e7e2ff'; ctx.font = '600 36px Fredoka, sans-serif'; ctx.fillText(title, 80, 500);
            ctx.fillStyle = 'rgba(255,247,238,.7)'; ctx.font = '500 28px Fredoka, sans-serif';
            ctx.fillText('Tempo ' + fmtTime(runTime), 80, 560);
            ctx.fillText('Record ' + Math.max(getBest(modeKey), runPeak) + ' m', 80, 610);
            ctx.fillStyle = '#37e0b0'; ctx.font = '700 26px Fredoka, sans-serif'; ctx.fillText('by ONLY_G4BB0', 80, 980);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            const file = blob ? new File([blob], `onlyball-${runPeak}m.png`, { type: 'image/png' }) : null;
            try {
                if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ title: 'Only Ball', text, files: [file] });
                    showEvent(`${icon('share')} Condiviso!`, 'good', 1600);
                    return;
                }
                if (navigator.share) {
                    await navigator.share({ title: 'Only Ball', text });
                    showEvent(`${icon('share')} Condiviso!`, 'good', 1600);
                    return;
                }
            } catch (e) { if (e && e.name === 'AbortError') return; }
            try { await navigator.clipboard.writeText(text); } catch (e) {}
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `onlyball-${runPeak}m.png`; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            }
            showEvent(`${icon('share')} Immagine salvata · testo copiato`, 'gold', 2200);
        }

        function endRun(reason) {
            gameState = 'gameover'; keys.space = false;
            tutorial.active = false; renderTutorial();
            $('ui-layer').classList.add('hidden'); $('mobile-controls').classList.add('hidden');
            if (!touchUI) { try { document.exitPointerLock(); } catch (e) {} }
            const m = MODE(); const titles = { fall: ['GAME OVER', 'Sei caduto nel vuoto.'], obstacle: ['GAME OVER', 'Un ostacolo letale ti ha colpito.'], lava: ['BRUCIATO!', 'La lava ti ha raggiunto.'], time: ['TEMPO SCADUTO', 'I 3 minuti sono finiti.'] };
            const [title, sub] = titles[reason] || titles.fall;
            $('gameover-title').textContent = title; $('gameover-title').classList.toggle('danger', reason !== 'time'); $('gameover-sub').textContent = sub;
            $('go-mode').innerHTML = modeHTML(m); $('final-score').textContent = runPeak + ' m'; $('go-time').textContent = fmtTime(runTime);
            const prevBest = getBest(modeKey); const isRecord = runPeak > prevBest && runPeak > 0;
            if (isRecord) { setBest(modeKey, runPeak); bestScore = runPeak; setTimeout(() => AudioEngine.playRecord(), 900); }
            noteProgressHeight(runPeak);
            recordLeaderboardRun(modeKey, runPeak, runTime);
            $('go-best').textContent = Math.max(prevBest, runPeak) + ' m'; $('gameover-record').classList.toggle('hidden', !isRecord);
            $('btn-gameover-share').classList.toggle('btn-sun', modeKey === 'daily' || isRecord);
            showScreen('gameover'); AudioEngine.playGameOver(); Audio.music('menu'); Audio.ambience(null); Audio.roll(0, false); renderModeCards();
        }
        $('btn-gameover-restart').addEventListener('click', () => { AudioEngine.playUI(); fullGameReset(); startGame(); });
        $('btn-gameover-home').addEventListener('click', () => { AudioEngine.playUIBack(); goHome(); });
        $('btn-gameover-share').addEventListener('click', () => { AudioEngine.playUI(); shareRunCard(); });
        function goHome() {
            tutorial.active = false; renderTutorial();
            $('ui-layer').classList.add('hidden'); $('mobile-controls').classList.add('hidden'); fullGameReset(); gameState = 'menu'; showScreen('main-menu'); renderModeCards(); Audio.music('menu'); Audio.ambience(null); Audio.roll(0, false);
            if (!touchUI) { try { document.exitPointerLock(); } catch (e) {} }
        }

/* ==========================================================================
           SEZIONE 17: CAMERA, AMBIENTE E LOOP PRINCIPALE
           ========================================================================== */
        const tmpColor = new THREE.Color(), camRay = new THREE.Raycaster(), camDir = new THREE.Vector3(), downOrigin = new THREE.Vector3();
        let camDistEff = 12, cullTimer = 0;
        function occludedDistance(origin, dir, maxDist, ballBottomY) {
            camRay.set(origin, dir); camRay.near = 1.2; camRay.far = maxDist;
            const hits = camRay.intersectObjects(platformMeshes, false);
            for (let i = 0; i < hits.length; i++) {
                const h = hits[i];
                // Ignora le piattaforme che si trovano sotto la pallina per evitare scatti di zoom durante il salto
                if (h.object.position.y + 0.6 <= ballBottomY + 0.35) continue;
                return Math.max(3.2, h.distance - 0.8);
            }
            return maxDist;
        }
        function updateCamera(dt) {
            const p = ballGroup.position;
            const safeX = isNaN(p.x) ? lastCheckpoint.x : p.x, safeY = isNaN(p.y) ? lastCheckpoint.y : p.y, safeZ = isNaN(p.z) ? lastCheckpoint.z : p.z;
            if (gameState === 'menu' || gameState === 'settings' && previousState === 'menu') { camYaw += dt * 0.25; camDistance += (11 - camDistance) * 0.05; camPitch += (0.28 - camPitch) * 0.05; }
            else if (gameState === 'skins') camYaw += dt * 0.15;

            const offsetY = gameState === 'skins' ? -0.6 : 0.6;
            const targetFocusY = safeY + offsetY;
            const kXZ = gameState === 'playing' ? (1 - Math.exp(-dt * 28)) : (1 - Math.exp(-dt * 6));
            const kY = gameState === 'playing' ? (1 - Math.exp(-dt * 20)) : (1 - Math.exp(-dt * 6));
            camFocus.x += (safeX - camFocus.x) * kXZ;
            camFocus.y += (targetFocusY - camFocus.y) * kY;
            camFocus.z += (safeZ - camFocus.z) * kXZ;

            landingDip *= Math.exp(-dt * 14);

            camDir.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
            const wanted = (gameState === 'playing' || gameState === 'paused') ? occludedDistance(camFocus, camDir, camDistance, safeY - radius) : camDistance;
            const distK = 1 - Math.exp(-dt * (wanted < camDistEff ? 14 : 6));
            camDistEff += (wanted - camDistEff) * distK;

            camera.position.set(
                camFocus.x + camDistEff * camDir.x,
                (camFocus.y - offsetY) + camDistEff * camDir.y - landingDip,
                camFocus.z + camDistEff * camDir.z
            );
            camera.lookAt(camFocus.x, camFocus.y - landingDip * 0.5, camFocus.z);
            skyMesh.position.copy(camera.position); skyUniforms.time.value += dt;

            const currBiome = clamp(Math.floor(isFinite(safeY / 70) ? safeY / 70 : 0), 0, 14), bdef = BIOMES[currBiome];
            setSkyTargets(currBiome);
            skyUniforms.topColor.value.lerp(skyTarget.top, 0.04); skyUniforms.horizonColor.value.lerp(skyTarget.horizon, 0.04); skyUniforms.bottomColor.value.lerp(skyTarget.bottom, 0.04); skyUniforms.sunColor.value.lerp(skyTarget.sun, 0.04);
            skyUniforms.stars.value = lerp(skyUniforms.stars.value, skyTarget.stars, 0.03); skyUniforms.clouds.value = lerp(skyUniforms.clouds.value, skyTarget.clouds, 0.03);
            scene.fog.color.lerp(skyTarget.horizon, 0.04); scene.fog.density = lerp(scene.fog.density, bdef.fog, 0.03);
            hemiLight.color.lerp(tmpColor.copy(skyTarget.horizon).lerp(new THREE.Color(0xffffff), 0.5), 0.04);
            dirLight.color.lerp(dirLightTarget.setHex(bdef.sun), 0.03);
            particleMesh.material.color.lerp(tmpColor.set(bdef.accent).lerp(new THREE.Color(0xffffff), 0.35), 0.05);
            particleMesh.material.size = bdef.particle.size;

            if (gameState !== 'skins' && platformMeshes.length > 0) {
                downOrigin.set(safeX, safeY, safeZ);
                downRay.set(downOrigin, downVec);
                const gHits = downRay.intersectObjects(platformMeshes, false);
                if (gHits.length > 0) {
                    const hit = gHits[0], dist = Math.max(0, hit.distance - radius);
                    landingShadow.visible = true;
                    landingShadow.position.set(safeX, hit.point.y + 0.03, safeZ);
                    const sScale = clamp(1.05 - dist * 0.028, 0.36, 1.05);
                    shadowDisc.scale.setScalar(sScale);
                    shadowDisc.material.opacity = clamp(0.55 - dist * 0.015, 0.14, 0.55);
                    const ringScale = clamp(0.65 + dist * 0.035, 0.65, 1.55);
                    shadowRing.scale.setScalar(ringScale);
                    shadowRing.material.color.set(bdef.accent);
                    shadowRing.material.opacity = dist > 0.35 ? clamp(0.65 - dist * 0.018, 0.12, 0.6) : 0;
                } else landingShadow.visible = false;
            } else landingShadow.visible = false;

            const positions = particleMesh.geometry.attributes.position.array, velocities = particleMesh.geometry.attributes.velocity.array, now = performance.now(), pm = bdef.particle.mode;
            for (let i = 0; i < particleCount * 3; i += 3) {
                if (pm === 'float') positions[i + 1] += Math.sin(now * 0.002 + i) * 0.05;
                else if (pm === 'wind') { positions[i] -= 0.5; positions[i + 1] += velocities[i + 1]; }
                else if (pm === 'snow') { positions[i + 1] -= 0.3; positions[i] += Math.sin(now * 0.001 + i) * 0.03; }
                else if (pm === 'embers') { positions[i + 1] += 0.4; positions[i] += velocities[i]; }
                else if (pm === 'rise') positions[i + 1] += 0.15 + Math.abs(velocities[i + 1]);
                else positions[i + 1] += velocities[i + 1] * 2;
                if (positions[i + 1] < safeY - 40) positions[i + 1] += 80; if (positions[i + 1] > safeY + 40) positions[i + 1] -= 80;
                if (positions[i] < safeX - 75) positions[i] += 150; if (positions[i] > safeX + 75) positions[i] -= 150;
                if (positions[i + 2] < safeZ - 75) positions[i + 2] += 150; if (positions[i + 2] > safeZ + 75) positions[i + 2] -= 150;
            }
            particleMesh.geometry.attributes.position.needsUpdate = true;

            if (gameState === 'playing' && currBiome !== currentVisualBiome) {
                currentVisualBiome = currBiome; Audio.music(currBiome); Audio.ambience(bdef.amb); AudioEngine.playBiome(); applyBiomeTheme(currBiome);
                const toast = $('biome-toast'); $('biome-toast-text').textContent = biomeNames[currBiome] || 'Nuovo Bioma'; $('biome-chip').textContent = biomeNames[currBiome];
                toast.classList.remove('hidden', 'hide'); toast.classList.add('show'); biomeToastTimer = 180; vibrate(20);
            }
            if (biomeToastTimer > 0) { biomeToastTimer--; if (biomeToastTimer === 30) { $('biome-toast').classList.remove('show'); $('biome-toast').classList.add('hide'); } if (biomeToastTimer === 0) $('biome-toast').classList.add('hidden'); }

            dirLight.position.set(safeX + 40, safeY + 60, safeZ + 40); dirLight.target.position.set(safeX, safeY, safeZ);
            for (const f of flags) { const pa = f.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(now * 0.004 + x * 2.5) * 0.12 * (x / 1.6)); } pa.needsUpdate = true; }

            ballSquash.x += (1 - ballSquash.x) * 0.18; ballSquash.y += (1 - ballSquash.y) * 0.18; ballGroup.scale.set(ballSquash.x, ballSquash.y, ballSquash.x);

            if (MODE().lava && lavaMesh.visible) { lavaMesh.position.set(safeX, lavaY, safeZ); lavaTex.offset.x += dt * 0.02; lavaTex.offset.y += dt * 0.013; lavaMat.emissiveIntensity = 1.5 + Math.sin(now * 0.004) * 0.35; lavaLight.intensity = 2 + Math.sin(now * 0.006) * 0.6; }
        }

        let lastFrame = performance.now(), accumulator = 0, lavaWarnTimer = 0; const FIXED_DT = 1 / 60;
        function animate() {
            requestAnimationFrame(animate);
            const now = performance.now(); let dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;

            if (gameState !== 'console' && gameState !== 'gameover' && gameState !== 'credits') {
                accumulator += dt; let steps = 0;
                while (accumulator >= FIXED_DT && steps < 3) { updatePhysics(); accumulator -= FIXED_DT; steps++; }
                if (steps === 3) accumulator = 0;
                const alpha = clamp(accumulator / FIXED_DT, 0, 1);
                ballGroup.position.lerpVectors(prevBallPos, currBallPos, alpha);
                if (gameState !== 'skins') sphereMesh.quaternion.slerpQuaternions(prevBallQuat, currBallQuat, alpha);
            }
            if (gameState !== 'console') updateCamera(dt);
            updateFx(dt); Audio.update(dt);

            if (window.Multiplayer) {
                if (Multiplayer.connected && gameState === 'playing') {
                    Multiplayer.broadcastState();
                }
                Multiplayer.update(dt);
            }

            if (gameState === 'playing') {
                runTime += dt; const m = MODE();
                if (isRTX) { ballGroup.visible = false; cubeCamera.position.copy(ballGroup.position); cubeCamera.update(renderer, scene); ballGroup.visible = true; }
                if (hitDeathZone) { hitDeathZone = false; if (m.fall === 'gameover') { AudioEngine.playDeath(); flashScreen(); vibrate([40, 30, 60]);
            if (window.Multiplayer && Multiplayer.connected) { Multiplayer.broadcastEvent('respawn', { alt: highestScore }); } endRun('obstacle'); return; } triggerRespawn(false, 'obstacle'); }

                if (m.timer) {
                    const before = Math.ceil(modeTimeLeft); modeTimeLeft -= dt; const after = Math.ceil(modeTimeLeft);
                    if (before !== after) { $('timer-hud').textContent = fmtTime(Math.max(0, modeTimeLeft)); if (after <= 10 && after > 0) { AudioEngine.playTick(); $('timer-hud').classList.add('warn'); } }
                    if (modeTimeLeft <= 0) { endRun('time'); return; }
                }
                if (m.lava) {
                    const biome = clamp(Math.floor(highestScore / 70), 0, 14);
                    if (runTime > 3) lavaSpeed += ((0.9 + biome * 0.18) - lavaSpeed) * 0.02; lavaY += lavaSpeed * dt;
                    lavaY = Math.max(lavaY, ballGroup.position.y - 45);
                    const dist = Math.max(0, Math.floor(ballGroup.position.y - lavaY)); $('lava-dist').textContent = dist; $('lava-hud').classList.toggle('chip-pulse', dist < 10);
                    if (dist < 10) { lavaWarnTimer -= dt; if (lavaWarnTimer <= 0) { lavaWarnTimer = 1.2; AudioEngine.playLavaWarn(); } }
                    if (ballGroup.position.y - radius < lavaY) { AudioEngine.playDeath(); flashScreen(); vibrate([60, 40, 80]); spawnPuffs(ballGroup.position, 14, 0xff5500, 6); endRun('lava'); return; }
                }

                const currentHeight = Math.floor(isNaN(ballGroup.position.y) ? lastCheckpoint.y : ballGroup.position.y);
                if (displayedScore !== highestScore) {
                    const diff = highestScore - displayedScore, step = Math.sign(diff) * Math.ceil(Math.abs(diff) * 0.15 + 0.5);
                    displayedScore = Math.abs(step) >= Math.abs(diff) ? highestScore : displayedScore + step;
                    $('score').textContent = displayedScore; popScore();
                }
                if (currentHeight > highestScore) {
                    highestScore = currentHeight; runPeak = Math.max(runPeak, highestScore);
                    const pct = Math.min(100, Math.round(runPeak / 10)); $('progress-bar').style.width = pct + '%'; $('progress-pct').textContent = pct;
                    if (runPeak > bestScore) {
                        if (!recordAnnounced && bestScore > 0) { recordAnnounced = true; showEvent(`${icon('trophy')} Nuovo record personale!`, 'gold', 2200); AudioEngine.playRecord(); vibrate([20, 40, 20]); }
                        bestScore = runPeak; setBest(modeKey, bestScore); $('best-score-val').textContent = bestScore; $('menu-best-val').textContent = bestScore;
                    }
                    noteProgressHeight(runPeak);
                    if (highestScore >= 1000) { if (window.Multiplayer && Multiplayer.connected) Multiplayer.broadcastEvent('win'); triggerEnding(); return; }
                }
                if (ballGroup.position.y > highestPlatformY - 100) generateMorePlatforms(20);
                cullTimer += dt; if (cullTimer > 1.5) { cullTimer = 0; cullBelow(highestScore - 130); }

                if (m.checkpoints) {
                    for (const cp of checkpoints) {
                        if (!cp.reached && ballGroup.position.y >= cp.y - 1) {
                            cp.reached = true; lastCheckpoint = cp.pos; AudioEngine.playCheckpoint(); flashScreen('good');
                            $('cp-score').textContent = cp.y;
                            const sigMsg = gen.pendingSigLabel ? ` · avanti: ${gen.pendingSigLabel}` : '';
                            showEvent(`${icon('flag')} Checkpoint ${cp.y} m${sigMsg}`, 'good');
                            gen.pendingSigLabel = null;
                            vibrate([15, 30, 15]);
                            if (window.Multiplayer && Multiplayer.connected) Multiplayer.broadcastEvent('checkpoint', { alt: cp.y });
                        }
                    }
                }
                const fallLimit = highestScore > 20 ? highestScore - 30 : -20;
                if (ballGroup.position.y < fallLimit) triggerRespawn(false, 'fall');

                if (!touchUI && hintsTimer < 12) { hintsTimer += dt; if (hintsTimer >= 12) $('desktop-hints').classList.add('faded'); }
            }
            renderer.render(scene, camera);
        }

/* ==========================================================================
           SEZIONE 18: VIEWPORT, ORIENTAMENTO E AVVIO
           ========================================================================== */
        function onResize() {
            updateViewportVars();
            const w = window.innerWidth, h = window.innerHeight;
            camera.aspect = w / h; camera.fov = h > w ? 82 : 72; camera.updateProjectionMatrix(); renderer.setSize(w, h);
        }
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', () => { setTimeout(onResize, 120); setTimeout(onResize, 500); });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
        if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(onResize, 120));
        window.addEventListener('contextmenu', (e) => { if (gameState === 'playing') e.preventDefault(); });

        // Hook di test/anteprima (usati dagli screenshot automatici): non influenzano il gioco
        function auditPlayable(minY = 240) {
            let guard = 0;
            while (genCurrentY < minY + 50 && genCurrentY < 1000 && guard++ < 40) generateMorePlatforms(30);
            const plats = platforms.map(p => {
                const he = p.body.shapes[0].halfExtents;
                return { x: p.body.position.x, y: p.topY, z: p.body.position.z, w: he.x * 2, d: he.z * 2, bouncer: !!p.body.isBouncer, flag: !!(p.body && p.flagMeshes && p.flagMeshes.length > 2) };
            });
            const obs = movingObstacles.filter(o => !o.isPlatform).map(o => ({ x: o.baseX, y: o.baseY, z: o.baseZ, deadly: !!o.deadly, kind: o.kind, amp: o.amp || 0, w: o.obsW || 2.4, d: o.obsD || 2.4 }));
            const sealed = [];
            for (const o of obs) {
                let best = null, bestDist = 1e9;
                for (const p of plats) {
                    const dist = Math.abs((o.y - 1.2) - p.y) * 2 + Math.hypot(o.x - p.x, o.z - p.z);
                    if (dist < bestDist) { bestDist = dist; best = p; }
                }
                if (!best || bestDist > 18) continue;
                if ((best.w - o.w) < OBS_LANE && (best.d - o.d) < OBS_LANE) sealed.push({ y: best.y, freeW: best.w - o.w, freeD: best.d - o.d });
            }
            const canJump = (a, b) => {
                const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz) || 1e-6, rise = b.y - a.y;
                const gap = dist - extentAlong(a.w, a.d, dx / dist, dz / dist) - extentAlong(b.w, b.d, dx / dist, dz / dist);
                if (a.bouncer) return rise <= 30 && gap <= 14 && rise >= -4;
                return rise <= 5.7 && gap <= 8.5 && rise >= -3;
            };
            const n = plats.length, reach = new Array(n).fill(false); reach[0] = true;
            const q = [0];
            while (q.length) {
                const i = q.pop();
                for (let j = 0; j < n; j++) {
                    if (reach[j] || i === j) continue;
                    if (Math.abs(plats[j].y - plats[i].y) > 32) continue;
                    if (canJump(plats[i], plats[j])) { reach[j] = true; q.push(j); }
                }
            }
            let maxReachY = 0, reached = 0;
            for (let i = 0; i < n; i++) if (reach[i]) { reached++; maxReachY = Math.max(maxReachY, plats[i].y); }
            const kinds = {}; for (const o of obs) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
            const bandYs = [0, 70, 140, 280, 420];
            const bands = bandYs.map((y0, i) => {
                const y1 = bandYs[i + 1] || y0 + 160;
                const pN = plats.filter(p => p.y >= y0 && p.y < y1).length, oN = obs.filter(o => o.y >= y0 && o.y < y1).length;
                return { y0, y1, platforms: pN, obstacles: oN, ratio: pN ? +(oN / pN).toFixed(2) : 0 };
            });
            const restClear = platforms.filter(p => p.flagMeshes.some(m => landmarks.indexOf(m) >= 0)).every(p => !obs.some(o => Math.hypot(o.x - p.body.position.x, o.z - p.body.position.z) < 5 && Math.abs(o.y - p.topY) < 4));
            const cpClear = checkpoints.every(cp => !obs.some(o => Math.hypot(o.x - cp.pos.x, o.z - cp.pos.z) < 7 && Math.abs(o.y - cp.pos.y) < 3.5));
            return { mode: modeKey, platforms: plats.length, obstacles: obs.length, lethal: obs.filter(o => o.deadly).length, kinds, sealed: sealed.length, maxReachY, reached, playable: maxReachY >= minY && sealed.length === 0, cpClear, restClear, bands, zenNoLethal: modeKey !== 'zen' || obs.every(o => !o.deadly) };
        }
        window.__ob = { gotoBiome, selectMode, startGame, fullGameReset, generateMorePlatforms, auditPlayable, endRun, shareRunCard, get state() { return { gameState, biome: currentVisualBiome, height: highestScore, platforms: platforms.length, obstacles: movingObstacles.filter(o => !o.isPlatform).length, lethal: movingObstacles.filter(o => o.deadly).length, mode: modeKey, audio: !!Audio.ctx, tutorial: tutorial.active ? tutorial.step : null }; }, Audio, BIOMES, createAudioEngine, SIG_PATTERNS };

        renderModeCards(); fullGameReset(); onResize(); animate();
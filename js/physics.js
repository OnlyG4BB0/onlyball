/* ==========================================================================
           SEZIONE 15: TASTIERA, MOUSE E GAMEPAD
           ========================================================================== */
        const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
        const keyMap = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' };
        document.addEventListener('keydown', (e) => {
            if (!$('leaderboard-modal').classList.contains('hidden')) {
                if (e.code === 'Escape') { e.preventDefault(); closeLeaderboard(); }
                return;
            }
            if (!$('patch-modal').classList.contains('hidden')) {
                if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); closePatchNotes(); }
                return;
            }
            if (e.key === '\\') {
                e.preventDefault(); const consoleEl = $('dev-console'), inputEl = $('console-input');
                if (gameState !== 'console') { lastGameState = gameState; gameState = 'console'; consoleEl.classList.remove('hidden'); try { document.exitPointerLock(); } catch (err) {} inputEl.value = ''; setTimeout(() => inputEl.focus(), 100); }
                else closeConsole();
                return;
            }
            if (gameState === 'console') { if (e.key === 'Escape') closeConsole(); return; }
            let key = e.key.toLowerCase(); if (keyMap[key]) { key = keyMap[key]; if (gameState === 'playing') e.preventDefault(); }
            if (keys.hasOwnProperty(key)) keys[key] = true;
            if (e.code === 'Space') { keys.space = true; if (gameState === 'playing') e.preventDefault(); }
            if (e.code === 'KeyH' && gameState === 'playing' && MODE().fall !== 'gameover') triggerRespawn(true);
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (gameState === 'credits') returnToMenuFromCredits();
                else if (gameState === 'playing') openPauseMenu();
                else if (gameState === 'paused') resumeGame();
                else if (gameState === 'settings') closeSettings();
                else if (gameState === 'skins') $('btn-close-skin').click();
            }
            if (gameState === 'menu' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { AudioEngine.playUI(); cycleMode(e.code === 'ArrowRight' ? 1 : -1); }
            if (gameState === 'menu' && e.code === 'Enter') startGame();
        });
        document.addEventListener('keyup', (e) => { let key = e.key.toLowerCase(); if (keyMap[key]) key = keyMap[key]; if (keys.hasOwnProperty(key)) keys[key] = false; if (e.code === 'Space') keys.space = false; });

        let lastMouseX = null, lastMouseY = null, isMouseDown = false;
        document.addEventListener('mousedown', (e) => {
            if (touchUI || e.button !== 0) return; isMouseDown = true;
            if (gameState === 'playing' && document.pointerLockElement !== document.body) { try { document.body.requestPointerLock(); } catch (err) {} }
        });
        document.addEventListener('mouseup', (e) => { if (e.button === 0) isMouseDown = false; });
        document.addEventListener('mouseleave', () => { isMouseDown = false; });
        document.addEventListener('mousemove', (e) => {
            if (gameState !== 'playing' || touchUI) return;
            const isLocked = document.pointerLockElement === document.body;
            let movX = e.movementX, movY = e.movementY;
            if (movX === undefined || (movX === 0 && movY === 0)) { movX = lastMouseX !== null ? e.clientX - lastMouseX : 0; movY = lastMouseY !== null ? e.clientY - lastMouseY : 0; }
            lastMouseX = e.clientX; lastMouseY = e.clientY; movX = isNaN(movX) ? 0 : movX; movY = isNaN(movY) ? 0 : movY;
            if (!isLocked && !isMouseDown) return;
            const sens = 0.003 * (settings.sens / 100);
            camYaw -= movX * sens; camPitch += movY * sens; camPitch = clamp(camPitch, 0.1, Math.PI / 2 - 0.1);
        });
        document.addEventListener('wheel', (e) => { if (gameState !== 'playing' || touchUI) return; camDistance = clamp(camDistance + e.deltaY * 0.02, 5, 30); }, { passive: true });
        window.addEventListener('gamepadconnected', (e) => {
            const el = $('gamepad-status');
            if (el) el.classList.remove('hidden');
            const name = (e && e.gamepad && e.gamepad.id) ? e.gamepad.id.split('(')[0].trim() : 'Controller';
            if (typeof showEvent === 'function') showEvent(`🎮 ${name} collegato!`, 'good', 2200);
        });
        window.addEventListener('gamepaddisconnected', () => {
            const el = $('gamepad-status');
            if (el) el.classList.add('hidden');
            if (typeof showEvent === 'function') showEvent('🎮 Controller disconnesso', 'bad', 2000);
        });

        const gpButtonPrevState = {};
        function wasJustPressed(key, isDown) {
            const prev = !!gpButtonPrevState[key];
            gpButtonPrevState[key] = isDown;
            return isDown && !prev;
        }
        function wasJustReleased(key, isDown) {
            const prev = !!gpButtonPrevState[key];
            gpButtonPrevState[key] = isDown;
            return !isDown && prev;
        }

        function getActiveGamepad() {
            if (!navigator.getGamepads) return null;
            try {
                const pads = navigator.getGamepads();
                if (!pads) return null;
                for (let i = 0; i < pads.length; i++) {
                    const p = pads[i];
                    if (p && p.connected) return p;
                }
            } catch (e) {}
            return null;
        }

        function isGpBtn(gp, idx) {
            if (!gp || !gp.buttons) return false;
            const b = gp.buttons[idx];
            if (!b) return false;
            return typeof b === 'object' ? !!b.pressed : b > 0.5;
        }

        function getGpAxis(gp, idx, deadzone = 0.12) {
            if (!gp || !gp.axes) return 0;
            const val = gp.axes[idx];
            if (typeof val !== 'number' || isNaN(val)) return 0;
            if (Math.abs(val) < deadzone) return 0;
            const sign = Math.sign(val);
            return sign * ((Math.abs(val) - deadzone) / (1 - deadzone));
        }

        function processGamepad() {
            try {
                const gp = getActiveGamepad();
                const statusEl = $('gamepad-status');
                if (statusEl) {
                    if (gp && statusEl.classList.contains('hidden')) statusEl.classList.remove('hidden');
                    else if (!gp && !statusEl.classList.contains('hidden')) statusEl.classList.add('hidden');
                }
                if (!gp) return { x: 0, y: 0, active: false };

                // Gestione focus cambio menu
                if (gameState !== lastGameState && gameState !== 'console') {
                    focusIndex = 0;
                    const cMenu = menuGroups[gameState];
                    if (cMenu && cMenu.length > 0) {
                        const firstEl = $(cMenu[0]);
                        if (firstEl && typeof firstEl.focus === 'function') firstEl.focus();
                    }
                    lastGameState = gameState;
                }

                // Switch Pro Controller & Generic mappings:
                // Tasto Salto: B (btn 0) o A (btn 1) o R1 (btn 5)
                const isJumpDown = isGpBtn(gp, 0) || isGpBtn(gp, 1) || isGpBtn(gp, 5);
                // Tasto Respawn: Y (btn 3) o X (btn 2)
                const isRespawnDown = isGpBtn(gp, 3) || isGpBtn(gp, 2);
                // Tasto Pausa: Start/+ (btn 9) o Select/- (btn 8)
                const isStartDown = isGpBtn(gp, 9) || isGpBtn(gp, 8);

                // D-Pad con fallback su Stick sinistro per navigazione menu
                const stickNavX = getGpAxis(gp, 0, 0.45);
                const stickNavY = getGpAxis(gp, 1, 0.45);
                let dUp = isGpBtn(gp, 12) || (stickNavY < -0.5);
                let dDown = isGpBtn(gp, 13) || (stickNavY > 0.5);
                let dLeft = isGpBtn(gp, 14) || (stickNavX < -0.5);
                let dRight = isGpBtn(gp, 15) || (stickNavX > 0.5);

                // Gestione hat switch aggiuntivo se presente su assi 4/5 (comune su vecchi driver DirectInput Switch)
                if (gp.axes && gp.axes.length >= 6) {
                    const ax4 = gp.axes[4], ax5 = gp.axes[5];
                    if (typeof ax4 === 'number' && !isNaN(ax4) && Math.abs(ax4) > 0.5) {
                        if (ax4 > 0.5) dRight = true; else if (ax4 < -0.5) dLeft = true;
                    }
                    if (typeof ax5 === 'number' && !isNaN(ax5) && Math.abs(ax5) > 0.5) {
                        if (ax5 > 0.5) dDown = true; else if (ax5 < -0.5) dUp = true;
                    }
                }

                // Eventi single-press (edge detection sicura)
                const startTriggered = wasJustPressed('start', isStartDown);
                const respawnTriggered = wasJustPressed('respawn', isRespawnDown);
                const jumpTriggered = wasJustPressed('jump', isJumpDown);
                const jumpReleased = wasJustReleased('jump', isJumpDown);

                const dUpTriggered = wasJustPressed('dUp', dUp);
                const dDownTriggered = wasJustPressed('dDown', dDown);
                const dLeftTriggered = wasJustPressed('dLeft', dLeft);
                const dRightTriggered = wasJustPressed('dRight', dRight);

                // Pausa / Riprendi
                if (startTriggered) {
                    if (gameState === 'playing') openPauseMenu();
                    else if (gameState === 'paused') resumeGame();
                    else if (gameState === 'credits') returnToMenuFromCredits();
                }

                // Respawn manuale
                if (respawnTriggered && gameState === 'playing' && MODE().fall !== 'gameover') {
                    triggerRespawn(true);
                }

                // Salto in gioco
                if (jumpTriggered) {
                    if (gameState === 'playing') keys.space = true;
                    else if (gameState === 'credits') returnToMenuFromCredits();
                }
                if (jumpReleased && gameState === 'playing') {
                    keys.space = false;
                }

                // Navigazione Menu
                if (gameState !== 'playing' && gameState !== 'credits' && gameState !== 'console') {
                    const currentMenu = menuGroups[gameState];
                    if (currentMenu && currentMenu.length > 0) {
                        if (dUpTriggered) {
                            focusIndex = (focusIndex - 1 + currentMenu.length) % currentMenu.length;
                            const el = $(currentMenu[focusIndex]);
                            if (el && typeof el.focus === 'function') el.focus();
                        }
                        if (dDownTriggered) {
                            focusIndex = (focusIndex + 1) % currentMenu.length;
                            const el = $(currentMenu[focusIndex]);
                            if (el && typeof el.focus === 'function') el.focus();
                        }
                        if (jumpTriggered) {
                            const el = $(currentMenu[focusIndex]);
                            if (el && typeof el.click === 'function') el.click();
                        }
                        const focusedId = currentMenu[focusIndex];
                        if (focusedId) {
                            if (focusedId.endsWith('-slider')) {
                                const slider = $(focusedId);
                                if (slider) {
                                    if (dLeftTriggered) {
                                        slider.value = Math.max(parseInt(slider.min) || 0, (parseInt(slider.value) || 0) - 5);
                                        slider.dispatchEvent(new Event('input'));
                                    }
                                    if (dRightTriggered) {
                                        slider.value = Math.min(parseInt(slider.max) || 100, (parseInt(slider.value) || 0) + 5);
                                        slider.dispatchEvent(new Event('input'));
                                    }
                                }
                            } else if (gameState === 'skins') {
                                if (dLeftTriggered && $('btn-skin-prev')) $('btn-skin-prev').click();
                                if (dRightTriggered && $('btn-skin-next')) $('btn-skin-next').click();
                            } else if (gameState === 'menu') {
                                if (dLeftTriggered) cycleMode(-1);
                                if (dRightTriggered) cycleMode(1);
                            }
                        }
                    }
                }

                // Telecamera: Levette analogiche destra (assi 2 e 3)
                if (gameState === 'playing' || gameState === 'skins') {
                    const lookX = getGpAxis(gp, 2, 0.15);
                    const lookY = getGpAxis(gp, 3, 0.15);
                    const sens = 0.04 * (settings.sens / 100);
                    if (lookX !== 0) camYaw -= lookX * sens;
                    if (lookY !== 0) {
                        camPitch += lookY * sens;
                        camPitch = clamp(camPitch, 0.1, Math.PI / 2 - 0.1);
                    }
                }

                // Sincronizza stato tasti per retrocompatibilita
                if (gp.buttons) {
                    for (let i = 0; i < gp.buttons.length; i++) {
                        lastGpButtons[i] = isGpBtn(gp, i);
                    }
                }

                // Movimento: Levetta analogica sinistra (assi 0 e 1)
                const moveX = getGpAxis(gp, 0, 0.12);
                const moveY = -getGpAxis(gp, 1, 0.12);
                return { x: moveX, y: moveY, active: (moveX !== 0 || moveY !== 0) };
            } catch (err) {
                console.warn('[Gamepad] Errore in processGamepad protetto:', err);
                return { x: 0, y: 0, active: false };
            }
        }

/* ==========================================================================
           SEZIONE 16: FISICA, COLLISIONI E RESPAWN
           ========================================================================== */
        let groundedNow = false, groundPlatform = null, landingDip = 0;
        const upAxis = new CANNON.Vec3(0, 1, 0);
        const prevBallPos = new THREE.Vector3(0, 5, 0), currBallPos = new THREE.Vector3(0, 5, 0);
        const prevBallQuat = new THREE.Quaternion(), currBallQuat = new THREE.Quaternion();
        const camFocus = new THREE.Vector3(0, 5.6, 0);

        function syncCameraToBall() {
            const sx = isNaN(sphereBody.position.x) ? 0 : sphereBody.position.x;
            const sy = isNaN(sphereBody.position.y) ? 5 : sphereBody.position.y;
            const sz = isNaN(sphereBody.position.z) ? 0 : sphereBody.position.z;
            prevBallPos.set(sx, sy, sz);
            currBallPos.set(sx, sy, sz);
            prevBallQuat.copy(sphereBody.quaternion);
            currBallQuat.copy(sphereBody.quaternion);
            camFocus.set(sx, sy + (gameState === 'skins' ? -0.6 : 0.6), sz);
            landingDip = 0; screenShakeIntensity = 0;
        }

        world.addEventListener('postStep', () => {
            let onGround = false, gPlat = null;
            for (let i = 0; i < world.contacts.length; i++) {
                const c = world.contacts[i];
                if (c.bi.id !== sphereBody.id && c.bj.id !== sphereBody.id) continue;
                const other = c.bi.id === sphereBody.id ? c.bj : c.bi;
                if (other.isDeathObstacle && MODE().hazards) {
                    hitDeathZone = true;
                } else if (other.isMovingObstacle) {
                    // Impatto cinetico ad alta energia: lancia via la pallina e scuote la visuale
                    const kx = sphereBody.position.x - other.position.x;
                    const kz = sphereBody.position.z - other.position.z;
                    const klen = Math.hypot(kx, kz) || 1;
                    const bump = 22;
                    sphereBody.velocity.x = (kx / klen) * bump;
                    sphereBody.velocity.z = (kz / klen) * bump;
                    sphereBody.velocity.y = Math.max(sphereBody.velocity.y, 8.5);
                    AudioEngine.playLand(1.0);
                    screenShakeIntensity = Math.max(screenShakeIntensity, 0.25);
                    spawnRing(sphereBody.position, 0xff5500, 1.3);
                    spawnPuffs(sphereBody.position, 8, 0xffa040, 5);
                    vibrate([35, 20, 50]);
                }
                const normal = c.ni; if (c.bi.id === sphereBody.id) normal.negate(normal);
                if (other.isBouncer && normal.y > 0.5) { sphereBody.velocity.y = 45; AudioEngine.playBounce(); ballSquash.y = 1.45; ballSquash.x = 0.8; spawnRing(sphereBody.position, 0x37e0b0, 1.4); spawnPuffs(sphereBody.position, 10, 0xb8ffd9, 6); vibrate(25); onGround = false; continue; }
                if (normal.y > 0.5) {
                    onGround = true;
                    if (other.isPlatform) {
                        gPlat = other;
                        if (other.type === CANNON.Body.STATIC) lastSafePos = { x: other.position.x, y: other.topY + 1.5, z: other.position.z };
                    }
                }
            }
            if (onGround) coyoteTimer = COYOTE_FRAMES; else if (coyoteTimer > 0) coyoteTimer--;
            canJump = coyoteTimer > 0; groundedNow = onGround; groundPlatform = gPlat;
            const velY = sphereBody.velocity.y;
            if (!wasOnGround && onGround && lastVelY < -8) {
                const k = Math.min(1, Math.abs(lastVelY) / 30); AudioEngine.playLand(k);
                if (lastVelY < -10) {
                    ballSquash.y = 0.7; ballSquash.x = 1.25;
                    spawnRing(sphereBody.position, 0xffffff, Math.min(1.6, Math.abs(lastVelY) * 0.05));
                    spawnPuffs(sphereBody.position, Math.min(12, Math.floor(Math.abs(lastVelY) * 0.35)), 0xffffff, 5);
                    if (lastVelY < -28) { landingDip = Math.min(0.28, (Math.abs(lastVelY) - 28) * 0.015); vibrate(15); }
                }
            }
            wasOnGround = onGround; lastVelY = velY;
        });

        const torqueAmount = 80, forceAmount = 150, maxVelocity = 25;

        function respawnAt(pos, resetScoreTo) {
            sphereBody.position.set(isNaN(pos.x) ? 0 : pos.x, isNaN(pos.y) ? 5 : pos.y, isNaN(pos.z) ? 0 : pos.z);
            sphereBody.velocity.set(0, 0, 0); sphereBody.angularVelocity.set(0, 0, 0); sphereBody.torque.set(0, 0, 0); sphereBody.force.set(0, 0, 0); sphereBody.wakeUp();
            ballGroup.position.copy(sphereBody.position); sphereMesh.quaternion.copy(sphereBody.quaternion); camYaw = Math.PI;
            syncCameraToBall();
            if (resetScoreTo !== undefined) { highestScore = Math.max(0, resetScoreTo); displayedScore = highestScore; $('score').textContent = highestScore; }
            resetParticles(sphereBody.position.x, sphereBody.position.y, sphereBody.position.z);
            spawnPuffs(sphereBody.position, 10, 0xffffff, 3);
        }
        function triggerRespawn(manual = false, cause = 'fall') {
            AudioEngine.playDeath(); flashScreen(); vibrate([40, 30, 60]); if (window.Multiplayer && Multiplayer.connected) Multiplayer.broadcastEvent('respawn', { alt: highestScore });
            const m = MODE();
            if (m.fall === 'gameover') { endRun(cause); return; }
            if (m.fall === 'safe') { respawnAt({ x: lastSafePos.x, y: lastSafePos.y + 2, z: lastSafePos.z }); if (!manual) showEvent(`${icon('lotus')} Respiro profondo… si riparte`, 'good', 1400); return; }
            respawnAt({ x: lastCheckpoint.x, y: lastCheckpoint.y + 4, z: lastCheckpoint.z }, Math.floor(lastCheckpoint.y));
            if (!manual) showEvent(`${icon('restart')} Torni all'ultimo checkpoint`, 'bad', 1400);
        }

        function updatePhysics() {
            prevBallPos.copy(sphereBody.position);
            prevBallQuat.copy(sphereBody.quaternion);

            const time = performance.now() * 0.002;
            for (const obs of movingObstacles) {
                if (obs.kind === 'laser_rotor') {
                    obs.body.angularVelocity.set(0, (obs.deadly ? 2.8 : 2.1) * obs.speed, 0);
                    const yOff = Math.sin(time * 2.2 + obs.timeOffset) * 0.05;
                    obs.body.velocity.y = ((obs.baseY + yOff) - obs.body.position.y) * 10;
                } else if (obs.kind === 'stomp') {
                    const cycle = 3.4;
                    const phase = ((time * (obs.speed * 0.72) + obs.timeOffset) % cycle) / cycle;
                    let yOff = 0;
                    if (phase < 0.45) {
                        const t = phase / 0.45;
                        yOff = Math.sin(t * Math.PI * 0.5) * obs.stompLift;
                    } else if (phase < 0.65) {
                        yOff = obs.stompLift + Math.sin(time * 35) * 0.04;
                        if (obs.mesh && obs.mesh.userData.siren) {
                            obs.mesh.userData.siren.material.emissiveIntensity = 2.4 + Math.sin(time * 30) * 1.6;
                        }
                    } else if (phase < 0.72) {
                        const t = (phase - 0.65) / 0.07;
                        yOff = obs.stompLift * (1 - Math.pow(t, 2.5));
                    } else {
                        yOff = 0;
                        if (obs.wasInAir) {
                            obs.wasInAir = false;
                            spawnRing(obs.body.position, obs.deadly ? 0xff2e63 : 0xffb830, 1.4);
                            spawnPuffs(obs.body.position, 6, obs.deadly ? 0xff4070 : 0xffd060, 4);
                            if (Math.hypot(sphereBody.position.x - obs.body.position.x, sphereBody.position.z - obs.body.position.z) < 22) {
                                screenShakeIntensity = Math.max(screenShakeIntensity, 0.16);
                                AudioEngine.playLand(0.85);
                            }
                        }
                    }
                    if (phase < 0.65) obs.wasInAir = true;
                    const targetY = obs.baseY + yOff;
                    obs.body.velocity.x = (obs.baseX - obs.body.position.x) * 14;
                    obs.body.velocity.y = (targetY - obs.body.position.y) * 20;
                    obs.body.velocity.z = (obs.baseZ - obs.body.position.z) * 14;
                } else if (obs.kind === 'plasma_mine') {
                    const a = time * obs.speed * 0.85 + obs.timeOffset;
                    const tx = obs.baseX + Math.sin(a) * obs.amp;
                    const tz = obs.baseZ + Math.sin(a * 2) * (obs.amp * 0.65);
                    const ty = obs.baseY + Math.sin(time * 2.8 + obs.timeOffset) * 0.28;
                    obs.body.velocity.x = (tx - obs.body.position.x) * 14;
                    obs.body.velocity.y = (ty - obs.body.position.y) * 14;
                    obs.body.velocity.z = (tz - obs.body.position.z) * 14;
                } else if (obs.kind === 'pendulum') {
                    const swingAng = Math.sin(time * obs.speed * 1.15 + obs.timeOffset) * 0.88;
                    const arm = 4.6;
                    const tx = obs.baseX + Math.sin(swingAng) * arm * obs.dirX;
                    const tz = obs.baseZ + Math.sin(swingAng) * arm * obs.dirZ;
                    const ty = (obs.baseY + 4.2) - Math.cos(swingAng) * arm;
                    obs.body.velocity.x = (tx - obs.body.position.x) * 16;
                    obs.body.velocity.y = (ty - obs.body.position.y) * 16;
                    obs.body.velocity.z = (tz - obs.body.position.z) * 16;
                    obs.body.quaternion.setFromAxisAngle(new CANNON.Vec3(obs.dirZ, 0, -obs.dirX), swingAng);
                } else if (obs.kind === 'spin') {
                    obs.body.angularVelocity.set(0, 2.3 * obs.speed, 0);
                    const yOff = Math.sin(time * 2.5 + obs.timeOffset) * 0.07;
                    obs.body.velocity.y = ((obs.baseY + yOff) - obs.body.position.y) * 10;
                } else if (obs.kind === 'bob') {
                    const s = Math.sin(time * obs.speed + obs.timeOffset);
                    const eased = Math.sign(s) * Math.pow(Math.abs(s), 0.65);
                    const y = (obs.baseY || obs.body.position.y) + eased * (obs.ampY || 0.95);
                    obs.body.velocity.x = (obs.baseX - obs.body.position.x) * 14;
                    obs.body.velocity.y = (y - obs.body.position.y) * 14;
                    obs.body.velocity.z = (obs.baseZ - obs.body.position.z) * 14;
                    obs.body.angularVelocity.set(0, 1.2 * Math.cos(time * obs.speed + obs.timeOffset), 0);
                } else if (obs.kind === 'orbit') {
                    const a = time * obs.speed + obs.timeOffset;
                    const tx = obs.baseX + Math.cos(a) * obs.amp, tz = obs.baseZ + Math.sin(a) * obs.amp;
                    obs.body.velocity.x = (tx - obs.body.position.x) * 16;
                    obs.body.velocity.z = (tz - obs.body.position.z) * 16;
                    if (!obs.isPlatform) obs.body.quaternion.setFromAxisAngle(upAxis, -a);
                } else if (obs.kind === 'sweep') {
                    const raw = Math.sin(time * obs.speed * 0.92 + obs.timeOffset);
                    const s = (Math.tanh(raw * 2.4) / 0.98367) * obs.amp;
                    obs.body.velocity.x = ((obs.baseX + obs.dirX * s) - obs.body.position.x) * 16;
                    obs.body.velocity.z = ((obs.baseZ + obs.dirZ * s) - obs.body.position.z) * 16;
                    if (!obs.isPlatform) obs.body.angularVelocity.set(0, Math.cos(time * obs.speed * 0.92 + obs.timeOffset) * 2.2, 0);
                } else {
                    const s = Math.sin(time * obs.speed + obs.timeOffset) * obs.amp;
                    obs.body.velocity.x = ((obs.baseX + obs.dirX * s) - obs.body.position.x) * 14;
                    obs.body.velocity.z = ((obs.baseZ + obs.dirZ * s) - obs.body.position.z) * 14;
                }
            }

            if (groundedNow && groundPlatform && groundPlatform.type === CANNON.Body.KINEMATIC) {
                sphereBody.position.x += groundPlatform.velocity.x * (1 / 60);
                sphereBody.position.z += groundPlatform.velocity.z * (1 / 60);
            }

            world.step(1 / 60);
            if (isNaN(sphereBody.position.x) || isNaN(sphereBody.position.y) || isNaN(sphereBody.position.z)) { triggerRespawn(); return; }
            const gpData = processGamepad();
            if (jumpBufferTimer > 0) jumpBufferTimer--;
            if (screenShakeIntensity > 0) screenShakeIntensity *= 0.75;

            for (const obs of movingObstacles) {
                obs.mesh.position.copy(obs.body.position); obs.mesh.quaternion.copy(obs.body.quaternion);
                if (obs.mesh.userData.innerRing) {
                    obs.mesh.userData.innerRing.rotation.x += 0.04 * obs.speed;
                    obs.mesh.userData.outerRing.rotation.z -= 0.032 * obs.speed;
                    if (obs.mesh.userData.core) {
                        const pulse = 1 + Math.sin(time * 4 + obs.timeOffset) * 0.12;
                        obs.mesh.userData.core.scale.set(pulse, pulse, pulse);
                    }
                }
                if (obs.mesh.userData.visor) {
                    obs.mesh.userData.visor.material.opacity = 0.75 + Math.sin(time * 6 + obs.timeOffset) * 0.25;
                }
            }
            for (const prop of sceneProps) prop.rotation.y += prop.userData.spin || 0.01;
            for (const lm of landmarks) { const sp = lm.userData.spin; if (sp) { (lm.userData.spinTarget || [lm]).forEach(t => { t.rotation.y += sp; }); if (lm.userData.rings) lm.children.forEach((r, i) => { if (r.userData.spinAxis !== undefined) { r.rotation.x += sp * (i % 2 ? 1 : -0.6); r.rotation.z += sp * 0.5; } }); } if (lm.userData.pulse) lm.userData.pulse.material.emissiveIntensity = 1.2 + Math.sin(time * 3) * 0.5; }

            if (gameState === 'playing') {
                const forwardX = -Math.sin(camYaw), forwardZ = -Math.cos(camYaw), rightX = Math.cos(camYaw), rightZ = -Math.sin(camYaw);
                let moveX = 0, moveZ = 0;
                if (keys.w) { moveX += forwardX; moveZ += forwardZ; } if (keys.s) { moveX -= forwardX; moveZ -= forwardZ; }
                if (keys.a) { moveX -= rightX; moveZ -= rightZ; } if (keys.d) { moveX += rightX; moveZ += rightZ; }
                let inputStrength = 1, speedFactor = window._speedMult || 1;
                if (joystickData.active || gpData.active) {
                    const isGamepad = gpData.active && !joystickData.active; speedFactor *= isGamepad ? 1.0 : 0.45;
                    const rawX = joystickData.active ? joystickData.x : gpData.x, rawY = joystickData.active ? -joystickData.y : gpData.y;
                    const inputX = isGamepad ? rawX : rawX * Math.abs(rawX), inputY = isGamepad ? rawY : rawY * Math.abs(rawY);
                    moveX = forwardX * inputY + rightX * inputX; moveZ = forwardZ * inputY + rightZ * inputX; inputStrength = Math.min(1, Math.sqrt(inputX ** 2 + inputY ** 2));
                }
                if (moveX !== 0 || moveZ !== 0) {
                    if (!joystickData.active && !gpData.active) { const len = Math.sqrt(moveX * moveX + moveZ * moveZ); moveX /= len; moveZ /= len; }
                    sphereBody.torque.x += moveZ * torqueAmount * inputStrength * speedFactor; sphereBody.torque.z += -moveX * torqueAmount * inputStrength * speedFactor;
                    sphereBody.applyForce(new CANNON.Vec3(moveX * forceAmount * inputStrength * speedFactor, 0, moveZ * forceAmount * inputStrength * speedFactor), sphereBody.position);
                    tutorialOnMove();
                }
                if (keys.space) jumpBufferTimer = JUMP_BUFFER_FRAMES;
                if (jumpBufferTimer > 0 && canJump) {
                    sphereBody.velocity.y = 22; AudioEngine.playJump(); ballSquash.y = 1.3; ballSquash.x = 0.85;
                    spawnPuffs(sphereBody.position, 5, 0xffffff, 3); vibrate(8);
                    canJump = false; coyoteTimer = 0; jumpBufferTimer = 0; keys.space = false;
                    tutorialOnJump();
                }
            }
            const speed = Math.sqrt(sphereBody.velocity.x ** 2 + sphereBody.velocity.z ** 2);
            if (speed > maxVelocity) { const ratio = maxVelocity / speed; sphereBody.velocity.x *= ratio; sphereBody.velocity.z *= ratio; }
            if (gameState === 'playing') {
                Audio.roll(speed, groundedNow);
                if (groundedNow && speed > 15 && Math.random() < 0.25) {
                    spawnPuffs({ x: sphereBody.position.x, y: sphereBody.position.y - radius * 0.7, z: sphereBody.position.z }, 1, BIOMES[currentVisualBiome]?.accent || 0xffffff, 2.2);
                }
            }
            currBallPos.copy(sphereBody.position);
            currBallQuat.copy(sphereBody.quaternion);
            if (gameState === 'skins') { sphereMesh.rotation.y += 0.012; sphereMesh.rotation.x += 0.004; }
        }
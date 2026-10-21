/* ==========================================================================
   MODULO MULTIGIOCATORE ONLINE PEER-TO-PEER (WebRTC + PeerJS)
   - Connessione diretta browser-to-browser senza server centrale
   - Creazione stanze con codice alfanumerico breve normalizzato (es. OB-8K4F)
   - Auto-retry in caso di latenza del signaling server WebRTC
   - Sincronizzazione seed percorso (stessa mappa), 30Hz posizione, rotazione, skin e quota
   - Sfera avversario 3D con illuminazione dedicata, interpolazione 60 FPS e nametag olografico
   - HUD Gara con distacco live e notifiche tempo reale (cadute, checkpoint, vittoria)
   ========================================================================== */

const Multiplayer = {
    peer: null,
    conn: null,
    isHost: false,
    cleanCode: null,
    roomCode: null,
    connected: false,
    opponent: null,
    lastSendTime: 0,
    sendInterval: 1000 / 30, // 30 FPS sync
    activeJoinTimeout: null,

    // Normalizza qualsiasi input utente: "8K4F", "ob-8k4f", "OB 8K4F" -> "8K4F"
    normalizeRoomCode(raw) {
        if (!raw) return '';
        let clean = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (clean.startsWith('OB')) clean = clean.slice(2);
        return clean;
    },

    formatRoomCode(clean) {
        return 'OB-' + clean;
    },

    getPeerId(clean) {
        return 'onlyball-v2-' + clean.toLowerCase();
    },

    generateCleanCode() {
        // Caratteri alfanumerici non ambigui (omessi 0/O e 1/I)
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    },

    initPeer(customId, onOpen, onError) {
        if (this.peer && !this.peer.destroyed) {
            try { this.peer.destroy(); } catch (e) {}
        }
        this.peer = null;

        try {
            const peerOptions = {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            };

            this.peer = customId ? new Peer(customId, peerOptions) : new Peer(peerOptions);

            this.peer.on('open', (id) => {
                console.log('[P2P] Peer pronto con ID:', id);
                if (onOpen) onOpen(id);
            });

            this.peer.on('error', (err) => {
                console.warn('[P2P] Peer error:', err && err.type ? err.type : err);
                if (onError) onError(err);
            });
        } catch (e) {
            console.error('[P2P] Inizializzazione PeerJS fallita:', e);
            if (onError) onError(e);
        }
    },

    createRoom(onCodeReady, onHostReady, onGuestJoin, onError) {
        this.cleanCode = this.generateCleanCode();
        this.roomCode = this.formatRoomCode(this.cleanCode);
        this.isHost = true;
        const peerId = this.getPeerId(this.cleanCode);

        // Comunica subito il codice all'interfaccia senza attendere la rete
        if (onCodeReady) onCodeReady(this.roomCode);

        this.initPeer(peerId, () => {
            console.log('[P2P] Stanza host creata con ID:', peerId);
            if (onHostReady) onHostReady(this.roomCode);

            this.peer.on('connection', (dataConn) => {
                console.log('[P2P] Connessione in arrivo da ospite:', dataConn.peer);
                this.conn = dataConn;
                this.setupConnection(onGuestJoin, onError);
            });
        }, (err) => {
            if (err && err.type === 'unavailable-id') {
                console.warn('[P2P] ID già in uso, rigenerazione...');
                this.createRoom(onCodeReady, onHostReady, onGuestJoin, onError);
            } else if (onError) {
                onError(err);
            }
        });
    },

    joinRoom(rawCode, onJoined, onProgress, onError) {
        const clean = this.normalizeRoomCode(rawCode);
        if (!clean || clean.length < 3) {
            if (onError) onError(new Error('Inserisci un codice valido (es. OB-8K4F o 8K4F)'));
            return;
        }

        this.cleanCode = clean;
        this.roomCode = this.formatRoomCode(clean);
        this.isHost = false;
        const targetPeerId = this.getPeerId(clean);

        if (this.activeJoinTimeout) {
            clearTimeout(this.activeJoinTimeout);
            this.activeJoinTimeout = null;
        }

        // Inizializza peer ospite anonimo
        this.initPeer(null, () => {
            let attempt = 0;
            const maxAttempts = 4;
            let joinFinished = false;

            const tryConnect = () => {
                if (joinFinished || this.connected) return;
                attempt++;
                if (onProgress) {
                    onProgress(`Connessione alla stanza ${this.roomCode}... (tentativo ${attempt}/${maxAttempts})`);
                }
                console.log(`[P2P] Connessione all'host ${targetPeerId} (tentativo ${attempt}/${maxAttempts})...`);

                const dataConn = this.peer.connect(targetPeerId, { reliable: true });
                this.conn = dataConn;

                let attemptCompleted = false;

                const disarmAttempt = () => {
                    attemptCompleted = true;
                    joinFinished = true;
                    clearTimeout(attemptTimer);
                    if (this.activeJoinTimeout) {
                        clearTimeout(this.activeJoinTimeout);
                        this.activeJoinTimeout = null;
                    }
                    if (this.peer) this.peer.off('error', peerErrorHandler);
                };

                // Timeout generoso per la negoziazione WebRTC tra reti diverse (es. mobile e WiFi)
                const attemptTimer = setTimeout(() => {
                    if (attemptCompleted || joinFinished || this.connected) return;
                    attemptCompleted = true;
                    console.warn(`[P2P] Tentativo ${attempt} scaduto (timeout WebRTC 15s)`);
                    nextOrExit('Timeout connessione');
                }, 15000);

                const peerErrorHandler = (err) => {
                    if (attemptCompleted || joinFinished || this.connected) return;
                    if (err && err.type === 'peer-unavailable') {
                        attemptCompleted = true;
                        clearTimeout(attemptTimer);
                        this.peer.off('error', peerErrorHandler);
                        console.log(`[P2P] Host non ancora visibile sul signaling server...`);
                        nextOrExit('Host non ancora registrato');
                    }
                };

                this.peer.on('error', peerErrorHandler);

                dataConn.on('open', () => {
                    disarmAttempt();
                });

                this.setupConnection(() => {
                    disarmAttempt();
                    console.log('[P2P] Connessione riuscita con successo!');
                    if (onJoined) onJoined();
                }, (err) => {
                    if (attemptCompleted || joinFinished || this.connected) return;
                    attemptCompleted = true;
                    clearTimeout(attemptTimer);
                    this.peer.off('error', peerErrorHandler);
                    nextOrExit(err);
                });
            };

            const nextOrExit = (reason) => {
                if (this.connected || joinFinished) return;
                if (attempt < maxAttempts) {
                    console.log(`[P2P] Nuovo tentativo tra 1200ms... (motivo: ${reason})`);
                    this.activeJoinTimeout = setTimeout(tryConnect, 1200);
                } else {
                    joinFinished = true;
                    if (onError) {
                        onError(new Error(`Stanza ${this.roomCode} non trovata. Controlla il codice o assicurati che l'amico abbia il gioco aperto.`));
                    }
                }
            };

            tryConnect();
        }, onError);
    },

    setupConnection(onReady, onError) {
        if (!this.conn) return;

        let opened = false;
        const onOpen = () => {
            if (opened) return;
            opened = true;
            this.connected = true;
            console.log('[P2P] DataChannel aperto. isHost:', this.isHost);

            if (this.activeJoinTimeout) {
                clearTimeout(this.activeJoinTimeout);
                this.activeJoinTimeout = null;
            }

            if (this.isHost) {
                // Host invia il seed casuale condiviso e il proprio nickname/skin
                const sharedSeed = Math.floor(Math.random() * 900000) + 100000;
                const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : 'Host';
                const mySkin = (typeof window.getCurrentSkinKey === 'function') ? window.getCurrentSkinKey() : 'brand';

                console.log('[P2P] Host invia handshake al guest:', { seed: sharedSeed, name: myName, skin: mySkin });
                try {
                    this.conn.send({
                        type: 'handshake',
                        seed: sharedSeed,
                        name: myName,
                        skin: mySkin
                    });
                } catch (e) {
                    console.error('[P2P] Errore invio handshake:', e);
                }
            }
        };

        if (this.conn.open) {
            onOpen();
        } else {
            this.conn.on('open', onOpen);
        }

        this.conn.on('data', (data) => {
            this.handleMessage(data, onReady);
        });

        this.conn.on('close', () => {
            this.handleDisconnect();
        });

        this.conn.on('error', (err) => {
            console.warn('[P2P] Conn error:', err);
            if (onError) onError(err);
        });
    },

    handleMessage(data, onReady) {
        if (!data || !data.type) return;

        if (data.type === 'handshake') {
            console.log('[P2P] Ricevuto handshake dall\'host:', data);
            const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : 'Ospite';
            const mySkin = (typeof window.getCurrentSkinKey === 'function') ? window.getCurrentSkinKey() : 'brand';

            try {
                this.conn.send({
                    type: 'handshake_ack',
                    name: myName,
                    skin: mySkin
                });
            } catch (e) {
                console.error('[P2P] Errore invio handshake_ack:', e);
            }

            this.startMultiplayerMatch(data.seed, data.name, data.skin);
            if (onReady) onReady();
        } else if (data.type === 'handshake_ack') {
            console.log('[P2P] Host ha ricevuto conferma dal guest:', data);
            this.startMultiplayerMatch(null, data.name, data.skin);
            if (onReady) onReady();
        } else if (data.type === 'state') {
            this.updateOpponentState(data);
        } else if (data.type === 'event') {
            this.handleRemoteEvent(data);
        }
    },

    startMultiplayerMatch(seed, oppName, oppSkin) {
        console.log('[P2P] Avvio match multiplayer con:', oppName, oppSkin);
        this.spawnOpponent(oppName || 'Sfidante', oppSkin || 'brand');

        // Se guest, sincronizza il seed del mondo in modo che le piattaforme siano identiche
        if (seed != null) {
            rng = makeRng(seed);
        }

        // Chiudi modali e avvia la partita se in menu
        if ($('multiplayer-modal')) $('multiplayer-modal').classList.add('hidden');
        if (gameState !== 'playing') {
            fullGameReset();
            startGame();
        }

        // Mostra HUD gara
        const raceBadge = $('hud-p2p-race');
        if (raceBadge) {
            raceBadge.classList.remove('hidden');
            if ($('hud-p2p-name')) $('hud-p2p-name').textContent = this.opponent ? this.opponent.name : 'Avversario';
        }

        showEvent(`Sfida Online Avviata contro ${this.opponent ? this.opponent.name : 'Avversario'}!`, 'good', 2400);
        AudioEngine.playRecord();
    },

    spawnOpponent(name, skinKey) {
        this.despawnOpponent();

        const group = new THREE.Group();
        // Spawna alla quota iniziale di caduta del player (y = 5) e non dentro la piattaforma sottoterra (y = 0)
        group.position.set(0, 5, 0);

        const ballRadius = (typeof radius !== 'undefined') ? radius : 0.8;
        const mat = (typeof window.getBallMaterial === 'function')
            ? window.getBallMaterial(skinKey)
            : new THREE.MeshStandardMaterial({ color: 0x37e0b0, roughness: 0.4, metalness: 0.1 });

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 36, 36), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // Luce d'accento olografica per rendere la sfera avversaria sempre brillante e visibile
        const oppLight = new THREE.PointLight(0x37e0b0, 0.9, 14);
        oppLight.position.y = 0.4;
        group.add(oppLight);

        // Nametag 3D olografico
        const nametag = this.createNametagSprite(name);
        group.add(nametag);

        scene.add(group);

        this.opponent = {
            name,
            skinKey,
            group,
            mesh,
            oppLight,
            nametag,
            targetPos: new THREE.Vector3(0, 5, 0),
            targetQuat: new THREE.Quaternion(),
            alt: 0
        };
    },

    despawnOpponent() {
        if (this.opponent && this.opponent.group) {
            scene.remove(this.opponent.group);
            if (this.opponent.nametag && this.opponent.nametag.material.map) {
                this.opponent.nametag.material.map.dispose();
            }
        }
        this.opponent = null;
        if ($('hud-p2p-race')) $('hud-p2p-race').classList.add('hidden');
    },

    createNametagSprite(name) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(12, 16, 36, 0.85)';
        ctx.strokeStyle = '#37e0b0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(8, 8, 240, 48, 24);
        else ctx.rect(8, 8, 240, 48);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 24px Fredoka, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((name || 'Ospite').slice(0, 14), 128, 33);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(3.2, 0.8, 1);
        sprite.position.y = 1.6;
        return sprite;
    },

    updateOpponentState(data) {
        if (!this.opponent) return;
        if (data.x != null && !isNaN(data.x) && !isNaN(data.y) && !isNaN(data.z)) {
            this.opponent.targetPos.set(data.x, data.y, data.z);
        }
        if (data.qx != null && !isNaN(data.qx) && !isNaN(data.qy) && !isNaN(data.qz) && !isNaN(data.qw)) {
            this.opponent.targetQuat.set(data.qx, data.qy, data.qz, data.qw);
        }
        this.opponent.alt = data.alt || 0;

        // Aggiorna indicatore di quota e delta nell'HUD
        const altEl = $('hud-p2p-alt');
        const deltaEl = $('hud-p2p-delta');
        if (altEl) altEl.textContent = Math.floor(this.opponent.alt) + 'm';
        if (deltaEl) {
            const delta = Math.floor(highestScore - this.opponent.alt);
            if (delta >= 0) {
                deltaEl.textContent = `(+${delta}m)`;
                deltaEl.className = 'p2p-delta ahead';
            } else {
                deltaEl.textContent = `(${delta}m)`;
                deltaEl.className = 'p2p-delta behind';
            }
        }
    },

    handleRemoteEvent(data) {
        const name = this.opponent ? this.opponent.name : 'Avversario';
        if (data.event === 'respawn') {
            showEvent(`${name} è caduto all'ultimo checkpoint!`, 'bad', 1800);
            AudioEngine.playLand(0.6);
        } else if (data.event === 'checkpoint') {
            showEvent(`${name} ha superato il Checkpoint a ${data.alt}m!`, 'good', 1800);
            AudioEngine.playCheckpoint();
        } else if (data.event === 'win') {
            showEvent(`🏆 ${name} ha raggiunto la vetta a 1000m!`, 'good', 3500);
            AudioEngine.playWin();
        }
    },

    broadcastState() {
        if (!this.connected || !this.conn || this.conn.open !== true) return;
        if (typeof sphereBody === 'undefined' || !sphereBody) return;

        const now = performance.now();
        if (now - this.lastSendTime < this.sendInterval) return;
        this.lastSendTime = now;

        try {
            this.conn.send({
                type: 'state',
                x: sphereBody.position.x,
                y: sphereBody.position.y,
                z: sphereBody.position.z,
                qx: sphereBody.quaternion.x,
                qy: sphereBody.quaternion.y,
                qz: sphereBody.quaternion.z,
                qw: sphereBody.quaternion.w,
                alt: highestScore
            });
        } catch (e) {}
    },

    broadcastEvent(event, extra = {}) {
        if (!this.connected || !this.conn || this.conn.open !== true) return;
        try {
            this.conn.send({
                type: 'event',
                event,
                ...extra
            });
        } catch (e) {}
    },

    update(dt) {
        if (!this.opponent || !this.opponent.group) return;
        // Interpolazione morbida a 60fps
        this.opponent.group.position.lerp(this.opponent.targetPos, 0.35);
        if (this.opponent.mesh) {
            this.opponent.mesh.quaternion.slerp(this.opponent.targetQuat, 0.35);
        }
        // Billboard del nametag verso la telecamera
        if (this.opponent.nametag && typeof camera !== 'undefined' && camera) {
            this.opponent.nametag.quaternion.copy(camera.quaternion);
        }
    },

    handleDisconnect() {
        if (!this.connected) return;
        this.connected = false;
        showEvent('Avversario disconnesso dalla stanza', 'bad', 2400);
        this.despawnOpponent();
    },

    leaveRoom() {
        this.connected = false;
        if (this.activeJoinTimeout) {
            clearTimeout(this.activeJoinTimeout);
            this.activeJoinTimeout = null;
        }
        if (this.conn) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
        }
        if (this.peer && !this.peer.destroyed) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }
        this.despawnOpponent();
    }
};

window.Multiplayer = Multiplayer;

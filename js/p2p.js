/* ==========================================================================
   MODULO MULTIGIOCATORE ONLINE PEER-TO-PEER (WebRTC + PeerJS)
   - Supporto fino a 4 Giocatori contemporanei per stanza (1 Host + fino a 3 Ospiti)
   - Architettura a Stella (Host Relay): solo 1 connessione per ospite, zero lag
   - Codici stanza brevi alfanumerici (es. OB-8K4F o 8K4F)
   - Sincronizzazione seed percorso (stessa mappa procedurale per tutti)
   - Sfera 3D dedicata per ogni avversario con skin, luce olografica e nametag colorato
   - Aggiornamento a 30Hz e interpolazione a 60 FPS con rotazione completa (quaternion)
   - HUD Classifica Gara Live in tempo reale (1°, 2°, 3°, 4° posto con quote e distacchi)
   - Notifiche live di gara: cadute, checkpoint superati e vittoria in vetta a 1000m
   ========================================================================== */

const PLAYER_COLORS = [
    { hex: 0x37e0b0, str: '#37e0b0', name: 'Verde Menta' },  // Giocatore 1 (Host)
    { hex: 0xffa502, str: '#ffa502', name: 'Giallo Sole' },   // Giocatore 2
    { hex: 0xff4757, str: '#ff4757', name: 'Rosso Corallo' }, // Giocatore 3
    { hex: 0x70a1ff, str: '#70a1ff', name: 'Blu Cielo' }      // Giocatore 4
];

const Multiplayer = {
    peer: null,
    isHost: false,
    cleanCode: null,
    roomCode: null,
    connected: false,
    maxPlayers: 4,
    sharedSeed: null,
    myColorIndex: 0,
    myPeerId: null,

    // Se Host: Map(peerId -> { conn, name, skin, colorIndex, alt })
    connections: new Map(),

    // Se Ospite: connessione singola verso l'Host
    hostConn: null,

    // Avversari 3D presenti nella scena: Map(peerId -> opponentObj)
    opponents: new Map(),

    lastSendTime: 0,
    sendInterval: 1000 / 30, // 30 FPS sync
    activeJoinTimeout: null,

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
                this.myPeerId = id;
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

    /* ==========================================================================
       GESTIONE STANZA (HOST)
       ========================================================================== */
    createRoom(onCodeReady, onHostReady, onPlayerUpdate, onError) {
        this.leaveRoom();
        this.cleanCode = this.generateCleanCode();
        this.roomCode = this.formatRoomCode(this.cleanCode);
        this.isHost = true;
        this.myColorIndex = 0;
        this.sharedSeed = Math.floor(Math.random() * 900000) + 100000;
        const peerId = this.getPeerId(this.cleanCode);

        if (onCodeReady) onCodeReady(this.roomCode);

        this.initPeer(peerId, () => {
            console.log('[P2P] Stanza creata dall\'Host con ID:', peerId);
            this.connected = true;
            if (onHostReady) onHostReady(this.roomCode);
            this.updateLobbyUI();

            this.peer.on('connection', (dataConn) => {
                this.handleIncomingGuest(dataConn, onPlayerUpdate);
            });
        }, (err) => {
            if (err && err.type === 'unavailable-id') {
                console.warn('[P2P] ID già in uso, rigenerazione...');
                this.createRoom(onCodeReady, onHostReady, onPlayerUpdate, onError);
            } else if (onError) {
                onError(err);
            }
        });
    },

    handleIncomingGuest(dataConn, onPlayerUpdate) {
        console.log('[P2P] Richiesta connessione da ospite:', dataConn.peer);

        // Controllo capienza massima (max 3 ospiti = 4 giocatori totali)
        if (this.connections.size >= this.maxPlayers - 1) {
            console.warn('[P2P] Stanza piena, rifiuto connessione da:', dataConn.peer);
            dataConn.on('open', () => {
                try {
                    dataConn.send({ type: 'room_full', message: 'Stanza piena (max 4 giocatori)' });
                    setTimeout(() => dataConn.close(), 500);
                } catch (e) {}
            });
            return;
        }

        dataConn.on('open', () => {
            console.log('[P2P] Canale dati aperto con ospite:', dataConn.peer);
        });

        dataConn.on('data', (data) => {
            this.handleHostReceivedData(dataConn, data, onPlayerUpdate);
        });

        dataConn.on('close', () => {
            this.handleGuestDisconnect(dataConn.peer);
        });

        dataConn.on('error', (err) => {
            console.warn('[P2P] Errore connessione ospite:', dataConn.peer, err);
            this.handleGuestDisconnect(dataConn.peer);
        });
    },

    getAvailableColorIndex() {
        const used = new Set([0]); // 0 è sempre l'Host
        for (const guest of this.connections.values()) {
            used.add(guest.colorIndex);
        }
        for (let i = 1; i < this.maxPlayers; i++) {
            if (!used.has(i)) return i;
        }
        return 1;
    },

    handleHostReceivedData(dataConn, data, onPlayerUpdate) {
        if (!data || !data.type) return;

        if (data.type === 'join_request') {
            const guestPeerId = dataConn.peer;
            const guestName = data.name || 'Ospite';
            const guestSkin = data.skin || 'brand';
            const colorIndex = this.getAvailableColorIndex();

            this.connections.set(guestPeerId, {
                conn: dataConn,
                name: guestName,
                skin: guestSkin,
                colorIndex,
                alt: 0
            });

            console.log(`[P2P] Ospite ${guestName} registrato con colore ${colorIndex} (Slot ${this.connections.size + 1}/${this.maxPlayers})`);

            // Spawna la sfera dell'ospite sul client dell'Host
            this.spawnOpponent(guestPeerId, guestName, guestSkin, colorIndex);

            // Costruisci la lista di tutti i giocatori presenti per il nuovo arrivato
            const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : 'Host';
            const mySkin = (typeof window.getCurrentSkinKey === 'function') ? window.getCurrentSkinKey() : 'brand';

            const playerList = [
                { peerId: 'host', name: myName, skin: mySkin, colorIndex: 0, isHost: true }
            ];
            for (const [pid, g] of this.connections.entries()) {
                playerList.push({
                    peerId: pid,
                    name: g.name,
                    skin: g.skin,
                    colorIndex: g.colorIndex,
                    isHost: false
                });
            }

            // Invia conferma e lista partecipanti al nuovo arrivato
            try {
                dataConn.send({
                    type: 'handshake_welcome',
                    seed: this.sharedSeed,
                    yourPeerId: guestPeerId,
                    yourColorIndex: colorIndex,
                    players: playerList,
                    matchRunning: (gameState === 'playing')
                });
            } catch (e) {
                console.error('[P2P] Errore invio handshake_welcome:', e);
            }

            // Notifica tutti gli altri ospiti già connessi dell'arrivo del nuovo giocatore
            this.broadcastToGuests({
                type: 'player_joined',
                peerId: guestPeerId,
                name: guestName,
                skin: guestSkin,
                colorIndex
            }, guestPeerId);

            showEvent(`🎮 ${guestName} è entrato nella stanza!`, 'good', 2200);
            this.updateLobbyUI();
            this.updateLeaderboardHUD();
            if (onPlayerUpdate) onPlayerUpdate();

        } else if (data.type === 'state') {
            const guestPeerId = dataConn.peer;
            this.updateOpponentState(guestPeerId, data);

            const guest = this.connections.get(guestPeerId);
            if (guest) guest.alt = data.alt || 0;

            // Fai da Relay verso tutti gli altri ospiti
            this.broadcastToGuests({
                type: 'relay_state',
                fromPeerId: guestPeerId,
                ...data
            }, guestPeerId);

            this.updateLeaderboardHUD();

        } else if (data.type === 'event') {
            const guestPeerId = dataConn.peer;
            const guest = this.connections.get(guestPeerId);
            const fromName = guest ? guest.name : 'Giocatore';

            this.handleRemoteEvent({ ...data, name: fromName });

            // Fai da Relay dell'evento verso gli altri ospiti
            this.broadcastToGuests({
                type: 'relay_event',
                fromPeerId: guestPeerId,
                fromName,
                ...data
            }, guestPeerId);
        }
    },

    broadcastToGuests(msg, excludePeerId = null) {
        for (const [pid, guest] of this.connections.entries()) {
            if (pid === excludePeerId) continue;
            try {
                if (guest.conn && guest.conn.open) {
                    guest.conn.send(msg);
                }
            } catch (e) {}
        }
    },

    handleGuestDisconnect(peerId) {
        if (!this.connections.has(peerId)) return;
        const guest = this.connections.get(peerId);
        const name = guest ? guest.name : 'Un giocatore';
        this.connections.delete(peerId);
        this.despawnOpponent(peerId);

        console.log(`[P2P] Ospite disconnesso: ${name} (${peerId})`);
        showEvent(`👋 ${name} è uscito dalla stanza`, 'bad', 2200);

        // Notifica gli altri ospiti rimasti
        this.broadcastToGuests({
            type: 'player_left',
            peerId,
            name
        });

        this.updateLobbyUI();
        this.updateLeaderboardHUD();
    },

    /* ==========================================================================
       GESTIONE PARTECIPAZIONE (OSPITE / GUEST)
       ========================================================================== */
    joinRoom(rawCode, onJoined, onProgress, onError) {
        const clean = this.normalizeRoomCode(rawCode);
        if (!clean || clean.length < 3) {
            if (onError) onError(new Error('Inserisci un codice valido (es. OB-8K4F o 8K4F)'));
            return;
        }

        this.leaveRoom();
        this.cleanCode = clean;
        this.roomCode = this.formatRoomCode(clean);
        this.isHost = false;
        const targetPeerId = this.getPeerId(clean);

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
                console.log(`[P2P] Connessione all'Host ${targetPeerId} (tentativo ${attempt}/${maxAttempts})...`);

                const dataConn = this.peer.connect(targetPeerId, { reliable: true });
                this.hostConn = dataConn;

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
                    this.connected = true;
                    console.log('[P2P] Canale dati verso Host aperto con successo!');

                    // Invia richiesta di ingresso con nickname e skin
                    const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : 'Ospite';
                    const mySkin = (typeof window.getCurrentSkinKey === 'function') ? window.getCurrentSkinKey() : 'brand';

                    try {
                        dataConn.send({
                            type: 'join_request',
                            name: myName,
                            skin: mySkin
                        });
                    } catch (e) {
                        console.error('[P2P] Errore invio join_request:', e);
                    }

                    if (onJoined) onJoined();
                });

                dataConn.on('data', (data) => {
                    this.handleGuestReceivedData(data);
                });

                dataConn.on('close', () => {
                    this.handleHostDisconnected();
                });

                dataConn.on('error', (err) => {
                    console.warn('[P2P] Errore connessione Host:', err);
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

    handleGuestReceivedData(data) {
        if (!data || !data.type) return;

        if (data.type === 'handshake_welcome') {
            console.log('[P2P] Handshake ricevuto dall\'Host:', data);
            this.sharedSeed = data.seed;
            this.myColorIndex = data.yourColorIndex || 1;

            if (data.seed != null) {
                rng = makeRng(data.seed);
            }

            // Spawna tutti gli altri giocatori già presenti nella stanza
            if (Array.isArray(data.players)) {
                for (const p of data.players) {
                    if (p.peerId !== this.myPeerId) {
                        this.spawnOpponent(p.peerId, p.name, p.skin, p.colorIndex);
                    }
                }
            }

            this.updateLobbyUI(data.players);
            this.updateLeaderboardHUD();

            if (data.matchRunning) {
                this.startMultiplayerMatch();
            } else {
                const statusEl = $('mp-join-status');
                if (statusEl) {
                    statusEl.innerHTML = `<span class="status-dot" style="background:var(--mint)"></span> Connesso! In attesa che l'Host avvii la gara...`;
                }
            }

        } else if (data.type === 'player_joined') {
            console.log('[P2P] Nuovo giocatore entrato nella stanza:', data.name);
            this.spawnOpponent(data.peerId, data.name, data.skin, data.colorIndex);
            showEvent(`🎮 ${data.name} è entrato nella stanza!`, 'good', 2200);
            this.updateLeaderboardHUD();

        } else if (data.type === 'player_left') {
            console.log('[P2P] Giocatore uscito:', data.name);
            this.despawnOpponent(data.peerId);
            showEvent(`👋 ${data.name} è uscito dalla stanza`, 'bad', 2200);
            this.updateLeaderboardHUD();

        } else if (data.type === 'start_match') {
            console.log('[P2P] L\'Host ha avviato la gara!');
            this.startMultiplayerMatch();

        } else if (data.type === 'state') {
            // Stato proveniente dall'Host
            this.updateOpponentState('host', data);
            this.updateLeaderboardHUD();

        } else if (data.type === 'relay_state') {
            // Stato proveniente da un altro ospite e ritrasmesso dall'Host
            this.updateOpponentState(data.fromPeerId, data);
            this.updateLeaderboardHUD();

        } else if (data.type === 'event' || data.type === 'relay_event') {
            this.handleRemoteEvent(data);

        } else if (data.type === 'room_full') {
            showEvent(data.message || 'Stanza piena (max 4 giocatori)', 'bad', 3500);
            this.leaveRoom();
        }
    },

    handleHostDisconnected() {
        if (!this.connected) return;
        this.connected = false;
        showEvent('L\'Host ha chiuso la stanza di gioco', 'bad', 3000);
        this.despawnAllOpponents();
    },

    /* ==========================================================================
       AVVIO GARA E STATI DI GIOCO
       ========================================================================== */
    startMatchAsHost() {
        if (!this.isHost) return;
        this.broadcastToGuests({ type: 'start_match' });
        this.startMultiplayerMatch();
    },

    startMultiplayerMatch() {
        console.log('[P2P] Avvio partita multigiocatore!');

        if ($('multiplayer-modal')) $('multiplayer-modal').classList.add('hidden');

        if (gameState !== 'playing') {
            fullGameReset();
            startGame();
        }

        const lbEl = $('hud-p2p-leaderboard');
        if (lbEl) lbEl.classList.remove('hidden');

        const totalPlayers = (this.isHost ? this.connections.size : this.opponents.size) + 1;
        showEvent(`🏁 Gara Avviata! ${totalPlayers} Giocatori in pista!`, 'good', 2500);
        AudioEngine.playRecord();
        this.updateLeaderboardHUD();
    },

    /* ==========================================================================
       SPAWN / DESPAWN MODELLI 3D AVVERSARI
       ========================================================================== */
    spawnOpponent(id, name, skinKey, colorIndex = 1) {
        this.despawnOpponent(id);

        const group = new THREE.Group();
        group.position.set(0, 5, 0);

        const ballRadius = (typeof radius !== 'undefined') ? radius : 0.8;
        const colorDef = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];

        const mat = (typeof window.getBallMaterial === 'function')
            ? window.getBallMaterial(skinKey)
            : new THREE.MeshStandardMaterial({ color: colorDef.hex, roughness: 0.4, metalness: 0.1 });

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 36, 36), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // Luce d'accento olografica con il colore distintivo del giocatore
        const oppLight = new THREE.PointLight(colorDef.hex, 0.95, 14);
        oppLight.position.y = 0.4;
        group.add(oppLight);

        // Nametag 3D olografico bordato con il colore assegnato
        const nametag = this.createNametagSprite(name, colorDef.str);
        group.add(nametag);

        scene.add(group);

        this.opponents.set(id, {
            id,
            name,
            skinKey,
            colorDef,
            group,
            mesh,
            oppLight,
            nametag,
            targetPos: new THREE.Vector3(0, 5, 0),
            targetQuat: new THREE.Quaternion(),
            alt: 0
        });

        console.log(`[P2P] Sfera 3D creata per ${name} (${id}) con colore ${colorDef.name}`);
    },

    despawnOpponent(id) {
        if (!this.opponents.has(id)) return;
        const opp = this.opponents.get(id);
        if (opp.group) {
            scene.remove(opp.group);
            if (opp.nametag && opp.nametag.material && opp.nametag.material.map) {
                opp.nametag.material.map.dispose();
            }
        }
        this.opponents.delete(id);
    },

    despawnAllOpponents() {
        for (const id of this.opponents.keys()) {
            this.despawnOpponent(id);
        }
        this.opponents.clear();
        const lbEl = $('hud-p2p-leaderboard');
        if (lbEl) lbEl.classList.add('hidden');
    },

    createNametagSprite(name, borderColor = '#37e0b0') {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(12, 16, 36, 0.88)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3.5;
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

    updateOpponentState(id, data) {
        const opp = this.opponents.get(id);
        if (!opp) return;

        if (data.x != null && !isNaN(data.x) && !isNaN(data.y) && !isNaN(data.z)) {
            opp.targetPos.set(data.x, data.y, data.z);
        }
        if (data.qx != null && !isNaN(data.qx) && !isNaN(data.qy) && !isNaN(data.qz) && !isNaN(data.qw)) {
            opp.targetQuat.set(data.qx, data.qy, data.qz, data.qw);
        }
        opp.alt = data.alt || 0;
    },

    handleRemoteEvent(data) {
        const name = data.fromName || data.name || 'Un avversario';
        if (data.event === 'respawn') {
            showEvent(`💀 ${name} è caduto all'ultimo checkpoint!`, 'bad', 2000);
            AudioEngine.playLand(0.6);
        } else if (data.event === 'checkpoint') {
            showEvent(`🚩 ${name} ha superato il Checkpoint a ${data.alt}m!`, 'good', 2000);
            AudioEngine.playCheckpoint();
        } else if (data.event === 'win') {
            showEvent(`🏆 ${name} ha raggiunto la vetta a 1000m!`, 'gold', 4000);
            AudioEngine.playWin();
        }
    },

    /* ==========================================================================
       BROADCAST COORDINATE E LOOP A 60 FPS
       ========================================================================== */
    broadcastState() {
        if (!this.connected) return;
        if (typeof sphereBody === 'undefined' || !sphereBody) return;

        const now = performance.now();
        if (now - this.lastSendTime < this.sendInterval) return;
        this.lastSendTime = now;

        const statePayload = {
            type: 'state',
            x: sphereBody.position.x,
            y: sphereBody.position.y,
            z: sphereBody.position.z,
            qx: sphereBody.quaternion.x,
            qy: sphereBody.quaternion.y,
            qz: sphereBody.quaternion.z,
            qw: sphereBody.quaternion.w,
            alt: highestScore
        };

        if (this.isHost) {
            // L'Host invia a tutti gli ospiti collegati
            this.broadcastToGuests(statePayload);
        } else if (this.hostConn && this.hostConn.open) {
            // L'Ospite invia all'Host
            try { this.hostConn.send(statePayload); } catch (e) {}
        }
    },

    broadcastEvent(event, extra = {}) {
        if (!this.connected) return;
        const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : (this.isHost ? 'Host' : 'Ospite');
        const eventPayload = {
            type: 'event',
            event,
            fromName: myName,
            ...extra
        };

        if (this.isHost) {
            this.broadcastToGuests(eventPayload);
        } else if (this.hostConn && this.hostConn.open) {
            try { this.hostConn.send(eventPayload); } catch (e) {}
        }
    },

    update(dt) {
        // Interpolazione morbida a 60 FPS per tutti gli avversari
        for (const opp of this.opponents.values()) {
            if (!opp.group) continue;
            opp.group.position.lerp(opp.targetPos, 0.35);
            if (opp.mesh) {
                opp.mesh.quaternion.slerp(opp.targetQuat, 0.35);
            }
            if (opp.nametag && typeof camera !== 'undefined' && camera) {
                opp.nametag.quaternion.copy(camera.quaternion);
            }
        }
    },

    /* ==========================================================================
       UI LOBBY & CLASSIFICA HUD LIVE A 4 GIOCATORI
       ========================================================================== */
    updateLobbyUI(guestPlayerList = null) {
        const slotsEl = $('mp-slots-list');
        const countEl = $('mp-player-count');
        const startBtn = $('btn-start-mp-game');
        const hostStatus = $('mp-host-status');

        let players = [];
        const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : (this.isHost ? 'Host' : 'Ospite');
        const mySkin = (typeof window.getCurrentSkinKey === 'function') ? window.getCurrentSkinKey() : 'brand';

        if (this.isHost) {
            players.push({ name: myName, skin: mySkin, isMe: true, isHost: true, colorIndex: 0 });
            for (const g of this.connections.values()) {
                players.push({ name: g.name, skin: g.skin, isMe: false, isHost: false, colorIndex: g.colorIndex });
            }
        } else if (guestPlayerList) {
            players = guestPlayerList.map(p => ({
                name: p.name,
                skin: p.skin,
                isMe: (p.peerId === this.myPeerId),
                isHost: p.isHost,
                colorIndex: p.colorIndex
            }));
        } else {
            players.push({ name: myName, skin: mySkin, isMe: true, isHost: false, colorIndex: this.myColorIndex });
            for (const opp of this.opponents.values()) {
                players.push({ name: opp.name, skin: opp.skinKey, isMe: false, isHost: false, colorIndex: opp.colorDef ? PLAYER_COLORS.findIndex(c => c.hex === opp.colorDef.hex) : 1 });
            }
        }

        if (countEl) {
            countEl.textContent = `${players.length}/${this.maxPlayers}`;
        }

        if (startBtn) {
            if (this.isHost) {
                startBtn.classList.remove('hidden');
                startBtn.disabled = (players.length < 2);
                startBtn.innerHTML = (players.length < 2)
                    ? `<svg class="i"><use href="#i-play"/></svg> In attesa di amici (1/4)...`
                    : `<svg class="i"><use href="#i-play"/></svg> Inizia Gara (${players.length}/4 Giocatori)`;
            } else {
                startBtn.classList.add('hidden');
            }
        }

        if (hostStatus && this.isHost) {
            if (players.length < 2) {
                hostStatus.innerHTML = `<span class="status-dot pulse"></span> Stanza pronta! In attesa che gli amici inseriscano il codice...`;
            } else {
                hostStatus.innerHTML = `<span class="status-dot" style="background:var(--mint)"></span> ${players.length} giocatori pronti! Puoi avviare la gara.`;
            }
        }

        if (slotsEl) {
            slotsEl.innerHTML = '';
            for (let i = 0; i < this.maxPlayers; i++) {
                const p = players[i];
                const card = document.createElement('div');
                const col = PLAYER_COLORS[i % PLAYER_COLORS.length];

                if (p) {
                    card.className = 'mp-slot-card occupied';
                    card.style.borderColor = col.str + '80';
                    card.innerHTML = `
                        <div class="mp-slot-badge" style="background:${col.str}; color:#111;">
                            ${p.isHost ? '👑' : (i + 1)}
                        </div>
                        <div class="mp-slot-info">
                            <span class="mp-slot-name">${p.name} ${p.isMe ? '<small style="color:var(--mint);">(Tu)</small>' : ''}</span>
                            <span class="mp-slot-status">${p.isHost ? 'Capostanza' : 'Pronto alla gara'}</span>
                        </div>
                    `;
                } else {
                    card.className = 'mp-slot-card empty';
                    card.innerHTML = `
                        <div class="mp-slot-badge" style="background:rgba(255,255,255,0.1); color:var(--muted);">
                            ${i + 1}
                        </div>
                        <div class="mp-slot-info">
                            <span class="mp-slot-name" style="color:var(--muted);">Slot Libero</span>
                            <span class="mp-slot-status">In attesa di connessione...</span>
                        </div>
                    `;
                }
                slotsEl.appendChild(card);
            }
        }
    },

    updateLeaderboardHUD() {
        const listEl = $('p2p-lb-list');
        if (!listEl) return;

        const myName = (typeof window.getPlayerName === 'function') ? window.getPlayerName() : (this.isHost ? 'Host' : 'Ospite');
        const myAlt = Math.floor(highestScore || 0);

        // Raccogli tutti i partecipanti
        const participants = [
            { id: 'me', name: `${myName} (Tu)`, alt: myAlt, colorStr: PLAYER_COLORS[this.myColorIndex % PLAYER_COLORS.length].str, isMe: true }
        ];

        for (const opp of this.opponents.values()) {
            participants.push({
                id: opp.id,
                name: opp.name,
                alt: Math.floor(opp.alt || 0),
                colorStr: opp.colorDef ? opp.colorDef.str : '#ffa502',
                isMe: false
            });
        }

        // Ordina in ordine decrescente di quota raggiunta
        participants.sort((a, b) => b.alt - a.alt);

        const medals = ['🥇', '🥈', '🥉', '4°'];

        listEl.innerHTML = '';
        participants.forEach((p, idx) => {
            const delta = p.alt - myAlt;
            let deltaTag = '';
            if (!p.isMe) {
                if (delta > 0) deltaTag = `<span class="p2p-delta ahead">+${delta}m</span>`;
                else if (delta < 0) deltaTag = `<span class="p2p-delta behind">${delta}m</span>`;
                else deltaTag = `<span class="p2p-delta" style="color:var(--muted)">pari</span>`;
            }

            const row = document.createElement('div');
            row.className = 'p2p-lb-row' + (p.isMe ? ' is-me' : '');
            row.innerHTML = `
                <span class="p2p-lb-rank">${medals[idx] || (idx + 1) + '°'}</span>
                <span class="p2p-lb-dot" style="background:${p.colorStr}; box-shadow:0 0 6px ${p.colorStr};"></span>
                <span class="p2p-lb-name">${p.name}</span>
                <span class="p2p-lb-alt">${p.alt}m</span>
                ${deltaTag}
            `;
            listEl.appendChild(row);
        });
    },

    leaveRoom() {
        this.connected = false;
        if (this.activeJoinTimeout) {
            clearTimeout(this.activeJoinTimeout);
            this.activeJoinTimeout = null;
        }

        if (this.hostConn) {
            try { this.hostConn.close(); } catch (e) {}
            this.hostConn = null;
        }

        for (const guest of this.connections.values()) {
            try { guest.conn.close(); } catch (e) {}
        }
        this.connections.clear();

        if (this.peer && !this.peer.destroyed) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
        }

        this.despawnAllOpponents();
    }
};

window.Multiplayer = Multiplayer;

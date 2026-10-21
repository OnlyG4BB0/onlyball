/* ==========================================================================
   MODULO MULTIGIOCATORE ONLINE PEER-TO-PEER (WebRTC + PeerJS)
   - Connessione diretta browser-to-browser senza server centrale
   - Creazione stanze con codice alfanumerico breve (es. OB-842)
   - Sincronizzazione seed percorso (stessa mappa), 30Hz posizione, rotazione, skin e quota
   - Sfera avversario 3D con nametag olografico fluttuante e HUD Gara con distacco live
   ========================================================================== */

const Multiplayer = {
    peer: null,
    conn: null,
    isHost: false,
    roomCode: null,
    connected: false,
    opponent: null,
    lastSendTime: 0,
    sendInterval: 1000 / 30, // 30 FPS sync
    
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return 'OB-' + code;
    },

    initPeer(customId, onOpen, onError) {
        if (this.peer && !this.peer.destroyed) this.peer.destroy();
        
        try {
            this.peer = new Peer(customId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            this.peer.on('open', (id) => {
                if (onOpen) onOpen(id);
            });
            
            this.peer.on('error', (err) => {
                console.warn('[P2P] Peer error:', err);
                if (onError) onError(err);
            });
        } catch (e) {
            console.error('[P2P] Failed to init PeerJS:', e);
            if (onError) onError(e);
        }
    },

    createRoom(onCodeReady, onGuestJoin, onError) {
        this.roomCode = this.generateRoomCode();
        this.isHost = true;
        const peerId = 'onlyball-room-' + this.roomCode.toLowerCase();
        
        this.initPeer(peerId, () => {
            if (onCodeReady) onCodeReady(this.roomCode);
            
            this.peer.on('connection', (dataConn) => {
                this.conn = dataConn;
                this.setupConnection(onGuestJoin);
            });
        }, (err) => {
            // Se ID occupato, rigenera
            if (err.type === 'unavailable-id') {
                this.createRoom(onCodeReady, onGuestJoin, onError);
            } else if (onError) {
                onError(err);
            }
        });
    },

    joinRoom(code, onJoined, onError) {
        this.roomCode = code.toUpperCase().trim();
        this.isHost = false;
        const targetPeerId = 'onlyball-room-' + this.roomCode.toLowerCase();
        
        this.initPeer(null, () => {
            const dataConn = this.peer.connect(targetPeerId, { reliable: true });
            this.conn = dataConn;
            this.setupConnection(onJoined, onError);
        }, onError);
    },

    setupConnection(onReady, onError) {
        if (!this.conn) return;

        this.conn.on('open', () => {
            this.connected = true;
            if (this.isHost) {
                // Host invia il seed casuale condiviso e il proprio nickname/skin
                const sharedSeed = Math.floor(Math.random() * 900000) + 100000;
                this.conn.send({
                    type: 'handshake',
                    seed: sharedSeed,
                    name: getPlayerName(),
                    skin: currentSkin
                });
            }
        });

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
            // Guest riceve seed dall'host e risponde con ack
            this.conn.send({
                type: 'handshake_ack',
                name: getPlayerName(),
                skin: currentSkin
            });
            this.startMultiplayerMatch(data.seed, data.name, data.skin);
            if (onReady) onReady();
        } else if (data.type === 'handshake_ack') {
            // Host riceve conferma dal guest e avvia il match
            this.startMultiplayerMatch(null, data.name, data.skin);
            if (onReady) onReady();
        } else if (data.type === 'state') {
            this.updateOpponentState(data);
        } else if (data.type === 'event') {
            this.handleRemoteEvent(data);
        }
    },

    startMultiplayerMatch(seed, oppName, oppSkin) {
        this.spawnOpponent(oppName || 'Sfidante', oppSkin || 'brand');
        
        // Se guest, imposta seed condiviso
        if (seed != null) {
            rng = makeRng(seed);
        }
        
        // Chiudi modali e avvia la partita
        if ($('multiplayer-modal')) $('multiplayer-modal').classList.add('hidden');
        if (gameState !== 'playing') {
            fullGameReset();
            startGame();
        }
        
        // Mostra HUD gara
        const raceBadge = $('hud-p2p-race');
        if (raceBadge) {
            raceBadge.classList.remove('hidden');
            if ($('hud-p2p-name')) $('hud-p2p-name').textContent = this.opponent.name;
        }
        
        showEvent(`Sfida Online Avviata contro ${this.opponent.name}!`, 'good', 2400);
        AudioEngine.playRecord();
    },

    spawnOpponent(name, skinKey) {
        this.despawnOpponent();
        
        const group = new THREE.Group();
        const mat = ballMaterial(skinKey);
        const mesh = new THREE.Mesh(sphereGeometry, mat);
        mesh.castShadow = true;
        group.add(mesh);
        
        // Nametag 3D olografico
        const nametag = this.createNametagSprite(name);
        group.add(nametag);
        
        scene.add(group);
        
        this.opponent = {
            name,
            skinKey,
            group,
            mesh,
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
        
        ctx.fillStyle = 'rgba(12, 16, 36, 0.82)';
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
        ctx.fillText(name.slice(0, 14), 128, 33);
        
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
        this.opponent.targetPos.set(data.x, data.y, data.z);
        this.opponent.targetQuat.set(data.qx, data.qy, data.qz, data.qw);
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
            showEvent(`${name} e caduto all'ultimo checkpoint!`, 'bad', 1800);
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
        this.opponent.mesh.quaternion.slerp(this.opponent.targetQuat, 0.35);
        // Billboard del nametag verso la telecamera
        if (this.opponent.nametag) {
            this.opponent.nametag.quaternion.copy(camera.quaternion);
        }
    },

    handleDisconnect() {
        if (!this.connected) return;
        this.connected = false;
        showEvent('Avversario disconnesso dalla stanza', 'bad', 2200);
        this.despawnOpponent();
    },

    leaveRoom() {
        this.connected = false;
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

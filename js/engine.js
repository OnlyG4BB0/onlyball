/* ==========================================================================
           SEZIONE 7: SCENA 3D, RENDERER, CIELO, LUCI, EFFETTI
           ========================================================================== */
        const world = new CANNON.World();
        world.gravity.set(0, -35, 0); world.broadphase = new CANNON.NaiveBroadphase(); world.solver.iterations = 10;
        const physicsMaterial = new CANNON.Material('standard');
        world.addContactMaterial(new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, { friction: 3.0, restitution: 0.1 }));

        const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x8ae2f5, 0.0032);
        const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1200);
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98; renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.insertBefore(renderer.domElement, document.body.firstChild);

        // Cielo procedurale: gradiente a tre stop + sole con alone + stelle (biomi scuri) + nuvole fbm in movimento
        const skyUniforms = {
            topColor: { value: new THREE.Color(0x3a86ff) }, horizonColor: { value: new THREE.Color(0xbfeaff) }, bottomColor: { value: new THREE.Color(0x6f95b8) },
            sunColor: { value: new THREE.Color(0xfff2dc) }, sunDir: { value: new THREE.Vector3(0.45, 0.55, 0.35) }, exponent: { value: 0.7 }, stars: { value: 0 }, clouds: { value: 0.5 }, time: { value: 0 }
        };
        const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
            uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
            vertexShader: 'varying vec3 vDir; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vDir = wp.xyz - cameraPosition; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: `
                uniform vec3 topColor, horizonColor, bottomColor, sunColor, sunDir; uniform float exponent, stars, clouds, time; varying vec3 vDir;
                float hash3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
                float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y); }
                float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
                void main(){
                    vec3 d = normalize(vDir); float h = d.y;
                    vec3 col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), exponent));
                    col = mix(bottomColor, col, smoothstep(-0.3, 0.06, h));
                    float sd = max(dot(d, normalize(sunDir)), 0.0);
                    col += sunColor * (pow(sd, 300.0) * 1.3 + pow(sd, 14.0) * 0.16 + pow(sd, 3.0) * 0.04);
                    if (stars > 0.001) { vec3 sp = floor(d * 170.0); float s = hash3(sp); float tw = 0.7 + 0.3 * sin(time * 2.2 + s * 80.0); float st = smoothstep(0.991, 1.0, s) * tw; col += vec3(st) * stars * smoothstep(-0.05, 0.3, h); }
                    if (clouds > 0.001 && h > 0.01) { vec2 uv = d.xz / (h + 0.18) * 1.4 + vec2(time * 0.012, time * 0.005); float c = fbm(uv); float cov = smoothstep(0.62 - clouds * 0.22, 0.86, c); vec3 cc = mix(topColor, vec3(1.0), 0.78); col = mix(col, cc, cov * smoothstep(0.01, 0.16, h) * 0.9); }
                    gl_FragColor = vec4(col, 1.0);
                }`
        }));
        skyMesh.renderOrder = -10; scene.add(skyMesh);
        const skyTarget = { top: new THREE.Color(), horizon: new THREE.Color(), bottom: new THREE.Color(), sun: new THREE.Color(), stars: 0, clouds: 0.5 };

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.45); scene.add(hemiLight);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xfff2dc, 1.05); dirLight.position.set(50, 100, 30); dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048); dirLight.shadow.bias = -0.0005; dirLight.shadow.camera.left = -60; dirLight.shadow.camera.right = 60; dirLight.shadow.camera.top = 60; dirLight.shadow.camera.bottom = -60; dirLight.shadow.camera.far = 300;
        scene.add(dirLight); scene.add(dirLight.target);
        const dirLightTarget = new THREE.Color();

        // Particelle ambientali (sprite radiale morbido con un accenno di "scintilla")
        const particleCount = (touchUI || lowEndDevice) ? 450 : 800;
        const particleGeo = new THREE.BufferGeometry();
        const posArray = new Float32Array(particleCount * 3), velocityArray = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i += 3) { posArray[i] = (Math.random() - 0.5) * 150; posArray[i + 1] = (Math.random() - 0.5) * 100; posArray[i + 2] = (Math.random() - 0.5) * 150; velocityArray[i] = (Math.random() - 0.5) * 0.1; velocityArray[i + 1] = (Math.random() - 0.5) * 0.1; velocityArray[i + 2] = (Math.random() - 0.5) * 0.1; }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3)); particleGeo.setAttribute('velocity', new THREE.BufferAttribute(velocityArray, 3));
        const particleTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 58); g.moveTo(6, 32); g.lineTo(58, 32); g.stroke(); return new THREE.CanvasTexture(c); })();
        const particleMat = new THREE.PointsMaterial({ size: 0.9, map: particleTex, color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
        const particleMesh = new THREE.Points(particleGeo, particleMat); scene.add(particleMesh);
        function resetParticles(x, y, z) {
            const p = particleMesh.geometry.attributes.position.array;
            for (let i = 0; i < particleCount * 3; i += 3) { p[i] = x + (Math.random() - 0.5) * 150; p[i + 1] = y + (Math.random() - 0.5) * 80; p[i + 2] = z + (Math.random() - 0.5) * 150; }
            particleMesh.geometry.attributes.position.needsUpdate = true;
        }

        // Lava (modalità Lava Crescente): texture procedurale animata via offset UV
        const lavaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#5a0a00'; g.fillRect(0, 0, 256, 256); const r = makeRng(99); for (let i = 0; i < 90; i++) { const x = r() * 256, y = r() * 256, rad = 8 + r() * 40; const grd = g.createRadialGradient(x, y, 0, x, y, rad); grd.addColorStop(0, 'rgba(255,200,60,.95)'); grd.addColorStop(0.5, 'rgba(255,90,20,.7)'); grd.addColorStop(1, 'rgba(90,10,0,0)'); g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); return t; })();
        const lavaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: lavaTex, emissive: 0xff5a1a, emissiveMap: lavaTex, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.0 });
        const lavaMesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), lavaMat); lavaMesh.rotation.x = -Math.PI / 2; lavaMesh.visible = false; lavaMesh.receiveShadow = false; scene.add(lavaMesh);
        const lavaLight = new THREE.PointLight(0xff5500, 0, 60); lavaMesh.add(lavaLight); lavaLight.position.set(0, 0, 3);

        // Effetti: anelli di atterraggio e particelle "puff"
        const fxRings = [], fxPuffs = [];
        const ringGeo = new THREE.RingGeometry(0.55, 0.9, 40);
        for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.noShadow = true; scene.add(m); fxRings.push({ mesh: m, life: 0 }); }
        const puffGeo = new THREE.SphereGeometry(0.14, 8, 8);
        for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.userData.noShadow = true; scene.add(m); fxPuffs.push({ mesh: m, life: 0, vel: new THREE.Vector3() }); }
        function spawnRing(pos, color = 0xffffff, scale = 1) {
            const r = fxRings.find(r => r.life <= 0) || fxRings[0];
            r.mesh.position.set(pos.x, pos.y - 0.72, pos.z); r.mesh.scale.setScalar(scale); r.mesh.material.color.setHex(color); r.mesh.material.opacity = 0.85; r.mesh.visible = true; r.life = 1;
        }
        function spawnPuffs(pos, n = 8, color = 0xffffff, spread = 4) {
            for (let k = 0; k < n; k++) {
                const p = fxPuffs.find(p => p.life <= 0); if (!p) return;
                p.mesh.position.set(pos.x, pos.y - 0.5, pos.z); p.mesh.material.color.setHex(color); p.mesh.material.opacity = 0.9; p.mesh.visible = true; p.life = 1;
                p.vel.set((Math.random() - 0.5) * spread, Math.random() * 3 + 1, (Math.random() - 0.5) * spread); p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
            }
        }
        function updateFx(dt) {
            for (const r of fxRings) { if (r.life > 0) { r.life -= dt * 1.8; r.mesh.scale.multiplyScalar(1 + dt * 5); r.mesh.material.opacity = Math.max(0, r.life) * 0.85; if (r.life <= 0) r.mesh.visible = false; } }
            for (const p of fxPuffs) { if (p.life > 0) { p.life -= dt * 1.6; p.vel.y -= dt * 8; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.material.opacity = Math.max(0, p.life); if (p.life <= 0) p.mesh.visible = false; } }
        }
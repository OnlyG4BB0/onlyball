/* ==========================================================================
           SEZIONE 10: OGGETTI DI SCENA, LANDMARK, PIATTAFORME E OSTACOLI CON TELEGRAPH
           ========================================================================== */
        const propMat = (o) => new THREE.MeshStandardMaterial(o);
        const propRng = makeRng(777);
        function createBiomeProp(biome) {
            const group = new THREE.Group();
            if (biome === 0) {
                // Prato: pino stilizzato a 3 palchi + funghetto rosso alla base
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.15, 7), propMat({ color: 0x7a4b24, roughness: 0.9 })); trunk.position.y = 0.57;
                const l1 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.5, 7), propMat({ color: 0x1fa855, flatShading: true, roughness: 0.8 })); l1.position.y = 1.45;
                const l2 = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.3, 7), propMat({ color: 0x2ed573, flatShading: true, roughness: 0.8 })); l2.position.y = 2.1;
                const l3 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 7), propMat({ color: 0x7bed9f, flatShading: true, roughness: 0.8 })); l3.position.y = 2.65;
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.28, 6), propMat({ color: 0xfff7ee })); stem.position.set(0.45, 0.14, 0.2);
                const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), propMat({ color: 0xff4757, roughness: 0.5 })); cap.position.set(0.45, 0.26, 0.2);
                group.add(trunk, l1, l2, l3, stem, cap);
            } else if (biome === 1) {
                // Deserto: cactus saguaro a due braccia con fiore + roccia sabbiosa
                const cm = propMat({ color: 0x2ecc71, roughness: 0.72 });
                const main = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 2.1, 9), cm); main.position.y = 1.05;
                const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.85, 8), cm); arm1.position.set(0.42, 1.35, 0); arm1.rotation.z = Math.PI / 4;
                const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.75, 8), cm); arm2.position.set(-0.38, 1.05, 0); arm2.rotation.z = -Math.PI / 4;
                const flower = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), propMat({ color: 0xff6fb5, emissive: 0x661133, emissiveIntensity: 0.3 })); flower.position.y = 2.16;
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32), propMat({ color: 0xd49b54, flatShading: true, roughness: 0.9 })); rock.position.set(-0.45, 0.2, 0.3);
                group.add(main, arm1, arm2, flower, rock);
            } else if (biome === 2) {
                // Ghiaccio: tripla guglia glaciale traslucida
                const cm = propMat({ color: 0x9df2ff, transparent: true, opacity: 0.86, metalness: 0.45, roughness: 0.08, emissive: 0x0a5a70, emissiveIntensity: 0.5 });
                const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 2.5, 6), cm); c1.position.y = 1.25;
                const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.55, 6), cm); c2.position.set(0.48, 0.75, 0.2); c2.rotation.z = -0.35;
                const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.2, 6), cm); c3.position.set(-0.4, 0.58, -0.18); c3.rotation.z = 0.32;
                group.add(c1, c2, c3);
            } else if (biome === 3) {
                // Vulcano: camino basaltico con nucleo di magma incandescente
                const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.85, 1.35, 8), propMat({ color: 0x24222a, roughness: 0.92, flatShading: true })); cone.position.y = 0.67;
                const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), propMat({ color: 0xff6a1a, emissive: 0xff3b00, emissiveIntensity: 1.2, roughness: 0.3 })); core.position.y = 1.32;
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffb830 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.65;
                group.add(cone, core, ring); group.userData.spin = 0.015;
            } else if (biome === 4) {
                // Neon: doppio anello olografico rotante su piedistallo
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.1, 8), propMat({ color: 0x1a1f2e, metalness: 0.85, roughness: 0.25 })); pole.position.y = 0.55;
                const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 10, 28), new THREE.MeshBasicMaterial({ color: 0xff4fd8 })); r1.position.y = 1.25;
                const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0x38b6ff })); r2.position.y = 1.25; r2.rotation.y = Math.PI / 2;
                group.add(pole, r1, r2); group.userData.spin = 0.025;
            } else if (biome === 5) {
                // Caramella: lecca-lecca girello gigante + gommina zuccherata
                const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), propMat({ color: 0xfff7ee, roughness: 0.3 })); stick.position.y = 0.7;
                const candy = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.22, 24), propMat({ color: 0xff6fb5, roughness: 0.18 })); candy.position.y = 1.65; candy.rotation.x = Math.PI / 2;
                const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 8, 24), propMat({ color: 0xfff7ee, roughness: 0.2 })); swirl.position.set(0, 1.65, 0.12);
                const gum = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), propMat({ color: 0x37e0b0, roughness: 0.2 })); gum.position.set(0.45, 0.12, 0.25);
                group.add(stick, candy, swirl, gum); group.userData.spin = 0.015;
            } else if (biome === 6) {
                // Tossico: fusto radioattivo con pozza acida luminosa
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 1.25, 14), propMat({ color: 0x35401a, roughness: 0.55, metalness: 0.35 })); barrel.position.y = 0.62;
                const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.28, 14), propMat({ color: 0xc6ff3d, emissive: 0x88b000, emissiveIntensity: 0.65 })); band.position.y = 0.62;
                const puddle = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.05, 16), propMat({ color: 0xc6ff3d, emissive: 0x77b300, emissiveIntensity: 0.8, roughness: 0.15 })); puddle.position.set(0.2, 0.03, 0.15);
                group.add(barrel, band, puddle);
            } else if (biome === 7) {
                // Oceano Profondo: corallo abissale bioluminescente + perla
                const branchMat = propMat({ color: 0x4dd2ff, emissive: 0x0984e3, emissiveIntensity: 0.55, roughness: 0.35 });
                const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.7, 8), branchMat); b1.position.y = 0.85; b1.rotation.z = 0.12;
                const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.1, 7), branchMat); b2.position.set(0.32, 1.1, 0); b2.rotation.z = -0.55;
                const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.95, 7), branchMat); b3.position.set(-0.28, 0.9, 0.15); b3.rotation.z = 0.6;
                const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), propMat({ color: 0xfff7ee, emissive: 0x74b9ff, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.3 })); pearl.position.set(0.35, 0.22, -0.25);
                group.add(b1, b2, b3, pearl);
            } else if (biome === 8) {
                // Solare: obelisco dorato con aureola solare sospesa
                const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 1.9, 4), propMat({ color: 0xf39c12, metalness: 0.75, roughness: 0.22 })); ob.position.y = 0.95; ob.rotation.y = Math.PI / 4;
                const sun = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), propMat({ color: 0xfff7ee, emissive: 0xffb830, emissiveIntensity: 1.1 })); sun.position.y = 2.25;
                const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.045, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f })); halo.position.y = 2.25;
                group.add(ob, sun, halo); group.userData.spin = 0.02;
            } else if (biome === 9) {
                // Cyberpunk: pilone dati con ottaedro wireframe olografico
                const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.55), propMat({ color: 0x0d1b24, metalness: 0.8, roughness: 0.25 })); base.position.y = 0.45;
                const holo = new THREE.Mesh(new THREE.OctahedronGeometry(0.48), new THREE.MeshBasicMaterial({ color: 0x2ef2e6, wireframe: true })); holo.position.y = 1.45;
                const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff4fd8 })); ring.position.y = 1.45; ring.rotation.x = Math.PI / 2;
                group.add(base, holo, ring); group.userData.spin = 0.028;
            } else if (biome === 10) {
                // Sangue: monolito d'ossidiana cremisi con cristallo pulsante
                const rock = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 5), propMat({ color: 0x1f070a, roughness: 0.7, flatShading: true })); rock.position.y = 1.05;
                const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), propMat({ color: 0xff3b4a, emissive: 0xd63031, emissiveIntensity: 0.9, roughness: 0.2 })); shard.position.set(0, 2.35, 0);
                group.add(rock, shard); group.userData.spin = 0.018;
            } else if (biome === 11) {
                // Nuvole: soffice cumulo con stellina dorata fluttuante
                const cm = propMat({ color: 0xffffff, roughness: 0.95 });
                const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 12), cm); p1.position.set(0, 0.42, 0);
                const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), cm); p2.position.set(0.42, 0.32, 0.1);
                const p3 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10), cm); p3.position.set(-0.38, 0.3, -0.1);
                const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), propMat({ color: 0xffd166, emissive: 0xffb830, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.2 })); star.position.y = 1.25;
                group.add(p1, p2, p3, star); group.userData.spin = 0.02;
            } else if (biome === 12) {
                // Spazio Profondo: sonda spaziale con pannelli solari
                const sat = new THREE.Mesh(new THREE.OctahedronGeometry(0.48), propMat({ color: 0xffd166, metalness: 0.85, roughness: 0.22, flatShading: true })); sat.position.y = 1.35;
                const panel = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 0.52), propMat({ color: 0x1f489c, emissive: 0x0a1e4a, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.3 })); panel.position.y = 1.35;
                group.add(sat, panel); group.userData.spin = 0.014;
            } else if (biome === 13) {
                // Cristallo: drusa di ametista luminosa a 3 punte
                const cm = propMat({ color: 0xe0a8ff, transparent: true, opacity: 0.88, metalness: 0.45, roughness: 0.1, emissive: 0x6c2d96, emissiveIntensity: 0.65 });
                const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.46, 2.4, 5), cm); c1.position.y = 1.2;
                const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5, 5), cm); c2.position.set(0.44, 0.7, 0.18); c2.rotation.z = -0.38;
                const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 5), cm); c3.position.set(-0.38, 0.62, -0.15); c3.rotation.z = 0.35;
                group.add(c1, c2, c3);
            } else {
                // Paradiso: colonna corinzia in marmo e oro con sfera celeste
                const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.85, 12), propMat({ color: 0xfff7ee, roughness: 0.22 })); col.position.y = 0.92;
                const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.72), propMat({ color: 0xffd76a, metalness: 0.8, roughness: 0.2 })); cap.position.y = 1.9;
                const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), propMat({ color: 0xffffff, emissive: 0xffd76a, emissiveIntensity: 0.9 })); orb.position.y = 2.32;
                group.add(col, cap, orb);
            }
            group.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return group;
        }

        // Struttura al checkpoint (varia per bioma) e landmark "wow" ai punti di respiro
        function createCheckpointStructure(biome) {
            const group = new THREE.Group(); const type = biome % 5;
            if (type === 0) {
                const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), propMat({ color: 0x8B4513, roughness: 0.9 })); base.position.y = 1; base.castShadow = true;
                const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.1, 4), propMat({ color: 0xc73a2f, roughness: 0.75 })); roof.position.y = 3.05; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
                const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.12), propMat({ color: 0xffe08a, emissive: 0xffb830, emissiveIntensity: 0.5 })); door.position.set(0, 0.6, 1.52);
                group.add(base, roof, door);
            } else if (type === 1) {
                const pyr = new THREE.Mesh(new THREE.ConeGeometry(3.1, 4, 4), propMat({ color: 0xd4af37, roughness: 0.5, metalness: 0.35 })); pyr.position.y = 2; pyr.rotation.y = Math.PI / 4; pyr.castShadow = true;
                const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), propMat({ color: 0xfff7ee, emissive: 0xffd166, emissiveIntensity: 0.9 })); tip.position.y = 4.55;
                group.add(pyr, tip);
            } else if (type === 2) {
                const igloo = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), propMat({ color: 0xeef9ff, roughness: 0.5 })); igloo.castShadow = true;
                const entrance = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 16, 1, false, 0, Math.PI), propMat({ color: 0xd8f0ff })); entrance.rotation.z = Math.PI / 2; entrance.position.set(2, 1, 0); entrance.castShadow = true; group.add(igloo, entrance);
            } else if (type === 3) {
                const alt = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 1.5, 8), propMat({ color: 0x22222a, roughness: 0.8 })); alt.position.y = 0.75; alt.castShadow = true;
                const lava = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.54, 8), propMat({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 0.95 })); lava.position.y = 0.75; group.add(alt, lava);
            } else {
                const gm = propMat({ color: 0x1a1e30, metalness: 0.7, roughness: 0.3 });
                const gate1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), gm); gate1.position.set(-2.5, 2.5, 0); gate1.castShadow = true;
                const gate2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), gm); gate2.position.set(2.5, 2.5, 0); gate2.castShadow = true;
                const arch = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.85, 0.9), propMat({ color: 0xff4fd8, emissive: 0xff4fd8, emissiveIntensity: 0.75 })); arch.position.set(0, 5.4, 0); group.add(gate1, gate2, arch);
            }
            return group;
        }
        function createLandmark(biome) {
            const g = new THREE.Group(); const acc = new THREE.Color(BIOMES[biome].accent);
            const glow = (c, i = 0.6) => propMat({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
            if (biome === 0) { for (let i = 0; i < 6; i++) { const t = createBiomeProp(0); const a = i / 6 * Math.PI * 2; t.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); t.scale.setScalar(1.3); g.add(t); } const stone = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.5, 12), propMat({ color: 0x9aa4b5, roughness: 0.9 })); stone.position.y = 0.25; g.add(stone); }
            else if (biome === 1) { const p = new THREE.Mesh(new THREE.ConeGeometry(4.5, 6, 4), propMat({ color: 0xe2b56a, roughness: 0.8 })); p.position.y = 3; p.rotation.y = Math.PI / 4; p.castShadow = true; const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.5, 4), propMat({ color: 0xffd76a, metalness: 0.8, roughness: 0.2, emissive: 0x664400, emissiveIntensity: 0.3 })); cap.position.y = 6.3; cap.rotation.y = Math.PI / 4; g.add(p, cap); }
            else if (biome === 2) { const arch = new THREE.Mesh(new THREE.TorusGeometry(4, 0.6, 10, 30, Math.PI), propMat({ color: 0xbff3ff, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.3 })); arch.position.y = 0.2; g.add(arch); for (let i = 0; i < 5; i++) { const c = createBiomeProp(2); c.position.set((propRng() - 0.5) * 6, 0, (propRng() - 0.5) * 6); c.scale.setScalar(1.4 + propRng()); g.add(c); } }
            else if (biome === 3) { const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 6, 9), propMat({ color: 0x24222a, roughness: 0.95, flatShading: true })); col.position.y = 3; col.castShadow = true; const top = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), glow(0xff6a1a, 1.4)); top.position.y = 6.4; const l = new THREE.PointLight(0xff6a1a, 1.6, 26); l.position.y = 7; g.add(col, top, l); g.userData.pulse = top; }
            else if (biome === 4) { for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(3.4 - i * 0.9, 0.12, 10, 48), new THREE.MeshBasicMaterial({ color: [0xff4fd8, 0x8a5cff, 0x38b6ff][i] })); r.position.y = 4; r.rotation.x = Math.PI / 2 * (i % 2); r.userData.spinAxis = i; g.add(r); } g.userData.spin = 0.012; g.userData.rings = true; }
            else if (biome === 5) { const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 8), propMat({ color: 0xfff7ee })); stick.position.y = 2.5; const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 32), propMat({ color: 0xff6fb5, roughness: 0.2 })); disk.position.y = 5.5; disk.rotation.x = Math.PI / 2; const swirl = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.25, 8, 32), propMat({ color: 0xfff7ee, roughness: 0.2 })); swirl.position.set(0, 5.5, 0.28); g.add(stick, disk, swirl); g.userData.spin = 0.02; g.userData.spinTarget = [disk, swirl]; }
            else if (biome === 6) { for (let i = 0; i < 4; i++) { const b = createBiomeProp(6); b.position.set(Math.cos(i * 1.6) * 1.6, 0, Math.sin(i * 1.6) * 1.6); b.scale.setScalar(1.8); g.add(b); } const pool = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 24), glow(0xc6ff3d, 0.8)); pool.position.y = 0.1; g.add(pool); }
            else if (biome === 7) { const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 7, 12), propMat({ color: 0xfff7ee, roughness: 0.5 })); tower.position.y = 3.5; tower.castShadow = true; const band = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 1.2, 12), propMat({ color: 0xff5c4d })); band.position.y = 4.5; const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 12), glow(0xffe08a, 1.5)); lamp.position.y = 7.5; const l = new THREE.PointLight(0xffe08a, 1.4, 30); l.position.y = 7.6; g.add(tower, band, lamp, l); g.userData.pulse = lamp; }
            else if (biome === 8) { const dial = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.4, 32), propMat({ color: 0xffd76a, metalness: 0.7, roughness: 0.3 })); dial.position.y = 0.2; const gnomon = new THREE.Mesh(new THREE.ConeGeometry(0.6, 5, 4), glow(0xffb830, 0.5)); gnomon.position.y = 2.9; g.add(dial, gnomon); }
            else if (biome === 9) { const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(2.2, 0.35, 96, 12), new THREE.MeshBasicMaterial({ color: 0x2ef2e6, wireframe: true, transparent: true, opacity: 0.8 })); knot.position.y = 4.5; g.add(knot); g.userData.spin = 0.015; g.userData.spinTarget = [knot]; const l = new THREE.PointLight(0x2ef2e6, 1.2, 24); l.position.y = 4.5; g.add(l); }
            else if (biome === 10) { const ob = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7, 1.6), propMat({ color: 0x1a0a0c, roughness: 0.6 })); ob.position.y = 3.5; ob.castShadow = true; const veins = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.7), glow(0xff3b4a, 1.2)); veins.position.y = 2.5; const veins2 = veins.clone(); veins2.position.y = 5; const tip = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.2, 4), propMat({ color: 0x1a0a0c })); tip.position.y = 7.6; tip.rotation.y = Math.PI / 4; g.add(ob, veins, veins2, tip); }
            else if (biome === 11) { [0xff5c4d, 0xffb830, 0x37e0b0, 0x38b6ff, 0x8a5cff].forEach((c, i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(5.2 - i * 0.45, 0.22, 8, 40, Math.PI), propMat({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.5 })); a.position.y = 0.3; g.add(a); }); }
            else if (biome === 12) { const planet = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), propMat({ color: 0x7fb2ff, roughness: 0.6 })); planet.position.y = 5.5; const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.3, 4, 48), propMat({ color: 0xc0d8ff, roughness: 0.5, metalness: 0.3 })); ring.position.y = 5.5; ring.rotation.x = Math.PI / 2.3; ring.scale.y = 0.25; g.add(planet, ring); g.userData.spin = 0.006; g.userData.spinTarget = [planet, ring]; }
            else if (biome === 13) { for (let i = 0; i < 7; i++) { const c = createBiomeProp(13); const a = i / 7 * Math.PI * 2; c.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2); c.scale.setScalar(1.6 + (i % 3) * 0.7); c.rotation.z = (propRng() - 0.5) * 0.5; g.add(c); } const big = createBiomeProp(13); big.scale.setScalar(3.2); g.add(big); const l = new THREE.PointLight(0xe0a8ff, 1.2, 24); l.position.y = 4; g.add(l); }
            else { const arch = new THREE.Mesh(new THREE.TorusGeometry(4, 0.5, 12, 40, Math.PI), propMat({ color: 0xffd76a, metalness: 0.85, roughness: 0.2, emissive: 0x553300, emissiveIntensity: 0.3 })); arch.position.y = 0.3; const halo = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 48), glow(0xfff7ee, 1.2)); halo.position.y = 6.2; halo.rotation.x = Math.PI / 2; g.add(arch, halo); g.userData.spin = 0.01; g.userData.spinTarget = [halo]; }
            g.traverse(o => { if (o.isMesh) o.castShadow = true; });
            return g;
        }

        // Scala le UV di una BoxGeometry in modo che le texture (condivise per bioma) si ripetano ogni ~4 unità
        function scaleBoxUVs(geo, w, h, d) {
            const uv = geo.attributes.uv; const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
            for (let f = 0; f < 6; f++) { const [su, sv] = faces[f]; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * su / 4, uv.getY(k) * (f === 2 || f === 3 ? sv / 4 : sv / 2)); } }
            uv.needsUpdate = true;
        }
        // Crea un binario o anello luminoso che mostra al giocatore la traiettoria di una piattaforma mobile o di un ostacolo
        function createPathGuide(kind, x, y, z, dirX, dirZ, amp, colorHex) {
            const g = new THREE.Group(); g.position.set(x, y, z); g.userData.noShadow = true;
            const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
            if ((kind === 'sway' || kind === 'sweep') && amp > 0.25) {
                const rail = new THREE.Mesh(new THREE.PlaneGeometry(amp * 2, 0.18), mat);
                rail.rotation.x = -Math.PI / 2; rail.rotation.z = -Math.atan2(dirZ, dirX); rail.userData.noShadow = true;
                const nGeo = new THREE.RingGeometry(0.14, 0.28, 16);
                const n1 = new THREE.Mesh(nGeo, mat); n1.rotation.x = -Math.PI / 2; n1.position.set(dirX * amp, 0, dirZ * amp); n1.userData.noShadow = true;
                const n2 = new THREE.Mesh(nGeo, mat); n2.rotation.x = -Math.PI / 2; n2.position.set(-dirX * amp, 0, -dirZ * amp); n2.userData.noShadow = true;
                g.add(rail, n1, n2);
            } else if ((kind === 'orbit' || kind === 'plasma_mine') && amp > 0.25) {
                const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.1, amp - 0.09), amp + 0.09, 40), mat);
                ring.rotation.x = -Math.PI / 2; ring.userData.noShadow = true; g.add(ring);
            } else if (kind === 'laser_rotor') {
                const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.2, amp - 0.12), amp + 0.12, 48), mat);
                ring.rotation.x = -Math.PI / 2; ring.userData.noShadow = true;
                const hubRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 20), mat);
                hubRing.rotation.x = -Math.PI / 2; hubRing.userData.noShadow = true;
                g.add(ring, hubRing);
            } else if (kind === 'stomp') {
                const pad = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1.5, amp * 1.4), Math.max(1.5, amp * 1.4)), mat);
                pad.rotation.x = -Math.PI / 2; pad.userData.noShadow = true;
                const reticle = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.85, 24), mat);
                reticle.rotation.x = -Math.PI / 2; reticle.userData.noShadow = true;
                g.add(pad, reticle);
            } else if (kind === 'pendulum') {
                const rail = new THREE.Mesh(new THREE.PlaneGeometry(amp * 2, 0.22), mat);
                rail.rotation.x = -Math.PI / 2; rail.rotation.z = -Math.atan2(dirZ, dirX); rail.userData.noShadow = true;
                g.add(rail);
            } else if (kind === 'bob') {
                const pad = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.85, 24), mat);
                pad.rotation.x = -Math.PI / 2; pad.userData.noShadow = true; g.add(pad);
            }
            scene.add(g);
            return g;
        }

        function createPlatform(x, y, z, w, h, d, texIndex, opts = {}) {
            const { flag = false, bouncer = false, moving = null, noProps = false, landmark = false } = opts;
            const biome = clamp(texIndex, 0, 14), bdef = BIOMES[biome];
            const body = new CANNON.Body({ mass: 0, type: moving ? CANNON.Body.KINEMATIC : CANNON.Body.STATIC, material: physicsMaterial });
            body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2))); body.position.set(x, y, z);
            if (bouncer) body.isBouncer = true; body.isPlatform = true; body.topY = y + h / 2; world.addBody(body);

            const geo = new THREE.BoxGeometry(w, h, d); scaleBoxUVs(geo, w, h, d);
            const mats = bouncer ? bouncerMaterial : biomeMaterials[biome];
            const mesh = new THREE.Mesh(geo, [mats.side, mats.side, mats.top, bottomMaterial, mats.side, mats.side]); mesh.position.copy(body.position); mesh.receiveShadow = true; mesh.castShadow = true;
            // Bordo luminoso nel colore d'accento del bioma: leggibilità dei bordi e identità visiva
            const edgeCol = bouncer ? 0x5ef0a6 : flag ? 0xffffff : bdef.accent;
            const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMaterial(edgeCol)); line.userData.noShadow = true; mesh.add(line);
            // Cornice inferiore smussata per dare spessore architettonico all'isola fluttuante
            if (w >= 4 && d >= 4) {
                const underGeo = new THREE.BoxGeometry(w * 0.86, h * 0.36, d * 0.86);
                const underMesh = new THREE.Mesh(underGeo, bottomMaterial);
                underMesh.position.y = -h * 0.66; underMesh.userData.noShadow = true; mesh.add(underMesh);
            }
            if (bouncer) {
                const padRing = new THREE.Mesh(new THREE.RingGeometry(Math.min(w, d) * 0.24, Math.min(w, d) * 0.36, 32), new THREE.MeshBasicMaterial({ color: 0xb8ffd9, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
                padRing.rotation.x = -Math.PI / 2; padRing.position.y = h / 2 + 0.02; padRing.userData.noShadow = true; mesh.add(padRing);
            }
            scene.add(mesh);
            const ref = { mesh, body, flagMeshes: [], topY: body.topY, moving: null }; platforms.push(ref); platformMeshes.push(mesh);

            if (moving) {
                const guideMesh = createPathGuide('sway', x, y, z, moving.dirX, moving.dirZ, moving.amp, bdef.accent);
                const o = { body, mesh, guideMesh, kind: 'sway', dirX: moving.dirX, dirZ: moving.dirZ, amp: moving.amp, speed: moving.speed, baseX: x, baseZ: z, baseY: y, timeOffset: rng() * 100, isPlatform: true };
                movingObstacles.push(o); ref.moving = o;
            }

            if (landmark) { const lm = createLandmark(biome); lm.position.set(x, y + h / 2, z); scene.add(lm); ref.flagMeshes.push(lm); landmarks.push(lm); }
            else if (!flag && !bouncer && !moving && !noProps) {
                const numProps = Math.floor(rng() * 3);
                for (let i = 0; i < numProps; i++) {
                    const prop = createBiomeProp(biome);
                    const px = (rng() > 0.5 ? 1 : -1) * (w / 2 * (0.6 + rng() * 0.3)), pz = (rng() > 0.5 ? 1 : -1) * (d / 2 * (0.6 + rng() * 0.3));
                    prop.position.set(px, h / 2, pz); prop.rotation.y = rng() * Math.PI * 2; mesh.add(prop); if (prop.userData.spin) sceneProps.push(prop);
                }
            }
            if (flag) {
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.5), propMat({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 })); pole.position.set(x + w / 2 - 1.5, y + 2.25, z - d / 2 + 1.5); pole.castShadow = true;
                const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1, 6, 1), propMat({ color: 0x37e0b0, emissive: 0x0c6b3a, emissiveIntensity: 0.4, side: THREE.DoubleSide })); flagMesh.position.set(x + w / 2 - 1.5, y + 4, z - d / 2 + 1.5); flagMesh.castShadow = true;
                flagMesh.geometry.translate(0.8, 0, 0); flags.push(flagMesh);
                const halo = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.set(x, y + h / 2 + 0.03, z); halo.userData.noShadow = true;
                const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 12, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x37e0b0, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
                beacon.position.set(x, y + h / 2 + 6, z); beacon.userData.noShadow = true;
                scene.add(pole, flagMesh, halo, beacon); ref.flagMeshes.push(pole, flagMesh, halo, beacon);
                const struct = createCheckpointStructure(biome); struct.position.set(x - w / 4, y + h / 2, z + d / 4); scene.add(struct); ref.flagMeshes.push(struct);
            }
            return ref;
        }
        // Ostacolo su piattaforma: lascia sempre una corsia di almeno LANE (pallina r=0.8) anche all'estremo del movimento
        const OBS_LANE = 3.2;
        function createObstacle(px, py, pz, platW, platD, deadly, biome, extra = {}) {
            if (deadly && !MODE().hazards) deadly = false;
            const zen = !!MODE().zen;
            const scale = zen ? 0.78 : 1;
            
            // Selezione del tipo di ostacolo: attivi in tutte le modalita (inclusa la Standard) fin dal Bioma 0
            const kinds = extra.kind ? [extra.kind] : (zen ? ['sway', 'spin'] : (
                biome >= 2 ? ['laser_rotor', 'stomp', 'plasma_mine', 'pendulum', 'sweep', 'orbit', 'bob', 'spin', 'sway'] :
                biome >= 1 ? ['laser_rotor', 'stomp', 'plasma_mine', 'pendulum', 'sway', 'spin', 'sweep'] :
                ['laser_rotor', 'stomp', 'sway', 'spin', 'sweep']
            ));
            const kind = kinds[Math.floor(rng() * kinds.length)];
            
            // I pericoli ad alta tecnologia (laser, stomper, mine, maglio) sono intrinsecamente letali se hazards attivi
            if (!zen && MODE().hazards && (kind === 'laser_rotor' || kind === 'stomp' || kind === 'plasma_mine' || kind === 'pendulum')) {
                deadly = true;
            } else if (!zen && MODE().hazards && !deadly && rng() < 0.45) {
                deadly = true;
            }
            
            let obsW = Math.min((deadly ? 2.35 : 3.05) * scale, platW * 0.34);
            let obsD = Math.min((deadly ? 2.35 : 3.05) * scale, platD * 0.34);
            obsW = Math.min(obsW, Math.max(1.1, platW - OBS_LANE));
            obsD = Math.min(obsD, Math.max(1.1, platD - OBS_LANE));
            let obsH = deadly ? 1.05 : (zen ? 1.7 : 2.15);
            
            const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
            let by = py + obsH / 2 + 0.5;
            let mesh = null;
            const accentHex = deadly ? 0xff2e63 : 0xffb830;
            const capMat = propMat({ color: deadly ? 0x2e0610 : 0x161c2c, metalness: 0.88, roughness: 0.22 });
            const glowMat = new THREE.MeshBasicMaterial({ color: accentHex });
            
            let stompLift = 3.3;
            let armLen = Math.min(platW, platD) * 0.35;
            
            if (kind === 'laser_rotor') {
                obsW = 2.0; obsD = 2.0; obsH = 0.65;
                by = py + obsH / 2 + 0.45;
                body.addShape(new CANNON.Box(new CANNON.Vec3(0.7, obsH / 2, 0.7)));
                body.addShape(new CANNON.Box(new CANNON.Vec3(armLen, 0.24, 0.15)));
                body.addShape(new CANNON.Box(new CANNON.Vec3(0.15, 0.24, armLen)));
                
                mesh = new THREE.Group();
                const stator = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, obsH, 12), deadly ? hazardMaterial : blockerMaterial);
                stator.castShadow = true; stator.receiveShadow = true;
                stator.add(new THREE.LineSegments(new THREE.EdgesGeometry(stator.geometry), edgeMaterial(accentHex)));
                mesh.add(stator);
                
                const rotor = new THREE.Group(); rotor.position.y = obsH * 0.45;
                const coreCap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 12), capMat);
                const coreOrb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), glowMat);
                coreOrb.position.y = 0.18;
                rotor.add(coreCap, coreOrb);
                
                const bladeGeo = new THREE.BoxGeometry(armLen * 0.75, 0.12, 0.05);
                const glowGeo = new THREE.BoxGeometry(armLen * 0.76, 0.24, 0.12);
                const bloomMat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
                
                [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(ang => {
                    const arm = new THREE.Group(); arm.rotation.y = ang;
                    const socket = new THREE.Mesh(new THREE.BoxGeometry(armLen * 0.25, 0.2, 0.18), capMat);
                    socket.position.x = armLen * 0.12;
                    const blade = new THREE.Mesh(bladeGeo, glowMat);
                    blade.position.x = armLen * 0.6;
                    const bloom = new THREE.Mesh(glowGeo, bloomMat);
                    bloom.position.x = armLen * 0.6; bloom.userData.noShadow = true;
                    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), glowMat);
                    tip.position.x = armLen * 0.98;
                    arm.add(socket, blade, bloom, tip);
                    rotor.add(arm);
                });
                mesh.add(rotor);
                mesh.userData.rotor = rotor;
            } else if (kind === 'stomp') {
                obsW = Math.min(2.7 * scale, platW * 0.32);
                obsD = Math.min(2.7 * scale, platD * 0.32);
                obsH = 1.3;
                by = py + obsH / 2 + 0.5;
                body.addShape(new CANNON.Box(new CANNON.Vec3(obsW / 2, obsH / 2, obsD / 2)));
                
                mesh = new THREE.Group();
                const anvilGeo = new THREE.BoxGeometry(obsW, obsH, obsD); scaleBoxUVs(anvilGeo, obsW, obsH, obsD);
                const anvil = new THREE.Mesh(anvilGeo, deadly ? hazardMaterial : blockerMaterial);
                anvil.castShadow = true; anvil.receiveShadow = true;
                anvil.add(new THREE.LineSegments(new THREE.EdgesGeometry(anvilGeo), edgeMaterial(accentHex)));
                mesh.add(anvil);
                
                const impactPlate = new THREE.Mesh(new THREE.PlaneGeometry(obsW * 0.92, obsD * 0.92), glowMat);
                impactPlate.rotation.x = Math.PI / 2; impactPlate.position.y = -obsH / 2 - 0.01;
                impactPlate.userData.noShadow = true;
                mesh.add(impactPlate);
                
                const rodMat = propMat({ color: 0xdce5f5, metalness: 0.95, roughness: 0.12 });
                [-obsW * 0.28, obsW * 0.28].forEach(rx => {
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8), rodMat);
                    rod.position.set(rx, obsH / 2 + 1.8, 0); rod.userData.noShadow = true;
                    mesh.add(rod);
                });
                const crossbar = new THREE.Mesh(new THREE.BoxGeometry(obsW * 0.85, 0.28, obsD * 0.6), capMat);
                crossbar.position.y = obsH / 2 + 3.6; crossbar.userData.noShadow = true;
                const siren = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), glowMat);
                siren.position.y = obsH / 2 + 3.9; siren.userData.noShadow = true;
                mesh.add(crossbar, siren);
                mesh.userData.siren = siren;
                mesh.userData.stompLift = stompLift;
            } else if (kind === 'plasma_mine') {
                obsW = 2.2 * scale; obsD = 2.2 * scale; obsH = 2.2 * scale;
                by = py + 1.8;
                body.addShape(new CANNON.Sphere(0.92));
                
                mesh = new THREE.Group();
                const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), glowMat);
                core.userData.noShadow = true;
                const chromeRingMat = propMat({ color: 0x9fb5d5, metalness: 0.92, roughness: 0.15 });
                const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.055, 8, 28), chromeRingMat);
                const outerRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.055, 8, 28), capMat);
                innerRing.userData.noShadow = true; outerRing.userData.noShadow = true;
                [-1, 1].forEach(dir => {
                    const probeX = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), capMat);
                    probeX.position.x = dir * 1.35; probeX.rotation.z = -dir * Math.PI / 2;
                    const probeZ = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), capMat);
                    probeZ.position.z = dir * 1.35; probeZ.rotation.x = dir * Math.PI / 2;
                    mesh.add(probeX, probeZ);
                });
                mesh.add(core, innerRing, outerRing);
                mesh.userData.core = core; mesh.userData.innerRing = innerRing; mesh.userData.outerRing = outerRing;
            } else if (kind === 'pendulum') {
                obsW = 2.0; obsD = 2.0; obsH = 2.0;
                by = py + 2.0;
                body.addShape(new CANNON.Sphere(0.92));
                
                mesh = new THREE.Group();
                const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), deadly ? hazardMaterial : blockerMaterial);
                head.castShadow = true; head.receiveShadow = true;
                head.add(new THREE.LineSegments(new THREE.EdgesGeometry(head.geometry), edgeMaterial(accentHex)));
                const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 1.25), glowMat);
                const fin2 = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 0.12), glowMat);
                fin1.userData.noShadow = true; fin2.userData.noShadow = true;
                head.add(fin1, fin2);
                const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.4, 6), capMat);
                cable.position.y = 2.2; cable.userData.noShadow = true;
                mesh.add(head, cable);
            } else {
                body.addShape(new CANNON.Box(new CANNON.Vec3(obsW / 2, obsH / 2, obsD / 2)));
                const geo = new THREE.BoxGeometry(obsW, obsH, obsD); scaleBoxUVs(geo, obsW, obsH, obsD);
                mesh = new THREE.Mesh(geo, deadly ? hazardMaterial : blockerMaterial); mesh.castShadow = true; mesh.receiveShadow = true;
                mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMaterial(deadly ? 0xffb9cb : 0xffb830)));
                
                const topCap = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(obsW, obsD) * 0.28, Math.min(obsW, obsD) * 0.34, 0.16, 12), capMat);
                topCap.position.y = obsH / 2 + 0.08; topCap.userData.noShadow = true; mesh.add(topCap);
                const coreOrb = new THREE.Mesh(new THREE.SphereGeometry(Math.min(obsW, obsD) * 0.16, 10, 10), glowMat);
                coreOrb.position.y = obsH / 2 + 0.18; coreOrb.userData.noShadow = true; mesh.add(coreOrb);
                
                if (kind === 'spin') {
                    const fin = new THREE.Mesh(new THREE.BoxGeometry(obsW * 1.1, obsH * 0.3, obsD * 0.22), glowMat);
                    const fin2 = new THREE.Mesh(new THREE.BoxGeometry(obsW * 0.22, obsH * 0.3, obsD * 1.1), glowMat);
                    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(obsW, obsD) * 0.38, 0.045, 6, 20), capMat);
                    ring.rotation.x = Math.PI / 2; ring.position.y = obsH / 2 + 0.12;
                    fin.userData.noShadow = true; fin2.userData.noShadow = true; ring.userData.noShadow = true;
                    mesh.add(fin, fin2, ring);
                } else if (kind === 'bob') {
                    const collar = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(obsW, obsD) * 0.42, Math.min(obsW, obsD) * 0.48, obsH * 0.5, 8), capMat);
                    collar.position.y = -obsH * 0.25; collar.userData.noShadow = true;
                    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), propMat({ color: 0xdde5f0, metalness: 0.95, roughness: 0.12 }));
                    shaft.position.y = obsH / 2 + 0.65; shaft.userData.noShadow = true;
                    mesh.add(collar, shaft);
                } else if (kind === 'sweep' || kind === 'sway') {
                    const visor = new THREE.Mesh(new THREE.BoxGeometry(obsW * 0.88, 0.14, 0.1), glowMat);
                    visor.position.set(0, obsH * 0.2, obsD / 2 + 0.05); visor.userData.noShadow = true;
                    [-obsW * 0.28, obsW * 0.28].forEach(tx => {
                        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.32, 8), capMat);
                        thruster.rotation.x = Math.PI / 2; thruster.position.set(tx, 0, -obsD / 2 - 0.12); thruster.userData.noShadow = true;
                        mesh.add(thruster);
                    });
                    mesh.add(visor); mesh.userData.visor = visor;
                }
            }
            
            body.position.set(px, by, pz);
            body.isMovingObstacle = true;
            body.obstacleKind = kind;
            if (deadly) body.isDeathObstacle = true;
            world.addBody(body);
            scene.add(mesh);
            
            const a = extra.dirX != null ? Math.atan2(extra.dirZ, extra.dirX) : rng() * Math.PI * 2;
            const dirX = extra.dirX != null ? extra.dirX : Math.cos(a), dirZ = extra.dirZ != null ? extra.dirZ : Math.sin(a);
            const maxAmp = Math.max(0.35, Math.min(platW, platD) / 2 - Math.max(obsW, obsD) / 2 - OBS_LANE);
            const wantAmp = extra.amp != null ? extra.amp : Math.min(platW, platD) * (kind === 'sweep' || kind === 'orbit' || kind === 'plasma_mine' ? 0.26 : 0.18);
            const amp = Math.min(wantAmp, maxAmp);
            const speed = (extra.speed != null ? extra.speed : (deadly ? 0.88 : 1.15) * (1 + Math.min(0.5, (biome || 0) * 0.04))) * (zen ? 0.62 : 1);
            
            const guideMesh = createPathGuide(kind, px, py + 0.52, pz, dirX, dirZ, kind === 'laser_rotor' ? armLen : amp, accentHex);
            const o = { body, mesh, guideMesh, kind, dirX, dirZ, amp, ampY: extra.ampY != null ? extra.ampY : (0.55 + rng() * 0.7), speed, baseX: px, baseZ: pz, baseY: by, timeOffset: rng() * 100, isPlatform: false, deadly, obsW, obsD, stompLift, armLen, wasInAir: false };
            movingObstacles.push(o);
            return o;
        }
        function obstacleChance(D, b) {
            if (gen.sinceCheckpoint === 0 && gen.lastPattern === 'checkpoint') return 0;
            let c = 0.42 + D.t * 0.52;
            if (b === 0) c *= 0.85;
            if (gen.sinceCheckpoint === 1 && gen.lastPattern !== '') c *= 0.55;
            if (gen.lastPattern === 'rest') c *= 0.4;
            if (MODE().zen) c *= 0.42;
            return Math.min(0.92, c);
        }
        function decoratePlat(p, w, d, D, b, opts = {}) {
            if (!p || !p.body || opts.skip || opts.flag || opts.landmark || opts.bouncer) return;
            if (Math.min(w, d) < 6) return;
            const chance = obstacleChance(D, b) * (opts.mult || 1);
            if (rng() > chance) return;
            const deadly = MODE().hazards && !MODE().zen && rng() < (0.60 + D.t * 0.35);
            const ox = (rng() < 0.5 ? 1 : -1) * w * 0.22, oz = (rng() - 0.5) * d * 0.22;
            const across = { dirX: -Math.sin(gen.angle), dirZ: Math.cos(gen.angle) };
            createObstacle(p.body.position.x + ox, p.body.position.y, p.body.position.z + oz, w, d, deadly, b, { kind: opts.kind, amp: Math.min(1.5, Math.min(w, d) * 0.14), ...across });
            
            // Su piattaforme ampie (>=10.5m): possibilita di secondo pericolo coordinato fin dai biomi iniziali
            if (!opts.kind && Math.min(w, d) >= 10.5 && !MODE().zen && rng() < (0.35 + D.t * 0.35)) {
                const deadly2 = MODE().hazards && !MODE().zen;
                createObstacle(p.body.position.x - ox, p.body.position.y, p.body.position.z - oz, w, d, deadly2, b, { amp: Math.min(1.4, Math.min(w, d) * 0.12), dirX: across.dirX, dirZ: across.dirZ });
            }
        }
        // Rimuove piattaforme e ostacoli molto sotto la vetta raggiunta: meno draw call e broadphase più leggero
        function cullBelow(minY) {
            for (let i = platforms.length - 1; i >= 0; i--) {
                const p = platforms[i]; if (p.topY >= minY) continue;
                scene.remove(p.mesh); world.removeBody(p.body); p.flagMeshes.forEach(m => { scene.remove(m); const li = landmarks.indexOf(m); if (li >= 0) landmarks.splice(li, 1); });
                const mi = platformMeshes.indexOf(p.mesh); if (mi >= 0) platformMeshes.splice(mi, 1); platforms.splice(i, 1);
            }
            for (let i = movingObstacles.length - 1; i >= 0; i--) {
                const o = movingObstacles[i];
                if (o.body.position.y < minY) {
                    scene.remove(o.mesh); if (o.guideMesh) scene.remove(o.guideMesh);
                    world.removeBody(o.body); movingObstacles.splice(i, 1);
                }
            }
        }

/* ==========================================================================
           SEZIONE 11: LEVEL DESIGN — generatore a pattern con curva di difficoltà
           - La difficoltà (gap tra i bordi, dislivello, dimensione) cresce con il bioma e resta sempre entro la portata del salto
             (salto: v=22, g=35 → ~6.9 u di altezza; trampolino: v=45 → ~29 u).
           - Ogni bioma: checkpoint (grande, con bandiera) → riscaldamento senza ostacoli → pattern vari → punto di respiro con landmark → pattern più intensi.
           - Ostacoli: densità e letalità crescono con l'altezza; corsia giocabile sempre garantita; Zen = solo blocker lenti.
           ========================================================================== */
        const gen = { angle: 0, prevW: 25, prevD: 25, lastPattern: '', nextRestY: 35, sinceCheckpoint: 0, pendingSigLabel: null };
        const extentAlong = (w, d, dx, dz) => Math.min(w / 2 / Math.max(Math.abs(dx), 1e-3), d / 2 / Math.max(Math.abs(dz), 1e-3));
        function difficulty(y) { const b = clamp(Math.floor(y / 70), 0, 14), t = b / 14; return { b, t, gap: 1.2 + 3.2 * t, rise: 2.3 + 1.5 * t, size: 9 - 4 * t }; }
        // Posiziona la piattaforma successiva a partire dall'ultima: `gap` è il vuoto tra i bordi, `rise` il dislivello
        function placeNext(w, d, gap, rise, angleDelta) {
            gen.angle += angleDelta; const dx = Math.cos(gen.angle), dz = Math.sin(gen.angle);
            const dist = extentAlong(gen.prevW, gen.prevD, dx, dz) + Math.max(0.5, gap) + extentAlong(w, d, dx, dz);
            genCurrentX += dx * dist; genCurrentZ += dz * dist; genCurrentY += clamp(rise, 0.5, 5); gen.prevW = w; gen.prevD = d; platformIndex++;
            return { x: genCurrentX, y: genCurrentY, z: genCurrentZ };
        }
        function plat(w, d, gap, rise, ang, biome, opts) { const p = placeNext(w, d, gap, rise, ang); return createPlatform(p.x, p.y, p.z, w, 1, d, biome, opts); }
        const PATTERN_FNS = {
            hops(D, b) {
                const n = 3 + Math.floor(rng() * 3), afterCp = gen.lastPattern === 'checkpoint';
                for (let i = 0; i < n; i++) {
                    const pw = D.size * rngRange(0.8, 1.2), pd = D.size * rngRange(0.8, 1.2);
                    const p = plat(pw, pd, D.gap * rngRange(0.7, 1.1), D.rise * rngRange(0.8, 1.1), 0.55 + rngRange(-0.15, 0.15), b);
                    if (afterCp) continue;
                    if (i > (gen.sinceCheckpoint === 0 ? 1 : 0)) decoratePlat(p, pw, pd, D, b, { mult: 0.95 });
                }
                return n;
            },
            zigzag(D, b) {
                const n = 4, pw = D.size * 0.95, pd = D.size * 0.95;
                for (let i = 0; i < n; i++) {
                    const p = plat(pw, pd, D.gap * 0.9, D.rise * 0.9, (i % 2 === 0 ? 1.0 : -0.75) + 0.2, b);
                    if (i % 2 === 1) decoratePlat(p, pw, pd, D, b, { mult: 1.1 });
                }
                return n;
            },
            stairs(D, b) {
                const n = 4 + Math.floor(rng() * 3), s = Math.max(5.5, D.size * 0.65);
                for (let i = 0; i < n; i++) {
                    const p = plat(s, s, Math.max(1, D.gap * 0.55), Math.min(2.4, D.rise * 0.8), 0.28, b, { noProps: true });
                    if (i >= n - 2) decoratePlat(p, s, s, D, b, { mult: 0.9, kind: 'spin' });
                }
                return n;
            },
            stepping(D, b) {
                const n = 4, s = Math.max(6.2, D.size * 0.82);
                for (let i = 0; i < n; i++) {
                    const ang = (i % 2 === 0 ? 0.65 : -0.45) + 0.18;
                    const p = plat(s, s, D.gap * 0.72, D.rise * 0.82, ang, b, { noProps: i < n - 1 });
                    if (i === n - 1) decoratePlat(p, s, s, D, b, { mult: 1.0, kind: 'sway' });
                }
                return n;
            },
            slalom(D, b) {
                const n = 3, w = Math.max(8.5, D.size * 1.08), d = Math.max(7.5, D.size * 0.95);
                for (let i = 0; i < n; i++) {
                    const p = plat(w, d, D.gap * 0.75, D.rise * 0.82, (i % 2 === 0 ? 0.55 : -0.3) + 0.15, b, { noProps: true });
                    const across = { dirX: -Math.sin(gen.angle), dirZ: Math.cos(gen.angle) };
                    const deadly = MODE().hazards && !MODE().zen;
                    const k = i % 2 === 0 ? (rng() < 0.55 ? 'stomp' : 'sway') : (rng() < 0.55 ? 'laser_rotor' : 'sweep');
                    createObstacle(p.body.position.x, p.body.position.y, p.body.position.z, w, d, deadly, b, { kind: k, amp: w * 0.2, speed: 0.8 + D.t * 0.25, ...across });
                }
                return n;
            },
            carousel(D, b) {
                const w = 15 + D.t * 2, p = plat(w, w, D.gap * 0.75, D.rise * 0.8, 0.45, b, { noProps: true });
                const deadly = MODE().hazards && !MODE().zen;
                const k = rng() < 0.6 ? 'laser_rotor' : 'plasma_mine';
                createObstacle(p.body.position.x, p.body.position.y, p.body.position.z, w * 0.75, w * 0.75, deadly, b, { kind: k, amp: w * 0.22, speed: 0.8 + D.t * 0.22 });
                if (rng() < 0.65) createObstacle(p.body.position.x, p.body.position.y, p.body.position.z, 5.5, 5.5, deadly, b, { kind: 'stomp', amp: 0.35, speed: 1.15 });
                return 1;
            },
            longjump(D, b) {
                plat(8.5, 8.5, D.gap * 0.7, D.rise * 0.7, 0.5, b, { noProps: true });
                const lw = D.size + 3, land = plat(lw, lw, D.gap + 2.0, 0.8, 0.15, b);
                decoratePlat(land, lw, lw, D, b, { mult: 1.15 });
                return 2;
            },
            launch(D, b) {
                plat(5, 5, D.gap * 0.8, 1.5, 0.5, b, { bouncer: true });
                const lw = D.size + 4, land = plat(lw, lw, 3.5, 14 + D.t * 4, 0.3, b);
                decoratePlat(land, lw, lw, D, b, { mult: 1.35 });
                if (b >= 4 && MODE().hazards && rng() < 0.45 + D.t * 0.3) {
                    const across = { dirX: -Math.sin(gen.angle), dirZ: Math.cos(gen.angle) };
                    createObstacle(land.body.position.x, land.body.position.y, land.body.position.z, lw, lw, true, b, { kind: 'sweep', amp: lw * 0.22, speed: 0.62, ...across });
                }
                return 2;
            },
            bridge(D, b) {
                const a = gen.angle + 0.5, px = -Math.sin(a), pz = Math.cos(a);
                plat(6, 6, D.gap * 0.7, D.rise * 0.8, 0.5, b, { moving: { dirX: px, dirZ: pz, amp: 2.6 + D.t * 1.6, speed: 0.45 + D.t * 0.3 } });
                const dw = D.size, dest = plat(dw, dw, 1.2, D.rise * 0.8, 0.3, b);
                decoratePlat(dest, dw, dw, D, b, { mult: 1.2, kind: 'spin' });
                return 2;
            },
            gauntlet(D, b) {
                const w = 13 + D.t * 3, p = plat(w, w, D.gap * 0.8, D.rise * 0.8, 0.55, b, { noProps: true });
                const hazards = MODE().hazards && !MODE().zen;
                const n = 2 + (b >= 2 ? 1 : 0);
                for (let i = 0; i < n; i++) {
                    const ang = (i / n) * Math.PI * 2 + rng() * 0.35, r = w * 0.26;
                    const k = i === 0 ? 'laser_rotor' : (i === 1 ? 'stomp' : 'plasma_mine');
                    createObstacle(p.body.position.x + Math.cos(ang) * r, p.body.position.y, p.body.position.z + Math.sin(ang) * r, w * 0.72, w * 0.72, hazards, b, { kind: k, amp: w * 0.16, speed: 0.8 + D.t * 0.2 });
                }
                return 1;
            },
            sweepers(D, b) {
                const w = 15 + D.t * 2, d = 11, p = plat(w, d, D.gap * 0.75, D.rise * 0.8, 0.5, b, { noProps: true });
                const across = { dirX: -Math.sin(gen.angle), dirZ: Math.cos(gen.angle) };
                const deadly = MODE().hazards && !MODE().zen;
                const k = rng() < 0.45 ? 'pendulum' : (rng() < 0.5 ? 'stomp' : 'sweep');
                createObstacle(p.body.position.x, p.body.position.y, p.body.position.z, w, d, deadly, b, { kind: k, amp: w * 0.24, speed: 0.68 + D.t * 0.25, ...across });
                createObstacle(p.body.position.x + across.dirX * w * 0.18, p.body.position.y, p.body.position.z + across.dirZ * d * 0.18, 6, 6, deadly, b, { kind: 'laser_rotor', amp: 0.5, speed: 1.1 });
                return 1;
            },
            lanes(D, b) {
                const w = 16 + D.t, d = 12, p = plat(w, d, D.gap * 0.75, D.rise * 0.8, 0.5, b, { noProps: true });
                const px = p.body.position.x, py = p.body.position.y, pz = p.body.position.z;
                const across = { dirX: -Math.sin(gen.angle), dirZ: Math.cos(gen.angle) };
                createObstacle(px + across.dirX * w * 0.32, py, pz + across.dirZ * d * 0.1, 5.2, d * 0.5, false, b, { kind: 'spin', amp: 0.4, speed: 1.05 });
                createObstacle(px - across.dirX * w * 0.32, py, pz - across.dirZ * d * 0.1, 5.2, d * 0.5, false, b, { kind: 'spin', amp: 0.4, speed: 1.05 });
                if (MODE().hazards && !MODE().zen) {
                    const k = rng() < 0.5 ? 'laser_rotor' : 'stomp';
                    createObstacle(px, py, pz, 5.2, 5.2, true, b, { kind: k, amp: 1.1, speed: 0.95 });
                }
                return 1;
            },
            split(D, b) {
                const sx = genCurrentX, sy = genCurrentY, sz = genCurrentZ, sa = gen.angle, sw = gen.prevW, sd = gen.prevD, w = Math.max(6.5, D.size * 0.9);
                const A = placeNext(w, w, D.gap * 0.8, D.rise * 0.8, 0.5 - 0.75); const platA = createPlatform(A.x, A.y, A.z, w, 1, w, b, { noProps: true }); const ax = A.x, az = A.z;
                decoratePlat(platA, w, w, D, b, { mult: 1.25 });
                genCurrentX = sx; genCurrentY = sy; genCurrentZ = sz; gen.angle = sa; gen.prevW = sw; gen.prevD = sd;
                const B = placeNext(w, w, D.gap * 0.8, D.rise * 0.8, 0.5 + 0.75); const useBouncer = rng() < 0.45; createPlatform(B.x, B.y, B.z, useBouncer ? 5 : w, 1, useBouncer ? 5 : w, b, { bouncer: useBouncer, noProps: true });
                genCurrentX = (ax + B.x) / 2; genCurrentZ = (az + B.z) / 2; gen.angle = sa + 0.5; gen.prevW = gen.prevD = w;
                const mergeW = D.size + 2, merge = plat(mergeW, mergeW, D.gap * 0.5, D.rise * 0.8, 0.3, b);
                decoratePlat(merge, mergeW, mergeW, D, b, { mult: 0.9 });
                return 3;
            },
            spiral(D, b) {
                const n = 5, pw = D.size * 0.85;
                for (let i = 0; i < n; i++) {
                    const p = plat(pw, pw, D.gap * 0.75, D.rise * 0.85, 1.05, b);
                    if (i === 2 || i === 4) decoratePlat(p, pw, pw, D, b, { mult: 1.05 });
                }
                return n;
            },
            rest(D, b) { plat(14, 14, D.gap * 0.6, D.rise * 0.7, 0.5, b, { landmark: true }); return 1; },
            // Pezzi "firmati" ogni ~70 m (dopo il checkpoint): personalità per bioma
            sigBridge(D, b) {
                const a = gen.angle + 0.45, px = -Math.sin(a), pz = Math.cos(a);
                plat(7, 7, D.gap * 0.55, D.rise * 0.7, 0.4, b, { noProps: true, landmark: true });
                for (let i = 0; i < 3; i++) {
                    plat(4.2, 4.2, 1.1 + D.t * 0.4, 0.9, 0.22, b, { moving: { dirX: px, dirZ: pz, amp: 2.2 + i * 0.35, speed: 0.42 + D.t * 0.2 }, noProps: true });
                }
                const land = plat(D.size + 3, D.size + 3, 1.4, D.rise * 0.85, 0.35, b, { landmark: true });
                decoratePlat(land, D.size + 3, D.size + 3, D, b, { mult: 1.1, kind: 'spin' });
                return 5;
            },
            sigCanyon(D, b) {
                plat(9, 9, D.gap * 0.65, D.rise * 0.75, 0.4, b, { noProps: true });
                plat(5, 5, D.gap * 0.5, 1.2, 0.25, b, { bouncer: true });
                const lw = D.size + 5, land = plat(lw, lw, 4.2 + D.t * 1.2, 1.0, 0.2, b, { landmark: true });
                decoratePlat(land, lw, lw, D, b, { mult: 1.2 });
                return 3;
            },
            sigHelix(D, b) {
                const n = 6, pw = Math.max(5.5, D.size * 0.72);
                for (let i = 0; i < n; i++) {
                    const p = plat(pw, pw, D.gap * 0.55, D.rise * 0.78, 1.15, b, { noProps: true, landmark: i === n - 1 });
                    if (i === n - 1) decoratePlat(p, pw, pw, D, b, { mult: 1.0 });
                }
                return n;
            },
            sigArena(D, b) {
                const w = 16 + D.t * 2, p = plat(w, w, D.gap * 0.7, D.rise * 0.8, 0.5, b, { landmark: true, noProps: true });
                if (MODE().hazards && b >= 1) {
                    const across = { dirX: -Math.sin(gen.angle), dirZ: Math.cos(gen.angle) };
                    const k = b >= 5 && rng() < 0.5 ? 'plasma_mine' : (b >= 3 ? 'laser_rotor' : 'orbit');
                    createObstacle(p.body.position.x, p.body.position.y, p.body.position.z, w * 0.7, w * 0.7, b >= 3 && rng() < 0.45, b, { kind: k, amp: w * 0.22, speed: 0.58 + D.t * 0.2 });
                    if (b >= 4) createObstacle(p.body.position.x + across.dirX * w * 0.16, p.body.position.y, p.body.position.z + across.dirZ * w * 0.16, 5, 5, false, b, { kind: 'stomp', amp: 0.4, speed: 1.0 });
                }
                plat(D.size, D.size, 1.6, D.rise * 0.75, 0.35, b);
                return 2;
            },
            sigTwin(D, b) {
                const sx = genCurrentX, sy = genCurrentY, sz = genCurrentZ, sa = gen.angle, sw = gen.prevW, sd = gen.prevD, w = Math.max(7, D.size * 0.95);
                const A = placeNext(w, w, D.gap * 0.75, D.rise * 0.85, 0.5 - 0.85);
                const platA = createPlatform(A.x, A.y, A.z, w, 1, w, b, { landmark: true, noProps: true });
                decoratePlat(platA, w, w, D, b, { mult: 1.15 });
                genCurrentX = sx; genCurrentY = sy; genCurrentZ = sz; gen.angle = sa; gen.prevW = sw; gen.prevD = sd;
                const B = placeNext(w, w, D.gap * 0.75, D.rise * 0.85, 0.5 + 0.85);
                createPlatform(B.x, B.y, B.z, w, 1, w, b, { bouncer: rng() < 0.4, noProps: true });
                genCurrentX = (A.x + B.x) / 2; genCurrentZ = (A.z + B.z) / 2; gen.angle = sa + 0.5; gen.prevW = gen.prevD = w;
                const mergeW = D.size + 3, merge = plat(mergeW, mergeW, D.gap * 0.55, D.rise * 0.85, 0.3, b, { landmark: true });
                decoratePlat(merge, mergeW, mergeW, D, b, { mult: 0.95 });
                return 3;
            }
        };
        const SIG_PATTERNS = [
            { key: 'sigBridge', label: 'Ponte Sospeso' },
            { key: 'sigCanyon', label: 'Canyon' },
            { key: 'sigHelix', label: 'Elica' },
            { key: 'sigArena', label: 'Arena' },
            { key: 'sigTwin', label: 'Gemelli' }
        ];
        const SIG_LABELS = { sigBridge: 'Ponte Sospeso', sigCanyon: 'Canyon', sigHelix: 'Elica', sigArena: 'Arena', sigTwin: 'Gemelli' };
        function pickSignature(b) { return SIG_PATTERNS[b % SIG_PATTERNS.length]; }
        function pickPattern(D, b) {
            const w = { hops: 4.5, stairs: 2.8, zigzag: 2.8, stepping: 2.4, gauntlet: 2.2 };
            if (b >= 1) { w.longjump = 2 + D.t * 2; w.bridge = 2.2; w.slalom = 2.0 + D.t * 1.4; w.gauntlet = 3.0 + D.t * 2.8; w.lanes = 2.2 + D.t * 1.6; }
            if (b >= 2) { w.launch = MODE().lava ? 3 : 2; w.split = 2.2; w.sweepers = 2.2 + D.t * 2.2; w.carousel = 1.8 + D.t * 1.6; }
            if (b >= 4) w.spiral = 2;
            if (b >= 6) { w.hops = 2.2; w.stairs = 3.0; w.gauntlet = 4.0 + D.t * 2; }
            if (MODE().zen) {
                w.hops = (w.hops || 5) + 2; w.stairs = (w.stairs || 3) + 1; w.stepping = (w.stepping || 2) + 1.5;
                if (w.gauntlet) w.gauntlet *= 0.4; if (w.sweepers) w.sweepers *= 0.35; if (w.lanes) w.lanes *= 0.5; if (w.carousel) w.carousel *= 0.4;
            }
            delete w[gen.lastPattern];
            let total = 0; for (const k in w) total += w[k]; let r = rng() * total;
            for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'hops';
        }
        function generateMorePlatforms(count) {
            let made = 0, guard = 0;
            while (made < count && genCurrentY < 1000 && guard++ < 60) {
                const D = difficulty(genCurrentY), b = D.b;
                if (genCurrentY >= nextTargetCheckpoint) {
                    const p = placeNext(20, 20, 1.5, 2, 0.5); createPlatform(p.x, p.y, p.z, 20, 1.5, 20, clamp(Math.floor(p.y / 70), 0, 14), { flag: true });
                    checkpoints.push({ y: nextTargetCheckpoint, pos: { x: p.x, y: p.y, z: p.z }, reached: false });
                    nextTargetCheckpoint += 70; gen.sinceCheckpoint = 0; gen.lastPattern = 'checkpoint'; made++; continue;
                }
                if (genCurrentY >= gen.nextRestY) { made += PATTERN_FNS.rest(D, b); gen.nextRestY += 70; gen.lastPattern = 'rest'; continue; }
                let key;
                if (gen.sinceCheckpoint === 0) {
                    key = 'hops';
                    const E = Object.assign({}, D, { gap: D.gap * 0.7, rise: D.rise * 0.85 });
                    made += PATTERN_FNS.hops(E, b);
                } else if (gen.sinceCheckpoint === 1) {
                    const sig = pickSignature(b);
                    key = sig.key;
                    made += PATTERN_FNS[key](D, b);
                    gen.pendingSigLabel = sig.label;
                } else {
                    key = pickPattern(D, b);
                    made += PATTERN_FNS[key](D, b);
                }
                gen.lastPattern = key; gen.sinceCheckpoint++;
            }
            highestPlatformY = genCurrentY;
        }
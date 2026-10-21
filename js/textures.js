/* ==========================================================================
           SEZIONE 8: LIBRERIA TEXTURE PROCEDURALI (colore + altezza → normal map + roughness)
           ========================================================================== */
        const maxAniso = () => renderer.capabilities.getMaxAnisotropy() || 4;
        const mkTex = (canvas, srgb = true) => { const t = new THREE.CanvasTexture(canvas); t.anisotropy = maxAniso(); if (srgb) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
        const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
        const hexRGB = (hex) => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
        const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        const rgbStr = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
        const shade = (hex, l) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return '#' + c.getHexString(); };
        // Rumore 2D periodico (ripete su [0,1) → texture tassellabili)
        function makeNoise2D(seed, grid = 32) {
            const r = makeRng(seed), vals = new Float32Array(grid * grid); for (let i = 0; i < vals.length; i++) vals[i] = r();
            const v = (a, b) => vals[(((a % grid) + grid) % grid) + (((b % grid) + grid) % grid) * grid];
            return (x, y) => { const gx = x * grid, gy = y * grid, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return lerp(lerp(v(ix, iy), v(ix + 1, iy), sx), lerp(v(ix, iy + 1), v(ix + 1, iy + 1), sx), sy); };
        }
        const fbm2 = (n, x, y, oct = 4) => { let v = 0, a = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { v += a * n((x * f) % 1, (y * f) % 1); norm += a; f *= 2; a *= 0.5; } return v / norm; };
        function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
        // Costruisce le mappe: fn(u, v) → { c: [r,g,b], h: 0..1, e?: [r,g,b] (emissivo) }
        function pixelMaps(size, fn) {
            const [cc, cctx] = mkCanvas(size, size), [hc, hctx] = mkCanvas(size, size), [ec, ectx] = mkCanvas(size, size);
            const cd = cctx.createImageData(size, size), hd = hctx.createImageData(size, size), ed = ectx.createImageData(size, size); let hasE = false;
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                const o = (y * size + x) * 4, p = fn(x / size, y / size);
                cd.data[o] = p.c[0]; cd.data[o + 1] = p.c[1]; cd.data[o + 2] = p.c[2]; cd.data[o + 3] = 255;
                const h = clamp(p.h, 0, 1) * 255; hd.data[o] = hd.data[o + 1] = hd.data[o + 2] = h; hd.data[o + 3] = 255;
                if (p.e) { hasE = true; ed.data[o] = p.e[0]; ed.data[o + 1] = p.e[1]; ed.data[o + 2] = p.e[2]; } ed.data[o + 3] = 255;
            }
            cctx.putImageData(cd, 0, 0); hctx.putImageData(hd, 0, 0); ectx.putImageData(ed, 0, 0);
            return { color: cc, height: hc, emissive: hasE ? ec : null };
        }
        function normalFromHeight(hCanvas, strength = 2.0) {
            const s = hCanvas.width, src = hCanvas.getContext('2d').getImageData(0, 0, s, s).data, [nc, nctx] = mkCanvas(s, s), out = nctx.createImageData(s, s);
            const H = (x, y) => src[((((y % s) + s) % s) * s + (((x % s) + s) % s)) * 4] / 255;
            for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
                const nx = (H(x - 1, y) - H(x + 1, y)) * strength, ny = (H(x, y + 1) - H(x, y - 1)) * strength, len = Math.sqrt(nx * nx + ny * ny + 1), o = (y * s + x) * 4;
                out.data[o] = (nx / len * 0.5 + 0.5) * 255; out.data[o + 1] = (ny / len * 0.5 + 0.5) * 255; out.data[o + 2] = (1 / len) * 255; out.data[o + 3] = 255;
            }
            nctx.putImageData(out, 0, 0); return nc;
        }
        function roughnessFromHeight(hCanvas, base, range, invert = false) {
            const s = hCanvas.width, src = hCanvas.getContext('2d').getImageData(0, 0, s, s).data, [rc, rctx] = mkCanvas(s, s), out = rctx.createImageData(s, s), r = makeRng(3);
            for (let i = 0; i < s * s; i++) { let h = src[i * 4] / 255; if (invert) h = 1 - h; const v = clamp(base + (h - 0.5) * range + (r() - 0.5) * 0.08, 0.02, 1) * 255, o = i * 4; out.data[o] = out.data[o + 1] = out.data[o + 2] = v; out.data[o + 3] = 255; }
            rctx.putImageData(out, 0, 0); return rc;
        }
        // Consumo: usura ai bordi delle tessere e graffi casuali disegnati sopra colore e altezza
        function addWear(maps, seed, amount = 0.5) {
            const s = maps.color.width, r = makeRng(seed), cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d');
            cc.globalAlpha = 0.09 * amount; hc.globalAlpha = 0.25 * amount;
            for (let i = 0; i < 14; i++) { const x = r() * s, y = r() * s, l = 8 + r() * 40, a = r() * Math.PI; cc.strokeStyle = r() > 0.5 ? '#fff' : '#000'; cc.lineWidth = 1 + r() * 1.5; cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cc.stroke(); hc.strokeStyle = '#000'; hc.lineWidth = cc.lineWidth; hc.beginPath(); hc.moveTo(x, y); hc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); hc.stroke(); }
            cc.globalAlpha = 0.06 * amount; for (let i = 0; i < 1800; i++) { cc.fillStyle = r() > 0.5 ? '#fff' : '#000'; cc.fillRect(r() * s, r() * s, 1.5, 1.5); }
            cc.globalAlpha = 1; hc.globalAlpha = 1;
        }

        // Pattern per bioma. Ogni funzione riceve la definizione bioma e restituisce { maps, normalStrength, rough:[base,range], metal, emissiveIntensity }
        const S = 256;
        // Helper Voronoi periodico per rocce, ghiaccio, basalto, cristalli e piastrelle
        function makeVoronoi(seed, count = 16) {
            const r = makeRng(seed), pts = [];
            for (let i = 0; i < count; i++) pts.push([r(), r(), r()]);
            return (u, v) => {
                let d1 = 9, d2 = 9, id = 0, val = 0;
                for (let i = 0; i < count; i++) {
                    const px = pts[i][0], py = pts[i][1];
                    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
                        const dx = u - px - ox, dy = v - py - oy, d = dx * dx + dy * dy;
                        if (d < d1) { d2 = d1; d1 = d; id = i; val = pts[i][2]; } else if (d < d2) d2 = d;
                    }
                }
                const s1 = Math.sqrt(d1), s2 = Math.sqrt(d2);
                return { d1: s1, edge: s2 - s1, id, val };
            };
        }
        const PATTERNS = {
            grass(b) {
                const n = makeNoise2D(11), n2 = makeNoise2D(12), vor = makeVoronoi(13, 14), g1 = hexRGB(b.c1), g2 = hexRGB(b.c2), gDark = hexRGB('#167a3e'), dirt = hexRGB('#6e4726'), stone = [148, 156, 166], r = makeRng(5);
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 5), d = fbm2(n2, u, v, 3), blades = n((u * 8) % 1, (v * 8) % 1);
                    const vc = vor(u, v), isStone = vc.d1 < 0.055 && d < 0.45, isDirt = d < 0.36;
                    let c = mixRGB(mixRGB(gDark, g1, f), g2, blades * 0.75);
                    let h = 0.48 + f * 0.32 + blades * 0.2;
                    if (isDirt) { const dt = smooth01(0.36 - d, 0, 0.08); c = mixRGB(c, dirt, dt * 0.82); h = lerp(h, 0.24 + f * 0.12, dt); }
                    if (isStone) { const st = smooth01(0.055 - vc.d1, 0, 0.018); c = mixRGB(c, mixRGB(stone, [195, 202, 210], vc.val), st); h = lerp(h, 0.72 + vc.val * 0.15, st); }
                    return { c, h };
                });
                const cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d');
                // Ciuffi di trifoglio e fiorellini con petali e bottone centrale
                for (let i = 0; i < 65; i++) {
                    const fx = r() * S, fy = r() * S, rad = 1.8 + r() * 1.6;
                    const pCol = ['#fff7ee', '#ffd166', '#ff8ac4', '#a8e6ff'][Math.floor(r() * 4)];
                    cc.fillStyle = 'rgba(15,65,30,.35)'; cc.beginPath(); cc.arc(fx + 1, fy + 1, rad + 1.2, 0, 7); cc.fill();
                    cc.fillStyle = pCol;
                    for (let p = 0; p < 5; p++) { const a = p * 1.256; cc.beginPath(); cc.arc(fx + Math.cos(a) * rad * 0.7, fy + Math.sin(a) * rad * 0.7, rad * 0.65, 0, 7); cc.fill(); }
                    cc.fillStyle = '#ffb830'; cc.beginPath(); cc.arc(fx, fy, rad * 0.48, 0, 7); cc.fill();
                    hc.fillStyle = '#d8d8d8'; hc.beginPath(); hc.arc(fx, fy, rad, 0, 7); hc.fill();
                }
                return { maps, normalStrength: 2.1, rough: [0.88, 0.14], metal: 0.02 };
            },
            sand(b) {
                const n = makeNoise2D(21), n2 = makeNoise2D(23), vor = makeVoronoi(24, 10), s1 = hexRGB(b.c2), s2 = hexRGB(shade(b.c1, -0.1)), sCrest = [255, 244, 210];
                const maps = pixelMaps(S, (u, v) => {
                    const warp = fbm2(n, u, v, 3) * 0.16 + fbm2(n2, (u * 2) % 1, (v * 2) % 1, 2) * 0.05;
                    const phase = (v + warp) * Math.PI * 2 * 7;
                    const w = Math.pow(Math.sin(phase) * 0.5 + 0.5, 1.35);
                    const crest = smooth01(w, 0.78, 0.98);
                    const grain = n2((u * 12) % 1, (v * 12) % 1);
                    const vc = vor(u, v), pebble = smooth01(0.042 - vc.d1, 0, 0.015) * (vc.val > 0.65 ? 1 : 0);
                    let c = mixRGB(mixRGB(s2, s1, w), sCrest, crest * 0.55 + grain * 0.08);
                    if (pebble > 0) c = mixRGB(c, [185, 138, 86], pebble * 0.85);
                    return { c, h: 0.28 + w * 0.52 + crest * 0.1 + grain * 0.06 + pebble * 0.2 };
                });
                addWear(maps, 22, 0.35); return { maps, normalStrength: 1.9, rough: [0.84, 0.12], metal: 0.03 };
            },
            ice(b) {
                const n = makeNoise2D(31), vor = makeVoronoi(33, 20), i1 = hexRGB('#e8faff'), i2 = hexRGB(b.c2), deep = hexRGB('#0c4a8a'), r = makeRng(32);
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 4), vc = vor(u, v);
                    const seam = 1 - smooth01(vc.edge, 0.006, 0.028);
                    const facet = mixRGB(mixRGB(deep, i2, 0.35 + vc.val * 0.65), i1, f * 0.75);
                    const c = mixRGB(facet, [240, 252, 255], seam * 0.85);
                    return { c, h: 0.72 + vc.val * 0.16 + f * 0.12 - seam * 0.35, e: mixRGB([0, 0, 0], [112, 214, 255], seam * 0.25 + vc.val * 0.08) };
                });
                const cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d');
                for (let i = 0; i < 12; i++) {
                    let x = r() * S, y = r() * S; cc.strokeStyle = 'rgba(220,248,255,.7)'; hc.strokeStyle = '#181818'; cc.lineWidth = hc.lineWidth = 1.3;
                    cc.beginPath(); hc.beginPath(); cc.moveTo(x, y); hc.moveTo(x, y);
                    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 52; y += (r() - 0.5) * 52; cc.lineTo(x, y); hc.lineTo(x, y); }
                    cc.stroke(); hc.stroke();
                }
                return { maps, normalStrength: 1.85, rough: [0.12, 0.16], metal: 0.12, emissiveIntensity: 0.35 };
            },
            basalt(b) {
                const n = makeNoise2D(41), vor = makeVoronoi(43, 18), rock1 = hexRGB('#1c1b22'), rock2 = hexRGB('#3d3846'), lava = hexRGB('#ff4d12'), lava2 = hexRGB('#ffe047');
                const maps = pixelMaps(S, (u, v) => {
                    const vc = vor(u, v), f = fbm2(n, u, v, 4);
                    const edge = vc.edge + (f - 0.5) * 0.025;
                    const rockMask = smooth01(edge, 0.018, 0.055);
                    const rimHeat = (1 - smooth01(edge, 0.04, 0.11)) * rockMask;
                    const glow = 1 - rockMask;
                    const lavaCol = mixRGB(lava, lava2, smooth01(glow * (0.6 + f * 0.5), 0.2, 0.9));
                    const rockCol = mixRGB(mixRGB(rock1, rock2, f * 0.7 + vc.val * 0.3), [255, 95, 25], rimHeat * 0.65);
                    const c = mixRGB(lavaCol, rockCol, rockMask);
                    const e = (glow > 0.01 || rimHeat > 0.05) ? mixRGB([0, 0, 0], lavaCol, Math.max(glow, rimHeat * 0.55)) : [0, 0, 0];
                    return { c, h: 0.15 + rockMask * (0.62 + vc.val * 0.15 + f * 0.1), e };
                });
                addWear(maps, 42, 0.55); return { maps, normalStrength: 2.8, rough: [0.82, 0.15], metal: 0.08, emissiveIntensity: 1.35 };
            },
            neon(b) {
                const base = hexRGB('#100820'), base2 = hexRGB('#1c1036'), line = hexRGB(b.accent), line2 = hexRGB('#38b6ff');
                const maps = pixelMaps(S, (u, v) => {
                    const gx = (u * 4) % 1, gy = (v * 4) % 1, dx = Math.min(gx, 1 - gx), dy = Math.min(gy, 1 - gy);
                    const d = Math.min(dx, dy) * 4, corner = Math.hypot(dx, dy) * 4;
                    const subX = Math.abs(((u * 16) % 1) - 0.5), subY = Math.abs(((v * 16) % 1) - 0.5), sub = 1 - smooth01(Math.min(subX, subY), 0.0, 0.08);
                    const l = 1 - smooth01(d, 0.02, 0.065), glow = 1 - smooth01(d, 0.06, 0.32), node = 1 - smooth01(corner, 0.08, 0.16);
                    const cell = (Math.floor(u * 4) + Math.floor(v * 4)) % 2;
                    const lc = cell ? line : line2;
                    let c = mixRGB(base, base2, sub * 0.45);
                    c = mixRGB(mixRGB(c, lc, glow * 0.32), lc, Math.max(l, node * 0.9));
                    if (node > 0.5) c = mixRGB(c, [255, 255, 255], (node - 0.5) * 1.4);
                    return { c, h: 0.65 - l * 0.38 + sub * 0.06 + node * 0.2, e: mixRGB([0, 0, 0], lc, Math.max(l, node) * 0.98 + glow * 0.16 + sub * 0.04) };
                });
                return { maps, normalStrength: 1.7, rough: [0.22, 0.12], metal: 0.42, emissiveIntensity: 1.05 };
            },
            candy(b) {
                const p1 = hexRGB(b.c1), p2 = hexRGB('#fff5fa'), p3 = hexRGB('#ffd166'), r = makeRng(51);
                const maps = pixelMaps(S, (u, v) => {
                    const wave = Math.sin((u * 2 + v * 2 + Math.sin(u * Math.PI * 2) * 0.08) * Math.PI * 2 * 2);
                    const band = smooth01(wave, -0.15, 0.15);
                    const pin = 1 - smooth01(Math.abs(wave), 0.0, 0.12);
                    let c = mixRGB(mixRGB(p1, p2, band), p3, pin * 0.35);
                    return { c, h: 0.54 + wave * 0.15 };
                });
                const cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d');
                // Confetti e zuccherini colorati a capsula 3D
                for (let i = 0; i < 42; i++) {
                    const x = 14 + r() * (S - 28), y = 14 + r() * (S - 28), len = 5 + r() * 7, rad = 2.4 + r() * 1.8, ang = r() * Math.PI;
                    const col = ['#ffd166', '#38b6ff', '#37e0b0', '#ff5c4d', '#8a5cff', '#ffffff'][Math.floor(r() * 6)];
                    cc.save(); cc.translate(x, y); cc.rotate(ang);
                    cc.strokeStyle = 'rgba(80,10,45,.28)'; cc.lineWidth = rad * 2 + 1.5; cc.lineCap = 'round'; cc.beginPath(); cc.moveTo(-len / 2, 1.5); cc.lineTo(len / 2, 1.5); cc.stroke();
                    cc.strokeStyle = col; cc.lineWidth = rad * 2; cc.beginPath(); cc.moveTo(-len / 2, 0); cc.lineTo(len / 2, 0); cc.stroke();
                    cc.strokeStyle = 'rgba(255,255,255,.55)'; cc.lineWidth = rad * 0.7; cc.beginPath(); cc.moveTo(-len * 0.35, -rad * 0.35); cc.lineTo(len * 0.35, -rad * 0.35); cc.stroke();
                    cc.restore();
                    hc.save(); hc.translate(x, y); hc.rotate(ang); hc.strokeStyle = '#ffffff'; hc.lineWidth = rad * 2; hc.lineCap = 'round'; hc.beginPath(); hc.moveTo(-len / 2, 0); hc.lineTo(len / 2, 0); hc.stroke(); hc.restore();
                }
                return { maps, normalStrength: 1.75, rough: [0.15, 0.1], metal: 0.06 };
            },
            toxic(b) {
                const n = makeNoise2D(61), dark = hexRGB('#1d2414'), grate = hexRGB('#333d24'), yel = hexRGB(b.c1), acid = hexRGB('#c6ff3d'), r = makeRng(62);
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 4), inBand = Math.abs(v - 0.5) < 0.16;
                    const chev = inBand && (Math.sin((u * 6 + Math.abs(v - 0.5) * 4) * Math.PI * 2) > 0);
                    const pool = !inBand && f > 0.62;
                    const grid = ((Math.floor(u * 24) + Math.floor(v * 24)) % 2) * 0.15;
                    let c = chev ? mixRGB(yel, [20, 25, 10], f * 0.25) : pool ? mixRGB(yel, acid, (f - 0.62) * 2.6) : mixRGB(dark, grate, f * 0.7 + grid);
                    const e = pool ? mixRGB([0, 0, 0], acid, 0.45 + (f - 0.62) * 1.4) : chev ? mixRGB([0, 0, 0], yel, 0.18) : [0, 0, 0];
                    return { c, h: pool ? 0.32 : 0.48 + f * 0.2 + (chev ? 0.14 : grid * 0.4), e };
                });
                const cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d'), ec = maps.emissive.getContext('2d');
                for (let i = 0; i < 36; i++) {
                    const x = r() * S, y = r() * S; if (Math.abs(y - S / 2) < S * 0.16) continue;
                    const rad = 2.2 + r() * 6.5;
                    cc.fillStyle = 'rgba(198,255,61,.55)'; cc.beginPath(); cc.arc(x, y, rad, 0, 7); cc.fill();
                    cc.fillStyle = 'rgba(255,255,255,.65)'; cc.beginPath(); cc.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.32, 0, 7); cc.fill();
                    hc.fillStyle = '#fff'; hc.beginPath(); hc.arc(x, y, rad, 0, 7); hc.fill();
                    ec.fillStyle = 'rgba(198,255,61,.45)'; ec.beginPath(); ec.arc(x, y, rad * 0.85, 0, 7); ec.fill();
                }
                addWear(maps, 63, 0.65); return { maps, normalStrength: 2.1, rough: [0.45, 0.25], metal: 0.22, emissiveIntensity: 0.75 };
            },
            waves(b) {
                const n = makeNoise2D(71), vor = makeVoronoi(72, 16), deep = hexRGB('#054a85'), mid = hexRGB(b.c1), light = hexRGB(b.c2), foam = [238, 252, 255];
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 3), vc = vor((u + f * 0.08) % 1, (v + f * 0.08) % 1);
                    const caustic = 1 - smooth01(vc.edge, 0.008, 0.045);
                    const w = Math.sin((v * 5 + Math.sin(u * Math.PI * 2 * 2) * 0.14 + f * 0.2) * Math.PI * 2);
                    const crest = smooth01(w, 0.72, 0.96);
                    let c = mixRGB(deep, mid, w * 0.5 + 0.5);
                    c = mixRGB(c, light, caustic * 0.65 + f * 0.2);
                    c = mixRGB(c, foam, crest * 0.82);
                    return { c, h: 0.42 + w * 0.22 + caustic * 0.18 + crest * 0.12, e: mixRGB([0, 0, 0], [77, 210, 255], caustic * 0.28 + crest * 0.15) };
                });
                return { maps, normalStrength: 1.9, rough: [0.16, 0.14], metal: 0.12, emissiveIntensity: 0.45 };
            },
            solar(b) {
                const n = makeNoise2D(81), o1 = hexRGB(b.c1), o2 = hexRGB(b.c2), core = [255, 252, 220], bronze = hexRGB('#8c5308');
                const maps = pixelMaps(S, (u, v) => {
                    const dx = u - 0.5, dy = v - 0.5, a = Math.atan2(dy, dx), d = Math.sqrt(dx * dx + dy * dy) * 2;
                    const f = fbm2(n, u, v, 3);
                    const ray = Math.sin(a * 16 + Math.sin(d * 8) * 0.35) * 0.5 + 0.5;
                    const ring1 = 1 - smooth01(Math.abs(d - 0.42), 0.01, 0.04);
                    const ring2 = 1 - smooth01(Math.abs(d - 0.76), 0.01, 0.045);
                    const disc = 1 - smooth01(d, 0.16, 0.25);
                    let c = mixRGB(mixRGB(o1, o2, ray * 0.8 + f * 0.2), bronze, (1 - ray) * 0.25);
                    c = mixRGB(c, core, Math.max(disc, (ring1 + ring2) * 0.75));
                    return { c, h: 0.45 + ray * 0.18 + (ring1 + ring2) * 0.22 + disc * 0.3, e: mixRGB([0, 0, 0], core, disc * 0.75 + (ring1 + ring2) * 0.35 + ray * 0.06) };
                });
                addWear(maps, 82, 0.25); return { maps, normalStrength: 1.75, rough: [0.3, 0.16], metal: 0.38, emissiveIntensity: 0.6 };
            },
            circuit(b) {
                const base = hexRGB('#07151b'), sub = hexRGB('#102b34'), trace = hexRGB(b.c1), gold = [255, 209, 102], r = makeRng(91);
                const maps = pixelMaps(S, (u, v) => {
                    const grid = ((Math.floor(u * 32) + Math.floor(v * 32)) % 2) * 0.22;
                    const border = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
                    const frame = 1 - smooth01(border, 0.02, 0.05);
                    return { c: mixRGB(mixRGB(base, sub, grid), trace, frame * 0.35), h: 0.48 + frame * 0.18 };
                });
                const cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d'), [ec, ectx] = mkCanvas(S, S);
                maps.emissive = ec; ectx.fillStyle = '#000'; ectx.fillRect(0, 0, S, S);
                // Microchip integrati
                for (let ic = 0; ic < 4; ic++) {
                    const cx = 36 + (ic % 2) * 128, cy = 36 + Math.floor(ic / 2) * 128, cw = 36, ch = 36;
                    cc.fillStyle = '#d4af37'; hc.fillStyle = '#c8c8c8';
                    for (let p = 4; p < cw; p += 8) { cc.fillRect(cx + p - 1, cy - 5, 3, cw + 10); cc.fillRect(cx - 5, cy + p - 1, cw + 10, 3); hc.fillRect(cx + p - 1, cy - 5, 3, cw + 10); hc.fillRect(cx - 5, cy + p - 1, cw + 10, 3); }
                    cc.fillStyle = '#0c1820'; cc.fillRect(cx, cy, cw, ch); cc.strokeStyle = rgbStr(trace, 0.7); cc.lineWidth = 1.5; cc.strokeRect(cx, cy, cw, ch);
                    hc.fillStyle = '#e8e8e8'; hc.fillRect(cx, cy, cw, ch);
                    ectx.strokeStyle = rgbStr(trace, 0.55); ectx.lineWidth = 1.5; ectx.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);
                }
                // Piste luminose e piazzole dorate
                for (let i = 0; i < 28; i++) {
                    let x = Math.floor(r() * 16) * 16, y = Math.floor(r() * 16) * 16;
                    const isGold = i % 5 === 0, tCol = isGold ? rgbStr(gold) : rgbStr(trace);
                    [cc, hc, ectx].forEach((c, k) => { c.strokeStyle = k === 0 ? tCol : k === 1 ? '#fff' : (isGold ? rgbStr(gold, 0.65) : rgbStr(trace, 0.9)); c.lineWidth = isGold ? 2.2 : 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); });
                    for (let k = 0; k < 4; k++) {
                        if (r() > 0.5) x = (x + (r() > 0.5 ? 1 : -1) * 16 * (1 + Math.floor(r() * 3)) + S) % S;
                        else y = (y + (r() > 0.5 ? 1 : -1) * 16 * (1 + Math.floor(r() * 3)) + S) % S;
                        [cc, hc, ectx].forEach(c => c.lineTo(x, y));
                    }
                    [cc, hc, ectx].forEach(c => c.stroke());
                    [cc, hc, ectx].forEach((c, k) => { c.fillStyle = k === 0 ? '#e8fffd' : '#ffffff'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); });
                }
                return { maps, normalStrength: 2.0, rough: [0.28, 0.16], metal: 0.52, emissiveIntensity: 0.95 };
            },
            blood(b) {
                const n = makeNoise2D(101), vor = makeVoronoi(103, 15), s1 = hexRGB('#2a070b'), s2 = hexRGB('#6e141b'), veinCol = hexRGB('#ff2e43'), r = makeRng(102);
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 5), vc = vor(u, v);
                    const vein = 1 - smooth01(vc.edge + (f - 0.5) * 0.02, 0.008, 0.036);
                    const c = mixRGB(mixRGB(s1, s2, f * 0.8 + vc.val * 0.2), veinCol, vein * 0.85);
                    return { c, h: 0.45 + f * 0.38 - vein * 0.22, e: mixRGB([0, 0, 0], veinCol, vein * 0.55) };
                });
                const cc = maps.color.getContext('2d');
                for (let i = 0; i < 10; i++) {
                    const x = r() * S, y = r() * S * 0.7, l = 20 + r() * 60;
                    const g = cc.createLinearGradient(x, y, x, y + l); g.addColorStop(0, 'rgba(255,46,67,.85)'); g.addColorStop(1, 'rgba(214,48,49,0)');
                    cc.fillStyle = g; cc.fillRect(x - 2, y, 4, l); cc.fillStyle = 'rgba(255,130,130,.9)'; cc.beginPath(); cc.arc(x, y + l * 0.95, 3, 0, 7); cc.fill();
                }
                return { maps, normalStrength: 2.3, rough: [0.38, 0.28], metal: 0.1, emissiveIntensity: 0.65 };
            },
            cloud(b) {
                const n = makeNoise2D(111), vor = makeVoronoi(112, 12), w1 = [253, 254, 255], w2 = hexRGB('#b8d4f2'), gold = [255, 236, 185];
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 5), vc = vor(u, v);
                    const puff = clamp(1 - vc.d1 * 2.2 + f * 0.35, 0, 1);
                    const rim = 1 - smooth01(Math.abs(puff - 0.65), 0.0, 0.12);
                    let c = mixRGB(w2, w1, smooth01(puff, 0.2, 0.78));
                    c = mixRGB(c, gold, rim * 0.25);
                    return { c, h: 0.35 + puff * 0.62 };
                });
                return { maps, normalStrength: 1.8, rough: [0.92, 0.08], metal: 0.0 };
            },
            hull(b) {
                const n = makeNoise2D(121), m1 = hexRGB(b.c1), m2 = hexRGB(b.c2), glow = hexRGB('#7fb2ff'), r = makeRng(122);
                const maps = pixelMaps(S, (u, v) => {
                    const gx = (u * 2) % 1, gy = (v * 2) % 1, dx = Math.min(gx, 1 - gx), dy = Math.min(gy, 1 - gy);
                    const seam = 1 - smooth01(Math.min(dx, dy) * 2, 0.02, 0.055), bevel = 1 - smooth01(Math.min(dx, dy) * 2, 0.055, 0.12);
                    const f = fbm2(n, u, v, 3), plate = Math.floor(u * 2) + Math.floor(v * 2) * 2;
                    let c = mixRGB(m1, m2, (plate % 3) * 0.22 + f * 0.25);
                    c = mixRGB(c, [185, 210, 245], bevel * 0.25);
                    c = mixRGB(c, [8, 14, 28], seam * 0.8);
                    return { c, h: 0.62 + bevel * 0.12 - seam * 0.45 + f * 0.05, e: seam > 0.65 ? mixRGB([0, 0, 0], glow, (seam - 0.65) * 1.2) : [0, 0, 0] };
                });
                const cc = maps.color.getContext('2d'), hc = maps.height.getContext('2d');
                for (let px = 0; px < 2; px++) for (let py = 0; py < 2; py++) for (let k = 0; k < 10; k++) {
                    const ox = px * 128, oy = py * 128, pad = 11, span = 128 - pad * 2;
                    const x = k < 4 ? ox + pad + (k % 2) * span : ox + pad + ((k - 4) % 3 + 1) * span / 4;
                    const y = k < 4 ? oy + pad + Math.floor(k / 2) * span : oy + pad + (k > 6 ? span : 0);
                    cc.fillStyle = 'rgba(0,0,0,.45)'; cc.beginPath(); cc.arc(x + 1, y + 1, 3.2, 0, 7); cc.fill();
                    cc.fillStyle = '#b8ccf0'; cc.beginPath(); cc.arc(x, y, 2.8, 0, 7); cc.fill();
                    hc.fillStyle = '#fff'; hc.beginPath(); hc.arc(x, y, 3, 0, 7); hc.fill();
                }
                addWear(maps, 123, 0.45); return { maps, normalStrength: 2.4, rough: [0.38, 0.2], metal: 0.68, emissiveIntensity: 0.45 };
            },
            crystal(b) {
                const vor = makeVoronoi(131, 22), n = makeNoise2D(132), c1 = hexRGB(b.c1), c2 = hexRGB(b.c2), bright = [250, 235, 255], cyan = [160, 240, 255];
                const maps = pixelMaps(S, (u, v) => {
                    const vc = vor(u, v), f = fbm2(n, u, v, 3);
                    const lum = ((vc.id * 37) % 10) / 10;
                    const e = 1 - smooth01(vc.edge, 0.008, 0.036);
                    let c = mixRGB(mixRGB(c1, c2, lum * 0.8 + f * 0.2), cyan, (vc.id % 3 === 0 ? 0.22 : 0));
                    c = mixRGB(c, bright, e * 0.82);
                    return { c, h: 0.28 + lum * 0.58 - e * 0.22, e: mixRGB([0, 0, 0], mixRGB(c2, bright, 0.5), e * 0.5 + lum * 0.08) };
                });
                return { maps, normalStrength: 2.5, rough: [0.1, 0.12], metal: 0.28, emissiveIntensity: 0.65 };
            },
            marble(b) {
                const n = makeNoise2D(141), n2 = makeNoise2D(142), white = [253, 250, 244], grey = [212, 204, 194], gold = hexRGB(b.c1), goldBright = [255, 232, 145];
                const maps = pixelMaps(S, (u, v) => {
                    const f = fbm2(n, u, v, 5), w = fbm2(n2, (u + f * 0.2) % 1, (v + f * 0.2) % 1, 4);
                    const vein = 1 - smooth01(Math.abs(w - 0.5), 0.004, 0.026);
                    const gx = (u * 2) % 1, gy = (v * 2) % 1, border = Math.min(Math.min(gx, 1 - gx), Math.min(gy, 1 - gy));
                    const inlay = 1 - smooth01(Math.abs(border - 0.06), 0.004, 0.016);
                    const goldMask = Math.max(vein * 0.9, inlay);
                    const c = mixRGB(mixRGB(white, grey, f * 0.55), mixRGB(gold, goldBright, inlay), goldMask);
                    return { c, h: 0.64 + f * 0.12 - vein * 0.08 + inlay * 0.12, e: mixRGB([0, 0, 0], goldBright, goldMask * 0.35) };
                });
                return { maps, normalStrength: 1.2, rough: [0.14, 0.14], metal: 0.24, emissiveIntensity: 0.65 };
            },
            bouncer() {
                const g1 = hexRGB('#127a4d'), g2 = hexRGB('#48f5a7'), white = [235, 255, 245];
                const maps = pixelMaps(S, (u, v) => {
                    const dx = u - 0.5, dy = v - 0.5, d = Math.sqrt(dx * dx + dy * dy) * 2;
                    const ring = Math.sin(d * Math.PI * 2 * 4) * 0.5 + 0.5;
                    const chev = Math.abs(dx) < 0.24 && v > 0.14 && v < 0.86 && Math.abs(Math.abs(dx) * 1.5 - (0.86 - v) % 0.32) < 0.055;
                    const rim = 1 - smooth01(Math.abs(d - 0.84), 0.015, 0.05);
                    const hi = chev || rim > 0.5;
                    const c = hi ? white : mixRGB(g1, g2, ring);
                    return { c, h: 0.48 + ring * 0.28 + (hi ? 0.24 : 0), e: mixRGB([0, 0, 0], hi ? white : g2, hi ? 0.95 : ring * 0.42) };
                });
                return { maps, normalStrength: 2.0, rough: [0.25, 0.12], metal: 0.18, emissiveIntensity: 0.85 };
            }
        };
        function smooth01(x, a, b) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

        // Texture dei fianchi su misura per ogni bioma: ciglio erboso, glassa colante, ghiaccioli, fasce neon, fregi dorati, ecc.
        function createSideMaps(b) {
            const n = makeNoise2D(hashString(b.name) % 1000 + 200), pat = b.pattern || '';
            const topCol = hexRGB(b.c1), topCol2 = hexRGB(b.c2), acc = hexRGB(b.accent || b.c2);
            const base = hexRGB(shade(b.c1, -0.22)), dark = hexRGB(shade(b.c1, -0.42));
            const maps = pixelMaps(128, (u, v) => {
                const f = fbm2(n, u, v, 3);
                // v=0 in alto (sotto il bordo superiore), v=1 in basso
                if (pat === 'grass') {
                    const lip = 0.22 + Math.sin(u * Math.PI * 2 * 7 + f * 3) * 0.07;
                    if (v < lip) return { c: mixRGB(topCol, topCol2, f), h: 0.72 + f * 0.2 };
                    const soil = mixRGB([118, 76, 40], [72, 44, 22], v * 0.85 + f * 0.2);
                    return { c: soil, h: 0.38 + f * 0.22 };
                }
                if (pat === 'candy') {
                    const drip = 0.26 + Math.pow(Math.sin(u * Math.PI * 2 * 5) * 0.5 + 0.5, 2) * 0.22;
                    if (v < drip) return { c: [255, 245, 250], h: 0.78 };
                    const wafer = ((Math.floor(u * 16) + Math.floor(v * 8)) % 2) * 0.14;
                    return { c: mixRGB(topCol, [245, 196, 120], 0.55 + wafer), h: 0.45 + wafer };
                }
                if (pat === 'ice') {
                    const spike = 0.18 + Math.pow(Math.sin(u * Math.PI * 2 * 9 + f * 2) * 0.5 + 0.5, 2.5) * 0.28;
                    if (v < spike) return { c: [232, 250, 255], h: 0.82 };
                    return { c: mixRGB(topCol2, dark, v * 0.75), h: 0.5 + f * 0.2 };
                }
                if (pat === 'neon' || pat === 'circuit' || pat === 'hull') {
                    const strip = Math.abs(v - 0.5) < 0.1;
                    const seg = Math.sin(u * Math.PI * 2 * 8) > -0.3;
                    if (strip && seg) return { c: acc, h: 0.75, e: mixRGB([0, 0, 0], acc, 0.85) };
                    const chassis = mixRGB([18, 22, 38], [38, 48, 72], f * 0.6);
                    return { c: chassis, h: 0.52 };
                }
                if (pat === 'marble' || pat === 'solar') {
                    const trim = v < 0.16 || v > 0.84;
                    const flute = Math.sin(u * Math.PI * 2 * 12) * 0.5 + 0.5;
                    if (trim) return { c: [255, 215, 95], h: 0.78 };
                    return { c: mixRGB([242, 236, 224], [198, 188, 172], flute * 0.5), h: 0.45 + flute * 0.25 };
                }
                const strata = Math.sin(v * Math.PI * 2 * 5 + f * 2) * 0.5 + 0.5, s = smooth01(strata, 0.8, 0.95);
                let c = mixRGB(mixRGB(base, dark, v * 0.8), topCol2, (1 - v) * 0.3 * (v < 0.14 ? 1 : 0));
                c = mixRGB(c, [0, 0, 0], s * 0.35 + f * 0.15);
                return { c, h: 0.55 - s * 0.3 + f * 0.12 };
            });
            addWear(maps, 7, 0.4); return maps;
        }
        function buildMaterial(pat, sideMaps, isRTX) {
            const map = mkTex(pat.maps.color), normalMap = mkTex(normalFromHeight(pat.maps.height, pat.normalStrength), false), roughnessMap = mkTex(roughnessFromHeight(pat.maps.height, pat.rough[0], pat.rough[1]), false);
            const opts = { map, normalMap, normalScale: new THREE.Vector2(1.05, 1.05), roughnessMap, roughness: 1, metalness: pat.metal };
            if (pat.maps.emissive) { opts.emissiveMap = mkTex(pat.maps.emissive); opts.emissive = new THREE.Color(0xffffff); opts.emissiveIntensity = pat.emissiveIntensity || 0.6; }
            const top = new THREE.MeshStandardMaterial(opts); top.userData.baseMetal = pat.metal; top.userData.baseRough = pat.rough[0];
            const sideOpts = { map: mkTex(sideMaps.color), normalMap: mkTex(normalFromHeight(sideMaps.height, 2.0), false), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.78, metalness: 0.08 };
            if (sideMaps.emissive) { sideOpts.emissiveMap = mkTex(sideMaps.emissive); sideOpts.emissive = new THREE.Color(0xffffff); sideOpts.emissiveIntensity = 0.7; }
            const side = new THREE.MeshStandardMaterial(sideOpts);
            return { top, side };
        }
        const biomeMaterials = BIOMES.map(b => buildMaterial(PATTERNS[b.pattern](b), createSideMaps(b), false));
        const bouncerMaterial = buildMaterial(PATTERNS.bouncer(), createSideMaps({ name: 'bouncer', pattern: 'neon', c1: '#1fa36a', c2: '#5ef0a6', accent: '#5ef0a6' }), false);
        const bottomMaterial = new THREE.MeshStandardMaterial({ color: 0x12172a, roughness: 0.88, metalness: 0.15 });

        // Materiali PBR completi (colore + normal map + emissive) per gli ostacoli letali e i respingenti mobili
        const hazardMaterial = (() => {
            const maps = pixelMaps(256, (u, v) => {
                const b = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
                const frame = b < 0.09;
                const stripe = Math.sin((u + v) * Math.PI * 2 * 4) > 0;
                const core = Math.hypot(u - 0.5, v - 0.5) < 0.22;
                if (core) return { c: [255, 220, 230], h: 0.85, e: [255, 90, 130] };
                if (frame) return { c: [36, 14, 24], h: 0.78, e: [90, 10, 30] };
                return { c: stripe ? [255, 38, 88] : [92, 10, 26], h: stripe ? 0.62 : 0.35, e: stripe ? [255, 28, 78] : [35, 0, 10] };
            });
            return new THREE.MeshStandardMaterial({
                map: mkTex(maps.color), normalMap: mkTex(normalFromHeight(maps.height, 2.2), false), normalScale: new THREE.Vector2(1, 1),
                emissive: 0xffffff, emissiveMap: mkTex(maps.emissive), emissiveIntensity: 0.9, roughness: 0.28, metalness: 0.35
            });
        })();
        const blockerMaterial = (() => {
            const n = makeNoise2D(99);
            const maps = pixelMaps(256, (u, v) => {
                const b = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v)), frame = b < 0.08;
                const inBand = Math.abs(v - 0.5) < 0.18;
                const chev = inBand && Math.sin((u * 5 + Math.abs(v - 0.5) * 3.5) * Math.PI * 2) > 0;
                const brush = n((u * 2) % 1, (v * 32) % 1) * 0.15;
                if (inBand) return { c: chev ? [255, 188, 42] : [20, 24, 38], h: chev ? 0.68 : 0.38, e: chev ? [90, 58, 0] : [0, 0, 0] };
                const base = frame ? [68, 78, 106] : [38, 45, 66];
                return { c: mixRGB(base, [140, 155, 190], brush), h: frame ? 0.76 : 0.5 + brush, e: [0, 0, 0] };
            });
            return new THREE.MeshStandardMaterial({
                map: mkTex(maps.color), normalMap: mkTex(normalFromHeight(maps.height, 2.0), false), normalScale: new THREE.Vector2(0.9, 0.9),
                emissive: 0xffffff, emissiveMap: mkTex(maps.emissive), emissiveIntensity: 0.45, roughness: 0.28, metalness: 0.82
            });
        })();
        const edgeMaterialCache = {};
        const edgeMaterial = (hex) => edgeMaterialCache[hex] || (edgeMaterialCache[hex] = new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.62 }));

/* ==========================================================================
           SEZIONE 9: PALLINA, SKIN ED EFFETTI DI ATTERRAGGIO (texture PBR, rilievi, mirino)
           ========================================================================== */
        const skinTexCache = {};
        function skinCanvas(w = 512, h = 256) { return mkCanvas(w, h); }
        function speckle(ctx, w, h, n, alpha, seed) { const r = makeRng(seed); ctx.globalAlpha = alpha; for (let i = 0; i < n; i++) { ctx.fillStyle = r() > 0.5 ? '#fff' : '#000'; ctx.fillRect(r() * w, r() * h, 2, 2); } ctx.globalAlpha = 1; }
        function seamLine(ctx, path, color = '#222', width = 5, stitch = true) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.setLineDash([]); path(); ctx.stroke(); if (stitch) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); path(); ctx.stroke(); ctx.setLineDash([]); } }
        const SKINS_DEF = {
            brand: {
                color() { const [c, g] = skinCanvas(); const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#ffe08a'); grd.addColorStop(0.45, '#ffb830'); grd.addColorStop(1, '#ff5c4d'); g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
                    g.fillStyle = '#fff7ee'; g.fillRect(0, 96, 512, 30); g.fillStyle = '#c73a2f'; g.fillRect(0, 150, 512, 12); g.fillStyle = '#38b6ff'; g.fillRect(0, 166, 512, 6);
                    g.fillStyle = '#ff5c4d'; g.beginPath(); g.arc(128, 111, 13, 0, 7); g.fill(); g.beginPath(); g.arc(384, 111, 13, 0, 7); g.fill(); g.fillStyle = '#fff7ee'; g.beginPath(); g.arc(128, 111, 5.5, 0, 7); g.fill(); g.beginPath(); g.arc(384, 111, 5.5, 0, 7); g.fill();
                    speckle(g, 512, 256, 1200, 0.05, 1); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#b0b0b0'; g.fillRect(0, 96, 512, 30); g.fillStyle = '#505050'; g.fillRect(0, 150, 512, 12); return c; }, roughness: 0.28, metalness: 0.18, bumpScale: 0.015
            },
            beach: {
                color() { const [c, g] = skinCanvas(); const cols = ['#ff3b3b', '#fff7ee', '#2f6bff', '#fff7ee', '#ffd400', '#fff7ee']; cols.forEach((col, i) => { const x = i * (512 / 6); const grd = g.createLinearGradient(x, 0, x + 512 / 6, 0); grd.addColorStop(0, shade(col, -0.06)); grd.addColorStop(0.5, col); grd.addColorStop(1, shade(col, -0.08)); g.fillStyle = grd; g.fillRect(x, 0, 512 / 6 + 1, 256); });
                    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2.5; for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(i * 512 / 6, 0); g.lineTo(i * 512 / 6, 256); g.stroke(); }
                    g.fillStyle = '#fff7ee'; g.fillRect(0, 0, 512, 16); g.fillRect(0, 240, 512, 16); g.fillStyle = '#e8e0d8'; g.fillRect(0, 14, 512, 3); g.fillRect(0, 239, 512, 3); speckle(g, 512, 256, 600, 0.04, 2); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#383838'; g.lineWidth = 3.5; for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(i * 512 / 6, 0); g.lineTo(i * 512 / 6, 256); g.stroke(); } return c; }, roughness: 0.18, metalness: 0.1, bumpScale: 0.012
            },
            tennis: {
                color() { const [c, g] = skinCanvas(); g.fillStyle = '#d4f23a'; g.fillRect(0, 0, 512, 256); speckle(g, 512, 256, 9000, 0.12, 3); const p = () => { g.beginPath(); g.arc(128, 128, 110, -Math.PI / 2, Math.PI / 2); g.moveTo(384 + 110, 128); g.arc(384, 128, 110, Math.PI / 2, 3 * Math.PI / 2); }; g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 18; p(); g.stroke(); g.strokeStyle = '#fff7ee'; g.lineWidth = 12; p(); g.stroke(); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); speckle(g, 512, 256, 12000, 0.35, 4); g.strokeStyle = '#b0b0b0'; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 110, -Math.PI / 2, Math.PI / 2); g.moveTo(384 + 110, 128); g.arc(384, 128, 110, Math.PI / 2, 3 * Math.PI / 2); g.stroke(); return c; }, roughness: 0.92, metalness: 0, bumpScale: 0.024
            },
            volley: {
                color() { const [c, g] = skinCanvas(); ['#fff7ee', '#ffb830', '#38b6ff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 171, 0, 172, 256); }); for (let i = 0; i < 3; i++) { const x = i * 171; seamLine(g, () => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); }, '#1a1a2e', 4); } seamLine(g, () => { g.beginPath(); g.moveTo(0, 85); g.bezierCurveTo(128, 60, 384, 110, 512, 85); }, '#1a1a2e', 3); seamLine(g, () => { g.beginPath(); g.moveTo(0, 170); g.bezierCurveTo(128, 195, 384, 145, 512, 170); }, '#1a1a2e', 3); speckle(g, 512, 256, 800, 0.05, 5); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#404040'; g.lineWidth = 4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(i * 171, 0); g.lineTo(i * 171, 256); g.stroke(); } g.beginPath(); g.moveTo(0, 85); g.bezierCurveTo(128, 60, 384, 110, 512, 85); g.stroke(); g.beginPath(); g.moveTo(0, 170); g.bezierCurveTo(128, 195, 384, 145, 512, 170); g.stroke(); return c; }, roughness: 0.42, metalness: 0.05, bumpScale: 0.014
            },
            golf: {
                color() { const [c, g] = skinCanvas(); g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, 512, 256); for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) { const x = i * 32 + (j % 2) * 16 + 16, y = j * 32 + 16; const grd = g.createRadialGradient(x - 3, y - 3, 1, x, y, 11); grd.addColorStop(0, '#d8d8d0'); grd.addColorStop(1, '#f4f4ee'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); } g.fillStyle = '#ff5c4d'; g.font = 'bold 22px Bungee, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('ONLY', 256, 136); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#909090'; g.fillRect(0, 0, 512, 256); for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) { const x = i * 32 + (j % 2) * 16 + 16, y = j * 32 + 16; const grd = g.createRadialGradient(x, y, 0, x, y, 11); grd.addColorStop(0, '#202020'); grd.addColorStop(1, '#909090'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); } return c; }, roughness: 0.65, metalness: 0.08, bumpScale: 0.032
            },
            basket: {
                color() { const [c, g] = skinCanvas(); const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#f28c3a'); grd.addColorStop(0.5, '#e06a1e'); grd.addColorStop(1, '#c9571a'); g.fillStyle = grd; g.fillRect(0, 0, 512, 256); speckle(g, 512, 256, 14000, 0.14, 6); const seams = () => { g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.moveTo(256, 0); g.lineTo(256, 256); g.moveTo(0, 0); g.lineTo(0, 256); g.moveTo(0 + 90, 128); g.arc(0, 128, 90, -Math.PI / 2, Math.PI / 2); g.moveTo(512 - 90, 128); g.arc(512, 128, 90, Math.PI / 2, 3 * Math.PI / 2); }; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 10; seams(); g.stroke(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; seams(); g.stroke(); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); speckle(g, 512, 256, 16000, 0.4, 7); g.strokeStyle = '#303030'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.moveTo(256, 0); g.lineTo(256, 256); g.moveTo(90, 128); g.arc(0, 128, 90, -Math.PI / 2, Math.PI / 2); g.moveTo(512 - 90, 128); g.arc(512, 128, 90, Math.PI / 2, 3 * Math.PI / 2); g.stroke(); return c; }, roughness: 0.78, metalness: 0.05, bumpScale: 0.022
            },
            eight: {
                color() { const [c, g] = skinCanvas(); g.fillStyle = '#0c0c12'; g.fillRect(0, 0, 512, 256); speckle(g, 512, 256, 900, 0.05, 8); g.fillStyle = '#fff7ee'; g.beginPath(); g.arc(256, 128, 62, 0, 7); g.fill(); g.fillStyle = '#e8e0d8'; g.beginPath(); g.arc(256, 128, 62, 0, 7); g.lineWidth = 3; g.strokeStyle = '#bdb4aa'; g.stroke(); g.fillStyle = '#0c0c12'; g.font = 'bold 82px Bungee, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', 256, 134); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); speckle(g, 512, 256, 600, 0.15, 9); return c; }, roughness: 0.08, metalness: 0.55, bumpScale: 0.004
            },
            magma: {
                color() { const vor = makeVoronoi(181, 18), n = makeNoise2D(182); return pixelMaps(256, (u, v) => { const vc = vor(u, v), f = fbm2(n, u, v, 4), crack = 1 - smooth01(vc.edge, 0.012, 0.048); return { c: mixRGB([26, 22, 30], [255, 110, 20], crack), h: 0.7 - crack * 0.45 }; }).color; },
                bump() { const vor = makeVoronoi(181, 18); return pixelMaps(256, (u, v) => { const vc = vor(u, v), crack = 1 - smooth01(vc.edge, 0.012, 0.048); return { c: [128, 128, 128], h: 0.75 - crack * 0.5 }; }).height; },
                roughness: 0.55, metalness: 0.25, bumpScale: 0.026
            },
            soccer: {
                color() { const [c, g] = skinCanvas(); g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, 512, 256); const centers = [[256, 128], [128, 64], [384, 64], [128, 192], [384, 192], [0, 128], [512, 128], [256, 0], [256, 256]]; const pent = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i - Math.PI / 2; if (i === 0) g.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); else g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); };
                    centers.forEach(([x, y]) => { const grd = g.createRadialGradient(x - 10, y - 10, 5, x, y, 40); grd.addColorStop(0, '#2a2a34'); grd.addColorStop(1, '#0c0c12'); g.fillStyle = grd; pent(x, y, 38); g.fill(); });
                    g.strokeStyle = '#8c8c86'; g.lineWidth = 2.5; centers.forEach(([x, y]) => { pent(x, y, 38); g.stroke(); for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i - Math.PI / 2; g.beginPath(); g.moveTo(x + 38 * Math.cos(a), y + 38 * Math.sin(a)); g.lineTo(x + 70 * Math.cos(a), y + 70 * Math.sin(a)); g.stroke(); } }); speckle(g, 512, 256, 700, 0.05, 10); return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); const centers = [[256, 128], [128, 64], [384, 64], [128, 192], [384, 192], [0, 128], [512, 128], [256, 0], [256, 256]]; g.strokeStyle = '#404040'; g.lineWidth = 3; centers.forEach(([x, y]) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i - Math.PI / 2; if (i === 0) g.moveTo(x + 38 * Math.cos(a), y + 38 * Math.sin(a)); else g.lineTo(x + 38 * Math.cos(a), y + 38 * Math.sin(a)); } g.closePath(); g.stroke(); for (let i = 0; i < 5; i++) { const a = (Math.PI * 2 / 5) * i - Math.PI / 2; g.beginPath(); g.moveTo(x + 38 * Math.cos(a), y + 38 * Math.sin(a)); g.lineTo(x + 70 * Math.cos(a), y + 70 * Math.sin(a)); g.stroke(); } }); return c; }, roughness: 0.55, metalness: 0.05, bumpScale: 0.014
            },
            cyber: {
                color() { const [c, g] = skinCanvas(); g.fillStyle = '#090d1e'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#2ef2e6'; g.lineWidth = 5; for (let y = 32; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); } g.strokeStyle = '#ff4fd8'; g.lineWidth = 4; for (let x = 64; x < 512; x += 128) { g.beginPath(); g.arc(x, 128, 42, 0, Math.PI * 2); g.stroke(); } return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#707070'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#ffffff'; g.lineWidth = 5; for (let y = 32; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); } return c; }, roughness: 0.16, metalness: 0.65, bumpScale: 0.015
            },
            planet: {
                color() { const n = makeNoise2D(171), n2 = makeNoise2D(172); const m = pixelMaps(256, (u, v) => { const f = fbm2(n, u, v, 5), land = f > 0.52, cl = fbm2(n2, (u + 0.1) % 1, v, 4); let c = land ? mixRGB([46, 160, 90], [120, 100, 60], (f - 0.52) * 6) : mixRGB([20, 70, 160], [40, 130, 220], f * 2); c = mixRGB(c, [255, 255, 255], smooth01(cl, 0.55, 0.75) * 0.9); const polar = Math.abs(v - 0.5) > 0.42 ? 1 : 0; c = mixRGB(c, [245, 250, 255], polar * 0.9); return { c, h: land ? 0.7 : 0.4 }; }); return m.color; },
                bump() { const n = makeNoise2D(171); return pixelMaps(256, (u, v) => { const f = fbm2(n, u, v, 5); return { c: [128, 128, 128], h: f > 0.52 ? 0.75 : 0.4 }; }).height; }, roughness: 0.55, metalness: 0.05, bumpScale: 0.02
            },
            galaxy: {
                color() { const n = makeNoise2D(191), r = makeRng(192); const [c, g] = skinCanvas(); const m = pixelMaps(256, (u, v) => { const f = fbm2(n, u, v, 5); return { c: mixRGB(mixRGB([12, 8, 34], [110, 42, 195], f), [255, 190, 90], Math.pow(f, 3)), h: 0.5 }; }); g.drawImage(m.color, 0, 0, 512, 256); for (let i = 0; i < 180; i++) { g.fillStyle = i % 5 === 0 ? '#ffd166' : '#ffffff'; g.beginPath(); g.arc(r() * 512, r() * 256, 0.8 + r() * 1.8, 0, 7); g.fill(); } return c; },
                bump() { const [c, g] = skinCanvas(); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 256); return c; }, roughness: 0.14, metalness: 0.45, bumpScale: 0.005
            }
        };
        const skinList = [
            { name: 'Only Ball', key: 'brand', unlock: 0 },
            { name: 'Pallone da Spiaggia', key: 'beach', unlock: 70 },
            { name: 'Sinner (Tennis)', key: 'tennis', unlock: 140 },
            { name: 'Pallavolo', key: 'volley', unlock: 210 },
            { name: 'Pallina da Golf', key: 'golf', unlock: 280 },
            { name: 'Palla da Basket', key: 'basket', unlock: 350 },
            { name: 'Palla Numero 8', key: 'eight', unlock: 490 },
            { name: 'Nucleo Magma', key: 'magma', unlock: 560 },
            { name: 'Pallone da Calcio', key: 'soccer', unlock: 630 },
            { name: 'Cyber Neon', key: 'cyber', unlock: 720 },
            { name: 'Piccolo Pianeta', key: 'planet', unlock: 800 },
            { name: 'Galassia', key: 'galaxy', unlock: 920 }
        ];
        function getLifetimeBest() {
            let best = parseInt(localStorage.getItem('onlyball_lifetime') || '0') || 0;
            Object.keys(MODES).forEach((k) => { best = Math.max(best, getBest(k)); });
            return best;
        }
        function setLifetimeBest(v) {
            const cur = getLifetimeBest();
            if (v > cur) localStorage.setItem('onlyball_lifetime', String(v));
        }
        function isSkinUnlocked(index) {
            if (index < 0) return !!customTexture;
            return getLifetimeBest() >= (skinList[index].unlock || 0);
        }
        function firstUnlockedSkinIndex() {
            for (let i = 0; i < skinList.length; i++) if (isSkinUnlocked(i)) return i;
            return 0;
        }
        let announcedUnlocks = new Set();
        try { JSON.parse(localStorage.getItem('onlyball_unlock_toast') || '[]').forEach((k) => announcedUnlocks.add(k)); } catch (e) {}
        function persistAnnouncedUnlocks() { try { localStorage.setItem('onlyball_unlock_toast', JSON.stringify([...announcedUnlocks])); } catch (e) {} }
        // Evita toast di sblocco a raffica per chi ha già i record
        skinList.forEach((s) => { if (s.unlock > 0 && getLifetimeBest() >= s.unlock) announcedUnlocks.add(s.key); });
        persistAnnouncedUnlocks();
        function checkSkinUnlocks(prevBest, nextBest) {
            const unlocked = [];
            skinList.forEach((s) => {
                if (s.unlock > 0 && prevBest < s.unlock && nextBest >= s.unlock && !announcedUnlocks.has(s.key)) {
                    announcedUnlocks.add(s.key); unlocked.push(s);
                }
            });
            if (unlocked.length) {
                persistAnnouncedUnlocks();
                const s = unlocked[unlocked.length - 1];
                showEvent(`${icon('palette')} Sbloccata: ${s.name}`, 'gold', 2800);
                vibrate([18, 40, 18]);
            }
            return unlocked;
        }
        function noteProgressHeight(h) {
            const prev = getLifetimeBest();
            setLifetimeBest(h);
            if (h > prev) checkSkinUnlocks(prev, h);
        }
        function skinTextures(key) {
            if (!skinTexCache[key]) { const d = SKINS_DEF[key]; const map = mkTex(d.color()); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; const bump = d.bump ? mkTex(d.bump(), false) : null; if (bump) bump.wrapS = bump.wrapT = THREE.ClampToEdgeWrapping; skinTexCache[key] = { map, bump }; }
            return skinTexCache[key];
        }
        // Migrazione: la skin brand "Only Ball" è ora la prima; gli indici salvati in precedenza scalano di uno
        let currentSkinIndex = parseInt(localStorage.getItem('onlyball_skin') || '0');
        if (!localStorage.getItem('onlyball_skin_v2')) { if (localStorage.getItem('onlyball_skin') !== null) currentSkinIndex += 1; localStorage.setItem('onlyball_skin_v2', '1'); }
        if (isNaN(currentSkinIndex) || currentSkinIndex < 0 || currentSkinIndex >= skinList.length) currentSkinIndex = 0;
        if (!isSkinUnlocked(currentSkinIndex)) currentSkinIndex = firstUnlockedSkinIndex();

        const radius = 0.8;
        const sphereBody = new CANNON.Body({ mass: 5, material: physicsMaterial, shape: new CANNON.Sphere(radius), angularDamping: 0.9, linearDamping: 0.1 }); world.addBody(sphereBody);
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, { format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }); cubeRenderTarget.texture.encoding = THREE.sRGBEncoding;
        const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget); scene.add(cubeCamera);
        const ballGroup = new THREE.Group(); scene.add(ballGroup);
        const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 }));
        sphereMesh.castShadow = true; ballGroup.add(sphereMesh);
        const ballLight = new THREE.PointLight(0xffe0b0, 0.6, 14); ballGroup.add(ballLight);
        const ballSquash = { x: 1, y: 1 };

        // Indicatore dinamico di atterraggio proiettato sulla piattaforma sottostante (aiuta la precisione nei salti 3D)
        const landingShadow = new THREE.Group();
        landingShadow.userData.noShadow = true;
        const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.95, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }));
        shadowDisc.rotation.x = -Math.PI / 2; shadowDisc.userData.noShadow = true;
        const shadowRing = new THREE.Mesh(new THREE.RingGeometry(radius * 0.98, radius * 1.18, 36), new THREE.MeshBasicMaterial({ color: 0x37e0b0, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false }));
        shadowRing.rotation.x = -Math.PI / 2; shadowRing.position.y = 0.01; shadowRing.userData.noShadow = true;
        landingShadow.add(shadowDisc, shadowRing); landingShadow.visible = false; scene.add(landingShadow);
        const downRay = new THREE.Raycaster(), downVec = new THREE.Vector3(0, -1, 0);

        function applySkin(index) {
            const m = sphereMesh.material;
            const nameEl = $('skin-name-display');
            if (index === -1 && customTexture) {
                m.map = customTexture; m.bumpMap = null; m.roughness = isRTX ? 0.1 : 0.5; m.metalness = isRTX ? 0.8 : 0.1;
                nameEl.classList.remove('locked'); nameEl.innerHTML = 'Skin Personale';
            } else {
                const safe = (index >= 0 && index < skinList.length) ? index : 0;
                const s = skinList[safe], d = SKINS_DEF[s.key], t = skinTextures(s.key), locked = !isSkinUnlocked(safe);
                m.map = t.map; m.bumpMap = t.bump; m.bumpScale = d.bumpScale || 0.01;
                m.roughness = isRTX ? Math.max(0.08, d.roughness - 0.2) : d.roughness;
                m.metalness = isRTX ? Math.min(0.85, d.metalness + 0.3) : d.metalness;
                nameEl.classList.toggle('locked', locked);
                nameEl.innerHTML = locked
                    ? `${icon('lock')} ${s.name}<small>Sblocca a ${s.unlock} m · tuo record ${getLifetimeBest()} m</small>`
                    : s.name;
                index = safe;
            }
            m.color.setHex(0xffffff); m.needsUpdate = true;
            const dots = $('skin-dots');
            dots.innerHTML = skinList.map((s, i) => `<span class="${i === index ? 'on' : ''} ${isSkinUnlocked(i) ? '' : 'locked'}" title="${s.name}"></span>`).join('')
                + (customTexture ? `<span class="${index === -1 ? 'on' : ''}"></span>` : '');
            if (index >= 0 && isSkinUnlocked(index)) localStorage.setItem('onlyball_skin', index);
        }
        applySkin(currentSkinIndex);

        $('btn-custom-skin').addEventListener('click', () => { AudioEngine.playUI(); $('custom-skin-upload').click(); });
        $('custom-skin-upload').addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
            reader.onload = (ev) => { const img = new Image(); img.onload = () => { const [c, ctx] = mkCanvas(img.width, img.height); ctx.drawImage(img, 0, 0); customTexture = mkTex(c); customTexture.wrapS = customTexture.wrapT = THREE.ClampToEdgeWrapping; currentSkinIndex = -1; applySkin(-1); }; img.src = ev.target.result; };
            reader.readAsDataURL(file);
        });
        $('btn-skin-prev').addEventListener('click', () => { AudioEngine.playUI(); currentSkinIndex = currentSkinIndex === -1 ? skinList.length - 1 : (currentSkinIndex - 1 + skinList.length) % skinList.length; applySkin(currentSkinIndex); });
        $('btn-skin-next').addEventListener('click', () => { AudioEngine.playUI(); currentSkinIndex = currentSkinIndex === -1 ? 0 : (currentSkinIndex + 1) % skinList.length; applySkin(currentSkinIndex); });
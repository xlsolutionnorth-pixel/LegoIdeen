/*
 * Baustein-Katalog und Geometrie.
 * Wird von der App UND vom Prüfskript (tools/validate-models.js) benutzt.
 *
 * Koordinaten: x = nach rechts, z = nach vorne (zum Betrachter), y = nach oben.
 * x/z werden in Noppen gezählt, y in Platten-Höhen (1 Stein = 3 Platten).
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.Bricks = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLATE = 0.4; // Höhe einer Platte in Noppen-Einheiten (3,2 mm / 8 mm)

  // k: brick = Stein, plate = Platte, tile = Fliese (ohne Noppen),
  //    slope = Dachstein 45°, round = rund
  // w = Breite (x), d = Tiefe (z), h = Höhe in Platten
  // Dachsteine fallen bei Drehung 0 nach vorne (+z) ab.
  const PARTS = {
    '3005': { n: 'Stein 1×1', k: 'brick', w: 1, d: 1, h: 3 },
    '3004': { n: 'Stein 1×2', k: 'brick', w: 2, d: 1, h: 3 },
    '3622': { n: 'Stein 1×3', k: 'brick', w: 3, d: 1, h: 3 },
    '3010': { n: 'Stein 1×4', k: 'brick', w: 4, d: 1, h: 3 },
    '3009': { n: 'Stein 1×6', k: 'brick', w: 6, d: 1, h: 3 },
    '3008': { n: 'Stein 1×8', k: 'brick', w: 8, d: 1, h: 3 },
    '3003': { n: 'Stein 2×2', k: 'brick', w: 2, d: 2, h: 3 },
    '3002': { n: 'Stein 2×3', k: 'brick', w: 3, d: 2, h: 3 },
    '3001': { n: 'Stein 2×4', k: 'brick', w: 4, d: 2, h: 3 },
    '2456': { n: 'Stein 2×6', k: 'brick', w: 6, d: 2, h: 3 },
    '3007': { n: 'Stein 2×8', k: 'brick', w: 8, d: 2, h: 3 },

    '3024': { n: 'Platte 1×1', k: 'plate', w: 1, d: 1, h: 1 },
    '3023': { n: 'Platte 1×2', k: 'plate', w: 2, d: 1, h: 1 },
    '3623': { n: 'Platte 1×3', k: 'plate', w: 3, d: 1, h: 1 },
    '3710': { n: 'Platte 1×4', k: 'plate', w: 4, d: 1, h: 1 },
    '3666': { n: 'Platte 1×6', k: 'plate', w: 6, d: 1, h: 1 },
    '3022': { n: 'Platte 2×2', k: 'plate', w: 2, d: 2, h: 1 },
    '3021': { n: 'Platte 2×3', k: 'plate', w: 3, d: 2, h: 1 },
    '3020': { n: 'Platte 2×4', k: 'plate', w: 4, d: 2, h: 1 },
    '3795': { n: 'Platte 2×6', k: 'plate', w: 6, d: 2, h: 1 },
    '3034': { n: 'Platte 2×8', k: 'plate', w: 8, d: 2, h: 1 },
    '3031': { n: 'Platte 4×4', k: 'plate', w: 4, d: 4, h: 1 },
    '3032': { n: 'Platte 4×6', k: 'plate', w: 6, d: 4, h: 1 },

    '3040': { n: 'Dachstein 1×2', k: 'slope', w: 1, d: 2, h: 3 },
    '3039': { n: 'Dachstein 2×2', k: 'slope', w: 2, d: 2, h: 3 },
    '3038': { n: 'Dachstein 2×3', k: 'slope', w: 3, d: 2, h: 3 },
    '3037': { n: 'Dachstein 2×4', k: 'slope', w: 4, d: 2, h: 3 },

    '3070': { n: 'Fliese 1×1', k: 'tile', w: 1, d: 1, h: 1 },
    '3069': { n: 'Fliese 1×2', k: 'tile', w: 2, d: 1, h: 1 },
    '3068': { n: 'Fliese 2×2', k: 'tile', w: 2, d: 2, h: 1 },

    '3062': { n: 'Rundstein 1×1', k: 'round', w: 1, d: 1, h: 3 },
    '4073': { n: 'Runde Platte 1×1', k: 'round', w: 1, d: 1, h: 1 },
  };

  // Andere Teilenummern, die der Erkennungsdienst für dieselben Teile liefert
  const ALIASES = {
    '3005b': '3005', '3004b': '3004', '3001b': '3001', '3003b': '3003',
    '3062a': '3062', '3062b': '3062', '6141': '4073', '30039': '3070',
    '3070b': '3070', '3069b': '3069', '3068b': '3068',
    '3039b': '3039', '3040b': '3040', '3040a': '3040', '3037b': '3037', '3038b': '3038',
  };

  // Reihenfolge, in der die Teile in Listen erscheinen
  const ORDER = Object.keys(PARTS);

  const KIND_LABEL = {
    brick: 'Steine', plate: 'Platten', slope: 'Dachsteine', tile: 'Fliesen', round: 'Runde Teile',
  };

  // Farben (Kurzzeichen im Modell -> Anzeige)
  const COLORS = {
    R: { n: 'Rot', hex: '#C91A09' },
    B: { n: 'Blau', hex: '#0055BF' },
    Y: { n: 'Gelb', hex: '#F2CD37' },
    G: { n: 'Grün', hex: '#237841' },
    E: { n: 'Hellgrün', hex: '#A5CA18' },
    W: { n: 'Weiß', hex: '#F4F4F4' },
    K: { n: 'Schwarz', hex: '#27313A' },
    O: { n: 'Orange', hex: '#FE8A18' },
    L: { n: 'Hellgrau', hex: '#A0A5A9' },
    D: { n: 'Dunkelgrau', hex: '#6C6E68' },
    N: { n: 'Braun', hex: '#7A3E1D' },
    T: { n: 'Beige', hex: '#E4CD9E' },
    P: { n: 'Rosa', hex: '#FC97AC' },
    A: { n: 'Hellblau', hex: '#36AEBF' },
  };

  /** Teilenummer oder Name aus dem Erkennungsdienst in eine Katalognummer umwandeln */
  function resolve(id, name) {
    if (id) {
      const clean = String(id).trim().toLowerCase();
      if (PARTS[clean]) return clean;
      if (ALIASES[clean]) return ALIASES[clean];
      const base = clean.replace(/[a-z]+$/, '');
      if (PARTS[base]) return base;
    }
    if (name) return resolveByName(name);
    return null;
  }

  function resolveByName(name) {
    const s = String(name).toLowerCase();
    let kind = null;
    if (/slope|dach/.test(s)) kind = 'slope';
    else if (/tile|fliese/.test(s)) kind = 'tile';
    else if (/round|rund/.test(s)) kind = 'round';
    else if (/plate|platte/.test(s)) kind = 'plate';
    else if (/brick|stein/.test(s)) kind = 'brick';
    if (!kind) return null;
    if (/inverted|curved|modified|with|technic/.test(s)) return null;
    const m = s.match(/(\d+)\s*x\s*(\d+)/);
    if (!m) return null;
    const a = Math.min(+m[1], +m[2]);
    const b = Math.max(+m[1], +m[2]);
    for (const id of ORDER) {
      const p = PARTS[id];
      if (kind === 'round') {
        if (p.k === 'round' && a === 1 && b === 1 && (/plate/.test(s) ? p.h === 1 : p.h === 3)) return id;
        continue;
      }
      if (p.k !== kind) continue;
      if (Math.min(p.w, p.d) === a && Math.max(p.w, p.d) === b) return id;
    }
    return null;
  }

  /** Modell-Eintrag [teil, x, z, y, farbe, drehung] in ein Objekt umwandeln */
  function norm(e) {
    if (!Array.isArray(e)) return e;
    return { p: String(e[0]), x: e[1], z: e[2], y: e[3], c: e[4] || 'R', r: e[5] || 0 };
  }

  function footprint(b) {
    const P = PARTS[b.p];
    const r = ((b.r % 360) + 360) % 360;
    return r % 180 === 0 ? { fw: P.w, fd: P.d } : { fw: P.d, fd: P.w };
  }

  /** Liefert Funktionen, die lokale Teile-Koordinaten (u, y, v) in Weltkoordinaten umrechnen */
  function transformer(b) {
    const P = PARTS[b.p];
    const { fw, fd } = footprint(b);
    const r = ((b.r % 360) + 360) % 360;
    const cx = b.x + fw / 2, cz = b.z + fd / 2, by = b.y * PLATE;
    const cu = P.w / 2, cv = P.d / 2;
    function rot(du, dv) {
      switch (r) {
        case 0: return [du, dv];
        case 90: return [dv, -du];
        case 180: return [-du, -dv];
        default: return [-dv, du];
      }
    }
    return {
      point(u, y, v) {
        const [dx, dz] = rot(u - cu, v - cv);
        return [cx + dx, by + y, cz + dz];
      },
      normal(nu, ny, nv) {
        const [dx, dz] = rot(nu, nv);
        return [dx, ny, dz];
      },
    };
  }

  function cellKey(x, z) { return x + ',' + z; }

  /** Alle Raster-Zellen, die das Teil bedeckt */
  function cells(b) {
    const P = PARTS[b.p];
    const t = transformer(b);
    const out = [];
    for (let i = 0; i < P.w; i++) {
      for (let j = 0; j < P.d; j++) {
        const p = t.point(i + 0.5, 0, j + 0.5);
        out.push([Math.floor(p[0]), Math.floor(p[2])]);
      }
    }
    return out;
  }

  /** Zellen mit Noppen auf der Oberseite */
  function studCells(b) {
    const P = PARTS[b.p];
    if (P.k === 'tile') return [];
    const t = transformer(b);
    const out = [];
    for (let i = 0; i < P.w; i++) {
      for (let j = 0; j < P.d; j++) {
        if (P.k === 'slope' && j !== 0) continue;
        const p = t.point(i + 0.5, 0, j + 0.5);
        out.push([Math.floor(p[0]), Math.floor(p[2])]);
      }
    }
    return out;
  }

  /** Teile zählen: { teilenummer: anzahl } */
  function countParts(bricks) {
    const out = {};
    for (const e of bricks) {
      const b = norm(e);
      out[b.p] = (out[b.p] || 0) + 1;
    }
    return out;
  }

  /** Prüft ein Modell. Gibt eine Liste von Fehlern zurück (leer = alles gut). */
  function validate(model) {
    const errors = [];
    const list = model.bricks.map(norm);
    const placed = [];
    const parent = list.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => { parent[find(a)] = find(b); };

    list.forEach((b, i) => {
      const P = PARTS[b.p];
      if (!P) { errors.push(`Schritt ${i + 1}: unbekanntes Teil ${b.p}`); return; }
      if (!COLORS[b.c]) errors.push(`Schritt ${i + 1}: unbekannte Farbe ${b.c}`);
      if (b.r % 90 !== 0) errors.push(`Schritt ${i + 1}: Drehung muss 0/90/180/270 sein`);
      const myCells = cells(b);
      const mySet = new Set(myCells.map((c) => cellKey(c[0], c[1])));
      const y0 = b.y, y1 = b.y + P.h;
      let supported = b.y === 0;
      placed.forEach((o, j) => {
        const OP = PARTS[o.p];
        const oy0 = o.y, oy1 = o.y + OP.h;
        const overlapXZ = cells(o).some((c) => mySet.has(cellKey(c[0], c[1])));
        if (overlapXZ && y0 < oy1 && oy0 < y1) {
          errors.push(`Schritt ${i + 1} (${P.n}) überschneidet sich mit Schritt ${j + 1} (${OP.n})`);
        }
        if (oy1 === y0 && studCells(o).some((c) => mySet.has(cellKey(c[0], c[1])))) {
          supported = true;
          union(i, j);
        }
      });
      if (!supported) errors.push(`Schritt ${i + 1} (${P.n} bei x=${b.x}, z=${b.z}, y=${b.y}) schwebt in der Luft`);
      placed.push(b);
    });

    // Bodenteile, die nur über spätere Teile verbunden sind, zählen auch (union oben).
    const roots = new Set(list.map((_, i) => find(i)));
    if (roots.size > 1) errors.push(`Modell zerfällt in ${roots.size} lose Teile`);
    if (list.length < 6) errors.push(`Nur ${list.length} Teile`);
    return errors;
  }

  // ---------------------------------------------------------------------
  // Geometrie für die 3D-Anzeige (lokale Koordinaten u, y, v)
  // ---------------------------------------------------------------------
  const GAP = 0.02;
  const STUD_R = 0.3, STUD_H = 0.18, SEG = 14;
  const geoCache = {};

  function geometry(partId) {
    if (geoCache[partId]) return geoCache[partId];
    const P = PARTS[partId];
    const H = P.h * PLATE;
    const tri = []; // [x,y,z, nx,ny,nz] * 3 pro Dreieck
    const lines = [];
    const g = GAP;

    function push(p, n) { tri.push(p[0], p[1], p[2], n[0], n[1], n[2]); }
    function quad(a, b, c, d, n) { push(a, n); push(b, n); push(c, n); push(a, n); push(c, n); push(d, n); }
    function line(a, b) { lines.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function faceNormal(a, b, c) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      return norm3([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    }

    function cylinder(cx, cz, r, y0, y1, withBottom, outline) {
      for (let s = 0; s < SEG; s++) {
        const a0 = (s / SEG) * Math.PI * 2, a1 = ((s + 1) / SEG) * Math.PI * 2;
        const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r];
        const p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
        const n0 = [Math.cos(a0), 0, Math.sin(a0)], n1 = [Math.cos(a1), 0, Math.sin(a1)];
        push([p0[0], y0, p0[1]], n0); push([p1[0], y0, p1[1]], n1); push([p1[0], y1, p1[1]], n1);
        push([p0[0], y0, p0[1]], n0); push([p1[0], y1, p1[1]], n1); push([p0[0], y1, p0[1]], n0);
        push([cx, y1, cz], [0, 1, 0]); push([p0[0], y1, p0[1]], [0, 1, 0]); push([p1[0], y1, p1[1]], [0, 1, 0]);
        if (withBottom) { push([cx, y0, cz], [0, -1, 0]); push([p1[0], y0, p1[1]], [0, -1, 0]); push([p0[0], y0, p0[1]], [0, -1, 0]); }
        if (outline) {
          line([p0[0], y1, p0[1]], [p1[0], y1, p1[1]]);
          if (outline === 2) line([p0[0], y0, p0[1]], [p1[0], y0, p1[1]]);
        }
      }
    }

    function box(u0, y0, v0, u1, y1, v1) {
      const c = [
        [u0, y0, v0], [u1, y0, v0], [u1, y0, v1], [u0, y0, v1],
        [u0, y1, v0], [u1, y1, v0], [u1, y1, v1], [u0, y1, v1],
      ];
      quad(c[4], c[5], c[6], c[7], [0, 1, 0]);
      quad(c[0], c[3], c[2], c[1], [0, -1, 0]);
      quad(c[3], c[7], c[6], c[2], [0, 0, 1]);
      quad(c[0], c[1], c[5], c[4], [0, 0, -1]);
      quad(c[1], c[2], c[6], c[5], [1, 0, 0]);
      quad(c[0], c[4], c[7], c[3], [-1, 0, 0]);
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      E.forEach(([a, b]) => line(c[a], c[b]));
    }

    if (P.k === 'round') {
      cylinder(0.5, 0.5, 0.5 - g * 2, 0, H, true, 2);
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
        const r = 0.5 - g * 2;
        line([0.5 + Math.cos(a) * r, 0, 0.5 + Math.sin(a) * r], [0.5 + Math.cos(a) * r, H, 0.5 + Math.sin(a) * r]);
      }
    } else if (P.k === 'slope') {
      // Profil (v, y): hinten hoch, vorne niedrig
      const lip = 0.24;
      const prof = [[g, 0], [g, H], [1, H], [P.d - g, lip], [P.d - g, 0]];
      const u0 = g, u1 = P.w - g;
      // Seitenflächen (Fächer)
      for (const [u, n] of [[u0, [-1, 0, 0]], [u1, [1, 0, 0]]]) {
        for (let i = 1; i < prof.length - 1; i++) {
          push([u, prof[0][1], prof[0][0]], n);
          push([u, prof[i][1], prof[i][0]], n);
          push([u, prof[i + 1][1], prof[i + 1][0]], n);
        }
        for (let i = 0; i < prof.length; i++) {
          const a = prof[i], b = prof[(i + 1) % prof.length];
          line([u, a[1], a[0]], [u, b[1], b[0]]);
        }
      }
      // Mantelflächen
      for (let i = 0; i < prof.length; i++) {
        const a = prof[i], b = prof[(i + 1) % prof.length];
        const A0 = [u0, a[1], a[0]], B0 = [u0, b[1], b[0]], B1 = [u1, b[1], b[0]], A1 = [u1, a[1], a[0]];
        let n = faceNormal(A0, B0, B1);
        // Normale nach außen zeigen lassen (Mittelpunkt des Profils liegt innen)
        const mid = [(a[0] + b[0]) / 2 - P.d / 2, (a[1] + b[1]) / 2 - H / 2];
        if (n[2] * mid[0] + n[1] * mid[1] < 0) n = [-n[0], -n[1], -n[2]];
        quad(A0, B0, B1, A1, n);
        line(A0, A1);
      }
    } else {
      box(g, 0, g, P.w - g, H, P.d - g);
    }

    // Noppen
    if (P.k !== 'tile') {
      for (let i = 0; i < P.w; i++) {
        for (let j = 0; j < P.d; j++) {
          if (P.k === 'slope' && j !== 0) continue;
          if (P.k === 'round' && (i || j)) continue;
          cylinder(i + 0.5, j + 0.5, STUD_R, H, H + STUD_H, false, 1);
        }
      }
    }

    const out = { tri: new Float32Array(tri), lines: new Float32Array(lines) };
    geoCache[partId] = out;
    return out;
  }

  /** Geometrie eines platzierten Teils in Weltkoordinaten */
  function placedGeometry(e) {
    const b = norm(e);
    const g = geometry(b.p);
    const t = transformer(b);
    const tri = new Float32Array(g.tri.length);
    for (let i = 0; i < g.tri.length; i += 6) {
      const p = t.point(g.tri[i], g.tri[i + 1], g.tri[i + 2]);
      const n = t.normal(g.tri[i + 3], g.tri[i + 4], g.tri[i + 5]);
      tri[i] = p[0]; tri[i + 1] = p[1]; tri[i + 2] = p[2];
      tri[i + 3] = n[0]; tri[i + 4] = n[1]; tri[i + 5] = n[2];
    }
    const lines = new Float32Array(g.lines.length);
    for (let i = 0; i < g.lines.length; i += 3) {
      const p = t.point(g.lines[i], g.lines[i + 1], g.lines[i + 2]);
      lines[i] = p[0]; lines[i + 1] = p[1]; lines[i + 2] = p[2];
    }
    return { tri, lines, b };
  }

  /** Begrenzungsbox eines Modells */
  function bounds(bricks) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    bricks.map(norm).forEach((b) => {
      const P = PARTS[b.p];
      const { fw, fd } = footprint(b);
      const top = (b.y + P.h) * PLATE + (P.k === 'tile' ? 0 : STUD_H);
      min[0] = Math.min(min[0], b.x); max[0] = Math.max(max[0], b.x + fw);
      min[1] = Math.min(min[1], b.y * PLATE); max[1] = Math.max(max[1], top);
      min[2] = Math.min(min[2], b.z); max[2] = Math.max(max[2], b.z + fd);
    });
    return { min, max };
  }

  return {
    PLATE, PARTS, ORDER, COLORS, KIND_LABEL, ALIASES,
    resolve, norm, footprint, cells, studCells, countParts, validate,
    geometry, placedGeometry, bounds,
  };
});

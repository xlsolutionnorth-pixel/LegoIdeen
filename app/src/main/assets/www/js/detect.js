/*
 * Findet einzelne Steine auf einem Foto (Bildausschnitte) und lässt jeden
 * Ausschnitt vom Erkennungsdienst Brickognize bestimmen.
 *
 * Der Dienst erkennt pro Bild einen Stein. Deshalb wird das Foto vorher in
 * Ausschnitte zerlegt: Alles, was sich deutlich vom Boden abhebt, gilt als Stein.
 */
(function () {
  'use strict';

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.src = src;
    });
  }

  function otsu(values, bins = 128, maxV = 442) {
    const hist = new Float64Array(bins);
    for (let i = 0; i < values.length; i++) hist[Math.min(bins - 1, (values[i] / maxV * bins) | 0)]++;
    const total = values.length;
    let sum = 0;
    for (let i = 0; i < bins; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 0;
    for (let i = 0; i < bins; i++) {
      wB += hist[i];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }
    return (thr + 0.5) / bins * maxV;
  }

  function median(arr) {
    const a = Array.from(arr).sort((x, y) => x - y);
    return a[(a.length / 2) | 0] || 0;
  }

  /**
   * Zerlegt das Foto in Bereiche, die wie Steine aussehen.
   * @returns {{boxes: Array<{x:number,y:number,w:number,h:number}>, mode: string}}
   */
  function segment(img, opts = {}) {
    const maxBoxes = opts.maxBoxes || 40;
    const S = 360;
    const scale = Math.min(1, S / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.max(1, Math.round(img.naturalWidth * scale));
    const H = Math.max(1, Math.round(img.naturalHeight * scale));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const N = W * H;

    // 1) Bodenfarbe aus dem Bildrand schätzen
    const band = Math.max(2, Math.round(Math.min(W, H) * 0.05));
    const rs = [], gs = [], bs = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x >= band && x < W - band && y >= band && y < H - band) continue;
        if ((x + y) % 2) continue;
        const i = (y * W + x) * 4;
        rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]);
      }
    }
    const bg = [median(rs), median(gs), median(bs)];

    // 2) Abstand jedes Pixels zur Bodenfarbe (Farbigkeit zählt extra)
    const dist = new Float32Array(N);
    const bgMax = Math.max(bg[0], bg[1], bg[2]), bgMin = Math.min(bg[0], bg[1], bg[2]);
    const bgSat = bgMax ? (bgMax - bgMin) / bgMax : 0;
    for (let i = 0, p = 0; i < N; i++, p += 4) {
      const r = px[p], g = px[p + 1], b = px[p + 2];
      const dr = r - bg[0], dg = g - bg[1], db = b - bg[2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx ? (mx - mn) / mx : 0;
      dist[i] = Math.sqrt(dr * dr + dg * dg + db * db) + Math.max(0, sat - bgSat) * 90;
    }
    // Schwelle: Otsu, aber mindestens deutlich über dem Rauschen des Bodens
    const borderD = [];
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        if (x >= band && x < W - band && y >= band && y < H - band) continue;
        borderD.push(dist[y * W + x]);
      }
    }
    borderD.sort((a, b) => a - b);
    const noise = borderD[Math.floor(borderD.length * 0.95)] || 20;
    // Schwelle knapp über dem Rauschen des Bodens, damit auch weiße/graue Steine
    // gefunden werden. Otsu nur als Obergrenze bei sehr unruhigem Boden.
    const thr = Math.max(30, Math.min(noise * 1.5 + 10, Math.max(otsu(dist), 60)));

    let mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = dist[i] > thr ? 1 : 0;

    // 3) Rauschen entfernen (Öffnen) und Löcher schließen
    const morph = (src, erode) => {
      const out = new Uint8Array(N);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let v = erode ? 1 : 0;
          for (let dy = -1; dy <= 1 && (erode ? v : !v); dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : src[yy * W + xx];
              if (erode && !s) { v = 0; break; }
              if (!erode && s) { v = 1; break; }
            }
          }
          out[y * W + x] = v;
        }
      }
      return out;
    };
    mask = morph(mask, true);
    mask = morph(mask, false);
    mask = morph(mask, false);
    mask = morph(mask, true);

    // 4) Zusammenhängende Flächen finden
    const label = new Int32Array(N);
    const comps = [];
    const stack = new Int32Array(N);
    let next = 1;
    for (let s = 0; s < N; s++) {
      if (!mask[s] || label[s]) continue;
      let sp = 0; stack[sp++] = s; label[s] = next;
      let minX = W, minY = H, maxX = 0, maxY = 0, area = 0;
      while (sp) {
        const i = stack[--sp];
        const x = i % W, y = (i / W) | 0;
        area++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x > 0 && mask[i - 1] && !label[i - 1]) { label[i - 1] = next; stack[sp++] = i - 1; }
        if (x < W - 1 && mask[i + 1] && !label[i + 1]) { label[i + 1] = next; stack[sp++] = i + 1; }
        if (y > 0 && mask[i - W] && !label[i - W]) { label[i - W] = next; stack[sp++] = i - W; }
        if (y < H - 1 && mask[i + W] && !label[i + W]) { label[i + W] = next; stack[sp++] = i + W; }
      }
      comps.push({ minX, minY, maxX, maxY, area });
      next++;
    }

    const minArea = N * 0.0012, maxArea = N * 0.6;
    let boxes = comps
      .filter((c) => c.area >= minArea && c.area <= maxArea)
      .filter((c) => (c.maxX - c.minX) >= 4 && (c.maxY - c.minY) >= 4)
      .sort((a, b) => b.area - a.area)
      .slice(0, maxBoxes)
      .map((c) => {
        const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
        const pad = Math.max(3, Math.round(Math.max(bw, bh) * 0.14));
        const x0 = Math.max(0, c.minX - pad), y0 = Math.max(0, c.minY - pad);
        const x1 = Math.min(W, c.maxX + 1 + pad), y1 = Math.min(H, c.maxY + 1 + pad);
        return { x: x0 / scale, y: y0 / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale };
      });

    // Lesereihenfolge: von oben nach unten, links nach rechts
    const rowH = (img.naturalHeight || 1) / 6;
    boxes.sort((a, b) => (Math.floor(a.y / rowH) - Math.floor(b.y / rowH)) || (a.x - b.x));

    if (!boxes.length) {
      return { boxes: [{ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }], mode: 'ganz' };
    }
    return { boxes, mode: 'haufen' };
  }

  /** Schneidet einen Bereich aus und gibt ein JPEG zurück */
  function crop(img, box, maxSide = 512) {
    const s = Math.min(1, maxSide / Math.max(box.w, box.h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(box.w * s));
    cv.height = Math.max(1, Math.round(box.h * s));
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.88);
  }

  // ---------------------------------------------------------------------
  // Erkennung über Brickognize
  // ---------------------------------------------------------------------
  const API = ['https://api.brickognize.com/predict/parts/', 'https://api.brickognize.com/predict/'];
  const pending = new Map();
  let reqCounter = 0;

  // Antworten der Android-App kommen hier an
  window.NativeBridge = window.NativeBridge || {};
  window.NativeBridge.onRecognize = function (id, ok, body) {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (!ok) { p.reject(new Error(body || 'Erkennung fehlgeschlagen')); return; }
    try { p.resolve(JSON.parse(body)); } catch (e) { p.reject(new Error('Unerwartete Antwort vom Erkennungsdienst')); }
  };

  function isDemo() { return /[?&]demo=1/.test(location.search); }

  async function callApi(dataUrl) {
    if (isDemo()) return demoAnswer();
    if (window.Android && window.Android.recognize) {
      const id = 'r' + (++reqCounter);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (pending.has(id)) { pending.delete(id); reject(new Error('Zeitüberschreitung')); }
        }, 60000);
        window.Android.recognize(id, dataUrl);
      });
    }
    // Im Browser (ohne App): direkter Aufruf
    const blob = await (await fetch(dataUrl)).blob();
    let lastErr;
    for (const url of API) {
      try {
        const fd = new FormData();
        fd.append('query_image', blob, 'stein.jpg');
        const res = await fetch(url, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (res.status === 404 || res.status === 405) { lastErr = new Error('HTTP ' + res.status); continue; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Erkennung fehlgeschlagen');
  }

  function demoAnswer() {
    const ids = ['3001', '3003', '3004', '3005', '3020', '3022', '3039', '3062', '4073', '3010', '3023', '2456', '3622', '3024', '3040', '6541'];
    const id = ids[Math.floor(Math.random() * ids.length)];
    const P = Bricks.PARTS[id];
    return new Promise((r) => setTimeout(() => r({
      items: [{ id, name: P ? P.n : 'Technic Brick 1 x 2 with Hole', score: 0.35 + Math.random() * 0.6 }],
    }), 300 + Math.random() * 700));
  }

  /**
   * Erkennt den Stein auf einem Bildausschnitt.
   * @returns {Promise<{partId: string|null, apiId: string, apiName: string, score: number, alternatives: string[]}>}
   */
  async function recognize(dataUrl) {
    const json = await callApi(dataUrl);
    const items = (json && (json.items || json.results || [])) || [];
    if (!items.length) return { partId: null, apiId: '', apiName: 'Nichts erkannt', score: 0, alternatives: [] };
    items.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top = items[0];
    const partId = Bricks.resolve(top.id, top.name);
    const alternatives = [];
    for (const it of items.slice(1, 6)) {
      const pid = Bricks.resolve(it.id, it.name);
      if (pid && pid !== partId && !alternatives.includes(pid)) alternatives.push(pid);
    }
    return {
      partId,
      apiId: String(top.id || ''),
      apiName: String(top.name || top.id || 'Unbekanntes Teil'),
      score: Number(top.score || 0),
      alternatives,
    };
  }

  window.Detect = { loadImage, segment, crop, recognize, isDemo };
})();

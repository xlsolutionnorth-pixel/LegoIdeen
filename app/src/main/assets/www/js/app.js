/*
 * Baustein-Ideen – App-Logik
 */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const PARTS = Bricks.PARTS;
  const native = window.Android || null;

  // ---------------------------------------------------------------------
  // Speicher
  // ---------------------------------------------------------------------
  const store = {
    data: { inv: {}, extra: {}, fav: [], built: [] },
    load() {
      let raw = '';
      try { raw = native && native.loadData ? native.loadData() : localStorage.getItem('bausteinIdeen'); } catch (e) { raw = ''; }
      if (raw) {
        try { Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* kaputte Daten ignorieren */ }
      }
    },
    save() {
      const raw = JSON.stringify(this.data);
      try {
        if (native && native.saveData) native.saveData(raw);
        else localStorage.setItem('bausteinIdeen', raw);
      } catch (e) { /* z. B. privater Modus */ }
      updateCount();
    },
    total() {
      return Object.values(this.data.inv).reduce((a, b) => a + b, 0) +
        Object.values(this.data.extra).reduce((a, b) => a + b.count, 0);
    },
    add(pid, n) {
      const v = Math.max(0, (this.data.inv[pid] || 0) + n);
      if (v) this.data.inv[pid] = v; else delete this.data.inv[pid];
    },
    addExtra(key, name, n) {
      const e = this.data.extra[key] || { name, count: 0 };
      e.count = Math.max(0, e.count + n);
      if (e.count) this.data.extra[key] = e; else delete this.data.extra[key];
    },
    toggle(list, id) {
      const arr = this.data[list];
      const i = arr.indexOf(id);
      if (i >= 0) arr.splice(i, 1); else arr.push(id);
      this.save();
      return i < 0;
    },
  };

  // ---------------------------------------------------------------------
  // Hilfsfunktionen
  // ---------------------------------------------------------------------
  let thumbs = null;
  function getThumbs() {
    if (!thumbs) {
      try { thumbs = new Thumbnailer(360, 280); } catch (e) { thumbs = false; }
    }
    return thumbs;
  }
  function partImg(pid, color = 'Y') {
    const t = getThumbs();
    return t ? t.part(pid, color) : '';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function plural(n, one, many) { return n === 1 ? one : many; }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function updateCount() {
    const n = store.total();
    $('#countPill').textContent = n + ' ' + plural(n, 'Stein', 'Steine');
  }
  function stars(n) { return n <= 12 ? '★☆☆' : n <= 18 ? '★★☆' : '★★★'; }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------
  let current = 'scan';
  function show(view) {
    current = view;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    window.scrollTo(0, 0);
    if (view === 'steine') renderInventory();
    if (view === 'merk') renderMerk();
    if (view === 'ideen' && lastIdeas) renderIdeas(false);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  // ---------------------------------------------------------------------
  // 1) Fotografieren und erkennen
  // ---------------------------------------------------------------------
  let mode = 'haufen';
  let scan = null; // { img, boxes, items: [...] }

  $$('.seg').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    $$('.seg').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-checked', x === b); });
  }));

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => app.onPhoto(r.result);
    r.readAsDataURL(f);
    fileInput.value = '';
  });

  $('#btnCamera').addEventListener('click', () => {
    if (native && native.takePhoto) native.takePhoto();
    else { fileInput.setAttribute('capture', 'environment'); fileInput.click(); }
  });
  $('#btnGallery').addEventListener('click', () => {
    if (native && native.pickImage) native.pickImage();
    else { fileInput.removeAttribute('capture'); fileInput.click(); }
  });
  $('#btnDiscard').addEventListener('click', resetScan);
  $('#btnMore').addEventListener('click', resetScan);
  $('#btnToIdeas').addEventListener('click', () => { resetScan(); show('ideen'); makeIdeas(); });
  $('#btnAdd').addEventListener('click', addScanToInventory);

  function resetScan() {
    scan = null;
    $('#scanResult').hidden = true;
    $('#scanStart').hidden = false;
    $('#afterAdd').hidden = true;
    window.scrollTo(0, 0);
  }

  async function startScan(dataUrl) {
    show('scan');
    const img = await Detect.loadImage(dataUrl);
    $('#scanStart').hidden = true;
    $('#scanResult').hidden = false;
    $('#afterAdd').hidden = true;
    $('#scanActions').hidden = true;
    $('#scanSummary').hidden = true;
    $('#detList').innerHTML = '';
    $('#photo').src = dataUrl;
    setProgress(0, 'Suche Steine …');
    await new Promise((r) => setTimeout(r, 30));

    let boxes;
    if (mode === 'einzeln') {
      // Bild mittig quadratisch zuschneiden
      const s = Math.min(img.naturalWidth, img.naturalHeight) * 0.9;
      boxes = [{ x: (img.naturalWidth - s) / 2, y: (img.naturalHeight - s) / 2, w: s, h: s }];
    } else {
      boxes = Detect.segment(img).boxes;
    }
    scan = { img, boxes, items: boxes.map((b, i) => ({ i, box: b, crop: Detect.crop(img, b), state: 'wait', count: 1, partId: null })) };
    drawOverlay();
    renderDetections();
    setProgress(0, `${boxes.length} ${plural(boxes.length, 'Stein', 'Steine')} gefunden – erkenne …`);

    let done = 0;
    const queue = scan.items.slice();
    const myScan = scan;
    async function worker() {
      while (queue.length && scan === myScan) {
        const it = queue.shift();
        it.state = 'busy';
        updateDetection(it);
        try {
          const r = await Detect.recognize(it.crop);
          Object.assign(it, r);
          it.state = r.partId ? (r.score >= 0.6 ? 'ok' : 'maybe') : (r.score > 0 ? 'other' : 'none');
          if (it.state === 'none') it.count = 0;
        } catch (e) {
          it.state = 'error';
          it.error = e.message;
          it.count = 0;
        }
        if (scan !== myScan) return;
        done++;
        setProgress(done / myScan.items.length, `Erkannt: ${done} von ${myScan.items.length}`);
        updateDetection(it);
        drawOverlay();
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (scan !== myScan) return;
    setProgress(1, 'Fertig!');
    finishScan();
  }

  function setProgress(f, text) {
    $('#progressBar').style.width = Math.round(f * 100) + '%';
    $('#progressText').textContent = text;
    $('#progress').classList.toggle('done', f >= 0.55);
  }

  function drawOverlay() {
    if (!scan) return;
    const img = scan.img;
    const cv = $('#photoOverlay');
    const el = $('#photo');
    const rw = el.clientWidth, rh = el.clientHeight;
    if (!rw || !rh) { requestAnimationFrame(drawOverlay); return; }
    const dpr = window.devicePixelRatio || 1;
    cv.width = rw * dpr; cv.height = rh * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    // object-fit: contain -> tatsächliche Bildfläche bestimmen
    const s = Math.min(rw / img.naturalWidth, rh / img.naturalHeight);
    const ox = (rw - img.naturalWidth * s) / 2, oy = (rh - img.naturalHeight * s) / 2;
    scan.items.forEach((it) => {
      const b = it.box;
      const x = ox + b.x * s, y = oy + b.y * s, w = b.w * s, h = b.h * s;
      const col = it.state === 'ok' ? '#2E9E4F' : it.state === 'maybe' ? '#FFC72C' : it.state === 'error' || it.state === 'none' ? '#D7261E' : it.state === 'other' ? '#7B68C9' : '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeStyle = col;
      ctx.setLineDash(it.state === 'wait' || it.state === 'busy' ? [6, 4] : []);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col === '#FFFFFF' || col === '#FFC72C' ? '#2B2118' : '#fff';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(it.i + 1), x + 2, y + 2.5);
    });
  }
  window.addEventListener('resize', () => { drawOverlay(); });
  $('#photo').addEventListener('load', drawOverlay);

  function partOptions(selected) {
    let html = '';
    let lastKind = '';
    for (const id of Bricks.ORDER) {
      const P = PARTS[id];
      if (P.k !== lastKind) {
        if (lastKind) html += '</optgroup>';
        html += `<optgroup label="${Bricks.KIND_LABEL[P.k]}">`;
        lastKind = P.k;
      }
      html += `<option value="${id}"${id === selected ? ' selected' : ''}>${esc(P.n)}</option>`;
    }
    html += '</optgroup>';
    return html;
  }

  function renderDetections() {
    const list = $('#detList');
    list.innerHTML = '';
    scan.items.forEach((it) => {
      const el = document.createElement('div');
      el.className = 'det';
      el.id = 'det-' + it.i;
      list.appendChild(el);
      updateDetection(it);
    });
  }

  function updateDetection(it) {
    const el = document.getElementById('det-' + it.i);
    if (!el) return;
    el.classList.toggle('removed', it.count === 0 && it.state !== 'wait' && it.state !== 'busy');
    let main = '', side = '';
    if (it.state === 'wait' || it.state === 'busy') {
      main = `<div class="det-name">Stein ${it.i + 1}</div><div class="det-api">${it.state === 'busy' ? 'wird erkannt …' : 'wartet …'}</div>`;
      side = it.state === 'busy' ? '<div class="spinner"></div>' : '';
    } else {
      let badge = '', title = '', sub = '';
      const pct = Math.round((it.score || 0) * 100);
      if (it.state === 'error') {
        badge = '<span class="badge err">Fehler</span>';
        title = 'Nicht erkannt';
        sub = esc(it.error || '') + ' – wähle den Stein selbst aus:';
      } else if (it.state === 'none') {
        badge = '<span class="badge err">?</span>';
        title = 'Kein Stein erkannt';
        sub = 'Wähle selbst aus, falls doch ein Stein darauf ist:';
      } else if (it.state === 'other') {
        badge = '<span class="badge other">Sonderteil</span>';
        title = esc(it.apiName);
        sub = 'Wird gezählt, aber nicht für Ideen benutzt.';
      } else {
        badge = it.state === 'ok' ? `<span class="badge ok">${pct}% sicher</span>` : `<span class="badge maybe">unsicher ${pct}%</span>`;
        title = esc(PARTS[it.partId].n);
        sub = esc(it.apiName);
      }
      const sel = it.partId || '';
      main = `<div class="det-name">${title}${badge}</div><div class="det-api">${sub}</div>
        <select aria-label="Stein ändern">
          ${it.state === 'other' ? `<option value="__other" ${sel ? '' : 'selected'}>Sonderteil behalten</option>` : `<option value="" ${sel ? '' : 'selected'}>– Stein wählen –</option>`}
          ${partOptions(sel)}
        </select>`;
      side = `<div class="stepper"><button data-d="-1" aria-label="weniger">−</button><span class="n">${it.count}</span><button data-d="1" aria-label="mehr">+</button></div>`;
    }
    el.innerHTML = `<div class="det-img"><img src="${it.crop}" alt=""><span class="det-num">${it.i + 1}</span></div>
      <div class="det-main">${main}</div>${side}`;
    const select = el.querySelector('select');
    if (select) {
      select.addEventListener('change', () => {
        const v = select.value;
        if (v === '__other' || v === '') { it.partId = null; }
        else {
          it.partId = v;
          if (it.state !== 'ok') it.state = 'maybe';
          if (!it.count) it.count = 1;
          it.manual = true;
        }
        updateDetection(it);
        updateScanSummary();
        drawOverlay();
      });
    }
    el.querySelectorAll('.stepper button').forEach((b) => b.addEventListener('click', () => {
      it.count = Math.max(0, Math.min(99, it.count + Number(b.dataset.d)));
      updateDetection(it);
      updateScanSummary();
    }));
    updateScanSummary();
  }

  function scanTotals() {
    const parts = {}, extra = {};
    if (!scan) return { parts, extra, n: 0 };
    let n = 0;
    scan.items.forEach((it) => {
      if (!it.count || it.state === 'wait' || it.state === 'busy') return;
      if (it.partId) { parts[it.partId] = (parts[it.partId] || 0) + it.count; n += it.count; }
      else if (it.state === 'other') {
        const k = it.apiId || it.apiName;
        extra[k] = extra[k] || { name: it.apiName, count: 0 };
        extra[k].count += it.count;
        n += it.count;
      }
    });
    return { parts, extra, n };
  }

  function updateScanSummary() {
    if (!scan) return;
    const finished = scan.items.every((it) => it.state !== 'wait' && it.state !== 'busy');
    if (!finished) return;
    const t = scanTotals();
    const box = $('#scanSummary');
    const chips = Object.entries(t.parts)
      .sort((a, b) => b[1] - a[1])
      .map(([pid, n]) => `<span class="chip">${n}× ${esc(PARTS[pid].n)}</span>`)
      .concat(Object.values(t.extra).map((e) => `<span class="chip">${e.count}× ${esc(e.name)}</span>`));
    box.innerHTML = `<h3>Das habe ich erkannt</h3>${chips.length ? `<div class="chips">${chips.join('')}</div>` : '<p class="muted">Noch keine Steine ausgewählt.</p>'}
      <p class="muted small">Stimmt etwas nicht? Unten kannst du jeden Stein ändern oder mit − entfernen.</p>`;
    box.hidden = false;
    $('#btnAdd').textContent = t.n ? `✓ ${t.n} ${plural(t.n, 'Stein', 'Steine')} hinzufügen` : 'Nichts hinzuzufügen';
    $('#btnAdd').disabled = !t.n;
  }

  function finishScan() {
    $('#scanActions').hidden = false;
    updateScanSummary();
    const errors = scan.items.filter((i) => i.state === 'error').length;
    if (errors === scan.items.length) {
      toast('Keine Verbindung zum Erkennungsdienst. Bist du online?');
    }
  }

  function addScanToInventory() {
    const t = scanTotals();
    Object.entries(t.parts).forEach(([pid, n]) => store.add(pid, n));
    Object.entries(t.extra).forEach(([k, e]) => store.addExtra(k, e.name, e.count));
    store.save();
    lastIdeas = null;
    $('#scanActions').hidden = true;
    $('#detList').innerHTML = '';
    $('#afterAdd').hidden = false;
    $('#afterAddText').textContent = `${t.n} ${plural(t.n, 'Stein', 'Steine')} hinzugefügt!`;
    $('#afterAdd').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---------------------------------------------------------------------
  // 2) Meine Steine
  // ---------------------------------------------------------------------
  $('#onlyOwned').addEventListener('change', renderInventory);
  $('#btnClear').addEventListener('click', () => {
    if (!store.total()) { toast('Deine Sammlung ist schon leer.'); return; }
    if (!confirm('Wirklich alle Steine aus der Sammlung löschen?')) return;
    store.data.inv = {};
    store.data.extra = {};
    store.save();
    lastIdeas = null;
    renderInventory();
    toast('Sammlung geleert');
  });

  function renderInventory() {
    const only = $('#onlyOwned').checked;
    const inv = store.data.inv;
    const groups = {};
    Bricks.ORDER.forEach((id) => {
      if (only && !inv[id]) return;
      (groups[PARTS[id].k] = groups[PARTS[id].k] || []).push(id);
    });
    let html = '';
    Object.keys(Bricks.KIND_LABEL).forEach((k) => {
      if (!groups[k]) return;
      html += `<h3 class="group-title">${Bricks.KIND_LABEL[k]}</h3><div class="inv">`;
      groups[k].forEach((id) => {
        const n = inv[id] || 0;
        html += `<div class="inv-item${n ? '' : ' zero'}" data-id="${id}">
          <img src="${partImg(id)}" alt="">
          <div class="name">${esc(PARTS[id].n)}</div>
          <div class="stepper"><button data-d="-1" aria-label="weniger">−</button><span class="n">${n}</span><button data-d="1" aria-label="mehr">+</button></div>
        </div>`;
      });
      html += '</div>';
    });
    if (!html) {
      html = `<div class="empty"><p>Noch keine Steine in deiner Sammlung.</p>
        <button class="btn btn-primary" id="emptyToScan">Steine fotografieren</button>
        <p class="small">oder schalte „Nur vorhandene“ aus und füge Steine von Hand hinzu.</p></div>`;
    }
    $('#invList').innerHTML = html;
    const e2s = $('#emptyToScan');
    if (e2s) e2s.addEventListener('click', () => show('scan'));
    $$('#invList .inv-item').forEach((el) => {
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        store.add(el.dataset.id, Number(b.dataset.d));
        store.save();
        lastIdeas = null;
        const n = store.data.inv[el.dataset.id] || 0;
        el.querySelector('.n').textContent = n;
        el.classList.toggle('zero', !n);
      }));
    });

    const extras = Object.entries(store.data.extra);
    $('#extraList').innerHTML = extras.length ? `<h3 class="group-title">Sonderteile</h3>
      <p class="muted small">Diese Teile hat die App erkannt, sie kommen aber in den Bauideen (noch) nicht vor.</p>
      ${extras.map(([k, e]) => `<div class="extra-item" data-k="${esc(k)}"><span class="name">${esc(e.name)}</span>
        <div class="stepper"><button data-d="-1">−</button><span class="n">${e.count}</span><button data-d="1">+</button></div></div>`).join('')}` : '';
    $$('#extraList .extra-item').forEach((el) => {
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const k = el.dataset.k;
        const e = store.data.extra[k];
        if (!e) return;
        store.addExtra(k, e.name, Number(b.dataset.d));
        store.save();
        renderInventory();
      }));
    });
  }

  // ---------------------------------------------------------------------
  // 3) Ideen: Was kann ich bauen?
  // ---------------------------------------------------------------------
  let lastIdeas = null;
  let ideaFilter = 'Alle';

  function analyse(model) {
    const need = Bricks.countParts(model.bricks);
    const inv = store.data.inv;
    const missing = [];
    let missingN = 0;
    Object.entries(need).forEach(([pid, n]) => {
      const have = inv[pid] || 0;
      if (have < n) { missing.push({ pid, n: n - have }); missingN += n - have; }
    });
    return { model, need, missing, missingN };
  }

  $('#btnDesign').addEventListener('click', makeIdeas);

  function makeIdeas() {
    const btn = $('#btnDesign');
    btn.classList.add('busy');
    setTimeout(() => {
      const all = MODELS.map(analyse);
      lastIdeas = {
        can: shuffle(all.filter((a) => !a.missingN)),
        almost: all.filter((a) => a.missingN > 0 && a.missingN <= 4).sort((a, b) => a.missingN - b.missingN || a.model.bricks.length - b.model.bricks.length),
        rest: all.filter((a) => a.missingN > 4).sort((a, b) => a.missingN - b.missingN),
      };
      btn.classList.remove('busy');
      renderIdeas(true);
    }, 350);
  }

  function renderIdeas(animate) {
    const box = $('#ideas');
    $('#ideasEmpty').hidden = true;
    const total = store.total();
    if (!total) {
      box.innerHTML = `<div class="empty"><p><b>Deine Sammlung ist noch leer.</b><br>Fotografiere zuerst deine Steine – dann zeige ich dir, was du bauen kannst.</p>
        <button class="btn btn-primary" id="ideasToScan">Steine fotografieren</button>
        <p class="small">Neugierig? Hier sind schon mal alle Modelle:</p></div>
        <div class="grid" id="gAllPreview"></div>`;
      $('#ideasToScan').addEventListener('click', () => show('scan'));
      fillGrid($('#gAllPreview'), MODELS.map(analyse), animate);
      return;
    }
    const cats = ['Alle', ...new Set(MODELS.map((m) => m.cat))];
    const f = (list) => list.filter((a) => ideaFilter === 'Alle' || a.model.cat === ideaFilter);
    const can = f(lastIdeas.can), almost = f(lastIdeas.almost), rest = f(lastIdeas.rest);
    box.innerHTML = `<div class="filters">${cats.map((c) => `<button class="filter${c === ideaFilter ? ' active' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="ideas-head"><h3>Das kannst du bauen!</h3><span class="n">${can.length}</span></div>
      ${can.length ? '<div class="grid" id="gCan"></div>' : '<p class="muted">Mit deinen Steinen klappt hier noch keine Figur ganz – aber schau mal unten!</p>'}
      ${almost.length ? `<div class="ideas-head"><h3>Fast geschafft</h3><span class="n">${almost.length}</span></div>
        <p class="muted small">Dir fehlen nur wenige Steine. Vielleicht findest du sie noch?</p><div class="grid" id="gAlmost"></div>` : ''}
      ${rest.length ? `<div class="ideas-head"><h3>Für später</h3><span class="n">${rest.length}</span></div><div class="grid" id="gRest"></div>` : ''}`;
    $$('#ideas .filter').forEach((b) => b.addEventListener('click', () => { ideaFilter = b.dataset.c; renderIdeas(false); }));
    if (can.length) fillGrid($('#gCan'), can, animate);
    if (almost.length) fillGrid($('#gAlmost'), almost, animate);
    if (rest.length) fillGrid($('#gRest'), rest, false);
  }

  function missingText(a) {
    if (!a.missingN) return '';
    const parts = a.missing.map((m) => `${m.n}× ${PARTS[m.pid].n}`);
    return 'Es fehlt: ' + (parts.length > 2 ? parts.slice(0, 2).join(', ') + ' …' : parts.join(', '));
  }

  /** Karten in ein Raster füllen; Vorschaubilder werden nach und nach gezeichnet */
  function fillGrid(grid, list, animate) {
    grid.innerHTML = '';
    list.forEach((a, i) => {
      const m = a.model;
      const card = document.createElement('button');
      card.className = 'card';
      if (animate) card.style.animationDelay = Math.min(i, 12) * 45 + 'ms';
      else card.style.animation = 'none';
      const isFav = store.data.fav.includes(m.id), isBuilt = store.data.built.includes(m.id);
      card.innerHTML = `<div class="thumb"><div class="spinner"></div></div>
        ${isFav ? '<span class="fav">♥</span>' : ''}${isBuilt ? '<span class="built">✓</span>' : ''}
        <div class="cname">${esc(m.name)}</div>
        <div class="meta"><span>${m.bricks.length} Teile</span><span class="stars">${stars(m.bricks.length)}</span></div>
        ${a.missingN ? `<div class="missing">${esc(missingText(a))}</div>` : (store.total() ? '<div class="ok">Alle Steine da!</div>' : '')}`;
      card.addEventListener('click', () => openGuide(m.id));
      grid.appendChild(card);
      queueThumb(card.querySelector('.thumb'), m);
    });
  }

  const thumbQueue = [];
  let thumbBusy = false;
  function queueThumb(el, model) {
    thumbQueue.push({ el, model });
    if (!thumbBusy) { thumbBusy = true; setTimeout(drainThumbs, 0); }
  }
  function drainThumbs() {
    const t0 = performance.now();
    while (thumbQueue.length && performance.now() - t0 < 30) {
      const { el, model } = thumbQueue.shift();
      if (!el.isConnected) continue;
      const t = getThumbs();
      el.innerHTML = t ? `<img src="${t.model(model.id, model.bricks)}" alt="${esc(model.name)}">` : '<span class="muted">Keine Vorschau</span>';
    }
    if (thumbQueue.length) setTimeout(drainThumbs, 16);
    else thumbBusy = false;
  }

  // ---------------------------------------------------------------------
  // 4) Merkliste
  // ---------------------------------------------------------------------
  function renderMerk() {
    const favs = MODELS.filter((m) => store.data.fav.includes(m.id)).map(analyse);
    const built = MODELS.filter((m) => store.data.built.includes(m.id)).map(analyse);
    const fg = $('#favGrid'), bg = $('#builtGrid');
    if (favs.length) fillGrid(fg, favs, false);
    else fg.innerHTML = '<p class="muted">Tippe in einer Bauanleitung auf das Herz, um eine Figur zu merken.</p>';
    if (built.length) fillGrid(bg, built, false);
    else bg.innerHTML = '<p class="muted">Wenn du eine Anleitung bis zum Ende baust, erscheint die Figur hier.</p>';
  }

  // ---------------------------------------------------------------------
  // 5) 3D-Bauanleitung
  // ---------------------------------------------------------------------
  let guideView = null;
  let guide = null; // { model, step, analysis }

  function openGuide(id) {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;
    guide = { model, step: 0, analysis: analyse(model) };
    $('#guide').hidden = false;
    $('#guideTitle').textContent = model.name;
    $('#guideFav').classList.toggle('on', store.data.fav.includes(id));
    $('#guideHint').style.opacity = 1;
    document.body.style.overflow = 'hidden';
    if (!guideView) {
      try {
        guideView = new BrickView($('#guideCanvas'), { interactive: true });
      } catch (e) {
        $('#stepInfo').innerHTML = '<p>3D wird auf diesem Gerät leider nicht unterstützt.</p>';
        return;
      }
      $('#guideCanvas').addEventListener('pointerdown', () => { $('#guideHint').style.opacity = 0; });
    }
    guideView.setModel(model.bricks);
    const dots = $('#stepDots');
    const n = model.bricks.length;
    dots.innerHTML = n <= 40 ? '<i></i>'.repeat(n) : '';
    setStep(0);
  }

  function closeGuide() {
    $('#guide').hidden = true;
    document.body.style.overflow = '';
    if (guideView) guideView.stop();
    guide = null;
    if (current === 'merk') renderMerk();
    if (current === 'ideen' && lastIdeas) renderIdeas(false);
  }

  function setStep(s) {
    const m = guide.model;
    const n = m.bricks.length;
    guide.step = Math.max(0, Math.min(n, s));
    const step = guide.step;
    guideView.setStep(step === 0 ? n : step, step > 0);
    $$('#stepDots i').forEach((d, i) => {
      d.className = i < step - 1 ? 'done' : i === step - 1 ? 'now' : '';
    });
    $('#stepBadge').textContent = step === 0 ? 'So sieht es aus' : `Schritt ${step} von ${n}`;
    const prev = $('#stepPrev'), next = $('#stepNext');
    prev.disabled = step === 0;
    prev.style.visibility = step === 0 ? 'hidden' : 'visible';
    next.classList.toggle('btn-finish', step === n);
    next.textContent = step === 0 ? "Los geht's ▶" : step === n ? 'Fertig! 🎉' : 'Weiter ▶';

    const info = $('#stepInfo');
    if (step === 0) {
      const a = guide.analysis;
      const items = Object.entries(a.need).sort((x, y) => Bricks.ORDER.indexOf(x[0]) - Bricks.ORDER.indexOf(y[0]));
      info.innerHTML = `<div class="partlist">${items.map(([pid, q]) => {
        const short = (store.data.inv[pid] || 0) < q && store.total();
        return `<div class="pl-item${short ? ' short' : ''}"><img src="${partImg(pid)}" alt=""><div class="q">${q}×</div><div class="lbl">${esc(PARTS[pid].n)}</div></div>`;
      }).join('')}</div>
      <p class="note">${a.missingN && store.total() ? '⚠ ' + esc(missingText(a)) + ' · ' : ''}Die Farben sind nur Vorschläge – nimm einfach, was du hast!</p>`;
    } else {
      const b = Bricks.norm(m.bricks[step - 1]);
      const P = PARTS[b.p];
      const col = Bricks.COLORS[b.c];
      info.innerHTML = `<div class="need"><img src="${partImg(b.p, b.c)}" alt="">
        <div><div class="t1">1× ${esc(P.n)}</div>
        <div class="t2"><span class="swatch" style="background:${col.hex}"></span>${esc(col.n)} (oder eine andere Farbe)</div>
        <div class="t2">Setze ihn dort hin, wo es leuchtet.</div></div></div>`;
    }
  }

  $('#stepPrev').addEventListener('click', () => guide && setStep(guide.step - 1));
  $('#stepNext').addEventListener('click', () => {
    if (!guide) return;
    if (guide.step === guide.model.bricks.length) { finishModel(); return; }
    setStep(guide.step + 1);
  });
  $('#guideClose').addEventListener('click', closeGuide);
  $('#guideFav').addEventListener('click', () => {
    if (!guide) return;
    const on = store.toggle('fav', guide.model.id);
    $('#guideFav').classList.toggle('on', on);
    toast(on ? 'Zur Merkliste hinzugefügt ♥' : 'Von der Merkliste entfernt');
  });

  function finishModel() {
    const id = guide.model.id;
    if (!store.data.built.includes(id)) { store.data.built.push(id); store.save(); }
    confetti();
    toast(`Super! Du hast „${guide.model.name}“ gebaut!`);
    guideView.setStep(guide.model.bricks.length, false);
    guideView.az += 0.0001;
    spin();
  }

  function spin() {
    if (!guide) return;
    const startAz = guideView.az;
    const t0 = performance.now();
    const loop = (now) => {
      if (!guide) return;
      const k = Math.min(1, (now - t0) / 1600);
      guideView.az = startAz + k * Math.PI * 2;
      guideView.resize();
      guideView.render(now);
      if (k < 1) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function confetti() {
    const box = $('#confetti');
    box.innerHTML = '';
    const colors = ['#C91A09', '#0055BF', '#F2CD37', '#237841', '#FE8A18', '#FC97AC'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.6 + 's';
      c.style.animationDuration = 1.4 + Math.random() * 1.2 + 's';
      box.appendChild(c);
    }
    setTimeout(() => { box.innerHTML = ''; }, 3500);
  }

  window.addEventListener('resize', () => { if (guide && guideView) guideView.start(); });

  // ---------------------------------------------------------------------
  // Schnittstelle für die Android-App
  // ---------------------------------------------------------------------
  const app = {
    onPhoto(dataUrl) {
      startScan(dataUrl).catch((e) => { toast('Fehler: ' + e.message); resetScan(); });
    },
    onPhotoLoading() { toast('Foto wird geladen …'); },
    onPhotoCancel() { /* Nutzer hat abgebrochen */ },
    onPhotoError(msg) { toast(msg || 'Foto konnte nicht geladen werden'); },
    /** Zurück-Taste: true = in der App behandelt, false = App schließen */
    onBack() {
      if (guide) { closeGuide(); return true; }
      if (scan && current === 'scan') { resetScan(); return true; }
      if (current !== 'scan') { show('scan'); return true; }
      return false;
    },
  };
  window.app = app;

  // Start
  store.load();
  updateCount();
  if (Detect.isDemo()) toast('Demo-Modus: Erkennung ist simuliert');
})();

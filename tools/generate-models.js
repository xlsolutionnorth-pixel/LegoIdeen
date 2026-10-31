#!/usr/bin/env node
/*
 * Erzeugt zusätzliche Bauideen (app/src/main/assets/www/js/models-extra.js).
 * Jede Figur wird mit denselben Regeln geprüft wie die Handmodelle;
 * Figuren, die nicht baubar wären, werden verworfen.
 *
 * Aufruf: node tools/generate-models.js
 */
const fs = require('fs');
const path = require('path');
const www = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www', 'js');
const Bricks = require(path.join(www, 'bricks.js'));
const BASE = require(path.join(www, 'models.js'));

const TARGET = 300;

// ---------------------------------------------------------------------
// Namen
// ---------------------------------------------------------------------
const ADJ = {
  R: 'rot', B: 'blau', Y: 'gelb', G: 'grün', W: 'weiß', K: 'schwarz', L: 'grau', D: 'dunkelgrau',
  N: 'braun', A: 'hellblau', E: 'hellgrün', O: 'orangefarben', P: 'rosafarben', T: 'beigefarben',
};
const END = { m: 'er', f: 'e', n: 'es' };
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
/** "Rotes Auto", "Roter Bus", "Rote Ente" */
function adj(c, g) { return cap(ADJ[c] + END[g]); }
function adjSmall(c, g) { return ADJ[c] + END[g]; }

// ---------------------------------------------------------------------
// Sammeln
// ---------------------------------------------------------------------
const out = [];
const rejected = [];
const usedIds = new Set(BASE.map((m) => m.id));
const usedNames = new Set(BASE.map((m) => m.name));

function slug(s) {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function add(name, cat, bricks, view) {
  if (usedNames.has(name)) return false;
  const m = { id: 'g-' + slug(name), name, cat, bricks };
  if (view) m.view = view;
  if (usedIds.has(m.id)) return false;
  const errors = Bricks.validate(m);
  if (errors.length) { rejected.push(name + ': ' + errors[0]); return false; }
  if (bricks.length > 45) { rejected.push(name + ': zu groß'); return false; }
  usedIds.add(m.id);
  usedNames.add(name);
  out.push(m);
  return true;
}

// Teil für einen 2 breiten Stein der Länge n (entlang x)
const BRICK2 = { 1: null, 2: '3003', 3: '3002', 4: '3001', 6: '2456', 8: '3007' };
const BRICK1 = { 1: '3005', 2: '3004', 3: '3622', 4: '3010', 6: '3009', 8: '3008' };
const PLATE2 = { 2: '3022', 3: '3021', 4: '3020', 6: '3795', 8: '3034' };
const PLATE1 = { 1: '3024', 2: '3023', 3: '3623', 4: '3710', 6: '3666' };

// =====================================================================
// 1) Vierbeinige Tiere
// =====================================================================
function quad(o) {
  const b = [];
  const L = o.len;           // Körperlänge (3, 4, 6)
  const c = o.c, a = o.acc || o.c, lc = o.legC || o.c;
  // Beine
  for (let l = 0; l < o.legH; l++) {
    const y = l * 3;
    if (o.thickLegs) {
      b.push(['3003', 0, 0, y, lc], ['3003', L - 2, 0, y, lc]);
    } else {
      b.push(['3005', 0, 0, y, lc], ['3005', 0, 1, y, lc], ['3005', L - 1, 0, y, lc], ['3005', L - 1, 1, y, lc]);
    }
  }
  let y = o.legH * 3;
  for (let h = 0; h < o.bodyH; h++) { b.push([BRICK2[L], 0, 0, y, h === 0 && o.belly ? o.belly : c]); y += 3; }
  const top = y;
  // Schwanz
  if (o.tail === 'stein') b.push(['3005', 0, 0, top, a]);
  else if (o.tail === 'rund') b.push(['4073', 0, 0, top, a]);
  else if (o.tail === 'platte') b.push(['3024', 0, 1, top, a]);
  else if (o.tail === 'stacheln') {
    for (let x = 0; x + 1 < L - 1; x += 2) b.push(['3039', x, 0, top, a, 270]);
  }
  // Flecken
  if (o.spots) {
    for (let x = 1; x < L - 1; x++) {
      if (o.tail === 'stacheln') break;
      b.push(['3024', x, x % 2, top, o.spots]);
    }
  }
  // Hals
  let hy = top;
  for (let n = 0; n < (o.neck || 0); n++) { b.push(['3004', L - 1, 0, hy, n % 2 && o.neckAcc ? o.neckAcc : c, 90]); hy += 3; }
  // Kopf
  const hw = o.head || 2;
  b.push([BRICK2[hw], L - 1, 0, hy, o.headC || c]);
  const ht = hy + 3;
  const front = L - 1 + hw - 1;
  // Augen vorne, Ohren hinten
  const earX = L - 1;
  if (o.ears === 'stein') b.push(['3005', earX, 0, ht, o.earC || c], ['3005', earX, 1, ht, o.earC || c]);
  else if (o.ears === 'platte') b.push(['3024', earX, 0, ht, o.earC || c], ['3024', earX, 1, ht, o.earC || c]);
  else if (o.ears === 'rund') b.push(['4073', earX, 0, ht, o.earC || c], ['4073', earX, 1, ht, o.earC || c]);
  else if (o.ears === 'horn') b.push(['3062', earX, 0, ht, o.earC || 'W'], ['3062', earX, 1, ht, o.earC || 'W']);
  else if (o.ears === 'einhorn') b.push(['3062', earX, 0, ht, 'Y'], ['3062', earX, 0, ht + 3, 'Y']);
  const eyeX = hw === 2 ? front : front - 1;
  if (hw === 2 && o.ears && o.ears !== 'keine') {
    // Kopf zu klein für Ohren + Augen: Augen vorne neben Ohren geht nicht -> nur 1 Spalte
  }
  if (eyeX !== earX) b.push(['4073', eyeX, 0, ht, o.eyeC || 'K'], ['4073', eyeX, 1, ht, o.eyeC || 'K']);
  if (hw === 3) {
    if (o.nose) b.push(['3023', front, 0, ht, o.nose, 90]);
    else if (o.horn) b.push(['3062', front, 0, ht, o.horn]);
  }
  return b;
}

const ANIMALS = [
  // name, Geschlecht, Optionen
  ['Hund', { len: 4, legH: 2, bodyH: 1, head: 3, ears: 'stein', tail: 'stein', nose: 'K' }, ['N', 'T', 'K', 'W']],
  ['Dackel', { len: 6, legH: 1, bodyH: 1, head: 3, ears: 'platte', tail: 'stein', nose: 'K' }, ['N', 'K']],
  ['Welpe', { len: 3, legH: 1, bodyH: 1, head: 2, ears: 'platte', tail: 'rund' }, ['T', 'N', 'W']],
  ['Dalmatiner', { len: 4, legH: 2, bodyH: 1, head: 3, ears: 'platte', tail: 'stein', spots: 'K', nose: 'K' }, ['W']],
  ['Pferd', { len: 4, legH: 2, bodyH: 1, neck: 1, head: 3, ears: 'platte', tail: 'stein', nose: 'K' }, ['N', 'K', 'W']],
  ['Pony', { len: 3, legH: 2, bodyH: 1, neck: 1, head: 2, ears: 'platte', tail: 'stein' }, ['T', 'P', 'W']],
  ['Esel', { len: 4, legH: 2, bodyH: 1, neck: 1, head: 3, ears: 'stein', tail: 'rund', nose: 'K' }, ['L']],
  ['Einhorn', { len: 4, legH: 2, bodyH: 1, neck: 1, head: 3, ears: 'einhorn', tail: 'stein', acc: 'P', eyeC: 'B' }, ['W', 'P']],
  ['Kuh', { len: 4, legH: 2, bodyH: 2, head: 3, ears: 'horn', tail: 'rund', spots: 'K', nose: 'P' }, ['W']],
  ['Kalb', { len: 3, legH: 2, bodyH: 1, head: 2, ears: 'platte', tail: 'rund', spots: 'N' }, ['W']],
  ['Schaf', { len: 4, legH: 1, bodyH: 2, head: 2, ears: 'platte', tail: 'rund', legC: 'K', headC: 'K', earC: 'K', eyeC: 'W' }, ['W']],
  ['Lamm', { len: 3, legH: 1, bodyH: 1, head: 2, ears: 'platte', tail: 'rund', legC: 'K', headC: 'K', earC: 'K', eyeC: 'W' }, ['W']],
  ['Ziege', { len: 4, legH: 2, bodyH: 1, head: 3, ears: 'horn', tail: 'rund', nose: 'K', earC: 'L' }, ['W', 'N']],
  ['Ferkel', { len: 3, legH: 1, bodyH: 1, head: 3, ears: 'platte', tail: 'rund', nose: 'P' }, ['P']],
  ['Wildschwein', { len: 4, legH: 1, bodyH: 2, head: 3, ears: 'platte', tail: 'rund', nose: 'W' }, ['N']],
  ['Fuchs', { len: 4, legH: 1, bodyH: 1, head: 3, ears: 'stein', tail: 'stein', acc: 'W', legC: 'K', nose: 'K' }, ['O']],
  ['Wolf', { len: 4, legH: 2, bodyH: 1, head: 3, ears: 'stein', tail: 'stein', nose: 'K' }, ['L', 'D']],
  ['Bär', { len: 4, legH: 1, bodyH: 2, head: 2, ears: 'rund', tail: 'rund', thickLegs: true }, ['N', 'K']],
  ['Eisbär', { len: 4, legH: 1, bodyH: 2, head: 2, ears: 'rund', tail: 'rund', thickLegs: true }, ['W']],
  ['Panda', { len: 4, legH: 1, bodyH: 2, head: 2, ears: 'rund', earC: 'K', tail: 'rund', thickLegs: true, legC: 'K', belly: 'K' }, ['W']],
  ['Löwe', { len: 4, legH: 2, bodyH: 1, head: 3, ears: 'stein', earC: 'N', tail: 'stein', acc: 'N', nose: 'N' }, ['Y']],
  ['Tiger', { len: 4, legH: 2, bodyH: 1, head: 3, ears: 'platte', tail: 'stein', spots: 'K', nose: 'K' }, ['O']],
  ['Leopard', { len: 4, legH: 2, bodyH: 1, head: 2, ears: 'platte', tail: 'stein', spots: 'K' }, ['Y']],
  ['Zebra', { len: 4, legH: 2, bodyH: 1, neck: 1, head: 3, ears: 'platte', tail: 'stein', spots: 'K', legC: 'K', nose: 'K' }, ['W']],
  ['Kamel', { len: 4, legH: 2, bodyH: 1, neck: 2, head: 3, ears: 'platte', tail: 'stein', spots: 'T', nose: 'N' }, ['T']],
  ['Lama', { len: 3, legH: 2, bodyH: 1, neck: 2, head: 2, ears: 'stein', tail: 'rund' }, ['W', 'T']],
  ['Elch', { len: 4, legH: 2, bodyH: 1, neck: 1, head: 3, ears: 'horn', earC: 'T', tail: 'rund', nose: 'K' }, ['N']],
  ['Hirsch', { len: 4, legH: 2, bodyH: 1, neck: 1, head: 2, ears: 'horn', earC: 'N', tail: 'rund' }, ['T']],
  ['Reh', { len: 3, legH: 2, bodyH: 1, neck: 1, head: 2, ears: 'platte', tail: 'rund', spots: 'W' }, ['T', 'N']],
  ['Nashorn', { len: 4, legH: 1, bodyH: 2, head: 3, ears: 'platte', tail: 'rund', horn: 'W', thickLegs: true }, ['L']],
  ['Nilpferd', { len: 4, legH: 1, bodyH: 2, head: 3, ears: 'rund', tail: 'rund', nose: 'P', thickLegs: true }, ['L', 'P']],
  ['Bison', { len: 4, legH: 1, bodyH: 2, head: 2, ears: 'horn', earC: 'W', tail: 'rund', thickLegs: true }, ['N']],
  ['Maus', { len: 3, legH: 1, bodyH: 1, head: 2, ears: 'rund', earC: 'P', tail: 'platte', acc: 'P' }, ['L', 'W']],
  ['Hamster', { len: 3, legH: 1, bodyH: 1, head: 2, ears: 'rund', tail: 'rund' }, ['O', 'T']],
  ['Igel', { len: 4, legH: 1, bodyH: 1, head: 3, ears: 'keine', tail: 'stacheln', acc: 'N', nose: 'K' }, ['T']],
  ['Brachiosaurus', { len: 4, legH: 2, bodyH: 1, neck: 4, head: 3, ears: 'keine', tail: 'stein' }, ['G', 'E']],
  ['Stegosaurus', { len: 6, legH: 1, bodyH: 1, head: 2, ears: 'keine', tail: 'stacheln', acc: 'O' }, ['G', 'E']],
  ['Triceratops', { len: 4, legH: 1, bodyH: 2, head: 3, ears: 'horn', horn: 'W', tail: 'rund', thickLegs: true }, ['O', 'B']],
  ['Drache', { len: 6, legH: 2, bodyH: 1, neck: 2, head: 3, ears: 'horn', earC: 'Y', tail: 'stacheln', acc: 'R', eyeC: 'Y' }, ['G', 'R', 'K']],
  ['Krokodil', { len: 6, legH: 1, bodyH: 1, head: 3, ears: 'keine', tail: 'stacheln', acc: 'E', eyeC: 'Y', nose: 'W' }, ['E']],
];
const GENDER = {
  Hund: 'm', Dackel: 'm', Welpe: 'm', Dalmatiner: 'm', Pferd: 'n', Pony: 'n', Esel: 'm', Einhorn: 'n', Kuh: 'f', Kalb: 'n',
  Schaf: 'n', Lamm: 'n', Ziege: 'f', Ferkel: 'n', Wildschwein: 'n', Fuchs: 'm', Wolf: 'm', 'Bär': 'm', 'Eisbär': 'm',
  Panda: 'm', 'Löwe': 'm', Tiger: 'm', Leopard: 'm', Zebra: 'n', Kamel: 'n', Lama: 'n', Elch: 'm', Hirsch: 'm', Reh: 'n',
  Nashorn: 'n', Nilpferd: 'n', Bison: 'm', Maus: 'f', Hamster: 'm', Igel: 'm', Brachiosaurus: 'm', Stegosaurus: 'm',
  Triceratops: 'm', Drache: 'm', Krokodil: 'n',
};

function genAnimals() {
  for (const [name, o, colors] of ANIMALS) {
    colors.forEach((c, i) => {
      const n = i === 0 ? name : adj(c, GENDER[name]) + ' ' + name;
      add(n, 'Tiere', quad(Object.assign({}, o, { c })));
    });
  }
}

// =====================================================================
// 2) Vögel
// =====================================================================
function bird(o) {
  const b = [];
  const c = o.c;
  b.push(['3020', 0, 0, 0, o.feet || 'O']);
  let y = 1;
  for (let i = 0; i < (o.legs || 0); i++) { b.push(['3005', 1, 0, y, o.feet || 'O'], ['3005', 2, 1, y, o.feet || 'O']); y += 3; }
  if (o.legs) { b.push(['3001', 0, 0, y, c]); y += 3; } else { b.push(['3001', 0, 0, y, c]); y += 3; }
  if (o.big) { b.push(['3001', 0, 0, y, o.wing || c]); y += 3; }
  // Schwanz
  b.push(['3040', 0, 0, y, o.tailC || c, 270], ['3040', 0, 1, y, o.tailC || c, 270]);
  // Hals
  let hy = y;
  for (let n = 0; n < (o.neck || 0); n++) { b.push(['3004', 2, 0, hy, c, 90]); hy += 3; }
  if (o.neck) {
    b.push(['3003', 2, 0, hy, c]);
  } else {
    b.push(['3003', 2, 0, hy, c]);
  }
  // Schnabel
  b.push(['3021', 2, 0, hy + 3, o.beak || 'O']);
  b.push(['3003', 2, 0, hy + 4, o.headC || c]);
  b.push(['4073', 3, 0, hy + 7, o.eye || 'K'], ['4073', 3, 1, hy + 7, o.eye || 'K']);
  if (o.comb) b.push(['3024', 2, 0, hy + 7, o.comb], ['3024', 2, 1, hy + 7, o.comb]);
  return b;
}
const BIRDS = [
  ['Ente', 'f', { feet: 'O', beak: 'O' }, ['Y', 'W']],
  ['Küken', 'n', { feet: 'O', beak: 'O' }, ['Y']],
  ['Huhn', 'n', { feet: 'Y', beak: 'Y', comb: 'R', big: true }, ['W', 'N']],
  ['Hahn', 'm', { feet: 'Y', beak: 'Y', comb: 'R', big: true, tailC: 'G' }, ['N']],
  ['Papagei', 'm', { feet: 'K', beak: 'Y', tailC: 'B', wing: 'B', big: true }, ['R', 'G', 'B']],
  ['Schwan', 'm', { feet: 'K', beak: 'O', neck: 2 }, ['W', 'K']],
  ['Flamingo', 'm', { feet: 'P', beak: 'K', legs: 2, neck: 1 }, ['P']],
  ['Storch', 'm', { feet: 'R', beak: 'R', legs: 2, neck: 1, tailC: 'K' }, ['W']],
  ['Rabe', 'm', { feet: 'K', beak: 'D', eye: 'W' }, ['K']],
  ['Spatz', 'm', { feet: 'N', beak: 'Y', headC: 'T' }, ['N']],
  ['Taube', 'f', { feet: 'P', beak: 'D' }, ['L']],
  ['Gans', 'f', { feet: 'O', beak: 'O', neck: 1, big: true }, ['W', 'L']],
  ['Truthahn', 'm', { feet: 'O', beak: 'Y', comb: 'R', big: true, tailC: 'O' }, ['N']],
  ['Tukan', 'm', { feet: 'B', beak: 'O', headC: 'W' }, ['K']],
];
function genBirds() {
  for (const [name, g, o, colors] of BIRDS) {
    colors.forEach((c, i) => add(i === 0 ? name : adj(c, g) + ' ' + name, 'Tiere', bird(Object.assign({}, o, { c }))));
  }
}

// =====================================================================
// 3) Meerestiere
// =====================================================================
function fish(o) {
  const b = [['3020', 0, 0, 0, o.water || 'B'], ['3003', 1, 0, 1, 'K']];
  b.push(['3001', 0, 0, 4, o.c]);
  b.push([o.long ? '3007' : '2456', -1, 0, 7, o.mid || o.c]);
  b.push(['3001', 0, 0, 10, o.c]);
  const tx = o.long ? 6 : 4;
  b.push(['3005', tx, 0, 10, o.fin], ['3005', tx, 1, 10, o.fin]);
  b.push(['3039', 1, 0, 13, o.fin, 90]);
  b.push(['3039', tx, 0, 13, o.fin, 90]);
  b.push(['4073', 0, 0, 13, o.eye || 'K'], ['4073', 0, 1, 13, o.eye || 'K']);
  return b;
}
function whale(o) {
  const b = [['3032', 0, -1, 0, 'A']];
  b.push(['3007', 0, 0, 1, o.belly || o.c]);
  b.push(['3007', 0, 0, 4, o.c]);
  b.push(['3001', 0, 0, 7, o.c]);
  b.push(['3039', 4, 0, 7, o.c, 90]);
  b.push(['3039', 6, 0, 7, o.c, 90]);
  b.push(['4073', 0, 0, 10, 'K'], ['4073', 0, 1, 10, 'K']);
  if (o.fin) b.push(['3040', 2, 0, 10, o.c, 90]);
  if (o.spout) b.push(['3062', 1, 0, 10, 'A'], ['4073', 1, 0, 13, 'W']);
  return b;
}
function crab(c) {
  return [
    ['3005', 0, 0, 0, c], ['3005', 3, 0, 0, c], ['3005', 0, 2, 0, c], ['3005', 3, 2, 0, c],
    ['3031', 0, -1, 3, c], ['3001', 0, 0, 4, c],
    ['3024', -1, -1, 3, c],
    ['3062', 0, 1, 7, c], ['3062', 3, 1, 7, c], ['4073', 0, 1, 10, 'K'], ['4073', 3, 1, 10, 'K'],
  ].filter((e) => !(e[0] === '3024'));
}
function star(c, center) {
  return [
    ['3795', -1, 1, 0, c], ['3795', 1, -1, 1, c, 90], ['3024', -1, 1, 1, c], ['3024', 4, 2, 1, c],
    ['3003', 1, 1, 2, center], ['4073', 1, 2, 5, 'K'], ['4073', 2, 2, 5, 'K'],
  ];
}
function genSea() {
  const fishes = [
    ['Goldfisch', { c: 'O', fin: 'Y' }], ['Clownfisch', { c: 'O', mid: 'W', fin: 'K' }],
    ['Blauer Fisch', { c: 'B', fin: 'Y' }], ['Grüner Fisch', { c: 'G', fin: 'E' }],
    ['Rosa Fisch', { c: 'P', fin: 'W' }], ['Gelber Fisch', { c: 'Y', fin: 'B' }],
    ['Langer Fisch', { c: 'A', fin: 'B', long: true }], ['Hai', { c: 'L', fin: 'D', long: true, eye: 'W' }],
    ['Barrakuda', { c: 'D', fin: 'L', long: true, eye: 'Y' }], ['Roter Fisch', { c: 'R', fin: 'W' }],
  ];
  fishes.forEach(([n, o]) => add(n, 'Meer', fish(o)));
  add('Wal', 'Meer', whale({ c: 'B', belly: 'W', spout: true }));
  add('Orca', 'Meer', whale({ c: 'K', belly: 'W', fin: true }));
  add('Delfin', 'Meer', whale({ c: 'A', fin: true }));
  add('Krabbe', 'Meer', crab('R'));
  add('Orangefarbene Krabbe', 'Meer', crab('O'));
  add('Seestern', 'Meer', star('O', 'Y'));
  add('Rosa Seestern', 'Meer', star('P', 'W'));
  add('Roter Seestern', 'Meer', star('R', 'O'));
}

// =====================================================================
// 4) Fahrzeuge
// =====================================================================
function car(o) {
  const c = o.c, w = o.win || 'A';
  const b = [
    ['3062', 1, 0, 0, 'K'], ['3062', 4, 0, 0, 'K'], ['3062', 1, 3, 0, 'K'], ['3062', 4, 3, 0, 'K'],
    ['3032', 0, 0, 3, o.base || c],
    ['2456', 0, 0, 4, c], ['2456', 0, 2, 4, c],
  ];
  if (o.open) {
    b.push(['3039', 2, 0, 7, w, 90], ['3039', 2, 2, 7, w, 90]);
    b.push(['3024', 0, 1, 7, 'K'], ['3024', 0, 2, 7, 'K']);
    b.push(['3024', 5, 0, 7, 'Y'], ['3024', 5, 3, 7, 'Y']);
    if (o.spoiler) b.push(['3023', 0, 0, 7, c, 90].slice(0, 6));
    return b;
  }
  b.push(['3003', 0, 0, 7, o.top || c], ['3003', 0, 2, 7, o.top || c]);
  b.push(['3039', 2, 0, 7, w, 90], ['3039', 2, 2, 7, w, 90]);
  b.push(['3024', 5, 0, 7, 'Y'], ['3024', 5, 3, 7, 'Y']);
  b.push(['3031', 0, 0, 10, o.roof || c]);
  if (o.siren) b.push(['3062', 1, 1, 11, o.siren], ['3062', 1, 2, 11, o.siren2 || o.siren]);
  if (o.sign) b.push(['3004', 1, 1, 11, o.sign, 90]);
  if (o.rack) b.push(['3710', 0, 0, 11, 'K', 90].slice(0, 6));
  return b;
}
function bus(o) {
  const c = o.c;
  const b = [
    ['3062', 1, 0, 0, 'K'], ['3062', 1, 3, 0, 'K'], ['3062', 6, 0, 0, 'K'], ['3062', 6, 3, 0, 'K'],
    ['3034', 0, 0, 3, c], ['3034', 0, 2, 3, c],
    ['3007', 0, 0, 4, c], ['3007', 0, 2, 4, c],
  ];
  for (let x = 0; x < 8; x += 2) b.push(['3001', x, 0, 7, x === 6 ? o.front || 'A' : 'A', 90]);
  b.push(['3034', 0, 0, 10, o.roof || c], ['3034', 0, 2, 10, o.roof || c]);
  b.push(['3024', 7, 0, 7, 'Y'].slice(0, 5));
  return b.filter((e) => !(e[0] === '3024'));
}
function truck(o) {
  const b = [
    ['3062', 1, 0, 0, 'K'], ['3062', 1, 3, 0, 'K'], ['3062', 6, 0, 0, 'K'], ['3062', 6, 3, 0, 'K'],
    ['3034', 0, 0, 3, 'D'], ['3034', 0, 2, 3, 'D'],
    ['2456', 0, 0, 4, o.box], ['2456', 0, 2, 4, o.box],
    ['3003', 6, 0, 4, o.cab], ['3003', 6, 2, 4, o.cab],
    ['3001', 0, 0, 7, o.box, 90], ['3001', 2, 0, 7, o.box, 90], ['3001', 4, 0, 7, o.box, 90],
    ['3039', 6, 0, 7, 'A', 90], ['3039', 6, 2, 7, 'A', 90],
  ];
  if (o.lid) b.push(['3031', 0, 0, 10, o.lid]);
  if (o.light) b.push(['3062', 6, 1, 10, o.light].slice(0, 5));
  return b.filter((e) => !(e[0] === '3062' && e[3] === 10));
}
function plane(o) {
  return [
    ['3031', 2, 0, 0, 'B'], ['3003', 3, 1, 1, 'K'], ['3003', 3, 1, 4, 'K'],
    ['2456', 0, 1, 7, o.c],
    ['3034', 2, -2, 10, o.wing || o.c, 90],
    ['3039', 4, 1, 10, 'A', 90], ['3003', 0, 1, 10, o.c],
    ['3039', 0, 1, 13, o.tail || 'R', 270],
    ['4073', 2, -2, 11, 'R'], ['4073', 2, 5, 11, 'G'], ['4073', 3, -2, 11, o.tip || 'R'], ['4073', 3, 5, 11, o.tip || 'G'],
  ];
}
function rocket(o) {
  const b = [['3031', 0, 0, 0, o.fin]];
  [[0, 0], [3, 0], [0, 3], [3, 3]].forEach(([x, z]) => b.push(['3005', x, z, 1, o.fin]));
  let y = 1;
  for (let i = 0; i < o.h; i++) {
    b.push(['3003', 1, 1, y, i === o.h - 2 ? o.win || 'A' : (i % 2 && o.stripe ? o.stripe : o.c)]);
    if (i === 0) [[0, 0], [3, 0], [0, 3], [3, 3]].forEach(([x, z]) => b.push(['3005', x, z, 4, o.fin]));
    y += 3;
  }
  b.push(['3040', 1, 1, y, o.tip || o.fin, 180], ['3040', 2, 1, y, o.tip || o.fin, 0]);
  return b;
}
function boat(o) {
  const b = [
    ['3032', 0, -1, 0, 'A'], ['2456', 0, 0, 1, o.hull], ['3001', 0, 0, 4, o.deck || 'W'], ['3039', 4, 0, 4, o.hull, 90],
  ];
  if (o.sail) {
    b.push(['3062', 1, 0, 7, 'N'], ['3062', 1, 0, 10, 'N'], ['3062', 1, 0, 13, 'N']);
    b.push(['3005', 2, 0, 7, o.sail], ['3005', 2, 0, 10, o.sail], ['3005', 3, 0, 7, o.sail]);
    b.push(['3022', 0, 0, 16, o.sail].slice(0, 5));
    return b.filter((e) => e[0] !== '3022');
  }
  b.push(['3024', 0, 0, 7, 'A'], ['3003', 1, 0, 7, o.cabin || 'Y'], ['4073', 3, 0, 7, 'O'], ['4073', 3, 1, 7, 'O']);
  b.push(['3021', 0, 0, 10, o.hull], ['3062', 1, 1, 11, 'W'], ['3062', 1, 1, 14, 'W']);
  return b;
}
function heli(o) {
  return [
    ['3710', 1, 0, 0, 'D'], ['3710', 1, 3, 0, 'D'], ['3031', 1, 0, 1, o.c], ['3003', 1, 1, 2, o.c],
    ['3039', 3, 1, 2, 'A', 90], ['3020', 1, 1, 5, o.c], ['3666', -3, 2, 6, o.c], ['3062', 2, 1, 6, 'D'],
    ['3005', -3, 2, 7, o.c], ['3666', 0, 1, 9, 'K'], ['4073', -3, 2, 10, 'K'], ['3666', 2, -1, 10, 'K', 90],
  ];
}
function tractor(o) {
  return [
    ['3003', 0, -1, 0, 'K'], ['3003', 0, 3, 0, 'K'], ['3062', 4, 0, 0, 'K'], ['3062', 4, 3, 0, 'K'],
    ['3032', 0, 0, 3, o.c], ['3004', 0, -1, 3, 'K'], ['3004', 0, 4, 3, 'K'], ['3001', 2, 1, 4, o.c],
    ['3005', 0, 0, 4, o.c], ['3005', 0, 3, 4, o.c], ['3005', 1, 1, 4, 'K'], ['3005', 0, 0, 7, o.c], ['3005', 0, 3, 7, o.c],
    ['3062', 5, 1, 7, 'K'], ['3024', 5, 2, 7, 'Y'], ['3020', 0, 0, 10, o.roof || o.c, 90],
  ];
}
function loco(o) {
  return [
    ['3062', 0, 0, 0, 'K'], ['3062', 0, 1, 0, 'K'], ['3062', 2, 0, 0, 'K'], ['3062', 2, 1, 0, 'K'], ['3062', 5, 0, 0, 'K'], ['3062', 5, 1, 0, 'K'],
    ['3795', 0, 0, 3, o.base || 'R'], ['3003', 0, 0, 4, o.c], ['3001', 2, 0, 4, o.c], ['3003', 0, 0, 7, o.c],
    ['3020', 2, 0, 7, 'K'], ['3062', 5, 0, 8, 'K'], ['3024', 5, 1, 8, 'Y'], ['3022', 0, 0, 10, o.roof || 'R'], ['3062', 5, 0, 11, 'K'],
  ];
}
function wagon(o) {
  const b = [
    ['3062', 0, 0, 0, 'K'], ['3062', 0, 1, 0, 'K'], ['3062', 5, 0, 0, 'K'], ['3062', 5, 1, 0, 'K'],
    ['3795', 0, 0, 3, 'D'], ['2456', 0, 0, 4, o.c],
  ];
  if (o.kind === 'personen') b.push(['2456', 0, 0, 7, 'A'], ['3795', 0, 0, 10, o.c]);
  else if (o.kind === 'kohle') b.push(['3004', 1, 0, 7, 'K'], ['3004', 3, 1, 7, 'K'], ['3005', 0, 1, 7, 'K']);
  else b.push(['3001', 1, 0, 7, o.c2 || o.c], ['3020', 1, 0, 10, o.c]);
  return b;
}
function genVehicles() {
  ['R', 'B', 'Y', 'G', 'W', 'K', 'O', 'A', 'P', 'L'].forEach((c) => add(adj(c, 'n') + ' Auto', 'Fahrzeuge', car({ c })));
  add('Polizeiauto', 'Fahrzeuge', car({ c: 'W', top: 'B', roof: 'W', siren: 'B' }));
  add('Krankenwagen', 'Fahrzeuge', car({ c: 'W', roof: 'W', siren: 'R', siren2: 'B' }));
  add('Notarztwagen', 'Fahrzeuge', car({ c: 'Y', roof: 'R', siren: 'B' }));
  add('Taxi', 'Fahrzeuge', car({ c: 'Y', sign: 'K' }));
  add('Feuerwehr-Kommandowagen', 'Fahrzeuge', car({ c: 'R', roof: 'W', siren: 'B' }));
  ['R', 'B', 'Y', 'G', 'K', 'O'].forEach((c) => add(adj(c, 'n') + ' Cabrio', 'Fahrzeuge', car({ c, open: true })));
  ['Y', 'R', 'B', 'G', 'W'].forEach((c, i) => add(i === 0 ? 'Schulbus' : adj(c, 'm') + ' Bus', 'Fahrzeuge', bus({ c })));
  add('Doppeldeckerbus', 'Fahrzeuge', bus({ c: 'R', roof: 'R' }).concat([
    ['3001', 0, 0, 11, 'A', 90], ['3001', 2, 0, 11, 'A', 90], ['3001', 4, 0, 11, 'A', 90], ['3001', 6, 0, 11, 'A', 90],
    ['3034', 0, 0, 14, 'R'], ['3034', 0, 2, 14, 'R'],
  ]));
  [['Lastwagen', { cab: 'R', box: 'W' }], ['Blauer Lastwagen', { cab: 'B', box: 'L' }], ['Postauto', { cab: 'Y', box: 'Y', lid: 'K' }],
    ['Müllauto', { cab: 'G', box: 'L', lid: 'G' }], ['Eiswagen', { cab: 'W', box: 'P', lid: 'W' }], ['Umzugswagen', { cab: 'O', box: 'W', lid: 'O' }],
    ['Kühlwagen', { cab: 'B', box: 'W', lid: 'A' }], ['Feuerwehr-Lastwagen', { cab: 'R', box: 'R', lid: 'W' }]]
    .forEach(([n, o]) => add(n, 'Fahrzeuge', truck(o)));
  [['W', 'W'], ['R', 'W'], ['B', 'W'], ['Y', 'B'], ['G', 'Y'], ['K', 'R']].forEach(([c, wing], i) =>
    add(i === 0 ? 'Passagierflugzeug' : adj(c, 'n') + ' Flugzeug', 'Fahrzeuge', plane({ c, wing, tail: c === 'W' ? 'B' : 'W' })));
  [
    ['Mondrakete', { c: 'W', fin: 'B', h: 4 }], ['Kleine Rakete', { c: 'W', fin: 'R', h: 3 }],
    ['Weltraumrakete', { c: 'L', fin: 'K', h: 5, stripe: 'W' }], ['Gelbe Rakete', { c: 'Y', fin: 'R', h: 4 }],
    ['Blaue Rakete', { c: 'B', fin: 'Y', h: 4 }], ['Grüne Rakete', { c: 'G', fin: 'O', h: 4, stripe: 'E' }],
    ['Rosa Rakete', { c: 'P', fin: 'W', h: 3 }], ['Gestreifte Rakete', { c: 'R', fin: 'W', h: 5, stripe: 'W' }],
    ['Riesenrakete', { c: 'W', fin: 'R', h: 6, stripe: 'R' }],
  ].forEach(([n, o]) => add(n, 'Fahrzeuge', rocket(o)));
  [['Fischerboot', { hull: 'B', cabin: 'W' }], ['Rettungsboot', { hull: 'O', cabin: 'W' }], ['Grünes Boot', { hull: 'G', cabin: 'Y' }],
    ['Gelbes Boot', { hull: 'Y', cabin: 'R' }], ['Segelboot', { hull: 'R', sail: 'W' }], ['Blaues Segelboot', { hull: 'B', sail: 'W' }],
    ['Piratenboot', { hull: 'N', sail: 'K', deck: 'N' }]]
    .forEach(([n, o]) => add(n, 'Fahrzeuge', boat(o)));
  ['R', 'Y', 'G', 'K', 'O'].forEach((c) => add(adj(c, 'm') + ' Hubschrauber', 'Fahrzeuge', heli({ c })));
  ['R', 'B', 'Y', 'O'].forEach((c) => add(adj(c, 'm') + ' Traktor', 'Fahrzeuge', tractor({ c })));
  [['B', 'R'], ['K', 'R'], ['R', 'K'], ['Y', 'B']].forEach(([c, roof]) => add(adj(c, 'f') + ' Lokomotive', 'Fahrzeuge', loco({ c, roof })));
  add('Personenwagen', 'Fahrzeuge', wagon({ c: 'R', kind: 'personen' }));
  add('Blauer Personenwagen', 'Fahrzeuge', wagon({ c: 'B', kind: 'personen' }));
  add('Kohlewagen', 'Fahrzeuge', wagon({ c: 'D', kind: 'kohle' }));
  add('Güterwagen', 'Fahrzeuge', wagon({ c: 'N', c2: 'O' }));
  add('Containerwagen', 'Fahrzeuge', wagon({ c: 'L', c2: 'B' }));
}

// =====================================================================
// 5) Gebäude
// =====================================================================
function house(o) {
  const W = o.w, wall = o.wall, roof = o.roof;
  const b = [[W === 4 ? '3031' : '3032', 0, 0, 0, o.ground || 'G']];
  let y = 1;
  for (let f = 0; f < o.floors; f++) {
    for (let l = 0; l < 2; l++) {
      const winRow = l === 1;
      b.push([BRICK1[W], 0, 0, y, wall]);
      b.push(['3004', 0, 1, y, winRow && W === 6 ? o.win || 'A' : wall, 90], ['3004', W - 1, 1, y, winRow && W === 6 ? o.win || 'A' : wall, 90]);
      if (f === 0) {
        // vorne mit Tür
        if (W === 4) b.push(['3005', 0, 3, y, wall], ['3004', 1, 3, y, o.door || 'N'], ['3005', 3, 3, y, wall]);
        else b.push(['3004', 0, 3, y, winRow ? o.win || 'A' : wall], ['3005', 2, 3, y, o.door || 'N'], ['3622', 3, 3, y, wall]);
      } else {
        b.push(['3005', 0, 3, y, wall], ['3004', 1, 3, y, o.win || 'A'], [W === 4 ? '3005' : '3622', 3, 3, y, wall]);
      }
      y += 3;
    }
    b.push([W === 4 ? '3031' : '3032', 0, 0, y, o.band || wall]);
    y += 1;
  }
  if (W === 4) {
    b.push(['3037', 0, 0, y, roof, 180], ['3037', 0, 2, y, roof, 0], ['3020', 0, 1, y + 3, roof]);
  } else {
    b.push(['3037', 0, 0, y, roof, 180], ['3039', 4, 0, y, roof, 180], ['3037', 0, 2, y, roof, 0], ['3039', 4, 2, y, roof, 0],
      ['3795', 0, 1, y + 3, roof]);
  }
  if (o.chimney) b.push(['3005', W - 2, 1, y + 4, 'D']);
  return b;
}
function tower(o) {
  const b = [['3031', 0, 0, 0, o.ground || 'D']];
  let y = 1;
  for (let i = 0; i < o.h; i++) { b.push(['3003', 1, 1, y, i % 2 ? o.c2 : o.c]); y += 3; }
  if (o.top === 'lampe') {
    b.push(['3031', 0, 0, y, 'W']);
    y += 1;
    b.push(['3062', 1, 1, y, 'Y'], ['3062', 2, 1, y, 'Y'], ['3062', 1, 2, y, 'Y'], ['3062', 2, 2, y, 'Y']);
    y += 3;
    b.push(['3022', 1, 1, y, o.roof], ['3040', 1, 1, y + 1, o.roof, 180], ['3040', 2, 1, y + 1, o.roof, 0]);
  } else if (o.top === 'dach') {
    b.push(['3040', 1, 1, y, o.roof, 180], ['3040', 2, 1, y, o.roof, 0]);
  } else {
    b.push(['3031', 0, 0, y, o.c]);
    [[0, 0], [3, 0], [0, 3], [3, 3]].forEach(([x, z]) => b.push(['3005', x, z, y + 1, o.c]));
  }
  return b;
}
function wall(o) {
  const b = [[o.len === 6 ? '3795' : '3034', 0, 0, 0, 'G']];
  let y = 1;
  for (let l = 0; l < o.h; l++) {
    if (l % 2 === 0) b.push(['3010', 0, 0, y, o.c], [BRICK1[o.len - 4], 4, 0, y, o.c]);
    else b.push(['3004', 0, 0, y, o.c], [BRICK1[o.len - 2], 2, 0, y, o.c]);
    y += 3;
  }
  for (let x = 0; x < o.len; x += 2) b.push(['3005', x, 0, y, o.c]);
  if (o.flag) b.push(['3062', o.len - 1, 0, y, o.flag]);
  return b;
}
function genBuildings() {
  const combos = [
    ['W', 'R'], ['Y', 'R'], ['R', 'K'], ['B', 'W'], ['W', 'B'], ['T', 'N'], ['P', 'W'], ['A', 'R'], ['G', 'R'], ['O', 'N'], ['L', 'R'], ['W', 'G'],
  ];
  combos.forEach(([wall, roof], i) => {
    add('Kleines ' + adjSmall(wall, 'n') + ' Haus', 'Gebäude', house({ w: 4, floors: 1, wall, roof, chimney: i % 2 === 0, door: i % 3 ? 'N' : 'R' }));
    add('Großes ' + adjSmall(wall, 'n') + ' Haus', 'Gebäude', house({ w: 6, floors: 1, wall, roof, chimney: i % 2 === 1 }));
  });
  [['W', 'R'], ['Y', 'B'], ['R', 'K'], ['B', 'R'], ['T', 'G'], ['P', 'R']].forEach(([wall, roof]) =>
    add(adj(wall, 'n') + ' Stadthaus', 'Gebäude', house({ w: 4, floors: 2, wall, roof })));
  add('Villa', 'Gebäude', house({ w: 6, floors: 2, wall: 'W', roof: 'B', chimney: true }));
  add('Holzhütte', 'Gebäude', house({ w: 4, floors: 1, wall: 'N', roof: 'G', door: 'T' }));
  add('Waldhütte', 'Gebäude', house({ w: 6, floors: 1, wall: 'N', roof: 'D', chimney: true, door: 'T' }));
  add('Lebkuchenhaus', 'Gebäude', house({ w: 4, floors: 1, wall: 'N', roof: 'W', door: 'P', ground: 'W' }));
  add('Schneehaus', 'Gebäude', house({ w: 4, floors: 1, wall: 'W', roof: 'W', door: 'A', ground: 'W' }));
  add('Strandhaus', 'Gebäude', house({ w: 6, floors: 1, wall: 'A', roof: 'W', ground: 'T' }));
  [
    ['Rot-weißer Turm', { c: 'R', c2: 'W', h: 5 }], ['Blau-weißer Turm', { c: 'B', c2: 'W', h: 5 }],
    ['Gelb-schwarzer Turm', { c: 'Y', c2: 'K', h: 4 }], ['Grün-gelber Turm', { c: 'G', c2: 'Y', h: 4 }],
    ['Regenbogenturm', { c: 'R', c2: 'Y', h: 6 }], ['Hoher Turm', { c: 'L', c2: 'D', h: 7 }],
    ['Steinturm', { c: 'L', c2: 'L', h: 4 }], ['Rosa Turm', { c: 'P', c2: 'W', h: 5, top: 'dach', roof: 'P' }],
    ['Zauberturm', { c: 'B', c2: 'A', h: 6, top: 'dach', roof: 'Y' }], ['Prinzessinnenturm', { c: 'W', c2: 'P', h: 5, top: 'dach', roof: 'P' }],
    ['Kirchturm', { c: 'W', c2: 'W', h: 6, top: 'dach', roof: 'G' }], ['Glockenturm', { c: 'T', c2: 'T', h: 5, top: 'dach', roof: 'R' }],
  ].forEach(([n, o]) => add(n, 'Gebäude', tower(Object.assign({ ground: 'G' }, o))));
  [['Blau-weißer Leuchtturm', 'B', 'W', 'B'], ['Grün-weißer Leuchtturm', 'G', 'W', 'G'], ['Gelb-schwarzer Leuchtturm', 'Y', 'K', 'K'],
    ['Hoher Leuchtturm', 'R', 'W', 'R']]
    .forEach(([n, c, c2, roof], i) => add(n, 'Gebäude', tower({ c, c2, roof, h: i === 3 ? 7 : 5, top: 'lampe' })));
  [['Burgmauer', { c: 'L', len: 8, h: 3, flag: 'R' }], ['Dunkle Burgmauer', { c: 'D', len: 8, h: 3, flag: 'Y' }],
    ['Kleine Burgmauer', { c: 'L', len: 6, h: 2 }], ['Gartenmauer', { c: 'R', len: 6, h: 1 }], ['Sandburgmauer', { c: 'T', len: 8, h: 2, flag: 'B' }],
    ['Hohe Mauer', { c: 'D', len: 6, h: 4, flag: 'R' }]]
    .forEach(([n, o]) => add(n, 'Gebäude', wall(o)));
}

// =====================================================================
// 6) Natur
// =====================================================================
function tree(o) {
  const b = [['3031', 0, 0, 0, o.ground || 'G']];
  let y = 1;
  for (let i = 0; i < o.trunk; i++) { b.push(['3003', 1, 1, y, 'N']); y += 3; }
  const leaf = o.leaf || 'E';
  b.push(['3001', 0, 0, y, leaf], ['3001', 0, 2, y, leaf]);
  y += 3;
  b.push(['3001', 0, 1, y, leaf], ['3004', 1, 0, y, leaf], ['3004', 1, 3, y, leaf]);
  if (o.fruit) b.push(['4073', 0, 0, y, o.fruit], ['4073', 3, 3, y, o.fruit], ['4073', 3, 0, y, o.fruit], ['4073', 0, 3, y, o.fruit]);
  y += 3;
  b.push(['3003', 1, 1, y, leaf]);
  if (o.fruit) b.push(['4073', 1, 1, y + 3, o.fruit]);
  return b;
}
function fir(o) {
  const b = [['3031', 0, 0, 0, o.ground || 'G'], ['3003', 1, 1, 1, 'N']];
  let y = 4;
  for (let i = 0; i < o.levels; i++) {
    b.push(['3031', 0, 0, y, o.c]);
    b.push(['3037', 0, 0, y + 1, o.c, 180], ['3037', 0, 2, y + 1, o.c, 0]);
    y += 4;
    if (i < o.levels - 1) { b.push(['3003', 1, 1, y, 'N']); y += 3; }
  }
  b.push(['3039', 1, 0, y, o.c, 180], ['3039', 1, 2, y, o.c, 0]);
  if (o.balls) b.push(['4073', 0, 1, y, o.balls], ['4073', 3, 2, y, o.balls]);
  b.push(['4073', 1, 1, y + 3, o.star || o.c]);
  return b;
}
function flower(o) {
  const b = [];
  let y = 0;
  for (let i = 0; i < o.pot; i++) { b.push(['3003', 0, 0, y, o.potC]); y += 3; }
  b.push(['3022', 0, 0, y, 'N']); y += 1;
  b.push(['3062', 0, 0, y, 'G']); y += 3;
  b.push(['3710', -1, 0, y, 'G']);
  if (o.bug && o.stem > 0) b.push(['4073', 2, 0, y + 1, o.bug]);
  y += 1;
  for (let i = 0; i < o.stem; i++) { b.push(['3062', 0, 0, y, 'G']); y += 3; }
  b.push(['3031', -1, -1, y, o.petal], ['3022', 0, 0, y + 1, o.center]);
  return b;
}
function mushroom(o) {
  const b = [['3031', 0, 0, 0, 'G']];
  let y = 1;
  for (let i = 0; i < o.stem; i++) { b.push(['3003', 1, 1, y, o.stemC || 'W']); y += 3; }
  b.push(['3031', 0, 0, y, o.c]); y += 1;
  b.push(['3001', 0, 1, y, o.c], ['3004', 1, 0, y, o.c], ['3004', 1, 3, y, o.c]); y += 3;
  b.push(['3003', 1, 1, y, o.c]);
  if (o.dots) b.push(['4073', 0, 1, y, o.dots], ['4073', 3, 2, y, o.dots], ['4073', 1, 0, y, o.dots], ['4073', 2, 3, y, o.dots]);
  return b;
}
function cactus(o) {
  const b = [['3031', 0, 0, 0, 'T']];
  let y = 1;
  for (let i = 0; i < o.h; i++) {
    b.push(['3003', 1, 1, y, 'G']);
    y += 3;
    if (i === 1) {
      b.push(['3666', -1, 1, y, 'G'].slice(0, 5));
    }
  }
  // Arme: Platte quer + Rundsteine hoch
  const arms = [['3666', -1, 1, 7, 'G'], ['3062', -1, 1, 8, 'G'], ['3062', 4, 1, 8, 'G']];
  const res = [['3031', 0, 0, 0, 'T'], ['3003', 1, 1, 1, 'G'], ['3003', 1, 1, 4, 'G'], ['3666', -1, 1, 7, 'G'], ['3003', 1, 1, 8, 'G'],
    ['3062', -1, 1, 8, 'G'], ['3062', 4, 1, 8, 'G']];
  let yy = 11;
  for (let i = 0; i < o.h - 3; i++) { res.push(['3003', 1, 1, yy, 'G']); yy += 3; }
  if (o.armsHigh) res.push(['3062', -1, 1, 11, 'G'], ['3062', 4, 1, 11, 'G']);
  res.push(['4073', 1, 1, yy, o.bloom || 'P']);
  void arms; void b;
  return res;
}
function snowman(o) {
  return [
    ['3031', 0, 0, 0, 'W'], ['3001', 0, 1, 1, 'W'], ['3004', 1, 0, 1, 'W'], ['3004', 1, 3, 1, 'W'],
    ['3001', 0, 1, 4, 'W'], ['3004', 1, 0, 4, 'W'], ['3004', 1, 3, 4, 'W'], ['3003', 1, 1, 7, 'W'],
    ['4073', 1, 3, 7, o.btn || 'K'], ['4073', 2, 3, 7, o.btn || 'K'], ['3021', 1, 1, 10, o.scarf, 90], ['3003', 1, 1, 11, 'W'],
    ['3024', 1, 3, 11, 'O'], ['3022', 1, 1, 14, o.hat || 'K'], ['3003', 1, 1, 15, o.hat || 'K'],
  ];
}
function genNature() {
  [['Apfelbaum mit roten Äpfeln', { trunk: 2, fruit: 'R' }], ['Apfelbaum mit grünen Äpfeln', { trunk: 2, fruit: 'E', leaf: 'G' }],
    ['Orangenbaum', { trunk: 2, fruit: 'O', leaf: 'G' }], ['Zitronenbaum', { trunk: 1, fruit: 'Y', leaf: 'G' }],
    ['Kirschbaum', { trunk: 2, fruit: 'R', leaf: 'G' }], ['Kirschblütenbaum', { trunk: 2, leaf: 'P', fruit: 'W' }],
    ['Kleiner Baum', { trunk: 1 }], ['Hoher Baum', { trunk: 3, leaf: 'G' }], ['Herbstbaum', { trunk: 2, leaf: 'O', fruit: 'R' }],
    ['Pflaumenbaum', { trunk: 2, leaf: 'G', fruit: 'B' }], ['Winterbaum', { trunk: 2, leaf: 'W', ground: 'W' }]]
    .forEach(([n, o]) => add(n, 'Natur', tree(o)));
  [['Tanne', { c: 'G', levels: 1 }], ['Große Tanne', { c: 'G', levels: 2 }], ['Weihnachtsbaum', { c: 'G', levels: 2, balls: 'R', star: 'Y' }],
    ['Kleiner Weihnachtsbaum', { c: 'G', levels: 1, balls: 'Y', star: 'Y' }], ['Schneetanne', { c: 'W', levels: 1, ground: 'W' }],
    ['Bunter Weihnachtsbaum', { c: 'E', levels: 2, balls: 'B', star: 'R' }]]
    .forEach(([n, o]) => add(n, 'Natur', fir(o)));
  const flowers = [
    ['Rote Blume', 'R', 'Y', 'O'], ['Gelbe Blume', 'Y', 'O', 'B'], ['Blaue Blume', 'B', 'W', 'R'], ['Weiße Blume', 'W', 'Y', 'P'],
    ['Rosa Blume', 'P', 'W', 'G'], ['Orangefarbene Blume', 'O', 'R', 'Y'], ['Sonnenblume', 'Y', 'N', 'G'], ['Margerite', 'W', 'Y', 'G'],
    ['Hellblaue Blume', 'A', 'W', 'O'], ['Zauberblume', 'P', 'B', 'Y'],
  ];
  flowers.forEach(([n, petal, center, potC], i) =>
    add(n, 'Natur', flower({ petal, center, potC, pot: 1 + (i % 3), stem: n === 'Sonnenblume' ? 2 : i % 2, bug: i % 4 === 0 ? 'R' : null })));
  [['Fliegenpilz', 'R', 'W'], ['Blauer Zauberpilz', 'B', 'Y'], ['Steinpilz', 'N', null], ['Gelber Pilz', 'Y', 'O'],
    ['Rosa Pilz', 'P', 'W'], ['Großer Fliegenpilz', 'R', 'W', 2], ['Gepunkteter Zauberpilz', 'B', 'P', 2], ['Grüner Pilz', 'E', 'W']]
    .forEach(([n, c, dots, stem]) => add(n, 'Natur', mushroom({ c, dots, stem: stem || 1, stemC: c === 'N' ? 'T' : 'W' })));
  add('Kaktus', 'Natur', cactus({ h: 3 }));
  add('Großer Kaktus', 'Natur', cactus({ h: 5, armsHigh: true, bloom: 'R' }));
  add('Blühender Kaktus', 'Natur', cactus({ h: 4, bloom: 'Y' }));
  [['B', 'Schneemann mit blauem Schal'], ['G', 'Schneemann mit grünem Schal'], ['Y', 'Schneemann mit gelbem Schal'],
    ['P', 'Schneemann mit rosa Schal'], ['O', 'Schneemann mit orangefarbenem Schal']]
    .forEach(([scarf, n]) => add(n, 'Natur', snowman({ scarf, hat: scarf === 'Y' ? 'R' : 'K' })));
}

// =====================================================================
// 7) Fantasie
// =====================================================================
function robot(o) {
  const b = [['3023', 0, 0, 0, 'D', 90], ['3023', 3, 0, 0, 'D', 90]];
  let y = 1;
  for (let l = 0; l < o.legs; l++) { b.push(['3005', 0, 0, y, o.leg || 'L'], ['3005', 3, 0, y, o.leg || 'L']); y += 3; }
  b.push(['3020', 0, 0, y, o.leg || 'L']); y += 1;
  for (let t = 0; t < o.body; t++) { b.push(['3001', 0, 0, y, o.c]); y += 3; }
  b.push(['2456', -1, 0, y, o.arm || 'L']); y += 3;
  if (o.armsUp) b.push(['3005', -1, 0, y, o.arm || 'L'], ['3005', 4, 0, y, o.arm || 'L']);
  b.push(['3003', 1, 0, y, o.head || 'L']);
  const ht = y + 3;
  if (o.armsUp) b.push(['4073', -1, 0, ht, 'Y'], ['4073', 4, 0, ht, 'Y']);
  b.push(['4073', 1, 1, ht, o.eye || 'Y'], ['4073', 2, 1, ht, o.eye || 'Y'], ['3062', 2, 0, ht, o.ant || 'R']);
  return b;
}
function monster(o) {
  const b = [
    ['3003', 0, 0, 0, o.feet || o.c], ['3003', 3, 0, 0, o.feet || o.c],
    ['3032', -1, -1, 3, o.c, 0], ['3001', 0, 0, 4, o.c], ['3001', 0, 0, 7, o.belly || o.c],
    ['3001', 0, 0, 10, o.c],
    ['3062', 0, 1, 13, 'W'], ['3062', 3, 1, 13, 'W'], ['4073', 0, 1, 16, 'K'], ['4073', 3, 1, 16, 'K'],
  ];
  if (o.horns) b.push(['3040', 1, 0, 13, o.horns, 180].slice(0, 6), ['3040', 2, 0, 13, o.horns, 0]);
  return b.filter((e) => !(e[0] === '3040' && e[5] === 180));
}
function ufo(o) {
  return [
    ['3005', 1, 1, 0, 'L'], ['3005', 2, 2, 0, 'L'],
    ['3031', 0, 0, 3, o.c], ['3001', 0, 1, 4, o.c], ['3004', 1, 0, 4, o.c], ['3004', 1, 3, 4, o.c],
    ['3003', 1, 1, 7, o.dome || 'A'], ['4073', 0, 1, 7, 'Y'], ['4073', 3, 2, 7, 'Y'], ['4073', 1, 0, 7, 'Y'], ['4073', 2, 3, 7, 'Y'],
    ['3062', 1, 1, 10, o.alien || 'E'], ['4073', 1, 1, 13, 'K'],
  ];
}
function castleGate(c) {
  return [
    ['3795', 0, 0, 0, 'G'],
    ['3004', 0, 0, 1, c], ['3004', 4, 0, 1, c], ['3004', 0, 0, 4, c], ['3004', 4, 0, 4, c],
    ['3009', 0, 0, 7, c], ['3005', 0, 0, 10, c], ['3005', 2, 0, 10, c], ['3005', 3, 0, 10, c], ['3005', 5, 0, 10, c],
    ['3004', 0, 1, 1, c], ['3004', 4, 1, 1, c], ['3004', 0, 1, 4, c], ['3004', 4, 1, 4, c], ['3009', 0, 1, 7, c],
  ];
}
function genFantasy() {
  [['Blauer Roboter', { c: 'B', legs: 2, body: 2, armsUp: true }], ['Roter Roboter', { c: 'R', legs: 2, body: 2 }],
    ['Gelber Roboter', { c: 'Y', legs: 1, body: 2, armsUp: true, eye: 'B' }], ['Grüner Roboter', { c: 'G', legs: 2, body: 1, eye: 'R' }],
    ['Kleiner Roboter', { c: 'L', legs: 1, body: 1, head: 'W' }], ['Großer Roboter', { c: 'D', legs: 3, body: 3, armsUp: true }],
    ['Schwarzer Roboter', { c: 'K', legs: 2, body: 2, eye: 'R', ant: 'Y' }], ['Weißer Roboter', { c: 'W', legs: 2, body: 2, armsUp: true, eye: 'A' }],
    ['Rosa Roboter', { c: 'P', legs: 1, body: 2, eye: 'B', ant: 'P' }], ['Orangefarbener Roboter', { c: 'O', legs: 2, body: 1, armsUp: true }],
    ['Hellblauer Roboter', { c: 'A', legs: 2, body: 2, head: 'W', eye: 'K' }], ['Goldroboter', { c: 'Y', leg: 'Y', arm: 'Y', head: 'Y', legs: 3, body: 2, armsUp: true, eye: 'R' }]]
    .forEach(([n, o]) => add(n, 'Fantasie', robot(o)));
  [['Grünes Monster', { c: 'G', belly: 'E', horns: 'Y' }], ['Blaues Monster', { c: 'B', belly: 'A' }], ['Rosa-blaues Monster', { c: 'P', belly: 'B', horns: 'W' }],
    ['Rotes Monster', { c: 'R', belly: 'O', horns: 'K' }], ['Gelbes Monster', { c: 'Y', belly: 'W', horns: 'O' }], ['Schwarzes Monster', { c: 'K', belly: 'D', horns: 'R' }],
    ['Kuschelmonster', { c: 'P', belly: 'W' }], ['Zottelmonster', { c: 'N', belly: 'T', horns: 'W' }]]
    .forEach(([n, o]) => add(n, 'Fantasie', monster(o)));
  [['Ufo', { c: 'L' }], ['Rotes Ufo', { c: 'R', dome: 'A' }], ['Blaues Ufo', { c: 'B', dome: 'W', alien: 'P' }], ['Grünes Ufo', { c: 'G', dome: 'A', alien: 'Y' }],
    ['Goldenes Ufo', { c: 'Y', dome: 'W' }]]
    .forEach(([n, o]) => add(n, 'Fantasie', ufo(o)));
  add('Burgtor', 'Gebäude', castleGate('L'));
  add('Dunkles Burgtor', 'Gebäude', castleGate('D'));
  add('Sandburg', 'Gebäude', castleGate('T'));
}

// =====================================================================
// 8) Buchstaben und Zahlen (stehend auf einer Platte)
// =====================================================================
const FONT = {
  A: ['###', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '###', '#.#', '###'], C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '###'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '###'], K: ['#.#', '###', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'], Q: ['###', '#.#', '#.#', '###', '..#'], R: ['##.', '#.#', '###', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '###', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '###', '.#.', '###', '#.#'],
  Y: ['#.#', '#.#', '###', '.#.', '.#.'], Z: ['###', '.##', '.#.', '##.', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'], '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'], '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'], '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
};
function glyph(rows, c) {
  const b = [['3021', 0, 0, 0, 'W']];
  const H = rows.length;
  for (let r = H - 1; r >= 0; r--) {
    const y = 1 + (H - 1 - r) * 3;
    const row = rows[r];
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') { x++; continue; }
      let e = x;
      while (e < row.length && row[e] === '#') e++;
      b.push([BRICK1[e - x], x, 1, y, c]);
      x = e;
    }
  }
  return b;
}
function genLetters() {
  const colors = ['R', 'B', 'Y', 'G', 'O', 'A', 'P', 'E'];
  let i = 0;
  for (const ch of Object.keys(FONT)) {
    const c = colors[i++ % colors.length];
    const isDigit = /\d/.test(ch);
    add((isDigit ? 'Zahl ' : 'Buchstabe ') + ch, isDigit ? 'Zahlen' : 'Buchstaben', glyph(FONT[ch], c), { az: 0.3, el: 0.3 });
  }
}

// ---------------------------------------------------------------------
genAnimals();
genBirds();
genSea();
genVehicles();
genBuildings();
genNature();
genFantasy();
genLetters();

console.log(`Erzeugt: ${out.length} gültige Figuren, ${rejected.length} verworfen`);
if (process.argv.includes('--verbose')) rejected.forEach((r) => console.log('  verworfen: ' + r));

// Kategorien möglichst gleichmäßig mischen und auf TARGET begrenzen
const byCat = {};
out.forEach((m) => (byCat[m.cat] = byCat[m.cat] || []).push(m));
const final = [];
const cats = Object.keys(byCat);
let k = 0;
while (final.length < Math.min(TARGET, out.length)) {
  const list = byCat[cats[k++ % cats.length]];
  if (list.length) final.push(list.shift());
}
final.sort((a, b) => cats.indexOf(a.cat) - cats.indexOf(b.cat));
const counts = {};
final.forEach((m) => (counts[m.cat] = (counts[m.cat] || 0) + 1));
console.log('Übernommen:', final.length, counts);

const body = final.map((m) => '  ' + JSON.stringify(m)).join(',\n');
const file = `/* AUTOMATISCH ERZEUGT von tools/generate-models.js – nicht von Hand ändern. */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.MODELS_EXTRA = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
${body}
  ];
});
`;
fs.writeFileSync(path.join(www, 'models-extra.js'), file);

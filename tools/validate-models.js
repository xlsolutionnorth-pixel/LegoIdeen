#!/usr/bin/env node
/*
 * Prüft alle Modelle in der Bibliothek:
 *  - keine Steine, die sich überschneiden
 *  - jeder Stein steht auf dem Boden oder auf Noppen eines vorherigen Steins
 *  - das Modell hängt zusammen
 * Aufruf: node tools/validate-models.js
 */
const path = require('path');
const www = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www', 'js');
const Bricks = require(path.join(www, 'bricks.js'));
const MODELS = require(path.join(www, 'models.js'));

let failed = 0;
const ids = new Set();
for (const m of MODELS) {
  const errors = Bricks.validate(m);
  if (ids.has(m.id)) errors.push('doppelte id ' + m.id);
  ids.add(m.id);
  const n = m.bricks.length;
  if (errors.length) {
    failed++;
    console.log(`✗ ${m.name} (${n} Teile)`);
    errors.forEach((e) => console.log('    ' + e));
  } else {
    console.log(`✓ ${m.name} (${n} Teile)`);
  }
}
console.log(`\n${MODELS.length} Modelle, ${failed} mit Fehlern.`);
process.exit(failed ? 1 : 0);

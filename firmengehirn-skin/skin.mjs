#!/usr/bin/env node
// Firmengehirn-Skin für LibreChat v0.8.8 setzen — läuft überall, wo Node läuft (macOS, Linux, Windows).
//
//   node skin.mjs neon     --lc <Pfad zu LibreChat>    Firmengehirn-Look
//   node skin.mjs standard --lc <Pfad zu LibreChat>    zurück zum Original
//   Zusatz: --ohne-build   nur Dateien setzen, Frontend nicht bauen
//
// Was es tut: Name, Fußzeile und Farben in LibreChats .env setzen, Logo/Stylesheet/Startskript nach
// client/public/assets/ kopieren, zwei Zeilen in client/index.html und eine in client/src/style.css
// ergänzen (nur beim ersten Mal), dann das Frontend bauen (npm run build in client/).
// Danach LibreChat neu starten und im Browser hart neu laden.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SKIN_KOMMENTARE = ['# ===== Firmengehirn', '# Navy n1', '# Firmengehirn-Skin', '# Zusätzlich: Programm'];
const LINK = '    <link rel="stylesheet" href="/assets/firmengehirn.css" /><!-- Firmengehirn-Skin -->';
const SKRIPT = '    <script src="/assets/firmengehirn.js"></script><!-- Firmengehirn-Skin: vor App-Start -->';
const AUTOFILL_ALT = '-webkit-box-shadow: 0 0 0 50vh #0d0d0d inset;';
const AUTOFILL_NEU = '-webkit-box-shadow: 0 0 0 50vh rgb(var(--surface-primary)) inset; /* Firmengehirn */';

function abbruch(text) {
  console.error(`✗ ${text}`);
  process.exit(1);
}

function argumente() {
  const args = process.argv.slice(2);
  const skin = args.find((a) => !a.startsWith('--'));
  const lcIndex = args.indexOf('--lc');
  const lc = path.resolve(lcIndex >= 0 ? args[lcIndex + 1] ?? '' : process.cwd());
  if (!skin) abbruch('Skin fehlt: node skin.mjs neon|standard --lc <Pfad zu LibreChat>');
  if (!fs.existsSync(path.join(HIER, skin))) abbruch(`Skin „${skin}" gibt es nicht in ${HIER}`);
  if (!fs.existsSync(path.join(lc, 'client', 'index.html')) || !fs.existsSync(path.join(lc, '.env'))) {
    abbruch(`${lc} ist kein LibreChat-Ordner mit .env (Option --lc prüfen)`);
  }
  return { skin, skinDir: path.join(HIER, skin), lc, build: !args.includes('--ohne-build') };
}

function envSetzen(lc, skinDir) {
  const envPfad = path.join(lc, '.env');
  let zeilen = fs.readFileSync(envPfad, 'utf8').split(/\r?\n/)
    .filter((z) => !z.startsWith('REACT_APP_THEME_') && !SKIN_KOMMENTARE.some((k) => z.startsWith(k)));
  for (const neu of fs.readFileSync(path.join(skinDir, 'app.env'), 'utf8').split(/\r?\n/).filter(Boolean)) {
    const schluessel = neu.replace(/^#\s?/, '').split('=')[0];
    const i = zeilen.findIndex((z) => z.replace(/^#\s?/, '').startsWith(`${schluessel}=`));
    if (i >= 0) zeilen[i] = neu; else zeilen.push(neu);
  }
  let text = zeilen.join('\n').replace(/\n+$/, '\n');
  const farben = fs.readFileSync(path.join(skinDir, 'env-theme.txt'), 'utf8').trim();
  if (farben) text += `\n${farben}\n`;
  fs.writeFileSync(envPfad, text);
}

function bilderSetzen(lc, skinDir) {
  const ziel = path.join(lc, 'client', 'public', 'assets');
  for (const datei of fs.readdirSync(ziel)) {
    if (datei.startsWith('firmengehirn')) fs.rmSync(path.join(ziel, datei));
  }
  const quelle = path.join(skinDir, 'assets');
  for (const datei of fs.readdirSync(quelle)) fs.copyFileSync(path.join(quelle, datei), path.join(ziel, datei));
  if (!fs.existsSync(path.join(quelle, 'logo.svg'))) {
    // Originallogo von LibreChat aus dessen eigenem git zurückholen
    const r = spawnSync('git', ['checkout', '--', 'client/public/assets/logo.svg'], { cwd: lc, stdio: 'inherit' });
    if (r.status !== 0) console.warn('! Originallogo nicht wiederhergestellt (kein git?) — Anmeldeseite zeigt weiter das Firmengehirn-Logo');
  }
}

function quelltextErgaenzen(lc) {
  const html = path.join(lc, 'client', 'index.html');
  let s = fs.readFileSync(html, 'utf8');
  if (!s.includes('firmengehirn.css')) {
    if (!s.includes('</head>')) abbruch('client/index.html ohne </head> — LibreChat-Version prüfen');
    s = s.replace('</head>', `${LINK.trimStart()}\n    ${SKRIPT.trimStart()}\n  </head>`);
    fs.writeFileSync(html, s);
    console.log('• client/index.html ergänzt');
  }
  const css = path.join(lc, 'client', 'src', 'style.css');
  const c = fs.readFileSync(css, 'utf8');
  if (c.includes(AUTOFILL_ALT)) {
    fs.writeFileSync(css, c.replace(AUTOFILL_ALT, AUTOFILL_NEU));
    console.log('• client/src/style.css ergänzt (Autofill-Farbe)');
  }
}

function bauen(lc) {
  console.log('• Frontend bauen (npm run build in client/) …');
  const r = spawnSync('npm', ['run', 'build'], { cwd: path.join(lc, 'client'), stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) abbruch('Build fehlgeschlagen — läuft Node 24 und wurde vorher einmal „npm run frontend" gebaut?');
}

const { skin, skinDir, lc, build } = argumente();
console.log(`▶ Skin „${skin}" für ${lc}`);
envSetzen(lc, skinDir);
bilderSetzen(lc, skinDir);
quelltextErgaenzen(lc);
if (build) bauen(lc);
console.log(`✓ Skin „${skin}" gesetzt. Jetzt LibreChat neu starten (npm run backend) und im Browser hart neu laden.`);

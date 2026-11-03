/* Skin „standard": von einem früheren Skin im Browser gespeicherte Farben entfernen,
   damit LibreChat wieder seine eigenen Farben zeigt. Läuft vor dem App-Start. */
try {
  ['theme-colors', 'theme-definition', 'theme-source', 'theme-name'].forEach((k) => localStorage.removeItem(k));
  // Den Tab-Titel nur zurücksetzen, wenn der Neon-Skin ihn gesetzt hat, nicht der Nutzer
  if (localStorage.getItem('firmengehirn-chattitel') === '1') {
    localStorage.removeItem('chatTitleInTab');
    localStorage.removeItem('firmengehirn-chattitel');
  }
} catch (e) { /* Speicher gesperrt: nichts zu tun */ }

/* Skin „neon": Farben kommen aus dem Build (REACT_APP_THEME_*). Läuft vor dem App-Start.
   Tab-Titel: LibreChat zeigt ab Werk den Chattitel („New Chat“). Hier ab Werk aus, damit „Firmengehirn“
   im Tab steht — nur wenn der Nutzer noch nichts gewählt hat; die Marke merkt sich, dass der Skin es war. */
try {
  if (localStorage.getItem('chatTitleInTab') === null) {
    localStorage.setItem('chatTitleInTab', 'false');
    localStorage.setItem('firmengehirn-chattitel', '1');
  }
} catch (e) { /* Speicher gesperrt: nichts zu tun */ }

/* Tab-Symbol: das Gehirn-Logo statt des LibreChat-Symbols. Das Skript steht nach den Icon-Zeilen in index.html,
   die Links gibt es hier also schon; „standard“ braucht nichts, ohne dieses Skript gelten wieder die Originale. */
document.querySelectorAll('link[rel="icon"]').forEach((link) => {
  link.type = 'image/svg+xml';
  link.removeAttribute('sizes');
  link.href = '/assets/firmengehirn.svg';
});

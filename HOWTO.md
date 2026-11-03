# Das Firmengehirn zum Selberbauen — eigenes ChatGPT mit LibreChat, lokal

Begleit-Anleitung zum Video von **Lokale KI mit Andreas Nürenberg**. Am Ende läuft auf deinem Rechner eine
Chat-Oberfläche wie ChatGPT, mit lokalem Sprachmodell, im Look des „Firmengehirns" aus der Erklär-Serie,
mit Agenten, Diagrammen, Diktat und einem Wissensspeicher, der mit Fundstelle antwortet. Den RAG-Teil (Suchen in den
Unterlagen) übernimmt der Dokumentenassistent, angebunden per MCP.

| | |
|---|---|
| **Stand** | November 2026, LibreChat **v0.8.8** · englische Fassung: `HOWTO.en.md` |
| **Getestet** | macOS (Apple Silicon, 24 GB RAM): Schritte 0–5. Linux/Windows nach offizieller Doku, Markierung **[ungetestet]** |
| **Dauer** | ca. 1–2 Stunden inkl. Downloads |
| **Kosten** | keine — die Software ist quelloffen, Gemma ist ein Open-Weight-Modell (Gemma-Nutzungsbedingungen) |
| **Daten** | nur der **synthetische** Demo-Bestand „Malerbetrieb Hoffmann" aus dem Dokumentenassistenten. Bitte für den Nachbau keine echten Firmenunterlagen verwenden |

Jeder Schritt hat ein **Ziel**, **Befehle zum Kopieren**, ein **Soll** (was du sehen musst) und **Wenn's hakt**.

---

## Für Claude Code (oder einen anderen Coding-Agenten)

Du kannst diese Datei einem Agenten geben, z. B. in Claude Code: *„Setze HOWTO.md Schritt für Schritt um."*
Für den Agenten gelten diese Regeln:

1. **Ordner zuerst klären** (Tabelle „Feste Ordner“ unten) und dem Menschen zur Bestätigung zeigen. Betriebssystem erkennen
   (`uname -s` bzw. Windows) und nur die passenden Befehle verwenden.
2. **Vor jedem Download, jeder Installation mit Administratorrechten und jedem `brew trust` nachfragen.**
   Downloads: Ollama-Modelle (mehrere GB), Whisper-Modell (~570 MB), Reranker `BAAI/bge-reranker-v2-m3` (~2 GB) und
   OCR-Modelle des Dokumentenassistenten (beim ersten Start), Pakete.
3. **Nach jedem Schritt die Prüfung („Soll") ausführen.** Schlägt sie fehl: anhalten, „Wenn's hakt" abarbeiten,
   dem Menschen berichten. Nicht mit dem nächsten Schritt weitermachen.
4. **Nur den synthetischen Demo-Bestand anbinden.** Nie Ordner mit echten Dokumenten als `--quelle` verwenden.
5. **Keine fremden Dienste einschalten** (Websuche, Cloud-OCR, Cloud-Modelle, Cloud-Embeddings).
6. Klicks in der Weboberfläche (Registrieren, Agenten anlegen) erledigt der Mensch; der Agent beschreibt sie.
7. Lange Prozesse (LibreChat, Whisper-Server, Dokumentenassistent) in eigenen Terminals starten, nicht blockierend.

### Feste Ordner

Alle Befehle unten benutzen diese Ordner. Wer sie so lässt, muss nichts anpassen und kann jeden Befehl
unverändert kopieren (macOS und Linux; Windows **[ungetestet]**, dort übersetzt am besten ein Agent).

| Was | Ordner |
|---|---|
| dieses Paket (HOWTO, Skin, yaml-Dateien) | `~/firmengehirn-howto` |
| LibreChat | `~/Projects/librechat` |
| Dokumentenassistent | `~/Projects/dokumentenassistent` |
| Zielablage der Demo | `~/dokass-demo-ziel` |
| Sprachmodell | `gemma4:12b-it-q4_K_M` (braucht ca. 8 GB freien Arbeitsspeicher) |

Wer ein anderes Modell nimmt (kleiner: `gemma4:e4b`), ersetzt den Modellnamen in den Befehlen, in denen er vorkommt.
`~` heißt „dein Benutzerordner".

---

## Schritt 0 · Voraussetzungen

**Ziel:** Git, Ollama mit Modell, Node.js 24 und MongoDB laufen.

**Dieses Paket holen** (braucht Git, siehe nächster Punkt):
```bash
git clone https://github.com/Lausbub198/firmengehirn-howto.git ~/firmengehirn-howto
```
Ohne Git: auf https://github.com/Lausbub198/firmengehirn-howto **Code → Download ZIP**, entpacken, den Ordner in deinen
Benutzerordner legen und in `firmengehirn-howto` umbenennen. Soll: `ls ~/firmengehirn-howto` zeigt
`HOWTO.md`, `firmengehirn-skin` und `librechat-yaml`.

**Werkzeuge zum Installieren** (nur was noch fehlt):

| Werkzeug | wofür | Installation |
|---|---|---|
| Homebrew (macOS) | whisper-cpp, ffmpeg, MongoDB nativ | Befehl von https://brew.sh |
| nvm | Node.js 24 neben einem vorhandenen Node | Befehl von https://github.com/nvm-sh/nvm (Windows: nvm-windows) |
| uv | Dokumentenassistent (Schritt 5); holt Python 3.13 selbst | `curl -LsSf https://astral.sh/uv/install.sh \| sh`, Doku https://docs.astral.sh/uv/ |
| Docker Desktop (optional) | nur für MongoDB-Variante a | https://www.docker.com/products/docker-desktop/ |

Soll: `brew --version` (macOS), `nvm --version` und `uv --version` zeigen je eine Versionsnummer. Danach das Terminal
einmal schließen und neu öffnen, damit es die neuen Befehle kennt.

**Git** — prüfen: `git --version`. Fehlt es: macOS `xcode-select --install`, Linux Paketmanager, Windows https://git-scm.com.

**Ollama** — Installation von https://ollama.com (macOS, Linux, Windows). Dann:
```bash
ollama pull gemma4:12b-it-q4_K_M
```
Soll: `ollama list` zeigt das Modell.

**Ollama mehr Kontext geben (wichtig):** LibreChat spricht Ollama über dessen OpenAI-Schnittstelle an. Dort arbeitet
Ollama ab Werk nur mit **4096 Tokens Kontext** und schneidet alles Längere vorne ab — die Anleitung für Artefakte, die
Beschreibung der Werkzeuge und der Anfang des Chats fallen dann still weg. Deshalb auf 16384 stellen:

*macOS (Ollama-App):*
```bash
launchctl setenv OLLAMA_CONTEXT_LENGTH 16384
```
Danach Ollama beenden (Menüleiste → Quit Ollama) und neu öffnen. Die Einstellung gilt bis zum nächsten Neustart des
Macs; danach den Befehl wiederholen.

*Linux (systemd):* `sudo systemctl edit ollama`, dort unter `[Service]` die Zeile
`Environment="OLLAMA_CONTEXT_LENGTH=16384"` eintragen, dann `sudo systemctl restart ollama`.

*Windows:* Umgebungsvariable `OLLAMA_CONTEXT_LENGTH` mit Wert `16384` für den Benutzer anlegen, Ollama neu starten.
**[ungetestet]**

Soll: Nach der ersten Frage zeigt `ollama ps` in der Spalte `CONTEXT` den Wert `16384` (oder `32768`, wenn zuletzt der
Dokumentenassistent aus Schritt 5 eingeordnet hat — der stellt das Modell selbst größer ein; beides ist in Ordnung). Mehr Kontext braucht mehr
Arbeitsspeicher; bei `gemma4:12b-it-q4_K_M` auf 24 GB passt es.

**Node.js 24** (LibreChat v0.8.8 verlangt Node 24, npm 11). Am einfachsten über nvm, damit ein vorhandenes Node bleibt:
```bash
nvm install 24
```
```bash
nvm use 24
```
macOS mit Homebrew geht auch: `brew install node@24` und im LibreChat-Terminal `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
Windows: nvm-windows (https://github.com/coreybutler/nvm-windows). Soll: `node -v` zeigt `v24.x`.

**MongoDB** — eine von zwei Varianten:

*a) Mit Docker (alle Systeme, am einfachsten):*
```bash
docker run -d --name librechat-mongo -p 127.0.0.1:27017:27017 -v librechat-mongo:/data/db mongo:8.0.20
```

*b) Nativ:* macOS mit Homebrew:
```bash
brew tap mongodb/brew
```
```bash
brew trust mongodb/brew
```
```bash
brew install mongodb-community
```
```bash
brew services start mongodb-community
```
Linux/Windows: MongoDB Community Server nach https://www.mongodb.com/docs/manual/administration/install-community/.

Soll: Verbindung auf Port 27017, z. B. `nc -z 127.0.0.1 27017` (macOS/Linux) oder `Test-NetConnection 127.0.0.1 -Port 27017` (Windows PowerShell).

**Wenn's hakt:** Homebrew meldet „Refusing to load formula … from untrusted tap" → `brew trust mongodb/brew` fehlt.
Docker-MongoDB startet nicht auf älteren x86-CPUs ohne AVX → laut LibreChat-Doku ein älteres MongoDB-Image nehmen.

---

## Schritt 1 · LibreChat installieren und das Modell anbinden

**Ziel:** LibreChat läuft ohne Docker und antwortet mit dem lokalen Modell.

```bash
git clone https://github.com/LibreChat-AI/LibreChat.git ~/Projects/librechat
```
```bash
cd ~/Projects/librechat
```
```bash
git checkout v0.8.8
```
```bash
cp .env.example .env
```

**Nur eigene Modelle zeigen:** Diese Zeile hängt `ENDPOINTS=custom,agents` an die Datei `.env` an. Damit zeigt die
Auswahl nur deine eigenen Modelle und die Agenten, nicht OpenAI, Google oder Anthropic:
```bash
echo 'ENDPOINTS=custom,agents' >> ~/Projects/librechat/.env
```
Soll: `grep ^ENDPOINTS ~/Projects/librechat/.env` zeigt genau eine Zeile `ENDPOINTS=custom,agents`.
(Die Datenbank-Adresse `MONGO_URI` steht in `.env` schon richtig, da musst du nichts tun.)

**Eigene Schlüssel und ein Prozess:** Ab Werk sind in `.env` die Schlüssel für gespeicherte Zugangsdaten und Anmeldungen
leer. LibreChat erzeugt dann beim ersten Start selbst welche, merkt sie sich in `.env.temp` und meldet das mit einer
Warnung, in der der volle Pfad samt Benutzername steht. Der erste Befehl trägt vier zufällige, feste Schlüssel ein:
```bash
cd ~/Projects/librechat && sed -i.bak -e "s/^CREDS_KEY=.*/CREDS_KEY=$(openssl rand -hex 32)/" -e "s/^CREDS_IV=.*/CREDS_IV=$(openssl rand -hex 16)/" -e "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" -e "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$(openssl rand -hex 32)/" .env && rm .env.bak
```
Der zweite sagt LibreChat, dass es als einzelner Prozess ohne Redis läuft; sonst stehen beim Start rote Fehler des
Zeitplaners für geplante Chats im Log:
```bash
echo 'SCHEDULES_SINGLE_PROCESS=true' >> ~/Projects/librechat/.env
```
Soll: `grep -E '^(CREDS|JWT|SCHEDULES)' ~/Projects/librechat/.env` zeigt fünf Zeilen, keine davon endet auf `=`.

> **Was sich dadurch ändert:** `CREDS_KEY`/`CREDS_IV` verschlüsseln gespeicherte Zugangsdaten (z. B. API-Schlüssel, die
> Nutzer eintragen), `JWT_SECRET`/`JWT_REFRESH_SECRET` unterschreiben die Anmeldungen. Feste Werte heißen: Anmeldungen und
> gespeicherte Schlüssel überstehen einen Neustart. Diese Werte gehören wie Passwörter nicht in Git und nicht in Screenshots.
> Wer sie später ändert, meldet alle ab.

> **Was sich dadurch ändert:** In `~/Projects/librechat/.env` steht ganz unten eine neue Zeile
> `ENDPOINTS=custom,agents`. `custom` sind die Modelle, die du selbst in `librechat.yaml` einträgst (hier Ollama),
> `agents` sind die Agenten aus Schritt 3. Alle anderen Anbieter (OpenAI, Google, Anthropic …) blendet LibreChat aus.
> Rückgängig: die Zeile in `.env` löschen.

**Konfiguration `librechat.yaml`:** Du schreibst diese Datei nicht selbst. Zu jedem Schritt liegt in
`~/firmengehirn-howto/librechat-yaml/` eine fertige, vollständige Fassung. Der folgende Befehl kopiert die Fassung für
Schritt 1 nach LibreChat und setzt dabei Modellname und Pfade ein. Eine vorhandene `librechat.yaml` wird ersetzt:
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-1.yaml > ~/Projects/librechat/librechat.yaml
```
Soll: `grep gemma4 ~/Projects/librechat/librechat.yaml` zeigt den Modellnamen, und `grep __ ~/Projects/librechat/librechat.yaml`
zeigt **nichts**. In den Schritten 2, 4 und 5 kommt derselbe Befehl wieder, nur mit einer anderen Schrittnummer.

> **Was der Befehl macht:** `sed` liest die Vorlage `schritt-1.yaml`, ersetzt darin den Platzhalter `__MODELL__` durch
> `gemma4:12b-it-q4_K_M` und schreibt das Ergebnis als `~/Projects/librechat/librechat.yaml`.
> Die Vorlage selbst bleibt unverändert. Ansehen kannst du das Ergebnis mit `cat ~/Projects/librechat/librechat.yaml`.
>
> **Was in der Datei steht (Schritt 1):**
>
> | Zeile | Bedeutung |
> |---|---|
> | `version: 1.3.17` | Format der Konfigurationsdatei, passend zu LibreChat v0.8.8 |
> | `endpoints:` → `custom:` → `name: "Ollama"` | ein eigener Modell-Anbieter mit dem Namen „Ollama" |
> | `baseURL: "http://localhost:11434/v1/"` | Adresse von Ollama auf diesem Rechner — die Fragen gehen nur dorthin |
> | `apiKey: "ollama"` | Pflichtfeld; Ollama prüft keinen Schlüssel |
> | `models: default: ["gemma4:12b-it-q4_K_M"]` | dieses Modell steht in der Auswahl |
> | `fetch: false` | nur dieses Modell — mit `true` holt LibreChat alle Modelle aus Ollama, auch das Embedding-Modell des Dokumentenassistenten, und das stand dann als erstes (und damit als Standard) in der Auswahl |
> | `titleConvo: true`, `titleModel: "current_model"` | das Modell gibt jedem Chat in der Seitenleiste einen Titel |
> | `modelDisplayLabel: "Ollama"` | Name, der über den Antworten steht |

Bauen und starten (Node 24 aktiv):
```bash
npm run reinstall
```
```bash
npm run backend
```

Soll: im Log „Connected to MongoDB", „Custom config file loaded", „Server listening at http://localhost:3080".
Im Browser http://localhost:3080 → **Registrieren** (lokales Konto) → oben „Ollama" und das Modell wählen → Frage stellen → Antwort kommt.
Das erste Konto ist automatisch **Admin**. Die Registrierung bleibt vorerst offen, Schritt 3 braucht ein zweites
Testkonto; geschlossen wird sie in Schritt 7.

**Wenn's hakt:**
- „Could not read package.json" → `npm` im falschen Ordner, erst `cd ~/Projects/librechat`.
- Im Log fehlt „Custom config file loaded" oder steht ein Fehler zur Konfiguration → den yaml-Befehl oben noch einmal
  kopieren, nichts von Hand in der Datei ändern (Einrückungen mit Leerzeichen sind dort wichtig).
- Build bricht ab → `node -v` prüfen, Node 24 muss in diesem Terminal aktiv sein.
- Modell fehlt in der Auswahl → läuft Ollama? `curl -s http://localhost:11434/api/tags`.
- Artefakte kommen nur als Code, Werkzeuge werden nicht aufgerufen, das Modell „vergisst" Anweisungen → Kontext prüfen:
  `ollama ps` muss bei `CONTEXT` 16384 (oder 32768) zeigen, sonst den Schritt „Ollama mehr Kontext geben" in Schritt 0 wiederholen.
- Harmlos im Log: „scheduler NOT started" (betrifft nur geplante Chats), „RAG API … not reachable" (LibreChats eingebaute RAG-API nutzen wir nicht, das Suchen in den Unterlagen macht der
  Dokumentenassistent in Schritt 5),
  „METRICS_SECRET is not set".

**Alternative mit Docker:** LibreChat lässt sich auch per `docker compose up -d` starten (Doku: https://www.librechat.ai/docs/local/docker).
Dann heißt die Ollama-Adresse `http://host.docker.internal:11434/v1/`, und `librechat.yaml` wird über
`docker-compose.override.yml` eingebunden. **Der Skin aus Schritt 2 geht damit nicht**, weil das fertige Image die
Farben nicht neu einliest.

---

## Schritt 2 · Das Gesicht: Firmengehirn-Look

**Ziel:** Name, Logo, Begrüßung, Modellkarte und Farben aus der Serie.

LibreChat im Terminal stoppen (Ctrl+C). Dann den Skin setzen (baut das Frontend neu, dauert ca. 10 s).
Der Befehl beginnt mit `node`, das Skript heißt `skin.mjs`:
```bash
node ~/firmengehirn-howto/firmengehirn-skin/skin.mjs neon --lc ~/Projects/librechat
```
Soll: am Ende eine Zeile mit „✓".

Begrüßung und Modellkarte kommen über die yaml-Fassung für Schritt 2 (ersetzt die von Schritt 1):
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-2.yaml > ~/Projects/librechat/librechat.yaml
```

> **Was in der Datei dazukommt (Schritt 2):** alles aus Schritt 1, plus zwei Blöcke:
>
> | Zeile | Bedeutung |
> |---|---|
> | `interface:` → `customWelcome: 'Willkommen im Firmengehirn …'` | Begrüßungstext auf der Startseite |
> | `modelSpecs:` → `list:` → `label: "Firmengehirn"` | eine Modellkarte „Firmengehirn"; dein Team sieht diesen Namen statt `gemma4:12b-it-q4_K_M` |
> | `prioritize: true`, `default: true` | die Karte steht oben und ist beim Öffnen schon ausgewählt |
> | `addedEndpoints: [agents]` | ohne diese Zeile zeigt das Modellmenü nur die Karten — Agenten (auch geteilte) wären dort nicht zu finden; so stehen sie unter **My Agents** |
> | `iconURL: "/assets/firmengehirn.svg"` | das Gehirn-Logo, das der Skin abgelegt hat |
> | `preset:` → `endpoint: "Ollama"`, `model: …` | hinter der Karte steckt das Modell aus Schritt 1 |
> | `greeting:` | Satz über dem Eingabefeld |
> | `promptPrefix:` | feste Anweisung an das Modell (Deutsch, knapp, sagt offen, wenn es etwas nicht weiß) — hier kannst du deinen Firmennamen eintragen |
LibreChat wieder starten (`cd ~/Projects/librechat` und `npm run backend`), im Browser **hart neu laden**
(Cmd+Shift+R bzw. Ctrl+Shift+R).

Soll: Navy-Flächen, Gehirn-Logo, Tab-Titel „Firmengehirn", Begrüßung „Willkommen im Firmengehirn", oben die Modellkarte
„Firmengehirn" statt des Modellnamens.

Zurück zum Original:
```bash
node ~/firmengehirn-howto/firmengehirn-skin/skin.mjs standard --lc ~/Projects/librechat
```

> **Was der Skin ändert** (alles in `~/Projects/librechat`):
>
> | Datei | Änderung | sichtbar als |
> |---|---|---|
> | `.env` | `APP_TITLE=Firmengehirn` | Name im Browser-Tab und auf der Anmeldeseite |
> | `.env` | `CUSTOM_FOOTER="Firmengehirn · Modell läuft lokal auf diesem Rechner"` | Zeile unter dem Eingabefeld |
> | `.env` | 64 Zeilen `REACT_APP_THEME_…=R G B` (aus `firmengehirn-skin/neon/env-theme.txt`) | Flächen-, Text- und Rahmenfarben |
> | `client/public/assets/` | neu: `firmengehirn.svg`, `firmengehirn-zeichen.svg`; ersetzt: LibreChats `logo.svg` | Logo in der Modellkarte und auf der Anmeldeseite |
> | `client/public/assets/` | `firmengehirn.css` | Neon-Überschrift, Farben der Symbole, Hintergrund |
> | `client/public/assets/` | `firmengehirn.js` | läuft vor dem App-Start: setzt das Gehirn-Logo als Tab-Symbol und schaltet „Chattitel im Tab“ ab Werk aus, damit „Firmengehirn“ statt „New Chat“ im Tab steht (nur wenn der Nutzer noch nichts gewählt hat); `standard` räumt alte Farbwerte und diese Voreinstellung wieder weg | Tab-Titel und Tab-Symbol |
> | `client/index.html` | zwei Zeilen mit dem Kommentar `Firmengehirn-Skin` (Stylesheet und Startskript einbinden), nur beim ersten Mal | — |
> | `client/src/style.css` | eine Zeile mit `/* Firmengehirn */` (Hintergrundfarbe bei automatisch ausgefüllten Feldern) | Anmeldefelder ohne schwarzen Balken |
> | `client/dist/` | neu gebaut (`npm run build`) | die Farben aus `.env` werden nur beim Bauen eingelesen |
>
> `standard` setzt `.env` zurück (`APP_TITLE=LibreChat`, keine Fußzeile, keine Farbzeilen), löscht die Firmengehirn-Logos,
> holt LibreChats Original-`logo.svg` aus dessen git zurück und legt neutrale Fassungen von `firmengehirn.css` und
> `firmengehirn.js` ab; die Zeilen in `index.html` und `style.css` bleiben, sie wirken dann nicht mehr. Nachvollziehen: `git -C ~/Projects/librechat status` und `git -C ~/Projects/librechat diff` zeigen die Änderungen an `client/`;
> ganz zurück auf den Auslieferungszustand mit `git -C ~/Projects/librechat restore client/index.html client/src/style.css client/public/assets/logo.svg`
> (`.env` liegt nicht in git, dafür bleibt `standard` nötig),
> `grep -E "APP_TITLE|CUSTOM_FOOTER|REACT_APP_THEME" ~/Projects/librechat/.env` die in `.env`.
>
> Eigene Farben: Zeilen in `firmengehirn-skin/neon/env-theme.txt` ändern (Wert „R G B", z. B. `36 37 94`) und den
> Befehl erneut ausführen.

**Wenn's hakt:**
- Tab zeigt noch „New Chat“ oder das LibreChat-Symbol → der Browser hält `firmengehirn.js` bis zu 48 Stunden im Cache: hart neu laden (Cmd+Shift+R). Hat jemand „Display chat title in tab“ selbst eingeschaltet, bleibt das so.
- Alte Farben trotz Neustart → die App hält Dateien im Browser fest: hart neu laden, notfalls Entwicklerwerkzeuge →
  Application → Service Workers → Unregister.
- Harmlos beim Bauen (der Befehl endet trotzdem mit „✓ Skin … gesetzt"): `<script src="/assets/firmengehirn.js"> … can't
  be bundled`, `/assets/firmengehirn.css doesn't exist at build time`, `The class ease-[…] is ambiguous`,
  `Use of direct eval`, `Some chunks are larger than 1500 kB`. Die Skin-Dateien werden absichtlich erst im Browser geladen.
- „SyntaxError: Invalid or unexpected token" → ein Shell-Skript (`skin.sh`) wurde mit `node` gestartet. Mit `node`
  immer `skin.mjs` aus diesem Paket aufrufen.
- Nach einem LibreChat-Update `skin.mjs` erneut ausführen, es setzt die Quelltext-Zeilen neu.

---

## Schritt 3 · Die Hände: Werkzeuge, Diagramme, Agenten

**Ziel:** Diagramme und kleine Programme im Chat, einen Agenten bauen und im Team teilen. Das Wissen bekommt der Agent
in Schritt 5.

1. **Werkzeug-Menü** im Chat (Schieberegler-Symbol neben der Büroklammer): **Artefakte** einschalten.
   **Code ausführen** aus lassen — dafür bräuchte es einen eigenen Dienst.
2. **Diagramm:**
   > Zeichne den Ablauf eines Angebots im Malerbetrieb als Mermaid-Diagramm: Anfrage, Besichtigung, Kalkulation, Angebot, Auftrag. Ohne eigene Farben, keine style- oder classDef-Zeilen.

   Soll: Eine Karte „Mermaid" mit dem Diagramm (läuft lokal im Browser).
3. **Artefakt** (eigenes Fenster rechts):
   > Erstelle ein Artefakt im Format :::artifact{identifier="farbrechner" type="text/html" title="Farbmengen-Rechner"} mit einer einzigen HTML-Datei (keine externen Skripte). Eingaben: Wandfläche in m², Anzahl Anstriche, Verbrauch Liter pro m² (0,15), Eimergröße Liter (12,5). Ausgabe: Liter und Eimer, aufgerundet.

   Soll: In der Antwort ein Knopf „Farbmengen-Rechner – Zum Öffnen klicken", rechts öffnet sich der Rechner.
4. **Agent „Abgleicher" anlegen:** rechte Seitenleiste → **Agenten erstellen**, dann:
   - **Name** `Abgleicher` · **Beschreibung** `Beantwortet Fragen zu den Unterlagen – mit Fundstelle und Link.`
   - **KI-Modell** Ollama / `gemma4:12b-it-q4_K_M` · **Kategorie** beliebig (nur Sortierung im Agenten-Marktplatz)
   - **Anweisungen** (das Werkzeug `suchen` kommt erst in Schritt 5 dazu):
     ```text
     Du beantwortest Fragen zu den Unterlagen der Malerbetrieb Hoffmann GmbH. Rufe für JEDE Frage zuerst das Werkzeug suchen auf, auch wenn die Frage schon einmal gestellt wurde; antworte nie aus dem Gedächtnis. Gib danach die Antwort in einem Satz und darunter je Beleg eine Zeile: Quelle: [Dateiname, Seite N](link) — den link übernimmst du unverändert aus dem Feld link. Findet das Werkzeug nichts, antworte: nicht gefunden.
     ```
   - **Tools** noch leer (die nativen Fähigkeiten wie Code ausführen, Web-Suche, Nutzer fragen lägen unter
     **Tools → Hinzufügen → Nativ**) · **Skills**: Off · **Dateikontext** leer
   - **Erstellen**. Soll: Der Agent steht unter „Agent auswählen" und im Chat im Modellmenü unter **My Agents**.
   - Gesprächseinstiege (Startfragen als Knöpfe) bietet der Agenten-Editor in v0.8.8 nicht — die Fragen werden getippt.
5. **Teilen** (ab Werk darf das nur der Admin, also das erste Konto): zweites Testkonto in einem privaten Browserfenster registrieren → im Agenten **Teilen** → Person suchen →
   Rolle **Betrachter**. Soll: Das zweite Konto findet den Agenten im Modellmenü unter **My Agents** und nutzt ihn; öffnet es den Editor,
   steht dort „keine Berechtigung, diesen Agenten zu bearbeiten".

**Wenn's hakt:**
- Statt Artefakt-Knopf nur Code → dem Modell fehlt der Rahmen `:::artifact{…}` … `:::`. Noch einmal ausdrücklich
  mit diesem Rahmen anfordern, oder unter Artefakte → **Benutzerdefinierter Promptmodus für Artefakte** eine kurze, harte Regel eintragen.
  Kleinere Modelle vergessen den Rahmen bei langen Antworten.
- Diagramm-Kästen schwer lesbar → „ohne eigene Farben" verlangen.
- HTML-/React-Artefakte laden laut LibreChat-Doku einen Baustein aus dem CodeSandbox-Netz — ohne Internet nur Code.

---

## Schritt 4 · Diktieren mit lokalem Whisper

**Ziel:** Sprache rein, Text raus, ohne dass Audio den Rechner verlässt.

**whisper.cpp installieren:**
- macOS: `brew install whisper-cpp` (bringt `whisper-server` mit), dazu `brew install ffmpeg`.
- Linux/Windows: nach https://github.com/ggml-org/whisper.cpp bauen; `whisper-server` liegt danach in `build/bin/`.
  ffmpeg installieren (für `--convert`).

**Modell laden** (~570 MB):
```bash
mkdir -p ~/whisper-modelle
```
```bash
curl -L -o ~/whisper-modelle/ggml-large-v3-turbo-q5_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
```

**Server starten** (eigenes Terminal; OpenAI-kompatibler Pfad, Deutsch):
```bash
whisper-server -m ~/whisper-modelle/ggml-large-v3-turbo-q5_0.bin --host 127.0.0.1 --port 2022 -l de --convert --inference-path /v1/audio/transcriptions
```

**LibreChat anbinden:** LibreChat stoppen (Ctrl+C), dann die yaml-Fassung für Schritt 4 kopieren (ersetzt die von Schritt 2):
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-4.yaml > ~/Projects/librechat/librechat.yaml
```

> **Was in der Datei dazukommt (Schritt 4):** alles aus Schritt 2, plus der Block `speech:`:
>
> | Zeile | Bedeutung |
> |---|---|
> | `stt:` | „speech to text" — Sprache zu Text |
> | `allowedAddresses: ['127.0.0.1:2022']` | erlaubt LibreChat ausnahmsweise, den Whisper-Server auf diesem Rechner anzusprechen (ab Werk gesperrt) |
> | `openai:` → `url: 'http://127.0.0.1:2022/v1/audio/transcriptions'` | Adresse des Whisper-Servers. „openai" heißt hier nur, dass er dieselbe Schnittstelle spricht — nichts geht an OpenAI |
> | `model: 'whisper'`, `apiKey: 'lokal'` | Pflichtfelder, der lokale Server prüft beides nicht |
> | `speechTab:` → `engineSTT: 'external'` | stellt in den Einstellungen den Server statt der Spracherkennung des Browsers ein |
LibreChat starten (`npm run backend`), im Chat auf das Mikrofon drücken, sprechen. Soll: Text erscheint im Eingabefeld.

**Wenn's hakt:** Meldung „An error occurred while processing the audio, maybe the audio was too short“ (kommt auch in
der deutschen Oberfläche auf Englisch) → die Aufnahme war nicht zu kurz, LibreChat hat den Whisper-Server gesperrt. LibreChat sperrt ab Werk Anfragen an localhost und private Adressen
(Schutz gegen SSRF); die Zeile `allowedAddresses` in der Schritt-4-Fassung hebt das nur für den Whisper-Server auf.
Prüfen: `grep allowedAddresses ~/Projects/librechat/librechat.yaml` muss eine Zeile zeigen. Kommt kein Text, das Server-Terminal ansehen
(Audioformat → `--convert` und ffmpeg). In LibreChat unter Einstellungen → Sprache → **Sprache zu Text** muss die
Engine „Extern" gewählt sein; „Browser" nutzt die Spracherkennung des Browsers (ob die online geht, hängt vom Browser ab).

---

## Schritt 5 · Das Wissen: Dokumentenassistent per MCP

**Ziel:** LibreChat fragt einen eigenen Wissensdienst und antwortet mit Fundstelle.

**Dokumentenassistent holen** (MIT, https://github.com/Lausbub198/dokumentenassistent; braucht Python 3.13 und `uv`,
https://docs.astral.sh/uv/; entwickelt auf macOS, Linux/Windows laut README ungetestet):
```bash
git clone https://github.com/Lausbub198/dokumentenassistent.git ~/Projects/dokumentenassistent
```
```bash
cd ~/Projects/dokumentenassistent
```
```bash
ollama pull qwen3-embedding:4b
```
```bash
uv sync --extra reranker --extra ocr-paddle
```

**Demo-Bestand einordnen und freigeben** (nur Freigegebenes ist später sichtbar):
```bash
uv run dokumentenassistent --quelle ~/Projects/dokumentenassistent/beispiele/malerbetrieb-demo/Quelle --ziel ~/dokass-demo-ziel
```
Browser http://127.0.0.1:8765 → **Quelle einlesen** → Zweck eintragen, z. B. „Alle Unterlagen der Malerbetrieb Hoffmann
GmbH aus dem Geschäftsjahr 2025 für Buchhaltung und Steuerberater ordnen" → **Profil vorschlagen** → Kategorien prüfen
(„Ausgangsrechnungen" ergänzen, falls sie fehlt) → **Profil bestätigen** → Eingang → **Stapel einordnen** (auf einem
24-GB-Mac rund 9 Minuten) → beide Konflikte entscheiden (die Korrekturrechnung **ersetzt** die alte) → **Alle sicheren
Zeilen anhaken** → **Bestätigte Kopien erzeugen**. Soll: rund 20 sortierte Kopien in `~/dokass-demo-ziel`. Beim ersten
Start lädt der Dokumentenassistent Reranker und OCR-Modelle einmalig nach.
**Dieses Terminal offen lassen:** Die Oberfläche auf Port 8765 liefert später die Dokumente hinter den Links im Chat.
Die Suche selbst startet LibreChat getrennt davon.

**In LibreChat eintragen:** LibreChat stoppen (Ctrl+C), dann die yaml-Fassung für Schritt 5 kopieren (ersetzt die von
Schritt 4):
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-5.yaml > ~/Projects/librechat/librechat.yaml
```

> **Was in der Datei dazukommt (Schritt 5):** alles aus Schritt 4, plus der Block `mcpServers:`:
>
> | Zeile | Bedeutung |
> |---|---|
> | `dokumentenassistent:` → `type: stdio` | LibreChat startet den Dokumentenassistenten selbst als Hintergrundprogramm und spricht direkt mit ihm |
> | `command: "uv"` | das Programm `uv`; LibreChat findet es über den Suchpfad des Terminals, aus dem du `npm run backend` startest |
> | `${HOME}/…` in den Pfaden | LibreChat setzt deinen Benutzerordner selbst ein — so steht kein Benutzername in der Datei |
> | `args: run --project ~/Projects/dokumentenassistent dokumentenassistent-mcp` | startet den Werkzeug-Teil (MCP) des Dokumentenassistenten, der nur lesen kann |
> | `--quelle …/malerbetrieb-demo/Quelle`, `--ziel ~/dokass-demo-ziel` | derselbe Demo-Bestand wie beim Einordnen oben — nur freigegebene Dokumente sind sichtbar |
> | `--modelle …/modelle.yaml` | welche lokalen Modelle der Dokumentenassistent zum Suchen nutzt |
> | `--nur-belege`, `"5"` | `suchen` liefert nur die fünf besten Absätze mit Link; LibreChats Modell formuliert die Antwort einmal statt zweimal. Gemessen mit Kontext 16384 und Netzteil: 26–31 s je Frage, also knapp 30 Sekunden, alle Prüffragen richtig (das README des Dokumentenassistenten nennt 16–22 s aus einer früheren Messung am 26.10.2026; maßgeblich für dieses HowTo ist die Messung aus dem Video). Dafür entfällt die Zitatprüfung des Dokumentenassistenten — der Link zur Fundstelle bleibt. Braucht den Dokumentenassistenten ab dem Stand vom 26.10.2026 (`git pull`) |
> | `env: HF_HUB_OFFLINE: "1"`, `TRANSFORMERS_OFFLINE: "1"` | der Reranker fragt beim Start sonst bei Hugging Face nach neuen Modellversionen; so bleibt er offline und nimmt die schon geladene Fassung |
> | `initTimeout: 120000` | LibreChat wartet beim Start bis zu 2 Minuten auf den Dokumentenassistenten (ab Werk 30 s); der lädt dabei seinen Reranker |
> | `timeout: 120000` | LibreChat wartet bis zu 2 Minuten auf eine Antwort (der erste Aufruf lädt Modelle) |


Soll: `command -v uv` zeigt einen Pfad — sonst fehlt `uv` im Terminal (siehe oben). LibreChat aus **diesem** Terminal starten.
Soll: Im Agenten-Editor unter **Tools → Hinzufügen** steht der MCP-Server „dokumentenassistent" (nächster Absatz).

**Dem Abgleicher sein Wissen geben:** Agent aus Schritt 3 öffnen → **Tools** → **Hinzufügen** → **dokumentenassistent**.
Soll: Unter Tools steht `dokumentenassistent · 3` (`suchen`, `fundstelle_lesen`, `datei_oeffnen`) → **Speichern**.

**Fragen — jede in einem neuen Chat mit dem Abgleicher** (im alten Verlauf antwortet das Modell sonst aus dem Gedächtnis):
Frage eintippen (Kopiervorlage unten). Soll: über der Antwort die Zeile **dokumentenassistent** (das Werkzeug wurde aufgerufen),
darunter `Quelle: Rechnung (6).pdf, Seite 1` als Link; ein Klick öffnet das PDF im Browser. Gemessen mit Gemma 12B:
3 von 3 Läufen mit Werkzeugaufruf und Link.

**Prüffragen** (Sollwerte aus dem README des Demo-Bestands):

| Frage | Soll |
|---|---|
| Welcher Betrag gilt für das Gerüst Ringstraße 8 nach der Korrekturrechnung von Vogel? | 3.998,40 EUR, Rechnung (6).pdf |
| Welcher Rechnungsbetrag gilt laut Korrekturrechnung von Farben Meister für die Ringstraße 8? | 1.170,25 EUR, Rechnung (9).pdf (Hinweis: „Was kostet die Fassadenfarbe …“ ist mehrdeutig — das Modell greift dann den Einzelpreis 79,00 EUR je 15-l-Gebinde und macht „pro Liter“ daraus; der Link zeigt den Beleg) |
| Wann ist der Betriebsurlaub 2025? | 28.07. bis 08.08.2025, Besprechung_Maerz.txt |
| Was steht im Kaufvertrag für den Bagger? | nicht gefunden |

**Wenn's hakt:**
- MCP-Server fehlt im Log → `command -v uv` im Terminal prüfen, aus dem LibreChat startet; LibreChat erbt dessen Suchpfad.
- Im Log „Server initialization timed out" bzw. im Chat „The agent is configured to use MCP tools, but none are available" →
  der Dokumentenassistent startet zu langsam (Reranker wird von einer langsamen Platte gelesen). `initTimeout` prüfen,
  den Hugging-Face-Cache (`~/.cache/huggingface`) auf eine schnelle interne Platte legen, LibreChat neu starten.
- Keine Zeile „dokumentenassistent" über der Antwort → das Modell hat nicht gesucht: neuen Chat öffnen; `ollama ps`
  muss bei `CONTEXT` 16384 oder 32768 zeigen (Schritt 0), sonst schneidet Ollama Anweisung und Werkzeugbeschreibung ab.
- Antwort ohne Link → Anweisung des Agenten prüfen (Satz mit „Quelle: [Dateiname, Seite N](link)").
- Link öffnet nichts → die Oberfläche des Dokumentenassistenten (Port 8765) läuft nicht.
- Ollama muss laufen (`suchen` rechnet die Frage lokal um).
- Leere Treffer → die Ordner müssen dieselben sein wie beim Einordnen.

`stdio` heißt: LibreChat startet den Dokumentenassistenten selbst, auf demselben Rechner. Solche Server lassen sich nur in
der `librechat.yaml` eintragen, nicht in der Oberfläche. Für viele Nutzer und einen eigenen Server sieht die
LibreChat-Doku `streamable-http` vor; das kann der Dokumentenassistent derzeit nicht.

**Warum nicht das eingebaute RAG von LibreChat?** Laut Doku arbeitet es nur mit hochgeladenen Dateien, nutzt ab Werk
OpenAI für die Embeddings (lokal nur nach Umstellung) und hat keine lokale Texterkennung für Scans. Der Dokumentenassistent
kennt den ganzen freigegebenen Bestand, liest Scans lokal und zeigt zu jeder Antwort die Fundstelle.

---

## Schritt 6 · Ehrliche Grenzen

- **Scans und Bilder:** LibreChat hat keine lokale Texterkennung (OCR nur über Mistral, Azure oder Vertex) → über den Dokumentenassistenten.
- **Websuche** braucht einen fremden Suchdienst.
- **HTML-/React-Artefakte** laden einen Baustein aus dem Netz.
- **Code ausführen** braucht einen eigenen Dienst: die Code-Interpreter-API von LibreChat (`LIBRECHAT_CODE_API_KEY`, `LIBRECHAT_CODE_BASEURL` in `.env`).
- **Kleine Modelle** halten Formatvorgaben (Artefakt-Rahmen, Werkzeugaufrufe) nicht immer ein.
- **Tempo:** Eine Antwort mit Fundstelle dauert mit Gemma 12B auf einem 24-GB-Mac knapp 30 Sekunden.

---

## Schritt 7 · Im Alltag bedienen

**Ziel:** Nach einem Neustart läuft alles wieder, und neue Kollegen kommen dazu.

**Starten nach einem Neustart** — in dieser Reihenfolge, jeder Dienst mit langer Laufzeit in einem eigenen Terminal:

| # | Was | Befehl | Soll |
|---|---|---|---|
| 1 | Ollama mit 16384 Kontext (macOS) | `launchctl setenv OLLAMA_CONTEXT_LENGTH 16384`, dann die Ollama-App öffnen | nach der ersten Frage zeigt `ollama ps` bei `CONTEXT` 16384 (oder 32768) |
| 2 | MongoDB | Docker: `docker start librechat-mongo` · Homebrew: läuft per `brew services` von selbst | `nc -z 127.0.0.1 27017` meldet Erfolg |
| 3 | Whisper (Terminal A) | der `whisper-server`-Befehl aus Schritt 4 | Terminal zeigt den Server auf Port 2022 |
| 4 | Dokumentenassistent-Oberfläche (Terminal B) | `cd ~/Projects/dokumentenassistent`, dann `uv run dokumentenassistent --quelle ~/Projects/dokumentenassistent/beispiele/malerbetrieb-demo/Quelle --ziel ~/dokass-demo-ziel` | http://127.0.0.1:8765 öffnet sich; liefert die Dokumente hinter den Links |
| 5 | LibreChat (Terminal C) | `cd ~/Projects/librechat`, `nvm use 24` (Homebrew-Node: die `export PATH=…`-Zeile aus Schritt 0), `npm run backend` | „Server listening at http://localhost:3080" |

Linux: Ollama läuft als Dienst mit der Einstellung aus Schritt 0, Punkt 1 entfällt. Neu bauen (`npm run reinstall`) ist
nur nach einem LibreChat-Update nötig, danach den Skin erneut setzen (Schritt 2).

**Stoppen:** In den Terminals A–C Ctrl+C. MongoDB und Ollama dürfen weiterlaufen.

**Arbeiten im Chat:**

| Ich will … | So geht's |
|---|---|
| eine allgemeine Frage stellen | Neuer Chat, oben ist die Karte „Firmengehirn" schon gewählt, Frage tippen |
| etwas aus den Unterlagen wissen | Neuer Chat, im Modellmenü unter **My Agents** den „Abgleicher" wählen, Frage tippen; jede Unterlagen-Frage in einem neuen Chat |
| ein Diagramm oder kleines Werkzeug | im Werkzeug-Menü **Artefakte** an, Kopiervorlagen aus Schritt 3 anpassen |
| diktieren | Mikrofon neben dem Eingabefeld, sprechen, noch einmal klicken; Text prüfen, dann senden |
| einen Agenten weitergeben | als Admin: Agent öffnen → **Teilen** → Person → Rolle **Betrachter** (nutzen) oder **Bearbeiter** (ändern). Normale Konten dürfen ab Werk nicht teilen |

**Neue Kollegen:** Jede Person registriert sich unter http://localhost:3080 mit eigenem Konto. Sind alle angelegt, die
Registrierung schließen: in `~/Projects/librechat/.env` die Zeile `ALLOW_REGISTRATION=true` auf `false` setzen und
LibreChat neu starten. Soll: Die Anmeldeseite zeigt keinen Link **Registrieren** mehr.

**Für das ganze Team im Netz:** Ab Werk hört LibreChat nur auf diesem Rechner (`HOST=localhost`). Für Zugriff von anderen
Rechnern gehört es auf einen Server mit fester Adresse und HTTPS; dafür die LibreChat-Doku zum Betrieb
(https://www.librechat.ai/docs) nehmen. **[ungetestet]** — dieses HowTo deckt den Einzelplatz ab.

**Aktualisieren:** Dokumentenassistent mit `git -C ~/Projects/dokumentenassistent pull` und `uv sync --extra reranker --extra ocr-paddle`.
LibreChat erst wechseln, wenn diese Anleitung für die neue Version aktualisiert ist — Konfiguration und Skin sind auf v0.8.8 geprüft.

---

## Quellen

- LibreChat-Doku: https://www.librechat.ai/docs (npm-Installation, Ollama, Theme, MCP, Sprache, RAG, Artefakte)
- LibreChat v0.8.8: https://github.com/LibreChat-AI/LibreChat (MIT)
- Open WebUI Lizenz: https://github.com/open-webui/open-webui/blob/main/LICENSE
- whisper.cpp Server: https://github.com/ggml-org/whisper.cpp/tree/master/examples/server
- Dokumentenassistent: https://github.com/Lausbub198/dokumentenassistent (MIT)

## Dateien in diesem Paket

| Datei | Zweck |
|---|---|
| `HOWTO.md` | diese Anleitung |
| `HOWTO.en.md` | dieselbe Anleitung auf Englisch |
| `librechat-yaml/schritt-1.yaml` … `schritt-5.yaml` | fertige `librechat.yaml` je Schritt, wird per Befehl kopiert |
| `firmengehirn-skin/skin.mjs` | Skin setzen (`neon` / `standard`), plattformübergreifend |
| `firmengehirn-skin/neon/` | Name, Farben, Logo, Stylesheet, Startskript |
| `firmengehirn-skin/standard/` | zurück zum Original |
| `demo-daten/chatgpt-export-malerbetrieb-synthetisch.json` | synthetischer ChatGPT-Export zum Testen des Imports (Einstellungen → Datenschutz & Sicherheit → Importieren) |

---

## Anhang · Alles von Hand (ohne `skin.mjs` und ohne `sed`)

Für alle, die jeden Handgriff selbst machen und sehen wollen. Ergebnis wie mit den Befehlen oben.
Vorher LibreChat im Terminal stoppen (Ctrl+C). Dateien z. B. in VS Code öffnen.

### A · Skin „neon"

1. **`~/Projects/librechat/.env`**
   - `APP_TITLE=LibreChat` ändern in `APP_TITLE=Firmengehirn`.
   - `# CUSTOM_FOOTER="My custom footer"` ersetzen durch
     `CUSTOM_FOOTER="Firmengehirn · Modell läuft lokal auf diesem Rechner"` (das `#` am Anfang muss weg).
   - Alle Zeilen löschen, die mit `REACT_APP_THEME_` beginnen, und Kommentarzeilen `# ===== Firmengehirn…` /
     `# Navy n1…` von früher.
   - Den ganzen Inhalt von `~/firmengehirn-howto/firmengehirn-skin/neon/env-theme.txt` ans Ende kopieren
     (4 Kommentarzeilen, 64 Farbzeilen).
2. **Bilder und Stylesheet:** alle Dateien aus `~/firmengehirn-howto/firmengehirn-skin/neon/assets/` nach
   `~/Projects/librechat/client/public/assets/` kopieren, Vorhandenes überschreiben (`logo.svg` ersetzt dabei
   LibreChats Logo auf der Anmeldeseite).
3. **`client/index.html`** (nur beim ersten Mal): direkt vor der Zeile `</head>` einfügen:
   ```html
       <link rel="stylesheet" href="/assets/firmengehirn.css" /><!-- Firmengehirn-Skin -->
       <script src="/assets/firmengehirn.js"></script><!-- Firmengehirn-Skin: vor App-Start -->
   ```
4. **`client/src/style.css`** (nur beim ersten Mal): die Zeile
   `-webkit-box-shadow: 0 0 0 50vh #0d0d0d inset;` ersetzen durch
   `-webkit-box-shadow: 0 0 0 50vh rgb(var(--surface-primary)) inset; /* Firmengehirn */`.
   Die Zeile mit `#fff` ein paar Zeilen darüber (heller Modus) bleibt.
5. **Bauen** — die Farben aus `.env` werden nur dabei eingelesen:
   ```bash
   cd ~/Projects/librechat/client
   ```
   ```bash
   npm run build
   ```
6. **Starten** (`cd ~/Projects/librechat`, `npm run backend`) und im Browser hart neu laden (Cmd+Shift+R).

### B · Zurück zu „standard"

1. `.env`: `APP_TITLE=LibreChat`, vor `CUSTOM_FOOTER` wieder ein `#`, alle `REACT_APP_THEME_`-Zeilen und die vier
   Kommentarzeilen des Skins (beginnen mit `# =====`, `# Navy`, `# Firmengehirn-Skin, Teil 2`, `# Zusätzlich`) löschen.
2. In `client/public/assets/` alle Dateien löschen, die mit `firmengehirn` beginnen; die zwei neutralen Dateien aus
   `~/firmengehirn-howto/firmengehirn-skin/standard/assets/` hineinkopieren. Die neutrale `firmengehirn.js` ist
   nötig, weil LibreChat Farben im Browser speichert und sie sonst navy bleiben.
3. Originallogo zurückholen:
   ```bash
   git -C ~/Projects/librechat checkout -- client/public/assets/logo.svg
   ```
4. `index.html` und `style.css` können so bleiben, sie wirken mit den neutralen Dateien nicht mehr.
5. Bauen, starten, hart neu laden wie oben.

### C · `librechat.yaml`

1. Die Vorlage zum Schritt öffnen (z. B. `~/firmengehirn-howto/librechat-yaml/schritt-2.yaml`) und den ganzen Inhalt
   nach `~/Projects/librechat/librechat.yaml` kopieren (alten Inhalt ersetzen).
2. Suchen und Ersetzen (VS Code: Cmd+Option+F):
   - `__MODELL__` → `gemma4:12b-it-q4_K_M`
3. Speichern — Einrückungen sind Leerzeichen und müssen genau so bleiben. LibreChat neu starten.

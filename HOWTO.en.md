# The company brain, built yourself — your own ChatGPT with LibreChat, running locally

Companion guide to the video by **Lokale KI mit Andreas Nürenberg**. At the end, your computer runs a chat
interface like ChatGPT, with a local language model, in the look of the "Firmengehirn" (German for "company brain")
from the explainer series, with agents, diagrams, dictation and a knowledge store that answers with the source location. The RAG part (searching
the documents) is done by the Dokumentenassistent, attached via MCP.

| | |
|---|---|
| **Version** | November 2026, LibreChat **v0.8.8** · German original: `HOWTO.md` |
| **Tested** | macOS (Apple Silicon, 24 GB RAM): steps 0–5. Linux/Windows according to the official docs, marked **[untested]** |
| **Duration** | about 1–2 hours including downloads |
| **Cost** | none — the software is open source, Gemma is an open-weight model (Gemma Terms of Use) |
| **Data** | only the **synthetic** demo dataset "Malerbetrieb Hoffmann" (a fictional painting company) from the Dokumentenassistent. Please do not use real company documents for this rebuild |

Each step has a **Goal**, **commands to copy**, an **Expected** (what you must see) and **If it fails**.

> **Note on language:** The demo data, the skin texts and the comments in the yaml files are German. The setup works
> the same with an English UI: LibreChat picks the browser language; you can change it under Settings. This guide
> uses the English UI labels.

---

## For Claude Code (or another coding agent)

You can give this file to an agent, e.g. in Claude Code: *"Implement HOWTO.en.md step by step."*
These rules apply to the agent:

1. **Settle the folders first** (table "Fixed folders" below) and show them to the human for confirmation. Detect the operating system
   (`uname -s` or Windows) and use only the matching commands.
2. **Ask before every download, every installation with administrator rights and every `brew trust`.**
   Downloads: Ollama models (several GB), Whisper model (~570 MB), reranker `BAAI/bge-reranker-v2-m3` (~2 GB) and the
   Dokumentenassistent's OCR models (on first start), packages.
3. **After each step, run the check ("Expected").** If it fails: stop, work through "If it fails",
   report to the human. Do not continue with the next step.
4. **Connect only the synthetic demo dataset.** Never use folders with real documents as `--quelle`.
5. **Do not enable any third-party services** (web search, cloud OCR, cloud models, cloud embeddings).
6. Clicks in the web interface (Sign up, creating agents) are done by the human; the agent describes them.
7. Start long-running processes (LibreChat, Whisper server, Dokumentenassistent) in their own terminals, non-blocking.

### Fixed folders

All commands below use these folders. If you keep them as they are, you do not need to change anything and can copy every command
unchanged (macOS and Linux; Windows **[untested]**, there an agent is the best way to translate them).

| What | Folder |
|---|---|
| this package (HOWTO, skin, yaml files) | `~/firmengehirn-howto` |
| LibreChat | `~/Projects/librechat` |
| Dokumentenassistent | `~/Projects/dokumentenassistent` |
| target storage of the demo | `~/dokass-demo-ziel` |
| language model | `gemma4:12b-it-q4_K_M` (needs about 8 GB of free RAM) |

If you use a different model (smaller: `gemma4:e4b`), replace the model name in the commands where it appears.
`~` means "your home folder".

---

## Step 0 · Prerequisites

**Goal:** Git, Ollama with a model, Node.js 24 and MongoDB are running.

**Get this package** (needs Git, see next item):
```bash
git clone https://github.com/Lausbub198/firmengehirn-howto.git ~/firmengehirn-howto
```
Without Git: on https://github.com/Lausbub198/firmengehirn-howto click **Code → Download ZIP**, unzip, put the folder
into your home folder and rename it to `firmengehirn-howto`. Expected: `ls ~/firmengehirn-howto` shows
`HOWTO.md`, `firmengehirn-skin` and `librechat-yaml`.

**Tools to install** (only what is missing):

| Tool | for | Installation |
|---|---|---|
| Homebrew (macOS) | whisper-cpp, ffmpeg, native MongoDB | command from https://brew.sh |
| nvm | Node.js 24 next to an existing Node | command from https://github.com/nvm-sh/nvm (Windows: nvm-windows) |
| uv | Dokumentenassistent (step 5); fetches Python 3.13 by itself | `curl -LsSf https://astral.sh/uv/install.sh \| sh`, docs https://docs.astral.sh/uv/ |
| Docker Desktop (optional) | only for MongoDB variant a | https://www.docker.com/products/docker-desktop/ |

Expected: `brew --version` (macOS), `nvm --version` and `uv --version` each show a version number. Then close the
terminal once and open it again so it knows the new commands.

**Git** — check: `git --version`. If it is missing: macOS `xcode-select --install`, Linux package manager, Windows https://git-scm.com.

**Ollama** — install from https://ollama.com (macOS, Linux, Windows). Then:
```bash
ollama pull gemma4:12b-it-q4_K_M
```
Expected: `ollama list` shows the model.

**Give Ollama more context (important):** LibreChat talks to Ollama through Ollama's OpenAI interface. There,
Ollama by default works with only **4096 tokens of context** and cuts off anything longer at the front — the instructions for artifacts, the
description of the tools and the beginning of the chat then silently drop out. Therefore set it to 16384:

*macOS (Ollama app):*
```bash
launchctl setenv OLLAMA_CONTEXT_LENGTH 16384
```
Then quit Ollama (menu bar → Quit Ollama) and open it again. The setting lasts until the next restart of the
Mac; after that, repeat the command.

*Linux (systemd):* `sudo systemctl edit ollama`, there under `[Service]` add the line
`Environment="OLLAMA_CONTEXT_LENGTH=16384"`, then `sudo systemctl restart ollama`.

*Windows:* Create the user environment variable `OLLAMA_CONTEXT_LENGTH` with the value `16384`, restart Ollama.
**[untested]**

Expected: After the first question, `ollama ps` shows the value `16384` in the `CONTEXT` column (or `32768` if the
Dokumentenassistent from step 5 classified documents last — it sets the model larger itself; both are fine). More context needs more
RAM; with `gemma4:12b-it-q4_K_M` it fits in 24 GB.

**Node.js 24** (LibreChat v0.8.8 requires Node 24, npm 11). Easiest via nvm, so that an existing Node stays in place:
```bash
nvm install 24
```
```bash
nvm use 24
```
macOS with Homebrew also works: `brew install node@24` and in the LibreChat terminal `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
Windows: nvm-windows (https://github.com/coreybutler/nvm-windows). Expected: `node -v` shows `v24.x`.

**MongoDB** — one of two variants:

*a) With Docker (all systems, easiest):*
```bash
docker run -d --name librechat-mongo -p 127.0.0.1:27017:27017 -v librechat-mongo:/data/db mongo:8.0.20
```

*b) Native:* macOS with Homebrew:
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
Linux/Windows: MongoDB Community Server according to https://www.mongodb.com/docs/manual/administration/install-community/.

Expected: connection on port 27017, e.g. `nc -z 127.0.0.1 27017` (macOS/Linux) or `Test-NetConnection 127.0.0.1 -Port 27017` (Windows PowerShell).

**If it fails:** Homebrew reports "Refusing to load formula … from untrusted tap" → `brew trust mongodb/brew` is missing.
Docker MongoDB does not start on older x86 CPUs without AVX → according to the LibreChat docs, use an older MongoDB image.

---

## Step 1 · Install LibreChat and connect the model

**Goal:** LibreChat runs without Docker and answers with the local model.

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

**Show only your own models:** This line appends `ENDPOINTS=custom,agents` to the file `.env`. With it, the
selection shows only your own models and the agents, not OpenAI, Google or Anthropic:
```bash
echo 'ENDPOINTS=custom,agents' >> ~/Projects/librechat/.env
```
Expected: `grep ^ENDPOINTS ~/Projects/librechat/.env` shows exactly one line `ENDPOINTS=custom,agents`.
(The database address `MONGO_URI` is already correct in `.env`; you do not need to do anything there.)

**Your own keys and a single process:** By default, the keys for stored credentials and logins in `.env`
are empty. LibreChat then generates its own on first start, stores them in `.env.temp` and reports this with a
warning that contains the full path including your user name. The first command enters four random, fixed keys:
```bash
cd ~/Projects/librechat && sed -i.bak -e "s/^CREDS_KEY=.*/CREDS_KEY=$(openssl rand -hex 32)/" -e "s/^CREDS_IV=.*/CREDS_IV=$(openssl rand -hex 16)/" -e "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" -e "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$(openssl rand -hex 32)/" .env && rm .env.bak
```
The second tells LibreChat that it runs as a single process without Redis; otherwise red errors from the
scheduler for scheduled chats appear in the log at startup:
```bash
echo 'SCHEDULES_SINGLE_PROCESS=true' >> ~/Projects/librechat/.env
```
Expected: `grep -E '^(CREDS|JWT|SCHEDULES)' ~/Projects/librechat/.env` shows five lines, none of them ends with `=`.

> **What this changes:** `CREDS_KEY`/`CREDS_IV` encrypt stored credentials (e.g. API keys that
> users enter), `JWT_SECRET`/`JWT_REFRESH_SECRET` sign the logins. Fixed values mean: logins and
> stored keys survive a restart. Like passwords, these values do not belong in Git or in screenshots.
> Changing them later logs everyone out.

> **What this changes:** At the very bottom of `~/Projects/librechat/.env` there is a new line
> `ENDPOINTS=custom,agents`. `custom` are the models you enter yourself in `librechat.yaml` (here Ollama),
> `agents` are the agents from step 3. LibreChat hides all other providers (OpenAI, Google, Anthropic …).
> To undo: delete the line in `.env`.

**Configuration `librechat.yaml`:** You do not write this file yourself. For each step there is a ready-made, complete version in
`~/firmengehirn-howto/librechat-yaml/`. The following command copies the version for
step 1 to LibreChat and fills in the model name and paths. An existing `librechat.yaml` is replaced:
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-1.yaml > ~/Projects/librechat/librechat.yaml
```
Expected: `grep gemma4 ~/Projects/librechat/librechat.yaml` shows the model name, and `grep __ ~/Projects/librechat/librechat.yaml`
shows **nothing**. In steps 2, 4 and 5 the same command comes again, only with a different step number.

> **What the command does:** `sed` reads the template `schritt-1.yaml` ("schritt" = step), replaces the placeholder `__MODELL__` in it with
> `gemma4:12b-it-q4_K_M` and writes the result as `~/Projects/librechat/librechat.yaml`.
> The template itself stays unchanged. You can view the result with `cat ~/Projects/librechat/librechat.yaml`.
>
> **What is in the file (step 1):**
>
> | Line | Meaning |
> |---|---|
> | `version: 1.3.17` | format of the configuration file, matching LibreChat v0.8.8 |
> | `endpoints:` → `custom:` → `name: "Ollama"` | a custom model provider named "Ollama" |
> | `baseURL: "http://localhost:11434/v1/"` | address of Ollama on this computer — the questions go only there |
> | `apiKey: "ollama"` | required field; Ollama does not check any key |
> | `models: default: ["gemma4:12b-it-q4_K_M"]` | this model appears in the selection |
> | `fetch: false` | only this model — with `true`, LibreChat fetches all models from Ollama, including the Dokumentenassistent's embedding model, and that one then appeared first (and therefore as the default) in the selection |
> | `titleConvo: true`, `titleModel: "current_model"` | the model gives each chat in the sidebar a title |
> | `modelDisplayLabel: "Ollama"` | name shown above the answers |

Build and start (Node 24 active):
```bash
npm run reinstall
```
```bash
npm run backend
```

Expected: in the log "Connected to MongoDB", "Custom config file loaded", "Server listening at http://localhost:3080".
In the browser http://localhost:3080 → **Sign up** (local account) → at the top select "Ollama" and the model → ask a question → an answer arrives.
The first account is automatically **admin**. Leave sign-up open for now, step 3 needs a second test account; it is
closed in step 7.

**If it fails:**
- "Could not read package.json" → `npm` in the wrong folder, first `cd ~/Projects/librechat`.
- "Custom config file loaded" is missing from the log, or there is a configuration error → copy the yaml command above
  again, do not change anything in the file by hand (indentation with spaces matters there).
- Build aborts → check `node -v`, Node 24 must be active in this terminal.
- Model missing from the selection → is Ollama running? `curl -s http://localhost:11434/api/tags`.
- Artifacts only come as code, tools are not called, the model "forgets" instructions → check the context:
  `ollama ps` must show 16384 (or 32768) under `CONTEXT`, otherwise repeat "Give Ollama more context" in step 0.
- Harmless in the log: "scheduler NOT started" (only affects scheduled chats), "RAG API … not reachable" (we do not use LibreChat's built-in RAG API, the Dokumentenassistent searches the
  documents in step 5),
  "METRICS_SECRET is not set".

**Alternative with Docker:** LibreChat can also be started with `docker compose up -d` (docs: https://www.librechat.ai/docs/local/docker).
Then the Ollama address is `http://host.docker.internal:11434/v1/`, and `librechat.yaml` is included via
`docker-compose.override.yml`. **The skin from step 2 does not work with that**, because the prebuilt image does not
re-read the colours.

---

## Step 2 · The face: the company-brain look

**Goal:** Name, logo, greeting, model card and colours from the series.

Stop LibreChat in the terminal (Ctrl+C). Then apply the skin (rebuilds the frontend, takes about 10 s).
The command starts with `node`, the script is called `skin.mjs`:
```bash
node ~/firmengehirn-howto/firmengehirn-skin/skin.mjs neon --lc ~/Projects/librechat
```
Expected: at the end a line with "✓".

Greeting and model card come from the yaml version for step 2 (replaces the one from step 1):
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-2.yaml > ~/Projects/librechat/librechat.yaml
```

> **What is added to the file (step 2):** everything from step 1, plus two blocks:
>
> | Line | Meaning |
> |---|---|
> | `interface:` → `customWelcome: 'Willkommen im Firmengehirn …'` | welcome text on the start page (German: "Welcome to the company brain …") |
> | `modelSpecs:` → `list:` → `label: "Firmengehirn"` | a model card "Firmengehirn"; your team sees this name instead of `gemma4:12b-it-q4_K_M` |
> | `prioritize: true`, `default: true` | the card is at the top and already selected on opening |
> | `addedEndpoints: [agents]` | without this line, the model menu shows only the cards — agents (including shared ones) could not be found there; this way they are under **My Agents** |
> | `iconURL: "/assets/firmengehirn.svg"` | the brain logo that the skin placed |
> | `preset:` → `endpoint: "Ollama"`, `model: …` | behind the card is the model from step 1 |
> | `greeting:` | sentence above the input field (German) |
> | `promptPrefix:` | fixed instruction to the model (German, concise, says openly when it does not know something) — you can enter your company name here |
Start LibreChat again (`cd ~/Projects/librechat` and `npm run backend`), **hard-reload** in the browser
(Cmd+Shift+R or Ctrl+Shift+R).

Expected: navy surfaces, brain logo, tab title "Firmengehirn", greeting "Willkommen im Firmengehirn" (Welcome to the company brain), at the top the model card
"Firmengehirn" instead of the model name.

Back to the original:
```bash
node ~/firmengehirn-howto/firmengehirn-skin/skin.mjs standard --lc ~/Projects/librechat
```

> **What the skin changes** (all in `~/Projects/librechat`):
>
> | File | Change | visible as |
> |---|---|---|
> | `.env` | `APP_TITLE=Firmengehirn` | name in the browser tab and on the login page |
> | `.env` | `CUSTOM_FOOTER="Firmengehirn · Modell läuft lokal auf diesem Rechner"` (German: "Company brain · model runs locally on this computer") | line below the input field |
> | `.env` | 64 lines `REACT_APP_THEME_…=R G B` (from `firmengehirn-skin/neon/env-theme.txt`) | surface, text and border colours |
> | `client/public/assets/` | new: `firmengehirn.svg`, `firmengehirn-zeichen.svg`; replaced: LibreChat's `logo.svg` | logo in the model card and on the login page |
> | `client/public/assets/` | `firmengehirn.css` | neon heading, icon colours, background |
> | `client/public/assets/` | `firmengehirn.js` | runs before the app starts: sets the brain logo as tab icon and turns "Display chat title in tab" off by default, so that "Firmengehirn" instead of "New Chat" appears in the tab (only if the user has not chosen anything yet); `standard` removes old colour values and this default again | tab title and tab icon |
> | `client/index.html` | two lines with the comment `Firmengehirn-Skin` (include stylesheet and start script), only the first time | — |
> | `client/src/style.css` | one line with `/* Firmengehirn */` (background colour of autofilled fields) | login fields without a black bar |
> | `client/dist/` | rebuilt (`npm run build`) | the colours from `.env` are read only during the build |
>
> `standard` resets `.env` (`APP_TITLE=LibreChat`, no footer, no colour lines), deletes the Firmengehirn logos,
> restores LibreChat's original `logo.svg` from its git and places neutral versions of `firmengehirn.css` and
> `firmengehirn.js`; the lines in `index.html` and `style.css` remain, they then have no effect. To trace it: `git -C ~/Projects/librechat status` and `git -C ~/Projects/librechat diff` show the changes to `client/`;
> back to the shipped state with `git -C ~/Projects/librechat restore client/index.html client/src/style.css client/public/assets/logo.svg`
> (`.env` is not in git, so `standard` is still needed for it),
> `grep -E "APP_TITLE|CUSTOM_FOOTER|REACT_APP_THEME" ~/Projects/librechat/.env` those in `.env`.
>
> Your own colours: change lines in `firmengehirn-skin/neon/env-theme.txt` (value "R G B", e.g. `36 37 94`) and
> run the command again.

**If it fails:**
- Tab still shows "New Chat" or the LibreChat icon → the browser keeps `firmengehirn.js` in its cache for up to 48 hours: hard-reload (Cmd+Shift+R). If someone has turned on "Display chat title in tab" themselves, it stays that way.
- Old colours despite restart → the app holds on to files in the browser: hard-reload, if necessary developer tools →
  Application → Service Workers → Unregister.
- Harmless during the build (the command still ends with "✓ Skin … gesetzt"): `<script src="/assets/firmengehirn.js"> … can't
  be bundled`, `/assets/firmengehirn.css doesn't exist at build time`, `The class ease-[…] is ambiguous`,
  `Use of direct eval`, `Some chunks are larger than 1500 kB`. The skin files are deliberately loaded only in the browser.
- "SyntaxError: Invalid or unexpected token" → a shell script (`skin.sh`) was started with `node`. With `node`,
  always call `skin.mjs` from this package.
- After a LibreChat update, run `skin.mjs` again; it re-applies the source code lines.

---

## Step 3 · The hands: tools, diagrams, agents

**Goal:** Diagrams and small programs in the chat, build an agent and share it with the team. The agent gets its knowledge
in step 5.

1. **Tool menu** in the chat (slider icon next to the paperclip): turn on **Artifacts**.
   Leave **Run Code** off — it would need a separate service.
2. **Diagram:**
   > Zeichne den Ablauf eines Angebots im Malerbetrieb als Mermaid-Diagramm: Anfrage, Besichtigung, Kalkulation, Angebot, Auftrag. Ohne eigene Farben, keine style- oder classDef-Zeilen.

   (English meaning: "Draw the flow of a quote in the painting company as a Mermaid diagram: inquiry, site visit, costing, quote, order. Without custom colours, no style or classDef lines.")

   Expected: A "Mermaid" card with the diagram (runs locally in the browser).
3. **Artifact** (separate panel on the right):
   > Erstelle ein Artefakt im Format :::artifact{identifier="farbrechner" type="text/html" title="Farbmengen-Rechner"} mit einer einzigen HTML-Datei (keine externen Skripte). Eingaben: Wandfläche in m², Anzahl Anstriche, Verbrauch Liter pro m² (0,15), Eimergröße Liter (12,5). Ausgabe: Liter und Eimer, aufgerundet.

   (English meaning: "Create an artifact in the format :::artifact{…} with a single HTML file (no external scripts). Inputs: wall area in m², number of coats, consumption litres per m² (0.15), bucket size litres (12.5). Output: litres and buckets, rounded up." "Farbmengen-Rechner" = paint quantity calculator.)

   Expected: In the answer a button "Farbmengen-Rechner" – "Click to open"; the calculator opens on the right.
4. **Create the agent "Abgleicher"** (German, roughly "the cross-checker"): right sidebar → **Agent Builder**, then:
   - **Name** `Abgleicher` · **Description** `Beantwortet Fragen zu den Unterlagen – mit Fundstelle und Link.` (German: "Answers questions about the documents – with source location and link.")
   - **Model** Ollama / `gemma4:12b-it-q4_K_M` · **Category** any (only sorting in the Agent Marketplace)
   - **Instructions** (the tool `suchen` is added only in step 5). The instruction is German because the documents are German:
     ```text
     Du beantwortest Fragen zu den Unterlagen der Malerbetrieb Hoffmann GmbH. Rufe für JEDE Frage zuerst das Werkzeug suchen auf, auch wenn die Frage schon einmal gestellt wurde; antworte nie aus dem Gedächtnis. Gib danach die Antwort in einem Satz und darunter je Beleg eine Zeile: Quelle: [Dateiname, Seite N](link) — den link übernimmst du unverändert aus dem Feld link. Findet das Werkzeug nichts, antworte: nicht gefunden.
     ```
     English version you may use instead (the answers then say "Source:" and "not found" instead of "Quelle:" and "nicht gefunden"):
     ```text
     You answer questions about the documents of Malerbetrieb Hoffmann GmbH. For EVERY question, first call the tool suchen, even if the question was asked before; never answer from memory. Then give the answer in one sentence and below it one line per piece of evidence: Source: [file name, page N](link) — copy the link unchanged from the field link. If the tool finds nothing, answer: not found.
     ```
   - **Tools** still empty (the native capabilities such as Run Code, web search, ask the user would be under
     **Tools → Add → Native**) · **Skills**: Off · **File Context** empty
   - **Create**. Expected: The agent appears under "Select Agent" and in the chat in the model menu under **My Agents**.
   - The agent editor in v0.8.8 does not offer conversation starters (starter questions as buttons) — the questions are typed.
5. **Share** (by default only the admin, i.e. the first account, may do this): register a second test account in a private browser window → in the agent **Share** → search for the person →
   role **Viewer**. Expected: The second account finds the agent in the model menu under **My Agents** and uses it; if it opens the editor,
   it shows "You don't have access to edit this agent."

**If it fails:**
- Only code instead of an artifact button → the model lacks the frame `:::artifact{…}` … `:::`. Request it again explicitly
  with this frame, or enter a short, strict rule under Artifacts → **Custom Prompt Mode**.
  Smaller models forget the frame in long answers.
- Diagram boxes hard to read → ask for "ohne eigene Farben" (without custom colours).
- According to the LibreChat docs, HTML/React artifacts load a component from the CodeSandbox network — without internet, only code.

---

## Step 4 · Dictation with local Whisper

**Goal:** Speech in, text out, without audio leaving the computer.

**Install whisper.cpp:**
- macOS: `brew install whisper-cpp` (includes `whisper-server`), plus `brew install ffmpeg`.
- Linux/Windows: build according to https://github.com/ggml-org/whisper.cpp; `whisper-server` is then in `build/bin/`.
  Install ffmpeg (for `--convert`).

**Download the model** (~570 MB):
```bash
mkdir -p ~/whisper-modelle
```
```bash
curl -L -o ~/whisper-modelle/ggml-large-v3-turbo-q5_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
```

**Start the server** (separate terminal; OpenAI-compatible path, German):
```bash
whisper-server -m ~/whisper-modelle/ggml-large-v3-turbo-q5_0.bin --host 127.0.0.1 --port 2022 -l de --convert --inference-path /v1/audio/transcriptions
```

**Connect LibreChat:** Stop LibreChat (Ctrl+C), then copy the yaml version for step 4 (replaces the one from step 2):
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-4.yaml > ~/Projects/librechat/librechat.yaml
```

> **What is added to the file (step 4):** everything from step 2, plus the block `speech:`:
>
> | Line | Meaning |
> |---|---|
> | `stt:` | "speech to text" |
> | `allowedAddresses: ['127.0.0.1:2022']` | allows LibreChat, as an exception, to contact the Whisper server on this computer (blocked by default) |
> | `openai:` → `url: 'http://127.0.0.1:2022/v1/audio/transcriptions'` | address of the Whisper server. "openai" here only means it speaks the same interface — nothing goes to OpenAI |
> | `model: 'whisper'`, `apiKey: 'lokal'` | required fields, the local server checks neither |
> | `speechTab:` → `engineSTT: 'external'` | sets the server instead of the browser's speech recognition in the settings |
Start LibreChat (`npm run backend`), press the microphone in the chat, speak. Expected: text appears in the input field.

**If it fails:** Message "An error occurred while processing the audio, maybe the audio was too short"
→ the recording was not too short, LibreChat blocked the Whisper server. By default, LibreChat blocks requests to localhost and private addresses
(protection against SSRF); the line `allowedAddresses` in the step 4 version lifts this only for the Whisper server.
Check: `grep allowedAddresses ~/Projects/librechat/librechat.yaml` must show a line. If no text arrives, look at the server terminal
(audio format → `--convert` and ffmpeg). In LibreChat under Settings → Speech → **Speech to Text** the
engine "External" must be selected; "Browser" uses the browser's speech recognition (whether that goes online depends on the browser).

---

## Step 5 · The knowledge: Dokumentenassistent via MCP

**Goal:** LibreChat queries its own knowledge service and answers with the source location.

**Get the Dokumentenassistent** (MIT, https://github.com/Lausbub198/dokumentenassistent; needs Python 3.13 and `uv`,
https://docs.astral.sh/uv/; developed on macOS, Linux/Windows untested according to the README):
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

**Classify and release the demo dataset** (only released documents are visible later):
```bash
uv run dokumentenassistent --quelle ~/Projects/dokumentenassistent/beispiele/malerbetrieb-demo/Quelle --ziel ~/dokass-demo-ziel
```
The Dokumentenassistent UI is German. Browser http://127.0.0.1:8765 → **Quelle einlesen** (read source) → enter a purpose, e.g.
„Alle Unterlagen der Malerbetrieb Hoffmann GmbH aus dem Geschäftsjahr 2025 für Buchhaltung und Steuerberater ordnen"
(English meaning: "Sort all documents of Malerbetrieb Hoffmann GmbH from fiscal year 2025 for bookkeeping and the tax advisor")
→ **Profil vorschlagen** (suggest profile) → check the categories
(add „Ausgangsrechnungen" (outgoing invoices) if it is missing) → **Profil bestätigen** (confirm profile) → Eingang (inbox) → **Stapel einordnen** (classify batch; about
9 minutes on a 24 GB Mac) → decide both conflicts (the corrective invoice **ersetzt**, i.e. replaces, the old one) → **Alle sicheren
Zeilen anhaken** (tick all safe rows) → **Bestätigte Kopien erzeugen** (create confirmed copies). Expected: about 20 sorted copies in `~/dokass-demo-ziel`. On first
start, the Dokumentenassistent downloads the reranker and OCR models once.
**Keep this terminal open:** The interface on port 8765 later serves the documents behind the links in the chat.
LibreChat starts the search itself separately.

**Register it in LibreChat:** Stop LibreChat (Ctrl+C), then copy the yaml version for step 5 (replaces the one from
step 4):
```bash
sed -e "s#__MODELL__#gemma4:12b-it-q4_K_M#g" ~/firmengehirn-howto/librechat-yaml/schritt-5.yaml > ~/Projects/librechat/librechat.yaml
```

> **What is added to the file (step 5):** everything from step 4, plus the block `mcpServers:`:
>
> | Line | Meaning |
> |---|---|
> | `dokumentenassistent:` → `type: stdio` | LibreChat starts the Dokumentenassistent itself as a background program and talks to it directly |
> | `command: "uv"` | the program `uv`; LibreChat finds it via the search path of the terminal from which you start `npm run backend` |
> | `${HOME}/…` in the paths | LibreChat fills in your home folder itself — so no user name appears in the file |
> | `args: run --project ~/Projects/dokumentenassistent dokumentenassistent-mcp` | starts the tool part (MCP) of the Dokumentenassistent, which can only read |
> | `--quelle …/malerbetrieb-demo/Quelle`, `--ziel ~/dokass-demo-ziel` | the same demo dataset as in the classification above — only released documents are visible |
> | `--modelle …/modelle.yaml` | which local models the Dokumentenassistent uses for searching |
> | `--nur-belege`, `"5"` | `suchen` returns only the five best paragraphs with link; LibreChat's model writes the answer once instead of twice. Measured with context 16384 and on mains power: 26–31 s per question, so just under 30 seconds, all test questions correct (the Dokumentenassistent README states 16–22 s from an earlier measurement on 26 October 2026; this guide uses the measurement from the video). In exchange, the Dokumentenassistent's citation check is dropped — the link to the source location remains. Needs the Dokumentenassistent as of 26 October 2026 or later (`git pull`) |
> | `env: HF_HUB_OFFLINE: "1"`, `TRANSFORMERS_OFFLINE: "1"` | otherwise the reranker asks Hugging Face for new model versions at startup; this way it stays offline and uses the version already downloaded |
> | `initTimeout: 120000` | LibreChat waits up to 2 minutes at startup for the Dokumentenassistent (default 30 s); it loads its reranker during that time |
> | `timeout: 120000` | LibreChat waits up to 2 minutes for an answer (the first call loads models) |


Expected: `command -v uv` shows a path — otherwise `uv` is missing in the terminal (see above). Start LibreChat from **this** terminal.
Expected: In the Agent Builder under **Tools → Add**, the MCP server "dokumentenassistent" is listed (next paragraph).

**Give the Abgleicher its knowledge:** Open the agent from step 3 → **Tools** → **Add** → **dokumentenassistent**.
Expected: Under Tools it shows `dokumentenassistent · 3` (`suchen`, `fundstelle_lesen`, `datei_oeffnen`) → **Save**.

**Questions — each in a new chat with the Abgleicher** (in the old history, the model otherwise answers from memory):
Type the question (copy template below). Expected: above the answer the line **dokumentenassistent** (the tool was called),
below it `Quelle: Rechnung (6).pdf, Seite 1` (Source: …, page 1) as a link; a click opens the PDF in the browser. Measured with Gemma 12B:
3 of 3 runs with tool call and link.

**Test questions** (expected values from the README of the demo dataset). The questions are German because the documents are German:

| Question | Expected |
|---|---|
| Welcher Betrag gilt für das Gerüst Ringstraße 8 nach der Korrekturrechnung von Vogel?<br>(Which amount applies to the scaffolding at Ringstraße 8 after Vogel's corrective invoice?) | 3,998.40 EUR (in the German answer: „3.998,40 EUR"), Rechnung (6).pdf |
| Welcher Rechnungsbetrag gilt laut Korrekturrechnung von Farben Meister für die Ringstraße 8?<br>(Which invoice amount applies to Ringstraße 8 according to Farben Meister's corrective invoice?) | 1,170.25 EUR (in the German answer: „1.170,25 EUR"), Rechnung (9).pdf (Note: „Was kostet die Fassadenfarbe …" (What does the facade paint cost …) is ambiguous — the model then picks the unit price of 79.00 EUR per 15-litre container and turns it into "per litre"; the link shows the evidence) |
| Wann ist der Betriebsurlaub 2025?<br>(When is the company holiday 2025?) | 28 July to 8 August 2025 (in the German answer: „28.07. bis 08.08.2025"), Besprechung_Maerz.txt |
| Was steht im Kaufvertrag für den Bagger?<br>(What does the purchase contract for the excavator say?) | nicht gefunden (not found) |

**If it fails:**
- MCP server missing from the log → check `command -v uv` in the terminal from which LibreChat starts; LibreChat inherits its search path.
- In the log "Server initialization timed out" or in the chat "The agent is configured to use MCP tools, but none are available" →
  the Dokumentenassistent starts too slowly (reranker is read from a slow disk). Check `initTimeout`,
  move the Hugging Face cache (`~/.cache/huggingface`) to a fast internal disk, restart LibreChat.
- No line "dokumentenassistent" above the answer → the model did not search: open a new chat; `ollama ps`
  must show 16384 or 32768 under `CONTEXT` (step 0), otherwise Ollama cuts off the instruction and the tool description.
- Answer without link → check the agent's instructions (sentence with "Quelle: [Dateiname, Seite N](link)", or "Source: [file name, page N](link)" in the English version).
- Link opens nothing → the Dokumentenassistent's interface (port 8765) is not running.
- Ollama must be running (`suchen` converts the question locally).
- Empty results → the folders must be the same as during classification.

`stdio` means: LibreChat starts the Dokumentenassistent itself, on the same computer. Such servers can only be entered in
`librechat.yaml`, not in the interface. For many users and a separate server, the
LibreChat docs provide `streamable-http`; the Dokumentenassistent cannot do that at the moment.

**Why not LibreChat's built-in RAG?** According to the docs, it works only with uploaded files, uses
OpenAI for the embeddings by default (local only after reconfiguration) and has no local text recognition for scans. The Dokumentenassistent
knows the whole released dataset, reads scans locally and shows the source location for every answer.

---

## Step 6 · Honest limits

- **Scans and images:** LibreChat has no local text recognition (OCR only via Mistral, Azure or Vertex) → via the Dokumentenassistent.
- **Web search** needs a third-party search service.
- **HTML/React artifacts** load a component from the network.
- **Run Code** needs a separate service: LibreChat's Code Interpreter API (`LIBRECHAT_CODE_API_KEY`, `LIBRECHAT_CODE_BASEURL` in `.env`).
- **Small models** do not always follow format requirements (artifact frame, tool calls).
- **Speed:** An answer with source location takes just under 30 seconds with Gemma 12B on a 24 GB Mac.

---

## Step 7 · Day-to-day operation

**Goal:** After a restart everything runs again, and new colleagues can join.

**Starting after a restart** — in this order, each long-running service in its own terminal:

| # | What | Command | Expected |
|---|---|---|---|
| 1 | Ollama with 16384 context (macOS) | `launchctl setenv OLLAMA_CONTEXT_LENGTH 16384`, then open the Ollama app | after the first question, `ollama ps` shows 16384 (or 32768) under `CONTEXT` |
| 2 | MongoDB | Docker: `docker start librechat-mongo` · Homebrew: runs by itself via `brew services` | `nc -z 127.0.0.1 27017` reports success |
| 3 | Whisper (terminal A) | the `whisper-server` command from step 4 | terminal shows the server on port 2022 |
| 4 | Dokumentenassistent interface (terminal B) | `cd ~/Projects/dokumentenassistent`, then `uv run dokumentenassistent --quelle ~/Projects/dokumentenassistent/beispiele/malerbetrieb-demo/Quelle --ziel ~/dokass-demo-ziel` | http://127.0.0.1:8765 opens; serves the documents behind the links |
| 5 | LibreChat (terminal C) | `cd ~/Projects/librechat`, `nvm use 24` (Homebrew Node: the `export PATH=…` line from step 0), `npm run backend` | "Server listening at http://localhost:3080" |

Linux: Ollama runs as a service with the setting from step 0, item 1 is not needed. Rebuilding (`npm run reinstall`) is
only necessary after a LibreChat update; after that, apply the skin again (step 2).

**Stopping:** Ctrl+C in terminals A–C. MongoDB and Ollama may keep running.

**Working in the chat:**

| I want to … | How |
|---|---|
| ask a general question | New chat, the card "Firmengehirn" is already selected at the top, type the question |
| find out something from the documents | New chat, in the model menu under **My Agents** select the "Abgleicher", type the question; each documents question in a new chat |
| a diagram or small tool | in the tool menu turn **Artifacts** on, adapt the copy templates from step 3 |
| dictate | microphone next to the input field, speak, click again; check the text, then send |
| pass on an agent | as admin: open the agent → **Share** → person → role **Viewer** (use) or **Editor** (change). Regular accounts may not share by default |

**New colleagues:** Each person signs up at http://localhost:3080 with their own account. Once everyone is set up,
close registration: in `~/Projects/librechat/.env` set the line `ALLOW_REGISTRATION=true` to `false` and
restart LibreChat. Expected: The login page no longer shows a **Sign up** link.

**For the whole team on the network:** By default, LibreChat listens only on this computer (`HOST=localhost`). For access from other
computers, it belongs on a server with a fixed address and HTTPS; for that, use the LibreChat docs on operation
(https://www.librechat.ai/docs). **[untested]** — this HowTo covers a single workstation.

**Updating:** Dokumentenassistent with `git -C ~/Projects/dokumentenassistent pull` and `uv sync --extra reranker --extra ocr-paddle`.
Only switch LibreChat once this guide has been updated for the new version — configuration and skin are tested on v0.8.8.

---

## Sources

- LibreChat docs: https://www.librechat.ai/docs (npm installation, Ollama, theme, MCP, speech, RAG, artifacts)
- LibreChat v0.8.8: https://github.com/LibreChat-AI/LibreChat (MIT)
- Open WebUI license: https://github.com/open-webui/open-webui/blob/main/LICENSE
- whisper.cpp server: https://github.com/ggml-org/whisper.cpp/tree/master/examples/server
- Dokumentenassistent: https://github.com/Lausbub198/dokumentenassistent (MIT)

## Files in this package

| File | Purpose |
|---|---|
| `HOWTO.md` | the German original of this guide |
| `HOWTO.en.md` | this guide in English |
| `librechat-yaml/schritt-1.yaml` … `schritt-5.yaml` | ready-made `librechat.yaml` per step, copied by command |
| `firmengehirn-skin/skin.mjs` | apply the skin (`neon` / `standard`), cross-platform |
| `firmengehirn-skin/neon/` | name, colours, logo, stylesheet, start script |
| `firmengehirn-skin/standard/` | back to the original |
| `demo-daten/chatgpt-export-malerbetrieb-synthetisch.json` | synthetic ChatGPT export for testing the import (Settings → Data & Privacy → Import) |

---

## Appendix · Everything by hand (without `skin.mjs` and without `sed`)

For everyone who wants to do and see every step themselves. Result as with the commands above.
First stop LibreChat in the terminal (Ctrl+C). Open the files e.g. in VS Code.

### A · Skin "neon"

1. **`~/Projects/librechat/.env`**
   - Change `APP_TITLE=LibreChat` to `APP_TITLE=Firmengehirn`.
   - Replace `# CUSTOM_FOOTER="My custom footer"` with
     `CUSTOM_FOOTER="Firmengehirn · Modell läuft lokal auf diesem Rechner"` (the `#` at the beginning must go).
   - Delete all lines starting with `REACT_APP_THEME_`, and comment lines `# ===== Firmengehirn…` /
     `# Navy n1…` from earlier.
   - Copy the entire content of `~/firmengehirn-howto/firmengehirn-skin/neon/env-theme.txt` to the end
     (4 comment lines, 64 colour lines).
2. **Images and stylesheet:** copy all files from `~/firmengehirn-howto/firmengehirn-skin/neon/assets/` to
   `~/Projects/librechat/client/public/assets/`, overwriting existing ones (`logo.svg` replaces
   LibreChat's logo on the login page).
3. **`client/index.html`** (only the first time): insert directly before the line `</head>`:
   ```html
       <link rel="stylesheet" href="/assets/firmengehirn.css" /><!-- Firmengehirn-Skin -->
       <script src="/assets/firmengehirn.js"></script><!-- Firmengehirn-Skin: vor App-Start -->
   ```
4. **`client/src/style.css`** (only the first time): replace the line
   `-webkit-box-shadow: 0 0 0 50vh #0d0d0d inset;` with
   `-webkit-box-shadow: 0 0 0 50vh rgb(var(--surface-primary)) inset; /* Firmengehirn */`.
   The line with `#fff` a few lines above (light mode) stays.
5. **Build** — the colours from `.env` are read only during this:
   ```bash
   cd ~/Projects/librechat/client
   ```
   ```bash
   npm run build
   ```
6. **Start** (`cd ~/Projects/librechat`, `npm run backend`) and hard-reload in the browser (Cmd+Shift+R).

### B · Back to "standard"

1. `.env`: `APP_TITLE=LibreChat`, put a `#` before `CUSTOM_FOOTER` again, delete all `REACT_APP_THEME_` lines and the four
   comment lines of the skin (starting with `# =====`, `# Navy`, `# Firmengehirn-Skin, Teil 2`, `# Zusätzlich`).
2. In `client/public/assets/` delete all files starting with `firmengehirn`; copy the two neutral files from
   `~/firmengehirn-howto/firmengehirn-skin/standard/assets/` into it. The neutral `firmengehirn.js` is
   necessary because LibreChat stores colours in the browser and they would otherwise stay navy.
3. Restore the original logo:
   ```bash
   git -C ~/Projects/librechat checkout -- client/public/assets/logo.svg
   ```
4. `index.html` and `style.css` can stay as they are; with the neutral files they no longer have any effect.
5. Build, start, hard-reload as above.

### C · `librechat.yaml`

1. Open the template for the step (e.g. `~/firmengehirn-howto/librechat-yaml/schritt-2.yaml`) and copy the entire content
   to `~/Projects/librechat/librechat.yaml` (replace the old content).
2. Search and replace (VS Code: Cmd+Option+F):
   - `__MODELL__` → `gemma4:12b-it-q4_K_M`
3. Save — indentation is spaces and must stay exactly as it is. Restart LibreChat.

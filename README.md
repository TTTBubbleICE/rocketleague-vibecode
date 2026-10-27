# PUCK ROCKET — Mini Arena 3D

Minispiel aus **Puck** + **Rocket League**: Rocket-Powered-Autos jagen einen Puck
über eine **echte 3D-Arena** — mit Höhe, Sprung, Flip und Aerials. 1 gegen 1:
du (BLAU) gegen einen Bot (ORANGE), der aufs Tor schießt.

Das Spiel selbst ist **eine einzige HTML-Datei ohne Laufzeit-Abhängigkeiten**
([index.html](index.html)): die Arena ist handgeschriebenes **WebGL2**
(kein three.js, keine Assets, kein Build). Dieses Repo packt es zusätzlich in
eine **Electron-Desktop-App** — Fenster, Menü, Vollbild — und lässt sich später
mit `electron-builder` zu einer `.exe` bauen.

Die frühere Draufsicht-Fassung liegt unverändert in
[2d-version/index.html](2d-version/index.html) (2D-Canvas, kein WebGL2 nötig) —
praktisch als Vergleich, was die dritte Achse am Spielgefühl ändert.

## Sofort spielen (ohne Installation)

Doppelklick auf [index.html](index.html) — läuft in jedem modernen Browser
(Chrome, Edge, Firefox) und braucht **WebGL2**. Ohne WebGL2 zeigt die Seite einen
Hinweis und verlinkt auf die 2D-Fassung.

## Als Desktop-App starten

Voraussetzung: [Node.js](https://nodejs.org) 18 oder neuer.

```bash
npm install     # holt Electron
npm start       # öffnet die Arena in einem eigenen Fenster
```

Im Fenster: Menü **Spiel → Neustart / Vollbild (F11) / Entwicklerwerkzeuge (F12) / Beenden**.

Geht das Fenster in den Hintergrund, friert Chromium es ein — das Spiel pausiert
damit automatisch, die Partie läuft dir also nicht weg. Zurück im Fenster mit
`P` oder `ESC` weiterspielen.

## Steuerung

| Taste | Aktion |
|---|---|
| `W` / `S` | Gas / Bremse und Rückwärts |
| `A` / `D` | Lenken |
| `SHIFT` | Boost (verbraucht Boost-Tank; in der Luft hebt er an — so fliegt man) |
| `LEERTASTE` | Sprung — in der Luft noch einmal gedrückt: **Flip/Dodge** (harter Schuss) |
| `STRG` | Handbremse / Drift (Powerslide) |
| `C` | Kamera umschalten (Ball-Cam ↔ Übersicht quer über das Feld) |
| `ENTER` / `LEERTASTE` | Anpfiff aus dem Menü, Revanche nach Spielende |
| `P` / `ESC` | Pause |
| `R` | Sofort neu starten |
| `M` | Ton an/aus |

## Spielen in 30 Sekunden

* Puck ins **orange** Tor drücken. Du schießt nach rechts, der Bot nach links.
* **Flip-Hits** sind deutlich härter als ein normaler Kontakt (gemessen ~1,7×):
  Puck vor der Nase, `LEERTASTE` und in der Luft noch einmal `LEERTASTE`.
* **Aerial**: `LEERTASTE`, dann `SHIFT` halten — der Boost hebt das Auto bis an
  die Decke (gemessen: Sprung 152 Einheiten, mit Boost in ~0,5 s auf 528).
  Puck in der Luft von oben treffen.
* **Über das Tor schießen zählt nicht**: die Torlatte liegt auf 250, ein Puck
  darüber prallt an der Bande ab — wie im Original.
* **Boost** gibt's auf den Hex-Feldern: kleine geben 12, große 100 (Respawn 4 s
  bzw. 10 s).
* Wer mit **Supersonic-Tempo** in den Gegner fährt, zerstört dessen Auto
  (Demolition, ab 1200 u/s); frisch respawnte Autos sind kurz geschützt.
* 5 Minuten, bei Gleichstand **Overtime mit Golden Goal**.

## Die Bot-KI

Der Bot ist kein Zielsuchroboter, sondern spielt in drei Regeln:

1. Er stellt sich **hinter den Puck** auf die Linie Puck → Toreck und rollt dann
   durch den Puck hindurch. Kurz vor dem Puck setzt er den **Boden-Flip** als
   harten Schuss.
2. Steht er falsch (zwischen Puck und gegnerischem Tor), **umkreist** er den Puck
   in sicherem Abstand, statt ihn ins eigene Tor zu schieben.
3. Er **springt nur, wenn der Puck in der Luft hängt**. Ein Puck am Boden wird
   rollend getroffen — Springen hebt das Auto über den Puck hinweg.

Dazu: freies Toreck statt Tor-Mitte, Boost-Management und Tanken abseits des
Pucks. Was das gemessen bringt (jeweils gegen einen stillstehenden Gegner):
**0 Tore → 3 bis 8 Tore in 90 s**, **0 statt 50 Sprünge** über einen Puck am
Boden, erstes Tor nach ~5 s. Details in
[REVERSE-ENGINEERING.md](REVERSE-ENGINEERING.md), Abschnitt 7.

## Klang

Boost, Puck-Knall, Tor und Demolition sind **komplett synthetisiert** (WebAudio:
Rauschen, Filter, Oszillatoren) — deshalb gibt es keine einzige Audiodatei und
nichts nachzuladen. Details in
[REVERSE-ENGINEERING.md](REVERSE-ENGINEERING.md), Abschnitt 8.

Browser (und Electron) erlauben Klang erst nach einer Nutzereingabe: der erste
Tastendruck schaltet den Ton frei. Mit `M` schaltest du ihn stumm.

## 3D-Technik in einem Absatz

Arena, Autos und Puck sind echte 3D-Geometrie (Box, Zylinder, Ebenen), gezeichnet
von einem handgeschriebenen WebGL2-Renderer: ein Mesh-Shader mit Diffuslicht,
Kantenlicht und Eigenleuchten (Tore, Boost-Pads), ein prozeduraler Boden-Shader
für die Linien (Achsen mit `fwidth`, Mittelkreis, Bande), Partikel als GL-Punkte
und Schatten als durchscheinende Scheiben. Die Decke wird von innen gezeigt und
von außen weggeblendet (Backface-Culling), damit die Übersichtskamera in die
Arena sieht. Physik läuft mit festem Zeitschritt 1/120 s.

## Projektstruktur

```
index.html                das komplette 3D-Spiel (Physik, KI, WebGL2, Klang)
2d-version/index.html     die frühere Draufsicht-Fassung (2D-Canvas)
main.js                   Electron-Hülle: Fenster, Menü, Vollbild
package.json              App-Metadaten und Start-Skripte
REVERSE-ENGINEERING.md    wie die Original-Mechanik zerlegt und nachgebaut wurde
README.md                 diese Datei
```

Alle Spielwerte liegen kommentiert im `CFG`-Block am Anfang von `index.html`
(Fahrwerk, Boost, Flip, Sprung, Puck, Pads, Matchdauer).

## Optional: eine `.exe` bauen

Nicht in `package.json` vorbereitet (das würde die Installation unnötig groß
machen) — bei Bedarf:

```bash
npm install --save-dev electron-builder
npx electron-builder --win
```

Dann noch in `package.json` ergänzen:

```json
"build": {
  "appId": "com.puckrocket.arena",
  "productName": "Puck Rocket",
  "directories": { "output": "dist" },
  "win": { "target": ["nsis", "portable"] }
}
```

Das Ergebnis liegt in `dist/` (bereits in `.gitignore`). Für Releases auf GitHub
lohnt es, `dist/` **nicht** mit zu committen, sondern die Datei als
Release-Anhang hochzuladen.

## Auf GitHub hochladen

```bash
git init
git add .
git commit -m "Puck Rocket — Mini Arena 3D als Desktop-App"
# Repo auf github.com anlegen, dann:
git remote add origin https://github.com/<dein-name>/puck-rocket-mini-arena.git
git branch -M main
git push -u origin main
```

* `node_modules/`, `dist/` und Logs sind über [.gitignore](.gitignore) ausgenommen.
* Der Code enthält **keine** Schlüssel, Tokens oder Zugangsdaten.
* Es ist **noch keine Lizenz** gesetzt. Wenn das Spiel frei nutzbar sein soll,
  z. B. eine MIT-Lizenz als `LICENSE` hinzufügen (und `"license": "MIT"` in
  `package.json` ergänzen); ohne Lizenz gilt „alle Rechte vorbehalten“.
* `"author"` steht auf `TTTBubbleICE` (dein GitHub-Name) — anpassen, wenn das
  anders heißen soll.

## Bekannte Grenzen

* Nur Tastatur, nur lokal, 1 gegen 1 gegen Bot (kein Netzwerk, kein zweiter
  Spieler).
* Der **Boden-Flip** (harter Schuss ohne Absprung) ist derzeit der Bot-KI
  vorbehalten — für den Menschen ist `LEERTASTE` der Sprung, der Flip kommt in
  der Luft. Grund: ein Sprung hebt das Auto über den flachen Puck.
* Der Bot kassiert gelegentlich ein **Eigentor** (gemessen 2 auf 360 s gegen 21
  eigene Tore) — meist als Abpraller, kein Fehler der Ziellogik.
* Kein Speicherstand: Score und Boost gibt es nur innerhalb einer Partie.
* Kein Spiel-Menü mit Optionen (Gegnerstärke, Rundenzahl) — die Werte stehen in
  `CFG` und in der KI.

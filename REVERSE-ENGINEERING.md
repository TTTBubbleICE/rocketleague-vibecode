# Reverse Engineering: PUCK ROCKET — Mini Arena

Wie aus „Puck + Rocket League" ein spielbares Minispiel wurde: erst die Mechanik
beobachten und in Regelkreise zerlegen, dann jeden Regelkreis als Formel
nachbauen. Alle Werte unten stehen 1:1 als Konstanten im Code
([index.html](index.html), Block `CFG`) — diese Datei ist die Begründung dazu.

Die **Hauptfassung ist 3D** (echte Arena-Geometrie, Höhenachse, Ball-Cam). Die
ältere Draufsicht-Fassung liegt unverändert unter
[2d-version/index.html](2d-version/index.html); sie diente als Referenz, welche
Mechanik die dritte Achse verändert. Alle Messwerte unten stammen — wenn nicht
anders vermerkt — aus der 3D-Fassung.

## 0. Was hier „Reverse Engineering" heißt (und was nicht)

Ehrlich vorweg: **keine Binäranalyse, kein Dekompilieren, kein Daten-Mining** aus
Rocket-League-Installationen. Was hier passiert, ist Verhaltens-Rekonstruktion
(Blackbox): beobachtbares Spielverhalten wird in Größen zerlegt, für die sich eine
Formel angeben lässt, und die Formel wird so lange kalibriert, bis die Messwerte
zum Original-Gefühl passen. Die Zahlen sind also **Nachbauten, keine Originalwerte**.

Ziel war nicht, RL zu kopieren, sondern die fünf Regelkreise zu finden, die sein
Spielgefühl erzeugen:

1. Fahrwerk mit Trägheit, Grip und begrenzter Lenkrate
2. Boost als zweiter, begrenzter Beschleunigungspfad
3. Flip/Dodge als Impuls mit Hit-Fenster (der Grund, warum „Flip-Hit" härter ist)
4. Kontakt zwischen Fahrzeug und Puck als Impuls zweier Massen
5. Match-Loop aus Kickoff, Tor, Uhr

## 1. Fahrwerk — warum sich das Auto „schwer" anfühlt

| Beobachtung im Original | Hypothese | Umsetzung im Code |
|---|---|---|
| Im Stand dreht das Auto nicht; es fährt erst an | Lenkung ist an Rollgeschwindigkeit gekoppelt | `gate = clamp(speed / steerRef, 0, 1)`, `steerRef = 260` |
| Bei hohem Tempo werden die Bögen weit | Lenkrate fällt mit Tempo | `steerFalloff = 0.35` → bei `boostMax` bleiben 65 % Lenkrate |
| Das Auto „schiebt" in Kurven, driftet | Geschwindigkeit ist nicht starr an die Blickrichtung gebunden | Geschwindigkeit wird **nach** der Lenkung auf die neue Achse projiziert; der Queranteil wird mit `grip` abgebaut |
| Handbremse = Powerslide | Handbremse senkt den Grip statt zu bremsen | `grip 7.5` → `gripDrift 1.7` |
| Ohne Gas wird man langsam | Rollwiderstand | `coastDrag = 380 u/s²` |
| Rückwärts dreht sich die Lenkung um | Vorzeichen hängt an der Längsgeschwindigkeit | `dir = vf < -20 ? -1 : 1` |

Damit das stabil bleibt, wird mit festem Zeitschritt `1/120 s` simuliert
(Akkumulator, max. 16 Substeps pro Frame) — sonst wird Physik frame­raten-abhängig.

**Messwerte:** Gas 0,5 s → 511 u/s; 300 Einheiten Anlauf → 148 Einheiten Weg;
Vollgas-Endtempo 900, mit Boost 1083…1500.

## 2. Boost

| Beobachtung | Hypothese | Code |
|---|---|---|
| Boost läuft in ~3 s leer | 33,3 Einheiten/s bei 100 Tank | `boostCap 100`, `boostUse 33.3` |
| Mit Boost ist man klar schneller als ohne | zweiter Beschleunigungspfad mit eigener Endgeschwindigkeit | `boostAccel 2300`, Ziel `boostMax 1500` statt `maxSpeed 900` |
| kleine Pads geben wenig, große viel, beide kommen wieder | 12 vs. 100, Respawn 4 s vs. 10 s | `CFG.pad.small/big` |
| Große Pads verschwinden nicht, wenn man voll ist | Aufnahme nur unter Volllast | `if (pad.big && car.boost > cap - 1) continue` |
| Beim Anpfiff hat man etwas Boost | Startwert 34 | `match.kickoffBoost` |

**Messwert:** 0,5 s Dauerdruck auf Boost = 17 Einheiten = 33,3/s, Endtempo 1083.

## 3. Flip / Dodge — der Grund für „Flip-Hits"

Der Flip ist im Original kein Gas, sondern ein **Impuls**. Deshalb wirkt er in
diesem Nachbau genauso: die Geschwindigkeit wird gesetzt, nicht erhöht
(`vel = vel·(1−blend) + dir·dodgeSpeed·blend`), danach klingt sie mit
`flipDrag` ab.

* Richtung aus der Eingabe: vorwärts / seitlich (links, rechts) / rückwärts —
  genau die vier Stick-Varianten des Originals. Ein *Side-Flip* geht quer zur
  Blickrichtung, weil `steer` die Fliprichtung kippt.
* `dodgeTime 0.55 s`, `dodgeCooldown 1.3 s`, `flipBlend 0.8` (vorwärts/seitlich),
  `flipBlendBack 0.5` (rückwärts).
* **Hit-Fenster:** `flipHit 1200`, linear abklingend über die Flip-Dauer. Ein
  Kontakt während eines Flips zählt also voll, kurz danach fast nichts mehr —
  wie im Original, wo späte Flip-Kontakte schwach sind.

**Messwerte (gleicher Anlauf, Puck-Maximaltempo):**

| Aktion | Pucktempo |
|---|---|
| Kontakt mit Gas bei 800 u/s | 963 u/s |
| Kontakt mit Flip bei 800 u/s | **1606 u/s** |

Front-Flip aus Tempo 300 → 964 u/s; Back-Flip aus +386 → −386; Side-Flip
rechts → 840 u/s quer.

### Gefundener Fehler in der eigenen Bot-KI
Der Bot gab beim Flip minimal `steer` mit — im Originalschema wird daraus ein
**Side-Flip**, und er schoss 2 m am Puck vorbei (Messung: Puck blieb bei
Geschwindigkeit 0, Bot bei y = 272). Fix: die KI übergibt eine explizite
Fliprichtung auf den Puck (`inp.flipAngle`), der Mensch behält die Stick-Logik.

### Der Flip mit Höhe (3D)

Im 3D-Nachbau hat der Flip eine Höhe bekommen — und genau daran ist die erste
Version der Bot-KI gescheitert (siehe Abschnitt 7):

* **Mensch:** `LEERTASTE` springt (`vel.y = 900`), ein zweiter Druck in der Luft
  flippt (`startFlip`). Die Flugkurve: `h = v²/2g = 900²/5200 ≈ 156`, gemessen
  **152** Einheiten.
* **Aerial:** Mit `SHIFT` in der Luft kommt `airLift 3400` gegen `gravity 2600`
  an — netto 800 u/s². Aus dem Sprung heraus ist die Decke nach ~0,5 s erreicht
  (gemessen: Maximalhöhe **528** = `arena.ceil 560 − car.hei 32`, dabei 34 → 17
  Boost verbraucht, also 0,5 s bei 33,3/s).
* **Boden-Flip (`inp.flip`, nur die Bot-KI):** `startFlip` direkt am Boden. Der
  Flip setzt `vel.y` nicht mehr nach oben, das Auto bleibt auf dem Boden und
  trifft den Puck auf Höhe — ein Schuss mit dem Flip-Hit-Bonus, ohne Absprung.
* **Warum das nötig war:** die Sprunghöhe (152) liegt über der Puck-Oberkante
  (2 · 46 = 92). Ein Sprung-aus-dem-Stand vor dem Puck fliegt also **über ihn
  hinweg**, und genau das tat die erste KI-Version 50-mal pro 90 s.

| Aktion | gemessene Höhe |
|---|---|
| Sprung aus dem Stand | 152 |
| Sprung + Boost (Aerial) | 528 (Decke) |
| Puck springt (Ausgangstempo 1800) | 514 (Decke), fällt zurück auf 46 |

## 4. Puck-Physik

Der Puck ist der „Puck"-Teil: schwer, gleitet weit, verliert langsam Tempo.

* Kontakt = **Impuls zweier Massen mit Restitution**:
  `j = (1 + rest)·closing / (1/mCar + 1/mPuck)`, dann
  `v_puck += n·j/mPuck` und `v_car −= n·j/mCar·carRecoil`.
  Mit `rest 0.55`, `puckMass 0.34`, `carRecoil 0.22` heißt das: der Puck fliegt
  ≈ 1,15× schneller weg als das Auto ankommt, das Auto verliert dabei spürbar
  Tempo (Messung: Auto 800 → 487 u/s nach dem Kontakt).
* Es gibt **kein Mindest-Tempo** — nur echtes Zusammentreffen zählt
  (`close <= 0` → kein Impuls). Deshalb ist ein Schubser auch ein Schubser.
* Gleitreibung als `friction·v + roll` (`0.55`, `45 u/s²`), Deckel bei
  `maxSpeed 2400` (Messung: Flip-Hit am Anpfiff = 1986 u/s).
* Wände: `wallRest 0.8`. Die Toröffnung ist eine Aussparung in der Bande; in den
  Torpfosten wird auf Höhe der Öffnung geklemmt.
* Tor zählt erst, wenn der **ganze Puck** hinter der Linie ist
  (`pos.x + r < −HX` bzw. `> +HX`) — „Ball über der Linie" wie im Original.

**Messwerte für den sanften Kontakt (genau ein Schritt):**

| Anlauftempo | Pucktempo |
|---|---|
| 100 u/s | 111 u/s |
| 250 u/s | 284 u/s |
| 500 u/s | 572 u/s |

### Der Puck in der Höhe (3D)

Derselbe Puck, aber mit Gravitation — das ist der Puck-Teil des Hybrids:
„schwer und flach" (Gleitreibung) plus eine Höhenachse, die ihn springen lässt:

* `puck.gravity 1900`, Ruhelage auf `r = 46` (gemessen: ruht exakt bei 46).
* Aufprall am Boden: `floorRest 0.62`, unter 45 u/s wird die Vertikalbewegung
  ganz abgeschaltet (kein Endlos-Zittern).
* Decke: `ceilRest 0.5` bei `560 − 46 = 514` (gemessen: exakt 514, danach fällt
  er wieder).
* In der Luft gilt `airDrag 0.25` statt der Gleitreibung.
* **Die Torlatte zählt mit:** `inGoal` verlangt zusätzlich `pos.y < goal.bar 250`.
  Gemessen: ein Puck, der in Torhöhe (400) auf die Öffnung zufliegt, erzielt
  **kein** Tor, sondern prallt an der Bande über dem Tor ab (Rückkehr ins Feld,
  Stand bleibt 0:0). Ein flacher Puck daneben ist ein Tor.
* Kontakt ist eine **Kugel gegen eine gedrehte Box** (OBB), also trifft auch ein
  Aerial von oben, und der Impuls zeigt entlang der Boxkante, nicht nur in der
  Ebene.

## 5. Demolition

| Beobachtung | Umsetzung |
|---|---|
| Zerstören braucht „Supersonic"-Tempo | `demoSpeed 1200` (über dem Vollgas-Endtempo 900 → nur mit Boost/Flip erreichbar) |
| Wer langsamer ist, verliert | Sieger braucht `speed > opfer.speed · 1.05` |
| Frisch gespawnter ist kurz immun | `spawnProtect 1.6 s`, kein Demo gegen/aus dem Schutz |
| Respawn kostet Boost | `demoRespawn 2 s`, danach 0 Boost, Position eigenes Drittel |

## 6. Match-Loop

5:00 Uhr (`match.time 300`), Kickoff mit **blockierten Autos** und 3 s Countdown,
34 Boost beim Anpfiff, 2,6 s Tor-Feier, danach Kickoff. Bei Gleichstand nach
0:00 → **Overtime = Golden Goal**; das nächste Tor beendet das Spiel. Kein
Countdown läuft, solange pausiert/gefeiert wird.

## 7. Bot-KI — vom Puck-Verfolger zum Torschützen

Die erste 3D-KI war messbar schlecht: **0 Tore in 3×90 s** gegen einen
stillstehenden Gegner. Die Ursachen ließen sich alle in Zahlen festmachen:

| Beobachtung (Messung) | Ursache im Code | Behebung |
|---|---|---|
| Bot springt **50–52 mal** pro 90 s über einen Puck am Boden und trifft ihn nie | vor dem Puck wurde `inp.jump` gesetzt; die Sprunghöhe 152 liegt über der Puck-Oberkante 92, der Flip-Impuls trug ihn dann noch 600 Einheiten weiter | Springen nur noch, wenn der Puck in der Luft hängt (`pos.y > 80`); am Boden rollt er durch und nutzt den **Boden-Flip** als Schuss |
| Bot bremst 60 Einheiten vor dem Puck ab („verfolgt ihn nur") | Bremsregel `if (speed > 150 && dTarget < 60 + speed·0.3) throttle = -1` | im Angriff ist das Ziel jetzt ein Punkt **90 Einheiten hinter dem Puck** in Schussrichtung — durchrollen statt bremsen |
| Bot stand 8 s neben dem Puck und kam nie hinter ihn (Bogenpunkt = Parkplatz) | Bogenziel war ein fester Punkt seitlich des Pucks | Ziel ist ein **Orbit-Radius 170** um den Puck, der Winkel dreht pro Frame max. 0,55 rad weiter — er umkreist ihn aktiv, bis er hinter ihm steht (gemessen: 1,8 s) |
| Bot schob den Puck ins **eigene Tor** (5 Eigentore in 6×60 s) | der Umlaufweg schnitt den Puck (Streifabstand 83 bei Kontaktdistanz ~80) | Orbit statt Querung: der Bot bleibt auf Abstand, bis seine Schussseite erreicht ist — Eigentore 5 → **2** in derselben Stichprobe |
| Tor-Mitte wurde zugestellt | Ziel war immer `goalOpp.z = 0` | **freies Toreck**: aus {−0,6·Halbbreite, 0, +0,6·Halbbreite} gewinnt das Eck mit dem größten Abstand zum Gegner |

Die KI ist jetzt in drei Regeln beschreibbar (und im Code so kommentiert): hinter
den Puck kommen → durchrollen (kurz davor Boden-Flip) → sonst umkreisen. Sprung
nur für Pucks in der Luft. Dazu Boost-Management (Boost auf der Schusslinie, Tanken
nur abseits des Pucks).

**Vorher/Nachher, identische Prüfläufe (Gegner steht still):**

| Messgröße | vorher | nachher |
|---|---|---|
| Tore Bot in 90 s (3 Läufe) | 0 / 0 / 0 | 8 / 4 / 3 · in 6×60 s zusammen 21 |
| Sprünge über einen Puck am Boden | 50–52 pro 90 s | **0** |
| erstes Tor | nie | nach ~5 s |
| Zeit in der gegnerischen Hälfte | 0 s | 10–33 s je 60 s |
| Boden-Flips als Schuss | 0 | ~10 pro 60 s |
| Eigentore (6×60 s) | 5 | 2 |

## 8. Klang — warum hier kein einziges Sample liegt

Das Original arbeitet mit aufgenommenen Samples; dieser Nachbau **synthetisiert
alles zur Laufzeit** mit der WebAudio-API. Das ist nicht nur eine Notlösung, es
folgt demselben Reverse-Engineering-Ansatz: ein Klang ist ein Signal, das aus
wenigen Bausteinen besteht, und die Bausteine sind messbar.

| Klang | Rekonstruktion | Messwert (Offline-Render) |
|---|---|---|
| Puck-Knall | Rauschimpuls durch Tiefpass mit Frequenzsturz (der Aufprall) + kurzer Ton mit Pitch-Drop (das Klacken). Amplitude und Tonhöhe skalieren mit der Aufprallgeschwindigkeit | Spitze 0,23 bei 120 u/s gegen 0,88 bei 1600 u/s |
| Flip-Hit | zusätzlich ein heller Sägezahn-Oberton | Spitze 0,77 |
| Tor | aufsteigende Vier-Ton-Fanfare (C5 E5 G5 C6), gehaltener C-Dur-Akkord, angepeilter Jubel-Schwall | Spitze 0,35, RMS 0,071 über 1,8 s |
| Demolition | Rauschen mit Filtersturz 3,2 kHz → 130 Hz plus Sinus-Boom 150 → 36 Hz | Spitze 0,76 |
| Boost | Dauerton: Rauschen im Bandpass (Luft) + Sägezahn-Rumpeln; Tonhöhe und Lautstärke folgen dem Tempo | bei Stellung 0 exakt 0, bei 0,2 Stellung Spitze 0,19 |

**Zwei Fallen, die erst beim Messen sichtbar wurden:**

1. Der Puck läuft bei Kontakt Schritt für Schritt mit dem Auto mit. Jeder dieser
   Schritte erzeugt einen winzigen Impuls (Messung: 175 Kontakte in 6 s, davon 44
   über der Hörschwelle) — ohne Filter hätte das im Maschinengewehr-Takt
   geklappert. Lösung: Mindeststärke 90 u/s plus **nach Schlagstärke gestaffelte
   Sperrzeit** (0,28 s leise / 0,10 s mittel / 0,05 s hart). Ergebnis: ein Schubser
   = ein Klang, ein Ansturm am Bande-Knäuel = ein Knall statt 44.
2. Die Sperrzeit hängt an der Audio-Uhr (`currentTime`). Beim schnellen
   Vorspulen der Simulation (Debug-Hook `simulate`) vergeht kaum Audio-Zeit, also
   verstummen die Klänge. Das ist nur im Test relevant, nicht im Spiel.

## 9. Was bewusst nicht rekonstruiert ist

* **Dribbling auf der Motorhaube, Ball-Halten:** bräuchte Kontaktpunkte auf
  Karoniveau und eine haltekraft — hier prallt der Puck immer ab.
* **Rad-/Getriebemodell, Suspension, einzelne Radkräfte:** Das Auto ist eine Box
  mit einem Längs-/Quer-Modell, nicht vier Räder.
* **Air-Roll, Half-Flip, Wavedash:** es gibt einen Flip-Impuls (aus der Eingabe
  oder fest vorgegeben), Luftsteuerung nur als Giermoment.
* **Netzwerk/Lag-Kompensation, Matchmaking, Replays:** Einzelplatz gegen Bot.
* **Mutatoren** (Low Gravity, Rumble …): außerhalb des Umfangs.

## 10. Wie verifiziert wurde (und wie du nachprüfen kannst)

Geprüft im laufenden Browser ohne Konsolenfehler, mit den Debug-Hooks
`window.GAME` (`hold`/`release` für echte Tastendrücke, `update(1/120)` für
einen Schritt, `simulate(s)` zum Vorspulen, `G`/`CFG` zum Inspizieren):

* Anpfiff: Autos blockiert, Boost 34, dann `play` — ✔
* Tor: Zustand `goal`, „TOR!", 1:0, danach Kickoff mit Autos bei ±368 — ✔
* Boost: Verbrauch 33,3/s, Tempo 1083 > 900 — ✔
* Flips: vorwärts 964, seitlich 840, rückwärts −386 — ✔
* Demolition: Bot zerstört, Zähler 1, Meldung „DEMOLITION!" — ✔
* Pause `P`, Revanche `R`, Start `Enter` — ✔
* Bot freie Bahn: **14 Tore in 120 s, 0 Eigentore in 240 s**, erster Kontakt
  0,48 s nach dem Anpfiff, Flip-Hit mit 1986 u/s — ✔
* Klang: alle fünf Signale im `OfflineAudioContext` gerendert und auf Pegel
  gemessen (Tabelle oben); im Echtzeit-Spiel ~5 Klänge in 9 s aktivem Spiel,
  Stummschaltung `M` (Master 0,55 ↔ 0), Boost-Ton geht sauber auf 0 — ✔

**3D-Schicht** (im Browser und in der Electron-App gemessen):

* WebGL2 aktiviert, Schadercode ohne Warnung, `glGetError()` nach dem Frame 0,
  Puffer 1264×735; ~29 % helle und ~30 % farbige Pixel im Bild — es wird also
  wirklich gezeichnet, nicht nur geleert — ✔
* Darstellung geprüft mit `readPixels` an berechneten Weltpunkten: Boden links
  blau / rechts braun (`(24,38,58)` bzw. `(49,35,24)`), Bande `(17,21,32)`,
  Boost-Pad gelb `(255,255,139)`, Puck-Rand weiß, Cockpit `(15,23,39)` — ✔
* Deckel weggeblendet: aus der Übersichtskamera sind die Bodenfarben sichtbar
  (also steht die Decke nicht im Weg) — ✔
* Höhe: Sprung 152, Aerial bis zur Decke 528, Puck ruht bei 46, Deckenprall 514,
  Puck bei Höhe 400 im Torraum ergibt **kein** Tor — ✔
* Tore in beiden Richtungen, korrekt zugeordnet (Puck ins orange Tor → Punkt für
  Blau, Torschütze `blue`) und Anpfiff-Reset danach — ✔
* Demolition bei Aufprallgeschwindigkeit 1443 u/s (Schwelle 1200) — ✔
* Echtzeit-Schleife der App synchron: 3,5 s Spielzeit in 3,5 s Echtzeit — ✔
* Bot-KI: 3 Tore in 30 s, 0 Sprünge über einen Puck am Boden — ✔

## 11. Schrauben, an denen du drehen kannst

| Wunsch | Konstante |
|---|---|
| Spiel schneller/hektischer | `car.accel`, `car.maxSpeed`, `car.boostMax`, `car.boostAccel` |
| Driftiger, „rutschiger" | `car.grip` runter (mehr Querbewegung) |
| Anderes Sprunggefühl | `car.gravity`, `car.jumpImpulse` (Höhe = `v²/2g`) |
| Höher/schneller fliegen | `car.airLift` (netto gegen `gravity` gerechnet) |
| Puck bleibt länger in Bewegung | `puck.rollFriction`, `puck.rollDrag` runter |
| Puck springt höher/flacher | `puck.gravity`, `puck.floorRest` |
| Härtere Flip-Hits | `car.flipHit`, `car.flipBlend` |
| Arena höher/flacher | `arena.ceil`, `arena.wall` |
| Bot stärker/schwächer | `botInput`: `a.t`-Intervall (Entscheidungstakt), `a.noise` (±Rad), `a.t` = 0 deaktiviert die Trägheit |
| Bot aggressiver | den `lead`-Faktor und `puckDist > 200` in der Boost-Regel erhöhen |
| Bot schießt härter | Bedingung für `inp.flip`: `puckDist < 175 && > 80` weiter fassen |
| Größere Tore | `goal.mouth` |
| Längere/kürzere Partie | `match.time` |

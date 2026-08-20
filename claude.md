# Projekt-Prompt: Live-Ergebnisse Tennisclub

> Diesen Text komplett in Claude Code als ersten Prompt einfügen.
> Danach am besten als `CLAUDE.md` im Projektordner ablegen, damit der Kontext in jeder Session verfügbar ist.

---

## Rolle und Arbeitsweise

Du baust mit mir zusammen eine kleine Web-App für meinen Tennisclub. Ich bin Hobby-Entwickler, kein Profi — erkläre Entscheidungen kurz, aber halte mich nicht mit Theorie auf.

Arbeite in den unten definierten **Etappen**. Nach jeder Etappe stoppst du, fasst zusammen was läuft, und wartest auf mein Okay. Bau nicht alles auf einmal.

Wenn eine Anforderung unklar ist: frag nach, statt zu raten.

---

## Das Problem

Bei uns im Club kann man von der Terrasse aus die Anzeigetafeln der hinteren Plätze nicht sehen. Bei Medenspielen weiß deshalb niemand, wie es auf Platz 4, 5 und 6 gerade steht.

**Die Lösung:** Wer zufällig hinten vorbeigeht, tippt den aktuellen Stand kurz ins Handy. Auf der Terrasse sieht man live alle Plätze auf einem Bildschirm.

**Zwei entscheidende Randbedingungen:**

1. **Kein App-Store, keine Installation.** Es muss eine normale Webseite sein, die man per Link oder QR-Code öffnet. Wenn Leute erst etwas herunterladen müssen, benutzt es niemand.
2. **Kein Login, kein Konto.** Die Hürde muss so niedrig wie möglich sein. Jedes Clubmitglied soll eintragen können, ohne sich vorher irgendwo zu registrieren.

---

## Technischer Stack

- **Next.js** (App Router, TypeScript)
- **Supabase** — Postgres als Datenbank, **Supabase Realtime** für Live-Updates
- **Tailwind CSS**
- Deployment auf **Vercel**
- PWA-Manifest, damit „Zum Startbildschirm hinzufügen" auf iOS und Android sauber funktioniert

Warum Realtime und nicht Polling: die Terrassen-Ansicht soll Änderungen in unter einer Sekunde zeigen, ohne dass jemand neu lädt. Baue **Polling alle 8 Sekunden als Fallback** ein, falls die Realtime-Verbindung abreißt — der Empfang auf der Anlage ist stellenweise schlecht.

---

## Fachlicher Kontext (wichtig für das Datenmodell)

Ein **Medenspiel** läuft so ab:

- Eine Heimmannschaft (immer wir: **Hochheim**) spielt gegen eine Gastmannschaft.
- Zuerst laufen die **Einzel** parallel auf mehreren Plätzen (je nach Mannschaftsgröße 4 oder 6 Einzel).
- Danach die **Doppel** (2 oder 3 Doppel).
- Jede gewonnene Partie zählt einen Mannschaftspunkt. Endstand z.B. „Hochheim 4 : 2 Flörsheim".

**Im Medenspiel-Modus gibt es keine Spielernamen.** Auf jedem Platz steht schlicht „Hochheim" gegen „Gast". Das ist eine bewusste Entscheidung: Namen einzutippen dauert zu lange und ist datenschutzrechtlich unnötig kompliziert. In der Oberfläche taucht in Etappe 1 bis 5 also kein Namensfeld auf.

**Aber:** wir werden die App später mit hoher Wahrscheinlichkeit auch für **interne Clubturniere** nutzen. Dort gibt es keine Mannschaften, sondern zwei Spieler mit Namen. Deshalb ist das Datenmodell unten bereits darauf vorbereitet (Feld `typ` am Spieltag, optionale Namensfelder an der Partie). Diese Felder bleiben vorerst leer und werden nirgends angezeigt — sie ersparen uns nur später eine Migration mit Bestandsdaten. **Bau keine Turnier-Oberfläche.**

**Tennis-Zählweise**, die du korrekt abbilden musst:

- Punkte im laufenden Game: `0`, `15`, `30`, `40`, `A` (Vorteil)
- Satz: bis 6 Spiele, zwei Vorsprung, bei 6:6 Tiebreak (dann Satzstand 7:6)
- Bei uns üblich: statt eines dritten Satzes wird ein **Match-Tiebreak bis 10** gespielt. Das muss die App unterstützen und im Ergebnis auch so anzeigen.

---

## Datenmodell

```sql
spieltag
  id            uuid pk
  datum         date
  typ           text        -- medenspiel | turnier   (vorerst immer "medenspiel")
  titel         text        -- bei Turnieren der Turniername, sonst null
  mannschaft    text        -- z.B. "Herren 40"
  gegner        text        -- z.B. "TC Flörsheim"
  status        text        -- geplant | laeuft | beendet
  created_at    timestamptz

partie
  id              uuid pk
  spieltag_id     uuid fk -> spieltag
  platz_nr        int         -- 1..9  (die Anlage hat 9 Plätze)
  disziplin       text        -- "Einzel 3", "Doppel 1"
  runde           text        -- einzel | doppel
  reihenfolge     int         -- für stabile Sortierung
  status          text        -- offen | laeuft | beendet
  saetze          jsonb       -- [[6,4],[3,6],[10,7]]
  game_heim       text        -- "0" | "15" | "30" | "40" | "A"
  game_gast       text
  ist_tiebreak    boolean
  ist_match_tb    boolean
  name_heim       text        -- nullable, nur für spätere Turniere
  name_gast       text        -- nullable, nur für spätere Turniere
  updated_at      timestamptz
  updated_by      text        -- freiwilliger Spitzname, kann leer sein

aenderung          -- einfaches Audit-Log für Undo und Korrekturen
  id          uuid pk
  partie_id   uuid fk
  vorher      jsonb
  nachher     jsonb
  quelle      text     -- Spitzname oder "unbekannt"
  created_at  timestamptz
```

**Wichtig:** Der Mannschafts-Gesamtstand (4:2) wird **immer aus den beendeten Partien berechnet**, nie als eigenes Feld gespeichert. Sonst läuft er früher oder später auseinander.

**Anzeigelogik für die Beteiligten:** Bau eine kleine Hilfsfunktion, die für eine Partie die beiden anzuzeigenden Bezeichnungen liefert — aktuell immer „Hochheim" und „Gast", später bei gefüllten Namensfeldern eben diese. Sie wird an genau einer Stelle definiert und überall verwendet. Damit ist der Turnier-Modus später eine kleine Änderung statt einer Suche quer durch alle Komponenten.

---

## Die Seiten

### `/live` — Terrassen-Ansicht

Das ist die Seite, die am häufigsten offen sein wird. Sie wird **draußen, in der Sonne, aus ein bis zwei Metern Entfernung** gelesen. Danach richtet sich das gesamte Design.

Aufbau von oben nach unten:

1. **Gesamtstand, sehr groß**: `Hochheim 3 : 2 TC Flörsheim`. Das ist die Information, die die Leute wirklich wollen. Darunter klein: Mannschaft und Datum.
2. **Eine Karte pro Platz**, in physischer Platzreihenfolge:
   - Platznummer und Disziplin (`Platz 5 · Einzel 4`)
   - Satzergebnisse und aktueller Game-Stand, groß
   - **Zeitstempel: „vor 3 Min"** — nicht optional. Ohne diese Angabe weiß auf der Terrasse niemand, ob der Stand aktuell ist oder von vor einer Stunde.
   - Optional der Spitzname dessen, der zuletzt eingetragen hat
3. Beendete Partien werden nach unten sortiert und optisch zurückgenommen.

**Stale-Kennzeichnung:** Partien mit Status `laeuft`, deren letzte Aktualisierung länger als 20 Minuten her ist, werden deutlich ausgegraut mit dem Hinweis „länger nicht aktualisiert". Lieber ehrlich zugeben, dass ein Stand alt ist, als falsche Aktualität vortäuschen.

**Spannungs-Hervorhebung:** Läuft irgendwo ein Match-Tiebreak, ein Satzball oder ein Matchball, wird diese Karte hervorgehoben. Das ist genau der Moment, in dem jemand auf der Terrasse aufsteht und hingeht.

**Kiosk-Modus:** `/live?tv=1` — ohne Navigation, noch größere Schrift, für einen Bildschirm im Clubhaus.

### `/eingeben` — Erfassung

Zwei Schritte:

**Schritt 1 — Platzauswahl:** große Kacheln 1 bis 9. Wird die Seite über einen QR-Code mit `?platz=5` geöffnet, wird dieser Schritt übersprungen.

**Auflösung Platz → Partie (wichtig):** Der QR-Code codiert **nur die Platznummer**, niemals eine Partie-ID. Die Schilder hängen dauerhaft am Zaun, während die Partie auf einem Platz mehrfach am Tag wechselt. Die App ermittelt beim Öffnen selbst, welche Partie gemeint ist:

1. Aktiven Spieltag suchen (`status = laeuft`). Gibt es keinen, erscheint eine ruhige Hinweisseite: „Heute läuft kein Spieltag." — mit Link zum Archiv, keine Fehlermeldung.
2. Innerhalb des Spieltags die Partie auf diesem Platz mit Status `laeuft` laden.
3. Gibt es keine laufende, aber eine offene Partie auf dem Platz: diese laden und beim ersten Speichern automatisch auf `laeuft` setzen.
4. Sind mehrere Partien möglich (typisch in der Übergangsphase zwischen Einzeln und Doppeln): eine kurze Auswahlliste mit maximal zwei bis drei Einträgen zeigen, nicht raten.
5. Sind auf dem Platz alle Partien beendet: Ergebnis anzeigen plus Schaltfläche „Trotzdem korrigieren".

Der Nutzer soll im Normalfall nach dem Scan **direkt in der richtigen Eingabemaske** stehen, ohne einen einzigen zusätzlichen Tap.

**Schritt 2 — Stand eintragen:**

Der typische Nutzer geht am Platz vorbei, schaut zwei Sekunden auf die Tafel und tippt. Er zählt **nicht** Punkt für Punkt mit. Die Eingabe muss deshalb „aktuellen Stand setzen" heißen, nicht „Punkt hinzufügen":

- Satzergebnisse über **große Plus-/Minus-Stepper** — pro Satz je ein Zähler für Hochheim und Gast
- Aktuelles Game über je **fünf Buttons** pro Seite: `0` `15` `30` `40` `A`
- Ein Button **„Stand speichern"**

Zielvorgabe: **unter 15 Sekunden, im Stehen, einhändig bedienbar.** Alle Tap-Ziele mindestens 56 Pixel hoch. Wenn die Eingabe sich wie ein Formular anfühlt, ist sie gescheitert.

Zusätzlich ein einklappbarer **Punkt-Modus** für den Fall, dass sich jemand längere Zeit an den Platz setzt: zwei Buttons `+1 Hochheim` / `+1 Gast`, und die App rechnet Game, Satz und Tiebreak selbst hoch.

Weitere Elemente auf dieser Seite:

- **„Rückgängig"** für die letzte eigene Änderung. Vertipper passieren garantiert, und ohne Undo trägt beim zweiten Mal niemand mehr etwas ein.
- **„Partie beendet"** — Button, der die Partie abschließt. Wenn der Satzstand rechnerisch ein Sieg ist, schlägt die App das von selbst vor.
- **Spitzname**, einmalig abgefragt, danach in localStorage. Rein freiwillig, überspringbar.

### `/admin` — Spieltag verwalten

Sehr schlicht, wird von einer Handvoll Leuten benutzt:

- Spieltag anlegen: Datum, Mannschaft, Gegner, Anzahl Einzel (4 oder 6)
- Partien werden automatisch generiert und auf Plätze verteilt
- **„Doppel starten"** — legt nach den Einzeln die Doppel-Partien an
- Jede Partie manuell korrigieren, Änderungshistorie einsehen, Änderungen zurückrollen
- Spieltag beenden und archivieren

### `/archiv`

Liste vergangener Spieltage mit Endergebnissen. Sehr einfach, aber für den Club nett und fast kostenlos in der Umsetzung.

---

## Zugriffsschutz ohne Login

Komplett offene Schreibrechte im Internet enden erfahrungsgemäß in Unsinn. Gleichzeitig darf es sich nicht wie ein Login anfühlen. Deshalb:

- **Vierstellige Club-PIN** vor dem ersten Eintragen. Wird in localStorage gespeichert — danach fragt die App nie wieder. Für den Nutzer fühlt es sich nach dem ersten Mal wie „kein Login" an.
- Die PIN liegt in einer Umgebungsvariable, ist also ohne Deployment änderbar.
- `/live` und `/archiv` sind **komplett frei zugänglich**, ohne PIN.
- `/admin` bekommt eine separate, längere PIN.
- Alle Schreibzugriffe laufen über Server Actions oder Route Handler, die die PIN serverseitig prüfen. Supabase-Keys mit Schreibrechten dürfen nie im Client landen.
- Jede Änderung wird im Audit-Log festgehalten.

---

## QR-Codes

Das ist wahrscheinlich der wichtigste Baustein für die tatsächliche Nutzung — wichtiger als jedes Feature in der App selbst.

Bau eine Seite `/admin/qr`, die **druckfertige DIN-A5-Schilder** generiert:

- **Ein Schild pro Platz** mit QR-Code auf `/eingeben?platz=N`. Überschrift groß: „Stand eintragen — Platz 5". Darunter eine Zeile Erklärung: „Kurz scannen, Stand eintippen. Die Terrasse sieht es sofort."
- Die Schilder bleiben **dauerhaft gültig**, weil der QR-Code nur die Platznummer enthält (siehe Auflösungslogik oben). Sie müssen nur neu gedruckt werden, wenn sich die Domain ändert.
- **Ein Schild für die Terrasse** mit QR-Code auf `/live`: „Live-Ergebnisse aller Plätze".
- Ausgabe als saubere Druckansicht per `window.print()` mit passendem `@media print`-Stylesheet. Kein PDF-Generator nötig.

Die Schilder werden laminiert und an die Platzzäune gehängt.

---

## Offline-Fähigkeit

Auf den hinteren Plätzen ist der Empfang schlecht. Wenn die erste Eingabe dort mit einer Fehlermeldung endet, probiert es niemand ein zweites Mal.

- Eingaben werden lokal in eine Queue geschrieben und im Hintergrund gesendet, sobald wieder Netz da ist.
- Die Oberfläche bestätigt **sofort optimistisch** („Gespeichert") und zeigt nur bei endgültigem Fehlschlag eine Meldung.
- Sichtbarer Verbindungsstatus, wenn etwas noch in der Queue hängt: „1 Eintrag wird gesendet".
- Bei gleichzeitigen Änderungen an derselben Partie gilt: letzte Schreiboperation gewinnt. Kein Merge-Konflikt-Handling — das wäre für diesen Anwendungsfall überzogen.

---

## Design-Vorgaben

Ich mag **schlichte, funktionale Oberflächen**. Keine Deko, keine Farbverläufe, keine Illustrationen, keine Animationen außer dort, wo sie eine Zustandsänderung erklären.

Konkret:

- **Helles Theme, sehr hohe Kontraste.** Die Seite wird bei Sonnenschein auf einem Handydisplay gelesen. Kein Dark Mode — draußen ist hell besser lesbar.
- **Große Typografie.** Der Gesamtstand und die Satzergebnisse sind die Hauptsache und dürfen richtig groß sein. Zeitstempel und Metainfos deutlich kleiner.
- **Zahlen in einer Tabellenziffern-Schrift** (`font-variant-numeric: tabular-nums`), damit Ergebnisse beim Aktualisieren nicht springen.
- Nur zwei Akzentfarben: eine für Hochheim, eine neutrale für den Gast. Grün/Rot vermeiden — Rot-Grün-Schwäche ist verbreitet, und der Gast ist kein Fehlerzustand.
- Mobile first. `/live` muss zusätzlich auf einem großen Bildschirm gut aussehen.
- Sichtbarer Tastatur-Fokus, `prefers-reduced-motion` respektieren.

**Beschriftungen** in einfachem Deutsch, Sie-Form vermeiden, keine Fachbegriffe: „Stand speichern", nicht „Absenden". „Partie beendet", nicht „Status auf beendet setzen".

---

## Etappen

Nach jeder Etappe stoppen und auf mein Okay warten.

**Etappe 1 — Fundament**
Next.js aufsetzen, Supabase-Schema anlegen, auf Vercel deployen. Als Ergebnis eine minimale `/live`-Seite, die fest hinterlegte Testdaten aus der Datenbank anzeigt. Beschreibe mir dabei genau, welche Schritte ich in der Supabase- und Vercel-Oberfläche selbst machen muss.

**Etappe 2 — Live-Ansicht**
`/live` vollständig: Gesamtstand, Platzkarten, Realtime-Updates, Zeitstempel, Stale-Kennzeichnung, Polling-Fallback.

**Etappe 3 — Eingabe**
`/eingeben` mit Platzauswahl, Steppern, Game-Buttons, PIN-Abfrage, Undo, „Partie beendet".

**Etappe 4 — Admin**
Spieltag anlegen, Partien generieren, Doppel starten, korrigieren, archivieren.

**Etappe 5 — Feinschliff**
PWA-Manifest, Offline-Queue, QR-Code-Druckseite, Kiosk-Modus, Archiv-Seite.

---

## Ausdrücklich nicht Teil des Projekts

Damit der Umfang nicht ausufert — bau das alles **nicht**, auch nicht „schon mal vorbereitend":

- Benutzerkonten, Rollen, Rechtesystem
- Turnier-Modus, Spielerverwaltung, Turnierbäume (Datenmodell vorbereiten, Oberfläche nicht)
- Push-Benachrichtigungen
- Statistiken, Auswertungen, Ranglisten
- Anbindung an nuLiga oder den Hessischen Tennisverband
- Mehrsprachigkeit
- Native App

---

## Domain und Deployment

Die App läuft unter einer **eigenen Subdomain der Clubdomain**, z.B. `live.euredomain.de`. Wir haben Zugriff auf die DNS-Einstellungen, also ist das entschieden — kein iframe, keine Unterseite im CMS.

Auf der Hauptseite des Clubs steht später nur ein gut sichtbarer Button „Live-Ergebnisse", der dorthin verlinkt.

Was das für den Code heißt:

- Die Basis-URL kommt aus einer Umgebungsvariable (`NEXT_PUBLIC_BASE_URL`). Keine absoluten URLs irgendwo fest verdrahtet.
- Die QR-Code-Seite baut ihre Links ausschließlich aus dieser Variable.
- In Etappe 1 deployst du zunächst auf die normale Vercel-URL. Sobald die Subdomain steht, wird nur die Variable umgestellt — sonst ändert sich nichts.
- Sag mir in Etappe 1 genau, welchen DNS-Eintrag ich anlegen muss (Typ, Name, Ziel) und wo ich die Domain im Vercel-Projekt hinterlege. Das TLS-Zertifikat macht Vercel automatisch.

**Reihenfolge beachten:** Die QR-Schilder werden erst gedruckt, wenn die Subdomain live ist. Sonst zeigen die laminierten Schilder auf eine URL, die es nicht mehr gibt.

---

Fang mit Etappe 1 an.

---

## Stand der Umsetzung

**Etappe 1 ist gebaut** (Stand 20.08.2026). Was steht:

- Next.js 16 mit App Router, TypeScript, Tailwind 4; Deployment-Vorbereitung für Vercel
- Datenbankschema in `supabase/schema.sql`, Testdaten in `supabase/seed.sql`
- `/live` in minimaler Fassung: Gesamtstand, Platzkarten, Sortierung, Zeitstempel
- Hilfsfunktionen in `src/lib`: `anzeige.ts` (Bezeichnungen der Beteiligten), `stand.ts` (Gesamtstand aus beendeten Partien), `zeit.ts` (Relativzeit und 20-Minuten-Regel)
- Die manuellen Einrichtungsschritte stehen in `SETUP.md`

**Korrektur zum Text oben:** Die Anlage hat **9 Plätze**, nicht 6.

Noch offen: Etappe 2 bis 5 wie oben beschrieben.

# Einrichtung — Etappe 1

Alles, was du selbst in Supabase, GitHub und Vercel klicken musst.
Reihenfolge einhalten, dann greift jeder Schritt in den nächsten.

---

## 1. Supabase-Projekt anlegen

1. Auf **supabase.com** ein Konto anlegen (Anmeldung mit GitHub ist am schnellsten).
2. **New Project**:
   - *Name:* `court-report`
   - *Database Password:* ein langes Zufallspasswort erzeugen und **im Passwortmanager speichern**. Du brauchst es später nur bei direktem Datenbankzugriff, aber es lässt sich nicht mehr anzeigen.
   - *Region:* **Central EU (Frankfurt)** — kürzeste Wege, und die Daten bleiben in Deutschland.
   - *Plan:* Free reicht für diesen Zweck deutlich aus.
3. Das Anlegen dauert ein bis zwei Minuten.

## 2. Tabellen anlegen

1. Links im Menü **SQL Editor** öffnen, **New query**.
2. Den kompletten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) hineinkopieren und **Run** drücken.
   Erwartete Rückmeldung: „Success. No rows returned."
3. Neue Query öffnen, den Inhalt von [`supabase/seed.sql`](supabase/seed.sql) einfügen, **Run**.
   Erwartete Rückmeldung: eine Tabelle mit **6 Zeilen**, Platz 1 bis 6.

Beide Dateien lassen sich gefahrlos mehrfach ausführen. `seed.sql` löscht die alten Testdaten vorher weg.

## 3. Zugangsdaten kopieren

**Project Settings → API Keys**. Du brauchst drei Werte:

| In Supabase | Trägst du ein als |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key (erst nach Klick auf *Reveal* sichtbar) | `SUPABASE_SERVICE_ROLE_KEY` |

> **Zum service_role-Key:** das ist ein Generalschlüssel, der sämtliche Zugriffsregeln der Datenbank umgeht. Er gehört ausschließlich in `.env.local` auf deinem Rechner und in die Vercel-Einstellungen. Nie in eine Datei, die ins Repo geht, nie in eine Chatnachricht, nie in den Browser. Die beiden anderen Werte sind unkritisch und dürfen öffentlich sein.

Die Werte trägst du in die Datei **`.env.local`** im Projektordner ein — die liegt schon dort und ist von Git ausgenommen.

## 4. Lokal ausprobieren

```bash
npm run dev
```

`http://localhost:3000` öffnen. Erwartetes Bild: oben groß **Hochheim 1 : 1 TC Flörsheim**, darunter sechs Platzkarten — vier laufende zuerst, die beiden beendeten abgesetzt darunter.

---

## 5. GitHub-Repo

1. Auf github.com ein **neues, privates** Repo anlegen, z.B. `court-report`.
   **Nichts ankreuzen** — kein README, keine `.gitignore`, keine Lizenz. Das liegt alles schon lokal.
2. Die angezeigte Repo-Adresse (`https://github.com/…/court-report.git`) an mich weitergeben, dann verbinde und pushe ich. Oder selbst:

```bash
git remote add origin https://github.com/DEINNAME/court-report.git
git branch -M main
git push -u origin main
```

## 6. Vercel

1. **Add New… → Project**, das GitHub-Repo importieren. Vercel erkennt Next.js selbst — an den Build-Einstellungen nichts ändern.
2. Noch **vor** dem ersten Deploy unter *Environment Variables* diese sechs Einträge anlegen, jeweils für **Production, Preview und Development**:

   | Name | Wert |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | wie in `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | wie in `.env.local` |
   | `SUPABASE_SERVICE_ROLE_KEY` | wie in `.env.local` |
   | `NEXT_PUBLIC_BASE_URL` | vorerst leer lassen, siehe Punkt 3 |
   | `CLUB_PIN` | vierstellige Zahl, die im Club herumgereicht wird |
   | `ADMIN_PIN` | längere Zahl, nur für die Handvoll Leute, die Spieltage anlegen |

   Die beiden PINs werden erst ab Etappe 3 abgefragt. Jetzt anlegen spart dir später einen zweiten Durchgang.
3. **Deploy** drücken. Danach zeigt Vercel dir die vergebene Adresse, etwa `court-report-xyz.vercel.app`. Diese Adresse als `NEXT_PUBLIC_BASE_URL` eintragen und einmal **Redeploy** auslösen.

---

## 7. Eigene Subdomain (kann warten)

Erst wenn alles läuft — die QR-Schilder werden erst danach gedruckt.

1. In Vercel: **Project → Settings → Domains → Add**, dort `live.euredomain.de` eintragen.
2. Vercel zeigt daraufhin den exakten DNS-Eintrag an. Bei einer Subdomain ist das ein:

   | Typ | Name | Ziel |
   |---|---|---|
   | `CNAME` | `live` | `cname.vercel-dns.com` |

   Den legst du beim Anbieter an, bei dem eure Clubdomain liegt. Falls Vercel dort einen anderen Zielwert anzeigt: **den nehmen**, der ist projektabhängig.
3. Die Verbreitung dauert meist Minuten, im Extremfall Stunden. Das TLS-Zertifikat stellt Vercel danach von selbst aus.
4. Zum Schluss `NEXT_PUBLIC_BASE_URL` auf `https://live.euredomain.de` umstellen und neu deployen.

Ab dann ändert sich an der App nichts mehr, wenn die Domain wechselt — sämtliche QR-Codes werden aus dieser einen Variable gebaut.

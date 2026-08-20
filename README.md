# Live-Ergebnisse TC Hochheim

Kleine Web-App, mit der Vorbeigehende den Spielstand auf den hinteren Plätzen
eintragen und alle auf der Terrasse ihn live sehen. Kein Login, keine Installation.

- Fachliche Vorgaben und Etappenplan: [`claude.md`](claude.md)
- Einrichtung von Supabase, GitHub und Vercel: [`SETUP.md`](SETUP.md)

## Lokal starten

```bash
npm install
npm run dev
```

Vorher `.env.local` mit den Supabase-Zugangsdaten füllen — Vorlage ist `.env.example`.

## Seiten

| Seite | Zweck | Stand |
|---|---|---|
| `/live` | Terrassen-Ansicht, frei zugänglich | Etappe 1: statisch, Realtime folgt |
| `/eingeben` | Stand eintragen, mit Club-PIN | Etappe 3 |
| `/admin` | Spieltag verwalten | Etappe 4 |
| `/archiv` | vergangene Spieltage | Etappe 5 |

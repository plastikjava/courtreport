-- ============================================================
-- Live-Ergebnisse Tennisclub Hochheim - Datenbankschema
-- Einfuegen im Supabase SQL-Editor und einmal ausfuehren.
-- Laesst sich gefahrlos erneut ausfuehren.
-- ============================================================

-- ------------------------------------------------------------
-- Tabelle: spieltag
-- ------------------------------------------------------------
create table if not exists public.spieltag (
  id          uuid primary key default gen_random_uuid(),
  datum       date        not null default current_date,
  -- "typ" und "titel" sind fuer spaetere Clubturniere vorbereitet.
  -- Sie bleiben vorerst auf "medenspiel" bzw. leer und werden nirgends angezeigt.
  typ         text        not null default 'medenspiel'
                          check (typ in ('medenspiel', 'turnier')),
  titel       text,
  mannschaft  text        not null,
  gegner      text        not null,
  status      text        not null default 'geplant'
                          check (status in ('geplant', 'laeuft', 'beendet')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabelle: partie
-- ------------------------------------------------------------
create table if not exists public.partie (
  id           uuid primary key default gen_random_uuid(),
  spieltag_id  uuid        not null references public.spieltag(id) on delete cascade,
  -- Die Anlage hat 9 Plaetze.
  platz_nr     int         not null check (platz_nr between 1 and 9),
  disziplin    text        not null,                    -- z.B. "Einzel 3", "Doppel 1"
  runde        text        not null check (runde in ('einzel', 'doppel')),
  reihenfolge  int         not null default 0,          -- fuer stabile Sortierung
  status       text        not null default 'offen'
                           check (status in ('offen', 'laeuft', 'beendet')),
  -- Satzergebnisse als Liste von Paaren [heim, gast], z.B. [[6,4],[3,6],[10,7]]
  saetze       jsonb       not null default '[]'::jsonb,
  -- Punktestand im laufenden Game. Im Tiebreak stehen hier die Tiebreak-Punkte ("7").
  game_heim    text        not null default '0',
  game_gast    text        not null default '0',
  ist_tiebreak boolean     not null default false,
  ist_match_tb boolean     not null default false,
  -- nullable, nur fuer spaetere Turniere. Im Medenspiel immer leer.
  name_heim    text,
  name_gast    text,
  updated_at   timestamptz not null default now(),
  updated_by   text                                     -- freiwilliger Spitzname
);

create index if not exists partie_spieltag_reihenfolge_idx
  on public.partie (spieltag_id, reihenfolge, platz_nr);

create index if not exists partie_platz_idx
  on public.partie (spieltag_id, platz_nr, status);

create index if not exists spieltag_status_idx
  on public.spieltag (status, datum desc);

-- ------------------------------------------------------------
-- Tabelle: aenderung  (Audit-Log fuer Undo und Korrekturen)
-- ------------------------------------------------------------
create table if not exists public.aenderung (
  id          uuid primary key default gen_random_uuid(),
  partie_id   uuid        not null references public.partie(id) on delete cascade,
  vorher      jsonb,
  nachher     jsonb,
  quelle      text        not null default 'unbekannt',
  created_at  timestamptz not null default now()
);

create index if not exists aenderung_partie_idx
  on public.aenderung (partie_id, created_at desc);

-- ------------------------------------------------------------
-- updated_at automatisch setzen.
-- Ohne diesen Trigger stimmt das "vor 3 Min" auf /live nicht.
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists partie_updated_at on public.partie;
create trigger partie_updated_at
  before update on public.partie
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Zugriffsschutz (RLS)
--
-- Grundregel: Der oeffentliche anon-Key darf ausschliesslich LESEN,
-- und zwar nur Spieltage und Partien. Geschrieben wird nur serverseitig
-- mit dem service_role-Key, der RLS umgeht und nie im Browser landet.
-- ------------------------------------------------------------
alter table public.spieltag  enable row level security;
alter table public.partie    enable row level security;
alter table public.aenderung enable row level security;

drop policy if exists "spieltag oeffentlich lesbar" on public.spieltag;
create policy "spieltag oeffentlich lesbar"
  on public.spieltag for select
  to anon, authenticated
  using (true);

drop policy if exists "partie oeffentlich lesbar" on public.partie;
create policy "partie oeffentlich lesbar"
  on public.partie for select
  to anon, authenticated
  using (true);

-- Tabellenrechte explizit vergeben, statt sie pauschal zu erben.
-- Wirkt zusaetzlich zu RLS: die oeffentlichen Rollen bekommen ausschliesslich
-- Leserechte, und das Audit-Log ueberhaupt keine.
grant usage on schema public to anon, authenticated;

grant select on public.spieltag to anon, authenticated;
grant select on public.partie   to anon, authenticated;
revoke insert, update, delete on public.spieltag from anon, authenticated;
revoke insert, update, delete on public.partie   from anon, authenticated;

revoke all on public.aenderung from anon, authenticated;

-- Die Server-Rolle braucht volle Rechte: ueber sie laufen ab Etappe 3 alle
-- Schreibvorgaenge. Sie ist nur serverseitig erreichbar, nie im Browser.
grant usage on schema public to service_role;
grant all on public.spieltag  to service_role;
grant all on public.partie    to service_role;
grant all on public.aenderung to service_role;

-- Fuer "aenderung" gibt es bewusst keine Policy:
-- das Audit-Log ist von aussen weder les- noch schreibbar.

-- ------------------------------------------------------------
-- Realtime (wird ab Etappe 2 genutzt)
-- ------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.partie;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.spieltag;
  exception when duplicate_object then null;
  end;
end
$$;

-- Damit Realtime-Updates auch den vorherigen Zeilenstand mitliefern.
alter table public.partie   replica identity full;
alter table public.spieltag replica identity full;

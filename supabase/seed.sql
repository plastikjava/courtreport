-- ============================================================
-- Testdaten fuer Etappe 1.
-- Nach schema.sql im Supabase SQL-Editor ausfuehren.
-- Legt einen laufenden Spieltag mit sechs Einzeln an.
-- Erneutes Ausfuehren ersetzt die Testdaten (löscht sie vorher).
-- ============================================================

delete from public.spieltag where gegner = 'TC Flörsheim';

with neuer_spieltag as (
  insert into public.spieltag (datum, typ, mannschaft, gegner, status)
  values (current_date, 'medenspiel', 'Herren 40', 'TC Flörsheim', 'laeuft')
  returning id
)
insert into public.partie
  (spieltag_id, platz_nr, disziplin, runde, reihenfolge, status,
   saetze, game_heim, game_gast, ist_tiebreak, ist_match_tb, updated_at, updated_by)
select id, v.* from neuer_spieltag, (values
  -- beendet: Hochheim gewinnt in zwei Saetzen
  (1, 'Einzel 1', 'einzel', 1, 'beendet',
   '[[6,3],[6,4]]'::jsonb,      '0',  '0',  false, false, now() - interval '35 minutes', 'Uwe'),
  -- beendet: Gast gewinnt in zwei Saetzen
  (2, 'Einzel 2', 'einzel', 2, 'beendet',
   '[[4,6],[2,6]]'::jsonb,      '0',  '0',  false, false, now() - interval '22 minutes', 'Uwe'),
  -- laeuft: normaler Spielstand
  (3, 'Einzel 3', 'einzel', 3, 'laeuft',
   '[[6,4],[3,2]]'::jsonb,      '40', '30', false, false, now() - interval '2 minutes',  'Uwe'),
  -- laeuft: Gast fuehrt
  (4, 'Einzel 4', 'einzel', 4, 'laeuft',
   '[[5,7],[4,5]]'::jsonb,      '0',  '15', false, false, now() - interval '6 minutes',  null),
  -- laeuft: Tiebreak im zweiten Satz bei 6:6
  (5, 'Einzel 5', 'einzel', 5, 'laeuft',
   '[[7,6],[6,6]]'::jsonb,      '4',  '5',  true,  false, now() - interval '1 minute',   'Bine'),
  -- laeuft: Match-Tiebreak bis 10 statt drittem Satz
  (6, 'Einzel 6', 'einzel', 6, 'laeuft',
   '[[6,2],[3,6]]'::jsonb,      '8',  '6',  false, true,  now() - interval '45 seconds', 'Bine')
) as v(platz_nr, disziplin, runde, reihenfolge, status,
       saetze, game_heim, game_gast, ist_tiebreak, ist_match_tb, updated_at, updated_by);

-- Kontrolle: sollte 6 Zeilen zeigen
select p.platz_nr, p.disziplin, p.status, p.saetze, p.game_heim, p.game_gast
from public.partie p
join public.spieltag s on s.id = p.spieltag_id
where s.status = 'laeuft'
order by p.platz_nr;

import "server-only";
import { supabaseSchreiben } from "@/lib/supabase/server";
import type { Partie } from "@/lib/typen";

/*
  Schreiben und Protokollieren an einer Stelle.

  Jede Änderung an einer Partie läuft hier durch - egal ob sie von der
  Eingabe am Platz oder aus dem Admin kommt. So kann das Audit-Log nicht
  vergessen werden, und "Rückgängig" findet immer einen Eintrag vor.
*/

export type Ergebnis =
  | { ok: true; partie: Partie; aenderungId: string | null }
  | { ok: false; fehler: string; pinFalsch?: boolean };

/** Die Felder, die im Protokoll festgehalten werden. */
export function schnappschuss(partie: Partie) {
  return {
    saetze: partie.saetze,
    game_heim: partie.game_heim,
    game_gast: partie.game_gast,
    ist_tiebreak: partie.ist_tiebreak,
    ist_match_tb: partie.ist_match_tb,
    status: partie.status,
  };
}

export async function partieHolen(partieId: string): Promise<Partie | null> {
  const supabase = supabaseSchreiben();
  const { data } = await supabase
    .from("partie")
    .select("*")
    .eq("id", partieId)
    .maybeSingle<Partie>();
  return data ?? null;
}

/**
 * Ändert eine Partie und schreibt Vorher und Nachher ins Protokoll.
 *
 * "quelle" ist der freiwillige Spitzname oder "unbekannt".
 */
export async function schreibenUndProtokollieren(
  partieId: string,
  vorher: Partie,
  aenderung: Record<string, unknown>,
  quelle: string,
): Promise<Ergebnis> {
  const supabase = supabaseSchreiben();

  const { data: nachher, error } = await supabase
    .from("partie")
    .update(aenderung)
    .eq("id", partieId)
    .select("*")
    .maybeSingle<Partie>();

  if (error) return { ok: false, fehler: error.message };
  if (!nachher) return { ok: false, fehler: "Das Speichern hat nicht geklappt." };

  const { data: protokoll } = await supabase
    .from("aenderung")
    .insert({
      partie_id: partieId,
      vorher: schnappschuss(vorher),
      nachher: schnappschuss(nachher),
      quelle: quelle.trim() || "unbekannt",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  return { ok: true, partie: nachher, aenderungId: protokoll?.id ?? null };
}

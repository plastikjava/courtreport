'use server';

import { clubPinStimmt } from '@/lib/pin';
import { supabaseSchreiben } from '@/lib/supabase/server';
import { angleichen, type Spielstand } from '@/lib/tennis';
import type { GamePunkt, Partie, Satz } from '@/lib/typen';

/*
  Alle Schreibzugriffe laufen ueber diese Datei. Sie prueft die Club-PIN
  serverseitig und schreibt mit dem Secret Key, der nie im Browser landet.
  Jede Aenderung wird protokolliert, damit "Rueckgaengig" und spaetere
  Korrekturen im Admin moeglich sind.
*/

export type Ergebnis =
  | { ok: true; partie: Partie; aenderungId: string | null }
  | { ok: false; fehler: string; pinFalsch?: boolean };

const ERLAUBTE_PUNKTE = new Set(['0', '15', '30', '40', 'A']);

/** Die Felder, die im Protokoll landen. */
function schnappschuss(partie: Partie) {
  return {
    saetze: partie.saetze,
    game_heim: partie.game_heim,
    game_gast: partie.game_gast,
    ist_tiebreak: partie.ist_tiebreak,
    ist_match_tb: partie.ist_match_tb,
    status: partie.status,
  };
}

function saetzePruefen(roh: unknown): Satz[] | null {
  if (!Array.isArray(roh) || roh.length > 5) return null;
  const saetze: Satz[] = [];
  for (const eintrag of roh) {
    if (!Array.isArray(eintrag) || eintrag.length !== 2) return null;
    const [a, b] = eintrag;
    if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
    if (a < 0 || b < 0 || a > 99 || b > 99) return null;
    saetze.push([a, b]);
  }
  return saetze;
}

function punktPruefen(wert: unknown, numerisch: boolean): GamePunkt | null {
  if (typeof wert !== 'string') return null;
  if (numerisch) {
    const n = Number(wert);
    return Number.isInteger(n) && n >= 0 && n <= 99 ? String(n) : null;
  }
  return ERLAUBTE_PUNKTE.has(wert) ? wert : null;
}

/** Nur pruefen, ob die PIN stimmt - fuer die einmalige Abfrage. */
export async function pinPruefen(pin: string): Promise<boolean> {
  return clubPinStimmt(pin);
}

export type StandEingabe = {
  partieId: string;
  pin: string;
  spitzname: string;
  saetze: unknown;
  gameHeim: unknown;
  gameGast: unknown;
  istTiebreak: boolean;
  istMatchTb: boolean;
};

/** Den aktuellen Stand einer Partie setzen. */
export async function standSpeichern(eingabe: StandEingabe): Promise<Ergebnis> {
  if (!clubPinStimmt(eingabe.pin)) {
    return { ok: false, fehler: 'Die PIN stimmt nicht.', pinFalsch: true };
  }

  const saetze = saetzePruefen(eingabe.saetze);
  if (!saetze) return { ok: false, fehler: 'Die Satzergebnisse sind ungültig.' };

  const numerisch = eingabe.istTiebreak || eingabe.istMatchTb;
  const gameHeim = punktPruefen(eingabe.gameHeim, numerisch);
  const gameGast = punktPruefen(eingabe.gameGast, numerisch);
  if (gameHeim === null || gameGast === null) {
    return { ok: false, fehler: 'Der Punktestand ist ungültig.' };
  }

  const supabase = supabaseSchreiben();
  const { data: vorher, error: ladefehler } = await supabase
    .from('partie')
    .select('*')
    .eq('id', eingabe.partieId)
    .maybeSingle<Partie>();

  if (ladefehler) return { ok: false, fehler: ladefehler.message };
  if (!vorher) return { ok: false, fehler: 'Diese Partie gibt es nicht mehr.' };

  const stand: Spielstand = angleichen({
    saetze,
    game_heim: gameHeim,
    game_gast: gameGast,
    ist_tiebreak: eingabe.istTiebreak,
    ist_match_tb: eingabe.istMatchTb,
  });

  const neu = {
    ...stand,
    // Wer auf eine noch offene Partie den ersten Stand setzt, startet sie damit.
    status: vorher.status === 'offen' ? 'laeuft' : vorher.status,
    updated_by: eingabe.spitzname.trim() || null,
  };

  return schreiben(eingabe.partieId, vorher, neu, eingabe.spitzname);
}

/** Die Partie abschliessen. */
export async function partieBeenden(
  partieId: string,
  pin: string,
  spitzname: string,
): Promise<Ergebnis> {
  if (!clubPinStimmt(pin)) {
    return { ok: false, fehler: 'Die PIN stimmt nicht.', pinFalsch: true };
  }

  const supabase = supabaseSchreiben();
  const { data: vorher, error } = await supabase
    .from('partie')
    .select('*')
    .eq('id', partieId)
    .maybeSingle<Partie>();

  if (error) return { ok: false, fehler: error.message };
  if (!vorher) return { ok: false, fehler: 'Diese Partie gibt es nicht mehr.' };

  return schreiben(
    partieId,
    vorher,
    { status: 'beendet', updated_by: spitzname.trim() || null },
    spitzname,
  );
}

/** Die letzte Aenderung zuruecknehmen. */
export async function aenderungZurueck(
  partieId: string,
  aenderungId: string,
  pin: string,
  spitzname: string,
): Promise<Ergebnis> {
  if (!clubPinStimmt(pin)) {
    return { ok: false, fehler: 'Die PIN stimmt nicht.', pinFalsch: true };
  }

  const supabase = supabaseSchreiben();
  const { data: eintrag, error } = await supabase
    .from('aenderung')
    .select('*')
    .eq('id', aenderungId)
    .eq('partie_id', partieId)
    .maybeSingle<{ id: string; vorher: Record<string, unknown> | null }>();

  if (error) return { ok: false, fehler: error.message };
  if (!eintrag?.vorher) {
    return { ok: false, fehler: 'Zu dieser Änderung gibt es nichts zurückzunehmen.' };
  }

  const { data: jetzt } = await supabase
    .from('partie')
    .select('*')
    .eq('id', partieId)
    .maybeSingle<Partie>();

  if (!jetzt) return { ok: false, fehler: 'Diese Partie gibt es nicht mehr.' };

  return schreiben(partieId, jetzt, eintrag.vorher, spitzname);
}

/** Schreiben und protokollieren - an einer Stelle, damit nichts vergessen wird. */
async function schreiben(
  partieId: string,
  vorher: Partie,
  aenderung: Record<string, unknown>,
  spitzname: string,
): Promise<Ergebnis> {
  const supabase = supabaseSchreiben();

  const { data: nachher, error } = await supabase
    .from('partie')
    .update(aenderung)
    .eq('id', partieId)
    .select('*')
    .maybeSingle<Partie>();

  if (error) return { ok: false, fehler: error.message };
  if (!nachher) return { ok: false, fehler: 'Das Speichern hat nicht geklappt.' };

  const { data: protokoll } = await supabase
    .from('aenderung')
    .insert({
      partie_id: partieId,
      vorher: schnappschuss(vorher),
      nachher: schnappschuss(nachher),
      quelle: spitzname.trim() || 'unbekannt',
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  return { ok: true, partie: nachher, aenderungId: protokoll?.id ?? null };
}


"use server";

import { clubPinStimmt } from "@/lib/pin";
import {
  partieHolen,
  schreibenUndProtokollieren,
  type Ergebnis,
} from "@/lib/protokoll";
import { supabaseSchreiben } from "@/lib/supabase/server";
import { angleichen, type Spielstand } from "@/lib/tennis";
import type { GamePunkt, Satz } from "@/lib/typen";

/*
  Alle Schreibzugriffe von /eingeben laufen über diese Datei. Sie prüft die
  Club-PIN serverseitig und schreibt mit dem Secret Key, der nie im Browser
  landet. Protokolliert wird in schreibenUndProtokollieren().
*/

export type { Ergebnis };

const ERLAUBTE_PUNKTE = new Set(["0", "15", "30", "40", "A"]);

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
  if (typeof wert !== "string") return null;
  if (numerisch) {
    const n = Number(wert);
    return Number.isInteger(n) && n >= 0 && n <= 99 ? String(n) : null;
  }
  return ERLAUBTE_PUNKTE.has(wert) ? wert : null;
}

/** Nur prüfen, ob die PIN stimmt - für die einmalige Abfrage. */
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
    return { ok: false, fehler: "Die PIN stimmt nicht.", pinFalsch: true };
  }

  const saetze = saetzePruefen(eingabe.saetze);
  if (!saetze) return { ok: false, fehler: "Die Satzergebnisse sind ungültig." };

  const numerisch = eingabe.istTiebreak || eingabe.istMatchTb;
  const gameHeim = punktPruefen(eingabe.gameHeim, numerisch);
  const gameGast = punktPruefen(eingabe.gameGast, numerisch);
  if (gameHeim === null || gameGast === null) {
    return { ok: false, fehler: "Der Punktestand ist ungültig." };
  }

  const vorher = await partieHolen(eingabe.partieId);
  if (!vorher) return { ok: false, fehler: "Diese Partie gibt es nicht mehr." };

  const stand: Spielstand = angleichen({
    saetze,
    game_heim: gameHeim,
    game_gast: gameGast,
    ist_tiebreak: eingabe.istTiebreak,
    ist_match_tb: eingabe.istMatchTb,
  });

  return schreibenUndProtokollieren(
    eingabe.partieId,
    vorher,
    {
      ...stand,
      // Wer auf eine noch offene Partie den ersten Stand setzt, startet sie damit.
      status: vorher.status === "offen" ? "laeuft" : vorher.status,
      updated_by: eingabe.spitzname.trim() || null,
    },
    eingabe.spitzname,
  );
}

/** Die Partie abschließen. */
export async function partieBeenden(
  partieId: string,
  pin: string,
  spitzname: string,
): Promise<Ergebnis> {
  if (!clubPinStimmt(pin)) {
    return { ok: false, fehler: "Die PIN stimmt nicht.", pinFalsch: true };
  }

  const vorher = await partieHolen(partieId);
  if (!vorher) return { ok: false, fehler: "Diese Partie gibt es nicht mehr." };

  return schreibenUndProtokollieren(
    partieId,
    vorher,
    { status: "beendet", updated_by: spitzname.trim() || null },
    spitzname,
  );
}

/** Die letzte Änderung zurücknehmen. */
export async function aenderungZurueck(
  partieId: string,
  aenderungId: string,
  pin: string,
  spitzname: string,
): Promise<Ergebnis> {
  if (!clubPinStimmt(pin)) {
    return { ok: false, fehler: "Die PIN stimmt nicht.", pinFalsch: true };
  }

  const supabase = supabaseSchreiben();
  const { data: eintrag, error } = await supabase
    .from("aenderung")
    .select("id, vorher")
    .eq("id", aenderungId)
    .eq("partie_id", partieId)
    .maybeSingle<{ id: string; vorher: Record<string, unknown> | null }>();

  if (error) return { ok: false, fehler: error.message };
  if (!eintrag?.vorher) {
    return { ok: false, fehler: "Zu dieser Änderung gibt es nichts zurückzunehmen." };
  }

  const jetzt = await partieHolen(partieId);
  if (!jetzt) return { ok: false, fehler: "Diese Partie gibt es nicht mehr." };

  return schreibenUndProtokollieren(partieId, jetzt, eintrag.vorher, spitzname);
}

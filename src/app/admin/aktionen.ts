"use server";

import { adminPinStimmt } from "@/lib/pin";
import { partieHolen, schreibenUndProtokollieren } from "@/lib/protokoll";
import { supabaseSchreiben } from "@/lib/supabase/server";
import { ANZAHL_PLAETZE, type Aenderung, type Partie, type Spieltag } from "@/lib/typen";

/*
  Der Admin-Bereich. Alles hier verlangt die längere ADMIN_PIN, die
  serverseitig geprüft wird. Auch das Lesen läuft über diese Aktionen -
  das Änderungsprotokoll ist von außen sonst gar nicht zugänglich.
*/

export type AdminErgebnis<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { daten?: undefined } : { daten: T }))
  | { ok: false; fehler: string; pinFalsch?: boolean };

const PIN_FALSCH = { ok: false as const, fehler: "Die Admin-PIN stimmt nicht.", pinFalsch: true };

export async function adminPinPruefen(pin: string): Promise<boolean> {
  return adminPinStimmt(pin);
}

/** Alle Spieltage, neueste zuerst. */
export async function spieltageLaden(pin: string): Promise<AdminErgebnis<Spieltag[]>> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const supabase = supabaseSchreiben();
  const { data, error } = await supabase
    .from("spieltag")
    .select("*")
    .order("datum", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Spieltag[]>();

  if (error) return { ok: false, fehler: error.message };
  return { ok: true, daten: data ?? [] };
}

export type SpieltagDetails = {
  spieltag: Spieltag;
  partien: Partie[];
  aenderungen: Aenderung[];
};

/** Ein Spieltag mit allen Partien und dem Änderungsprotokoll. */
export async function spieltagDetails(
  pin: string,
  spieltagId: string,
): Promise<AdminErgebnis<SpieltagDetails>> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const supabase = supabaseSchreiben();

  const { data: spieltag } = await supabase
    .from("spieltag")
    .select("*")
    .eq("id", spieltagId)
    .maybeSingle<Spieltag>();

  if (!spieltag) return { ok: false, fehler: "Diesen Spieltag gibt es nicht." };

  const { data: partien } = await supabase
    .from("partie")
    .select("*")
    .eq("spieltag_id", spieltagId)
    .order("reihenfolge", { ascending: true })
    .returns<Partie[]>();

  const ids = (partien ?? []).map((p) => p.id);
  let aenderungen: Aenderung[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("aenderung")
      .select("*")
      .in("partie_id", ids)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Aenderung[]>();
    aenderungen = data ?? [];
  }

  return { ok: true, daten: { spieltag, partien: partien ?? [], aenderungen } };
}

export type NeuerSpieltag = {
  datum: string;
  mannschaft: string;
  gegner: string;
  anzahlEinzel: number;
  plaetze: number[];
};

/** Wie viele Doppel gehören zu wie vielen Einzeln? */
function anzahlDoppel(anzahlEinzel: number): number {
  return anzahlEinzel >= 6 ? 3 : 2;
}

function plaetzePruefen(plaetze: unknown, mindestens: number): number[] | null {
  if (!Array.isArray(plaetze)) return null;
  const sauber = [...new Set(plaetze)]
    .filter((p): p is number => Number.isInteger(p) && p >= 1 && p <= ANZAHL_PLAETZE)
    .sort((a, b) => a - b);
  return sauber.length >= mindestens ? sauber : null;
}

/** Spieltag anlegen und die Einzel auf die gewählten Plätze verteilen. */
export async function spieltagAnlegen(
  pin: string,
  eingabe: NeuerSpieltag,
): Promise<AdminErgebnis<{ id: string }>> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const mannschaft = eingabe.mannschaft.trim();
  const gegner = eingabe.gegner.trim();
  if (!mannschaft) return { ok: false, fehler: "Bitte die Mannschaft eintragen." };
  if (!gegner) return { ok: false, fehler: "Bitte den Gegner eintragen." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eingabe.datum)) {
    return { ok: false, fehler: "Bitte ein Datum wählen." };
  }

  const anzahlEinzel = eingabe.anzahlEinzel === 6 ? 6 : 4;
  const plaetze = plaetzePruefen(eingabe.plaetze, anzahlEinzel);
  if (!plaetze) {
    return {
      ok: false,
      fehler: `Bitte mindestens ${anzahlEinzel} Plätze auswählen — die Einzel laufen gleichzeitig.`,
    };
  }

  const supabase = supabaseSchreiben();

  const { data: spieltag, error } = await supabase
    .from("spieltag")
    .insert({
      datum: eingabe.datum,
      typ: "medenspiel",
      mannschaft,
      gegner,
      status: "geplant",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return { ok: false, fehler: error.message };
  if (!spieltag) return { ok: false, fehler: "Der Spieltag konnte nicht angelegt werden." };

  const partien = Array.from({ length: anzahlEinzel }, (_, i) => ({
    spieltag_id: spieltag.id,
    platz_nr: plaetze[i],
    disziplin: `Einzel ${i + 1}`,
    runde: "einzel",
    reihenfolge: i + 1,
    status: "offen",
  }));

  const { error: partienFehler } = await supabase.from("partie").insert(partien);
  if (partienFehler) return { ok: false, fehler: partienFehler.message };

  return { ok: true, daten: { id: spieltag.id } };
}

/** Die Doppel anlegen, sobald die Einzel durch sind. */
export async function doppelAnlegen(
  pin: string,
  spieltagId: string,
  plaetze: number[],
): Promise<AdminErgebnis<{ anzahl: number }>> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const supabase = supabaseSchreiben();
  const { data: vorhanden } = await supabase
    .from("partie")
    .select("id, runde")
    .eq("spieltag_id", spieltagId)
    .returns<{ id: string; runde: string }[]>();

  const einzel = (vorhanden ?? []).filter((p) => p.runde === "einzel").length;
  if (einzel === 0) return { ok: false, fehler: "Zu diesem Spieltag gibt es keine Einzel." };
  if ((vorhanden ?? []).some((p) => p.runde === "doppel")) {
    return { ok: false, fehler: "Die Doppel sind schon angelegt." };
  }

  const anzahl = anzahlDoppel(einzel);
  const gewaehlt = plaetzePruefen(plaetze, anzahl);
  if (!gewaehlt) {
    return { ok: false, fehler: `Bitte mindestens ${anzahl} Plätze auswählen.` };
  }

  const partien = Array.from({ length: anzahl }, (_, i) => ({
    spieltag_id: spieltagId,
    platz_nr: gewaehlt[i],
    disziplin: `Doppel ${i + 1}`,
    runde: "doppel",
    // Deutlich hinter den Einzeln, damit die Sortierung stimmt.
    reihenfolge: 100 + i + 1,
    status: "offen",
  }));

  const { error } = await supabase.from("partie").insert(partien);
  if (error) return { ok: false, fehler: error.message };

  return { ok: true, daten: { anzahl } };
}

/**
 * Den Spieltag starten, pausieren oder archivieren.
 *
 * /live und /eingeben suchen immer den Spieltag mit Status "laeuft".
 * Es kann deshalb nur einer gleichzeitig laufen.
 */
export async function spieltagStatusSetzen(
  pin: string,
  spieltagId: string,
  status: "geplant" | "laeuft" | "beendet",
): Promise<AdminErgebnis> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const supabase = supabaseSchreiben();

  if (status === "laeuft") {
    const { data: laufende } = await supabase
      .from("spieltag")
      .select("id, mannschaft, gegner")
      .eq("status", "laeuft")
      .neq("id", spieltagId)
      .returns<{ id: string; mannschaft: string; gegner: string }[]>();

    if (laufende && laufende.length > 0) {
      const andere = laufende[0];
      return {
        ok: false,
        fehler: `Es läuft schon ein Spieltag (${andere.mannschaft} gegen ${andere.gegner}). Bitte den zuerst beenden.`,
      };
    }
  }

  const { error } = await supabase.from("spieltag").update({ status }).eq("id", spieltagId);
  if (error) return { ok: false, fehler: error.message };
  return { ok: true };
}

/** Eine einzelne Änderung aus dem Protokoll zurücknehmen. */
export async function aenderungZuruecknehmen(
  pin: string,
  aenderungId: string,
): Promise<AdminErgebnis> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const supabase = supabaseSchreiben();
  const { data: eintrag } = await supabase
    .from("aenderung")
    .select("partie_id, vorher")
    .eq("id", aenderungId)
    .maybeSingle<{ partie_id: string; vorher: Record<string, unknown> | null }>();

  if (!eintrag?.vorher) {
    return { ok: false, fehler: "Zu dieser Änderung gibt es nichts zurückzunehmen." };
  }

  const jetzt = await partieHolen(eintrag.partie_id);
  if (!jetzt) return { ok: false, fehler: "Diese Partie gibt es nicht mehr." };

  const ergebnis = await schreibenUndProtokollieren(
    eintrag.partie_id,
    jetzt,
    eintrag.vorher,
    "Admin",
  );

  if (!ergebnis.ok) return { ok: false, fehler: ergebnis.fehler };
  return { ok: true };
}

/** Einen Spieltag samt Partien und Protokoll löschen. Nur für Fehlanlagen. */
export async function spieltagLoeschen(
  pin: string,
  spieltagId: string,
): Promise<AdminErgebnis> {
  if (!adminPinStimmt(pin)) return PIN_FALSCH;

  const supabase = supabaseSchreiben();
  const { error } = await supabase.from("spieltag").delete().eq("id", spieltagId);
  if (error) return { ok: false, fehler: error.message };
  return { ok: true };
}

import { supabaseLesen } from './supabase/client';
import type { Partie, Spieltag } from './typen';

export type SpieltagMitPartien = {
  spieltag: Spieltag;
  partien: Partie[];
};

/**
 * Der Spieltag, der gerade laeuft, samt allen Partien.
 * Gibt null zurueck, wenn heute kein Spieltag laeuft - das ist kein Fehler,
 * sondern der Normalfall an den meisten Tagen.
 */
export async function laufenderSpieltag(): Promise<SpieltagMitPartien | null> {
  const supabase = supabaseLesen();

  const { data: spieltag, error } = await supabase
    .from('spieltag')
    .select('*')
    .eq('status', 'laeuft')
    .order('datum', { ascending: false })
    .limit(1)
    .maybeSingle<Spieltag>();

  if (error) throw error;
  if (!spieltag) return null;

  const { data: partien, error: partienFehler } = await supabase
    .from('partie')
    .select('*')
    .eq('spieltag_id', spieltag.id)
    .order('reihenfolge', { ascending: true })
    .order('platz_nr', { ascending: true })
    .returns<Partie[]>();

  if (partienFehler) throw partienFehler;

  return { spieltag, partien: partien ?? [] };
}

/** Der Spieltag, der gerade laeuft - ohne Partien. */
export async function aktiverSpieltag(): Promise<Spieltag | null> {
  const supabase = supabaseLesen();
  const { data, error } = await supabase
    .from('spieltag')
    .select('*')
    .eq('status', 'laeuft')
    .order('datum', { ascending: false })
    .limit(1)
    .maybeSingle<Spieltag>();

  if (error) throw error;
  return data ?? null;
}

export type PlatzLage = {
  spieltag: Spieltag;
  /** alle Partien, die heute auf diesem Platz vorgesehen sind */
  alle: Partie[];
  /** die Partien, die jetzt gemeint sein koennen: laufende zuerst, dann offene */
  kandidaten: Partie[];
};

/**
 * Welche Partie ist auf diesem Platz gemeint?
 *
 * Der QR-Code am Zaun enthaelt nur die Platznummer, nie eine Partie-ID -
 * die Schilder haengen dauerhaft, die Partie wechselt mehrmals am Tag.
 * Deshalb wird hier aufgeloest statt geraten.
 */
export async function lageAufPlatz(platzNr: number): Promise<PlatzLage | null> {
  const spieltag = await aktiverSpieltag();
  if (!spieltag) return null;

  const supabase = supabaseLesen();
  const { data, error } = await supabase
    .from('partie')
    .select('*')
    .eq('spieltag_id', spieltag.id)
    .eq('platz_nr', platzNr)
    .order('reihenfolge', { ascending: true })
    .returns<Partie[]>();

  if (error) throw error;

  const alle = data ?? [];
  const kandidaten = [
    ...alle.filter((p) => p.status === 'laeuft'),
    ...alle.filter((p) => p.status === 'offen'),
  ];

  return { spieltag, alle, kandidaten };
}

/** Eine einzelne Partie samt ihrem Spieltag. */
export async function partieLaden(
  partieId: string,
): Promise<{ partie: Partie; spieltag: Spieltag } | null> {
  const supabase = supabaseLesen();
  const { data: partie, error } = await supabase
    .from('partie')
    .select('*')
    .eq('id', partieId)
    .maybeSingle<Partie>();

  if (error) throw error;
  if (!partie) return null;

  const { data: spieltag, error: fehler } = await supabase
    .from('spieltag')
    .select('*')
    .eq('id', partie.spieltag_id)
    .maybeSingle<Spieltag>();

  if (fehler) throw fehler;
  if (!spieltag) return null;

  return { partie, spieltag };
}

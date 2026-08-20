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

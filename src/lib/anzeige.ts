import type { Partie, Spieltag } from './typen';
import { HEIMVEREIN } from './typen';

/**
 * Liefert die beiden Bezeichnungen, die auf einer Platzkarte stehen.
 *
 * Im Medenspiel ist das immer "Hochheim" gegen "Gast" - Spielernamen werden
 * bewusst nicht erfasst. Sind bei einer Partie Namen hinterlegt (spaeterer
 * Turniermodus), gelten diese.
 *
 * Diese Funktion ist die einzige Stelle, an der das entschieden wird.
 * In Komponenten steht nie ein hartkodiertes "Hochheim".
 */
export function beteiligte(partie: Partie): { heim: string; gast: string } {
  return {
    heim: partie.name_heim?.trim() || HEIMVEREIN,
    gast: partie.name_gast?.trim() || 'Gast',
  };
}

/**
 * Die beiden Mannschaftsnamen fuer den Gesamtstand ganz oben auf /live.
 */
export function mannschaften(spieltag: Spieltag): { heim: string; gast: string } {
  return { heim: HEIMVEREIN, gast: spieltag.gegner };
}

/** Ueberschrift einer Platzkarte, z.B. "Platz 5 · Einzel 4". */
export function platzTitel(partie: Partie): string {
  return `Platz ${partie.platz_nr} · ${partie.disziplin}`;
}

/** Datum als "Mi, 20. August 2026". */
export function datumLang(datum: string): string {
  return new Date(`${datum}T00:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

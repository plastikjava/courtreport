import type { Partie } from './typen';

/** Ab dieser Dauer ohne Aktualisierung gilt ein laufender Stand als veraltet. */
export const STALE_MINUTEN = 20;

/** Minuten seit dem Zeitpunkt, gerundet. */
export function minutenHer(zeitpunkt: string, jetzt: number = Date.now()): number {
  return Math.floor((jetzt - new Date(zeitpunkt).getTime()) / 60000);
}

/**
 * "gerade eben" / "vor 3 Min" / "vor 2 Std".
 * Ohne diese Angabe weiss auf der Terrasse niemand, ob ein Stand aktuell ist.
 */
export function vorZeit(zeitpunkt: string, jetzt: number = Date.now()): string {
  const minuten = minutenHer(zeitpunkt, jetzt);
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} Min`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std`;
  return `vor ${Math.floor(stunden / 24)} Tagen`;
}

/**
 * Eine laufende Partie, die seit ueber 20 Minuten nicht aktualisiert wurde.
 * Solche Staende werden auf /live ausgegraut - lieber ehrlich sagen, dass
 * ein Stand alt ist, als Aktualitaet vortaeuschen.
 */
export function istVeraltet(partie: Partie, jetzt: number = Date.now()): boolean {
  if (partie.status !== 'laeuft') return false;
  return minutenHer(partie.updated_at, jetzt) >= STALE_MINUTEN;
}

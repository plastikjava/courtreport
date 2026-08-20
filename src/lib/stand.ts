import type { Partie, Satz } from './typen';

/**
 * Wer hat einen einzelnen Satz gewonnen?
 * Gilt genauso fuer den Match-Tiebreak, der als Satz [10, 7] abgelegt wird.
 */
export function satzGewinner(satz: Satz): 'heim' | 'gast' | null {
  const [heim, gast] = satz;
  if (heim === gast) return null;
  return heim > gast ? 'heim' : 'gast';
}

/**
 * Wer hat die Partie gewonnen? Entschieden wird nach gewonnenen Saetzen.
 * Steht es nach den eingetragenen Saetzen unentschieden, gibt es keinen Sieger.
 */
export function partieSieger(partie: Partie): 'heim' | 'gast' | null {
  let heim = 0;
  let gast = 0;
  for (const satz of partie.saetze ?? []) {
    const gewinner = satzGewinner(satz);
    if (gewinner === 'heim') heim++;
    if (gewinner === 'gast') gast++;
  }
  if (heim === gast) return null;
  return heim > gast ? 'heim' : 'gast';
}

/**
 * Der Mannschaftsstand, z.B. 3:2.
 *
 * Wird immer aus den beendeten Partien gerechnet und nie gespeichert -
 * ein gespeicherter Zwischenstand laeuft frueher oder spaeter auseinander.
 */
export function gesamtstand(partien: Partie[]): { heim: number; gast: number } {
  let heim = 0;
  let gast = 0;
  for (const partie of partien) {
    if (partie.status !== 'beendet') continue;
    const sieger = partieSieger(partie);
    if (sieger === 'heim') heim++;
    if (sieger === 'gast') gast++;
  }
  return { heim, gast };
}

/**
 * Sortierung fuer /live: erst die laufenden Partien in Platzreihenfolge,
 * beendete danach.
 */
export function fuerLiveSortiert(partien: Partie[]): Partie[] {
  return [...partien].sort((a, b) => {
    const aFertig = a.status === 'beendet' ? 1 : 0;
    const bFertig = b.status === 'beendet' ? 1 : 0;
    if (aFertig !== bFertig) return aFertig - bFertig;
    if (a.platz_nr !== b.platz_nr) return a.platz_nr - b.platz_nr;
    return a.reihenfolge - b.reihenfolge;
  });
}

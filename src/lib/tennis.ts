import type { GamePunkt, Partie, Satz } from './typen';

/*
  Ablage der Ergebnisse, damit ueberall dieselbe Annahme gilt:

  - "saetze" enthaelt die gespielten Saetze als Paare [heim, gast].
    Der letzte Eintrag ist der laufende Satz, solange er noch nicht
    entschieden ist. Zwischen zwei Saetzen sind alle Eintraege entschieden.
  - Im Tiebreak stehen die Tiebreak-Punkte in game_heim/game_gast,
    der Satzstand bleibt bei 6:6, bis der Tiebreak durch ist.
  - Beim Match-Tiebreak stehen die Punkte ebenfalls in game_heim/game_gast,
    und "saetze" enthaelt nur die beiden regulaeren Saetze.
*/

/** Ist dieser Satz entschieden? Gilt auch fuer einen Match-Tiebreak bis 10. */
export function satzIstFertig(satz: Satz): boolean {
  const [heim, gast] = satz;
  const hoch = Math.max(heim, gast);
  const tief = Math.min(heim, gast);
  if (hoch >= 10 && hoch - tief >= 2) return true; // Match-Tiebreak
  if (hoch === 7 && tief === 6) return true; // Tiebreak
  return hoch >= 6 && hoch - tief >= 2;
}

/** Wie viele Saetze hat jede Seite sicher gewonnen? */
export function gewonneneSaetze(partie: Partie): { heim: number; gast: number } {
  let heim = 0;
  let gast = 0;
  for (const satz of partie.saetze ?? []) {
    if (!satzIstFertig(satz)) continue;
    if (satz[0] > satz[1]) heim++;
    else gast++;
  }
  return { heim, gast };
}

/** Der Satz, der gerade laeuft - oder null zwischen zwei Saetzen. */
export function laufenderSatz(partie: Partie): Satz | null {
  const saetze = partie.saetze ?? [];
  const letzter = saetze[saetze.length - 1];
  if (!letzter || satzIstFertig(letzter)) return null;
  return letzter;
}

/** Steht diese Seite einen Punkt vor dem Gewinn des laufenden Games? */
function gamePunktOffen(eigen: GamePunkt, fremd: GamePunkt): boolean {
  if (eigen === 'A') return true;
  return eigen === '40' && (fremd === '0' || fremd === '15' || fremd === '30');
}

/** Wuerde ein weiteres Spiel den Satz entscheiden? */
function spielEntscheidetSatz(eigeneSpiele: number, fremdeSpiele: number): boolean {
  const danach = eigeneSpiele + 1;
  return danach >= 6 && danach - fremdeSpiele >= 2;
}

/** Wuerde ein weiterer Punkt den Tiebreak entscheiden? */
function punktEntscheidetTiebreak(eigen: number, fremd: number, ziel: number): boolean {
  const danach = eigen + 1;
  return danach >= ziel && danach - fremd >= 2;
}

export type Spannung = {
  /** "Matchball", "Satzball" oder "Match-Tiebreak" */
  art: 'matchball' | 'satzball' | 'match-tiebreak';
  seite: 'heim' | 'gast' | null;
};

/**
 * Der Moment, in dem auf der Terrasse jemand aufsteht und hingeht:
 * Matchball, Satzball oder ein laufender Match-Tiebreak.
 *
 * Gibt null zurueck, wenn gerade nichts Besonderes ansteht.
 */
export function spannung(partie: Partie): Spannung | null {
  if (partie.status !== 'laeuft') return null;

  const saetze = gewonneneSaetze(partie);
  // Ein weiterer Satz entscheidet die Partie: bei uns gewinnt, wer zwei hat.
  const entscheidetPartie = (seite: 'heim' | 'gast') =>
    (seite === 'heim' ? saetze.heim : saetze.gast) + 1 >= 2;

  const punkteHeim = Number(partie.game_heim);
  const punkteGast = Number(partie.game_gast);

  // Match-Tiebreak: zaehlt selbst als Satz, entscheidet also die Partie.
  if (partie.ist_match_tb) {
    if (punktEntscheidetTiebreak(punkteHeim, punkteGast, 10)) {
      return { art: 'matchball', seite: 'heim' };
    }
    if (punktEntscheidetTiebreak(punkteGast, punkteHeim, 10)) {
      return { art: 'matchball', seite: 'gast' };
    }
    return { art: 'match-tiebreak', seite: null };
  }

  // Tiebreak im laufenden Satz.
  if (partie.ist_tiebreak) {
    for (const seite of ['heim', 'gast'] as const) {
      const eigen = seite === 'heim' ? punkteHeim : punkteGast;
      const fremd = seite === 'heim' ? punkteGast : punkteHeim;
      if (punktEntscheidetTiebreak(eigen, fremd, 7)) {
        return { art: entscheidetPartie(seite) ? 'matchball' : 'satzball', seite };
      }
    }
    return null;
  }

  // Normales Game im laufenden Satz.
  const satz = laufenderSatz(partie);
  if (!satz) return null;

  for (const seite of ['heim', 'gast'] as const) {
    const index = seite === 'heim' ? 0 : 1;
    const eigenesGame = seite === 'heim' ? partie.game_heim : partie.game_gast;
    const fremdesGame = seite === 'heim' ? partie.game_gast : partie.game_heim;

    if (!gamePunktOffen(eigenesGame, fremdesGame)) continue;
    if (!spielEntscheidetSatz(satz[index], satz[1 - index])) continue;

    return { art: entscheidetPartie(seite) ? 'matchball' : 'satzball', seite };
  }

  return null;
}

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

// ------------------------------------------------------------------
// Zaehlweise fuer den Punkt-Modus
//
// Gebraucht wird das nur, wenn sich jemand laenger an den Platz setzt und
// Punkt fuer Punkt mittippt. Der Normalfall bleibt "aktuellen Stand setzen".
// ------------------------------------------------------------------

/** Die Felder einer Partie, die sich beim Spielen aendern. */
export type Spielstand = {
  saetze: Satz[];
  game_heim: GamePunkt;
  game_gast: GamePunkt;
  ist_tiebreak: boolean;
  ist_match_tb: boolean;
};

const STUFEN: GamePunkt[] = ['0', '15', '30', '40'];

/** Bei uns wird statt eines dritten Satzes ein Match-Tiebreak bis 10 gespielt. */
export const MATCH_TIEBREAK_ZIEL = 10;
export const TIEBREAK_ZIEL = 7;

export function spielstandVon(partie: Partie): Spielstand {
  return {
    saetze: (partie.saetze ?? []).map((s) => [s[0], s[1]] as Satz),
    game_heim: partie.game_heim,
    game_gast: partie.game_gast,
    ist_tiebreak: partie.ist_tiebreak,
    ist_match_tb: partie.ist_match_tb,
  };
}

/** Wer hat die Partie gewonnen? Zwei Saetze genuegen. */
export function partieEntschieden(stand: Spielstand): 'heim' | 'gast' | null {
  let heim = 0;
  let gast = 0;
  for (const satz of stand.saetze) {
    if (!satzIstFertig(satz)) continue;
    if (satz[0] > satz[1]) heim++;
    else gast++;
  }
  if (heim >= 2) return 'heim';
  if (gast >= 2) return 'gast';
  return null;
}

function zahl(punkt: GamePunkt): number {
  const n = Number(punkt);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Bringt einen von Hand gesetzten Stand in sich stimmig:
 * bei 6:6 laeuft ein Tiebreak, sonst nicht. Wechselt der Modus,
 * werden die Punkte im laufenden Game zurueckgesetzt.
 */
export function angleichen(stand: Spielstand): Spielstand {
  const neu = { ...stand, saetze: stand.saetze.map((s) => [s[0], s[1]] as Satz) };

  if (neu.ist_match_tb) {
    neu.ist_tiebreak = false;
    return neu;
  }

  const letzter = neu.saetze[neu.saetze.length - 1];
  const sollTiebreak = Boolean(letzter && letzter[0] === 6 && letzter[1] === 6);

  if (sollTiebreak !== neu.ist_tiebreak) {
    neu.ist_tiebreak = sollTiebreak;
    neu.game_heim = '0';
    neu.game_gast = '0';
  }
  return neu;
}

/** Nach einem gewonnenen Satz: naechster Satz, Match-Tiebreak oder Schluss. */
function nachSatzende(stand: Spielstand, saetze: Satz[]): Spielstand {
  const neu: Spielstand = { ...stand, saetze, game_heim: '0', game_gast: '0', ist_tiebreak: false };

  let heim = 0;
  let gast = 0;
  for (const satz of saetze) {
    if (!satzIstFertig(satz)) continue;
    if (satz[0] > satz[1]) heim++;
    else gast++;
  }

  // Partie entschieden - nichts weiter anlegen.
  if (heim >= 2 || gast >= 2) {
    neu.ist_match_tb = false;
    return neu;
  }

  // Satzgleichstand: statt eines dritten Satzes der Match-Tiebreak bis 10.
  if (heim === 1 && gast === 1) {
    neu.ist_match_tb = true;
    return neu;
  }

  neu.saetze = [...saetze, [0, 0]];
  return neu;
}

/**
 * Ein gewonnener Punkt fuer eine Seite. Rechnet Game, Satz, Tiebreak und
 * Match-Tiebreak selbst weiter.
 */
export function naechsterPunkt(stand: Spielstand, seite: 'heim' | 'gast'): Spielstand {
  // Ist die Partie durch, aendert kein weiterer Tipper mehr etwas.
  if (partieEntschieden(stand)) return stand;

  const i = seite === 'heim' ? 0 : 1;
  const j = 1 - i;
  const neu: Spielstand = { ...stand, saetze: stand.saetze.map((s) => [s[0], s[1]] as Satz) };

  // Match-Tiebreak bis 10
  if (neu.ist_match_tb) {
    const punkte = [zahl(neu.game_heim), zahl(neu.game_gast)];
    punkte[i]++;
    if (punkte[i] >= MATCH_TIEBREAK_ZIEL && punkte[i] - punkte[j] >= 2) {
      neu.saetze = [...neu.saetze, [punkte[0], punkte[1]]];
      neu.ist_match_tb = false;
      neu.game_heim = '0';
      neu.game_gast = '0';
      return neu;
    }
    neu.game_heim = String(punkte[0]);
    neu.game_gast = String(punkte[1]);
    return neu;
  }

  // Sicherstellen, dass ein laufender Satz existiert.
  const saetze = neu.saetze;
  const letzter = saetze[saetze.length - 1];
  if (!letzter || satzIstFertig(letzter)) saetze.push([0, 0]);
  const satz = saetze[saetze.length - 1];

  // Tiebreak bis 7
  if (neu.ist_tiebreak) {
    const punkte = [zahl(neu.game_heim), zahl(neu.game_gast)];
    punkte[i]++;
    if (punkte[i] >= TIEBREAK_ZIEL && punkte[i] - punkte[j] >= 2) {
      satz[i] = 7;
      satz[j] = 6;
      return nachSatzende(neu, saetze);
    }
    neu.game_heim = String(punkte[0]);
    neu.game_gast = String(punkte[1]);
    return neu;
  }

  // Normales Game: 0, 15, 30, 40, Vorteil
  const punkte: GamePunkt[] = [neu.game_heim, neu.game_gast];
  const eigen = punkte[i];
  const fremd = punkte[j];
  let gameGewonnen = false;

  if (eigen === 'A') {
    gameGewonnen = true;
  } else if (eigen === '40') {
    if (fremd === 'A') {
      // Einstand wiederhergestellt
      punkte[i] = '40';
      punkte[j] = '40';
    } else if (fremd === '40') {
      punkte[i] = 'A';
    } else {
      gameGewonnen = true;
    }
  } else {
    const stufe = STUFEN.indexOf(eigen);
    punkte[i] = STUFEN[stufe >= 0 ? Math.min(stufe + 1, 3) : 1];
  }

  if (!gameGewonnen) {
    neu.game_heim = punkte[0];
    neu.game_gast = punkte[1];
    return neu;
  }

  // Game gewonnen
  satz[i]++;
  neu.game_heim = '0';
  neu.game_gast = '0';

  if (satzIstFertig(satz)) return nachSatzende(neu, saetze);
  if (satz[0] === 6 && satz[1] === 6) neu.ist_tiebreak = true;
  return neu;
}

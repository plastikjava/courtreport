// Typen zum Datenmodell. Die Feldnamen entsprechen exakt den Spalten
// in der Datenbank, damit zwischen Supabase und App nichts umbenannt wird.

export type SpieltagStatus = 'geplant' | 'laeuft' | 'beendet';
export type SpieltagTyp = 'medenspiel' | 'turnier';
export type PartieStatus = 'offen' | 'laeuft' | 'beendet';
export type Runde = 'einzel' | 'doppel';

/** Punktestand im laufenden Game. Im Tiebreak steht hier die Punktzahl als Text. */
export type GamePunkt = '0' | '15' | '30' | '40' | 'A' | string;

/** Ein Satzergebnis als Paar [heim, gast], z.B. [6, 4]. */
export type Satz = [number, number];

export type Spieltag = {
  id: string;
  datum: string;
  typ: SpieltagTyp;
  titel: string | null;
  mannschaft: string;
  gegner: string;
  status: SpieltagStatus;
  created_at: string;
};

export type Partie = {
  id: string;
  spieltag_id: string;
  platz_nr: number;
  disziplin: string;
  runde: Runde;
  reihenfolge: number;
  status: PartieStatus;
  saetze: Satz[];
  game_heim: GamePunkt;
  game_gast: GamePunkt;
  ist_tiebreak: boolean;
  ist_match_tb: boolean;
  /** nur fuer spaetere Turniere, im Medenspiel immer null */
  name_heim: string | null;
  /** nur fuer spaetere Turniere, im Medenspiel immer null */
  name_gast: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type Aenderung = {
  id: string;
  partie_id: string;
  vorher: unknown;
  nachher: unknown;
  quelle: string;
  created_at: string;
};

/** Anzahl der Plaetze auf der Anlage. */
export const ANZAHL_PLAETZE = 9;

/** Name unseres Vereins. Steht bewusst nur an dieser einen Stelle. */
export const HEIMVEREIN = 'Hochheim';

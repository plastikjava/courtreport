/** Wie aktuell ist der angezeigte Stand? */
export type Verbindungszustand =
  /** Realtime-Abo laeuft, Aenderungen kommen sofort an. */
  | 'live'
  /** Realtime haengt, es wird alle 8 Sekunden nachgeladen. */
  | 'nachladen'
  /** Weder Realtime noch Nachladen kommen durch. */
  | 'getrennt';

/** Alle 8 Sekunden nachladen, wenn Realtime nicht durchkommt. */
export const NACHLADE_TAKT_MS = 8000;

/** Auch bei laufendem Realtime gelegentlich nachladen, als Sicherheitsnetz. */
export const SICHERHEITS_TAKT_MS = 60000;

/** Wie oft die Zeitstempel ("vor 3 Min") neu berechnet werden. */
export const UHR_TAKT_MS = 15000;

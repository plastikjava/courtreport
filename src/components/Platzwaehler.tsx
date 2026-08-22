"use client";

import { ANZAHL_PLAETZE } from "@/lib/typen";

/**
 * Ankreuzen, welche Plätze heute benutzt werden.
 *
 * Die Einzel laufen gleichzeitig, es müssen also mindestens so viele Plätze
 * frei sein wie Partien anstehen. Die App verteilt sie dann aufsteigend.
 */
export function Platzwaehler({
  gewaehlt,
  umschalten,
  benoetigt,
}: {
  gewaehlt: number[];
  umschalten: (nr: number) => void;
  benoetigt: number;
}) {
  const plaetze = Array.from({ length: ANZAHL_PLAETZE }, (_, i) => i + 1);
  const genug = gewaehlt.length >= benoetigt;

  return (
    <div>
      <div className="zahlen grid grid-cols-5 gap-2 sm:grid-cols-9">
        {plaetze.map((nr) => {
          const an = gewaehlt.includes(nr);
          return (
            <button
              key={nr}
              type="button"
              onClick={() => umschalten(nr)}
              aria-pressed={an}
              aria-label={`Platz ${nr}`}
              className={`min-h-[56px] rounded-lg border-2 text-xl font-bold ${
                an ? "border-text bg-text text-flaeche" : "border-linie bg-flaeche"
              }`}
            >
              {nr}
            </button>
          );
        })}
      </div>
      <p className={`mt-2 text-sm ${genug ? "text-schwach" : "font-medium"}`}>
        {genug
          ? `${gewaehlt.length} Plätze gewählt — die Partien werden aufsteigend verteilt.`
          : `Noch ${benoetigt - gewaehlt.length} Platz${
              benoetigt - gewaehlt.length === 1 ? "" : "e"
            } auswählen. Die Partien laufen gleichzeitig.`}
      </p>
    </div>
  );
}

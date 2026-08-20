import { beteiligte, platzTitel } from "@/lib/anzeige";
import { partieSieger } from "@/lib/stand";
import { spannung } from "@/lib/tennis";
import { istVeraltet, STALE_MINUTEN, vorZeit } from "@/lib/zeit";
import type { Partie } from "@/lib/typen";

/**
 * Eine Karte pro Platz: wer spielt, wie steht es, wie alt ist der Stand.
 *
 * "jetzt" wird von aussen hereingereicht, damit alle Karten dieselbe Uhrzeit
 * benutzen und die Zeitangaben beim Aktualisieren nicht auseinanderlaufen.
 */
export function Platzkarte({ partie, jetzt }: { partie: Partie; jetzt: number }) {
  const namen = beteiligte(partie);
  const beendet = partie.status === "beendet";
  const sieger = beendet ? partieSieger(partie) : null;
  const veraltet = istVeraltet(partie, jetzt);

  // Ein Stand, der seit 20 Minuten steht, ist kein spannender Moment mehr,
  // sondern nur ein alter Stand. Deshalb keine Hervorhebung.
  const moment = veraltet ? null : spannung(partie);

  const rahmen = moment
    ? "border-text ring-2 ring-text"
    : "border-linie";
  const abschwaechen = beendet ? "opacity-70" : veraltet ? "opacity-55" : "";

  return (
    <li
      className={`rounded-xl border bg-flaeche px-4 py-3 sm:px-5 sm:py-4 ${rahmen} ${abschwaechen}`}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-linie pb-2">
        <h2 className="text-base font-semibold sm:text-lg">
          {platzTitel(partie)}
          {moment ? <Markierung partie={partie} namen={namen} /> : null}
        </h2>
        <p className="zahlen shrink-0 text-sm text-schwach">
          {beendet ? "beendet" : vorZeit(partie.updated_at, jetzt)}
        </p>
      </div>

      <div className="mt-2 space-y-1">
        <Seite name={namen.heim} seite="heim" partie={partie} hatGewonnen={sieger === "heim"} />
        <Seite name={namen.gast} seite="gast" partie={partie} hatGewonnen={sieger === "gast"} />
      </div>

      {veraltet ? (
        <p className="mt-2 text-xs font-medium">
          Seit über {STALE_MINUTEN} Minuten nicht aktualisiert
        </p>
      ) : partie.updated_by && !beendet ? (
        <p className="mt-2 text-xs text-schwach">eingetragen von {partie.updated_by}</p>
      ) : null}
    </li>
  );
}

/** Die Beschriftung des spannenden Moments, z.B. "Matchball Hochheim". */
function Markierung({
  partie,
  namen,
}: {
  partie: Partie;
  namen: { heim: string; gast: string };
}) {
  const moment = spannung(partie);
  if (!moment) return null;

  const wer = moment.seite === "heim" ? namen.heim : moment.seite === "gast" ? namen.gast : null;
  const text =
    moment.art === "match-tiebreak"
      ? "Match-Tiebreak"
      : `${moment.art === "matchball" ? "Matchball" : "Satzball"}${wer ? ` ${wer}` : ""}`;

  return (
    <span className="ml-2 rounded bg-text px-2 py-0.5 align-middle text-xs font-semibold uppercase tracking-wide text-flaeche">
      {text}
    </span>
  );
}

function Seite({
  name,
  seite,
  partie,
  hatGewonnen,
}: {
  name: string;
  seite: "heim" | "gast";
  partie: Partie;
  hatGewonnen: boolean;
}) {
  const index = seite === "heim" ? 0 : 1;
  const game = seite === "heim" ? partie.game_heim : partie.game_gast;
  const laeuft = partie.status !== "beendet";

  return (
    <div className="flex items-center gap-3">
      <p
        className={`flex-1 truncate text-lg sm:text-xl ${
          seite === "heim" ? "text-heim" : "text-gast"
        } ${hatGewonnen ? "font-bold" : "font-medium"}`}
      >
        {name}
      </p>

      <p className="zahlen flex gap-2 text-2xl font-semibold sm:text-3xl">
        {(partie.saetze ?? []).map((satz, i) => (
          <span key={i} className="w-6 text-right sm:w-7">
            {satz[index]}
          </span>
        ))}
      </p>

      {laeuft ? (
        <p className="zahlen w-12 rounded-md bg-grund text-center text-2xl font-bold sm:w-14 sm:text-3xl">
          {game}
        </p>
      ) : null}
    </div>
  );
}

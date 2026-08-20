import { beteiligte, platzTitel } from "@/lib/anzeige";
import { partieSieger } from "@/lib/stand";
import { vorZeit } from "@/lib/zeit";
import type { Partie } from "@/lib/typen";

/**
 * Eine Karte pro Platz: wer spielt, wie steht es, wie alt ist der Stand.
 *
 * Etappe 1 zeigt den Stand statisch. Live-Aktualisierung, Stale-Kennzeichnung
 * und die Hervorhebung bei Satz- und Matchball kommen in Etappe 2 dazu.
 */
export function Platzkarte({ partie }: { partie: Partie }) {
  const namen = beteiligte(partie);
  const sieger = partie.status === "beendet" ? partieSieger(partie) : null;
  const beendet = partie.status === "beendet";
  const spielart = partie.ist_match_tb
    ? "Match-Tiebreak"
    : partie.ist_tiebreak
      ? "Tiebreak"
      : null;

  return (
    <li
      className={`rounded-xl border border-linie bg-flaeche px-4 py-3 sm:px-5 sm:py-4 ${
        beendet ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-linie pb-2">
        <h2 className="text-base font-semibold sm:text-lg">
          {platzTitel(partie)}
          {spielart ? (
            <span className="ml-2 rounded bg-grund px-2 py-0.5 align-middle text-xs font-semibold uppercase tracking-wide text-schwach">
              {spielart}
            </span>
          ) : null}
        </h2>
        <p className="zahlen shrink-0 text-sm text-schwach">
          {beendet ? "beendet" : vorZeit(partie.updated_at)}
        </p>
      </div>

      <div className="mt-2 space-y-1">
        <Seite
          name={namen.heim}
          seite="heim"
          partie={partie}
          hatGewonnen={sieger === "heim"}
        />
        <Seite
          name={namen.gast}
          seite="gast"
          partie={partie}
          hatGewonnen={sieger === "gast"}
        />
      </div>

      {partie.updated_by && !beendet ? (
        <p className="mt-2 text-xs text-schwach">eingetragen von {partie.updated_by}</p>
      ) : null}
    </li>
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
        {partie.saetze.map((satz, i) => (
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

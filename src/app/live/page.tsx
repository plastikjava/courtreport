import { Platzkarte } from "@/components/Platzkarte";
import { datumLang, mannschaften } from "@/lib/anzeige";
import { laufenderSpieltag } from "@/lib/daten";
import { istKonfiguriert } from "@/lib/supabase/client";
import { fuerLiveSortiert, gesamtstand } from "@/lib/stand";

// Der Stand muss bei jedem Aufruf frisch aus der Datenbank kommen.
export const dynamic = "force-dynamic";

export default async function LiveSeite() {
  if (!istKonfiguriert()) {
    return <NichtEingerichtet />;
  }

  const daten = await laufenderSpieltag();

  if (!daten) {
    return <KeinSpieltag />;
  }

  const { spieltag, partien } = daten;
  const namen = mannschaften(spieltag);
  const stand = gesamtstand(partien);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="rounded-xl border border-linie bg-flaeche px-4 py-5 sm:px-6 sm:py-7">
        <div className="zahlen grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
          <p className="text-right text-2xl font-bold leading-tight text-heim sm:text-4xl">
            {namen.heim}
          </p>
          <p className="text-3xl font-bold tabular-nums sm:text-6xl">
            {stand.heim} : {stand.gast}
          </p>
          <p className="text-2xl font-bold leading-tight text-gast sm:text-4xl">
            {namen.gast}
          </p>
        </div>
        <p className="mt-3 text-center text-sm text-schwach sm:text-base">
          {spieltag.mannschaft} · {datumLang(spieltag.datum)}
        </p>
      </header>

      <ul className="mt-4 space-y-3 sm:mt-6">
        {fuerLiveSortiert(partien).map((partie) => (
          <Platzkarte key={partie.id} partie={partie} />
        ))}
      </ul>

      {partien.length === 0 ? (
        <p className="mt-6 text-center text-schwach">
          Für diesen Spieltag sind noch keine Partien angelegt.
        </p>
      ) : null}
    </main>
  );
}

function KeinSpieltag() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold sm:text-3xl">Heute läuft kein Spieltag.</h1>
      <p className="mt-3 text-schwach">
        Sobald ein Medenspiel beginnt, stehen hier alle Plätze live.
      </p>
      {/* Der Link zum Archiv kommt in Etappe 5, sobald die Seite existiert. */}
    </main>
  );
}

function NichtEingerichtet() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold sm:text-3xl">Noch nicht eingerichtet</h1>
      <p className="mt-3 text-schwach">
        Die Verbindung zur Datenbank fehlt. Die Zugangsdaten gehören in die Datei{" "}
        <code className="rounded bg-flaeche px-1.5 py-0.5">.env.local</code> — die
        einzelnen Schritte stehen in <code className="rounded bg-flaeche px-1.5 py-0.5">SETUP.md</code>.
      </p>
    </main>
  );
}

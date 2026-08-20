import { LiveAnsicht } from "@/components/LiveAnsicht";
import { laufenderSpieltag } from "@/lib/daten";
import { istKonfiguriert } from "@/lib/supabase/client";

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

  return (
    <LiveAnsicht
      spieltag={daten.spieltag}
      partien={daten.partien}
      // Der Browser rechnet die Zeitangaben ab hier selbst weiter. Der
      // Startwert kommt vom Server, damit die erste Darstellung uebereinstimmt.
      jetzt={Date.now()}
    />
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
        <code className="rounded bg-flaeche px-1.5 py-0.5">.env.local</code> — die einzelnen
        Schritte stehen in <code className="rounded bg-flaeche px-1.5 py-0.5">SETUP.md</code>.
      </p>
    </main>
  );
}

import Link from "next/link";
import { Eingabemaske } from "@/components/Eingabemaske";
import { PlatzWahl } from "@/components/PlatzWahl";
import { beteiligte, platzTitel } from "@/lib/anzeige";
import { lageAufPlatz, partieLaden } from "@/lib/daten";
import { clubPinGesetzt } from "@/lib/pin";
import { istKonfiguriert } from "@/lib/supabase/client";
import { ANZAHL_PLAETZE, type Partie } from "@/lib/typen";

export const dynamic = "force-dynamic";

export default async function EingebenSeite({
  searchParams,
}: {
  searchParams: Promise<{ platz?: string; partie?: string }>;
}) {
  const { platz, partie: partieId } = await searchParams;

  if (!istKonfiguriert()) return <Hinweis titel="Noch nicht eingerichtet" />;

  if (!clubPinGesetzt()) {
    return (
      <Hinweis
        titel="Es fehlt noch die Club-PIN."
        text="In den Einstellungen der App ist keine PIN hinterlegt. Ohne sie kann niemand etwas eintragen."
      />
    );
  }

  // Direkt auf eine bestimmte Partie: aus der Auswahlliste oder aus "trotzdem korrigieren".
  if (partieId) {
    const daten = await partieLaden(partieId);
    if (!daten) return <Hinweis titel="Diese Partie gibt es nicht mehr." zurueck />;
    return <Eingabemaske partie={daten.partie} spieltag={daten.spieltag} />;
  }

  const platzNr = Number(platz);
  const gueltig = Number.isInteger(platzNr) && platzNr >= 1 && platzNr <= ANZAHL_PLAETZE;

  // Schritt 1: Platz waehlen. Entfaellt beim Scan vom Zaun.
  if (!gueltig) return <PlatzWahl />;

  const lage = await lageAufPlatz(platzNr);

  if (!lage) {
    return (
      <Hinweis
        titel="Heute läuft kein Spieltag."
        text="Sobald ein Medenspiel beginnt, kannst du hier den Stand eintragen."
      />
    );
  }

  if (lage.alle.length === 0) {
    return (
      <Hinweis
        titel={`Auf Platz ${platzNr} ist heute nichts angesetzt.`}
        text="Vielleicht ist der falsche Platz gescannt worden."
        zurueck
      />
    );
  }

  // Genau eine Partie kommt in Frage: ohne Umweg direkt in die Maske.
  if (lage.kandidaten.length === 1) {
    return <Eingabemaske partie={lage.kandidaten[0]} spieltag={lage.spieltag} />;
  }

  // Mehrere moeglich - typisch beim Wechsel von den Einzeln zu den Doppeln.
  if (lage.kandidaten.length > 1) {
    return (
      <Auswahl platzNr={platzNr} partien={lage.kandidaten} titel="Welche Partie ist gemeint?" />
    );
  }

  // Alles beendet: Ergebnis zeigen, Korrektur trotzdem anbieten.
  return <Fertig platzNr={platzNr} partien={lage.alle} />;
}

function Auswahl({
  platzNr,
  partien,
  titel,
}: {
  platzNr: number;
  partien: Partie[];
  titel: string;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">
        Platz {platzNr} — {titel}
      </h1>
      <ul className="mt-5 space-y-3">
        {partien.slice(0, 3).map((partie) => (
          <li key={partie.id}>
            <Link
              href={`/eingeben?partie=${partie.id}`}
              className="flex min-h-[72px] items-center justify-between rounded-xl border-2 border-linie bg-flaeche px-5 text-xl font-semibold hover:border-text"
            >
              <span>{partie.disziplin}</span>
              <span className="text-base font-normal text-schwach">
                {partie.status === "laeuft" ? "läuft" : "noch offen"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Fertig({ platzNr, partien }: { platzNr: number; partien: Partie[] }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">Auf Platz {platzNr} ist alles durch.</h1>
      <ul className="zahlen mt-5 space-y-3">
        {partien.map((partie) => {
          const namen = beteiligte(partie);
          return (
            <li key={partie.id} className="rounded-xl border border-linie bg-flaeche px-5 py-4">
              <p className="text-sm text-schwach">{platzTitel(partie)}</p>
              <p className="mt-1 text-2xl font-semibold">
                {namen.heim} {(partie.saetze ?? []).map((s) => `${s[0]}:${s[1]}`).join("  ")}{" "}
                {namen.gast}
              </p>
              <Link
                href={`/eingeben?partie=${partie.id}`}
                className="mt-3 inline-block min-h-[56px] rounded-lg border-2 border-linie px-5 py-4 font-medium hover:border-text"
              >
                Trotzdem korrigieren
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function Hinweis({
  titel,
  text,
  zurueck,
}: {
  titel: string;
  text?: string;
  zurueck?: boolean;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold sm:text-3xl">{titel}</h1>
      {text ? <p className="mt-3 text-schwach">{text}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/live"
          className="min-h-[56px] rounded-lg border-2 border-linie bg-flaeche px-5 py-4 font-medium hover:border-text"
        >
          Zu den Ergebnissen
        </Link>
        {zurueck ? (
          <Link
            href="/eingeben"
            className="min-h-[56px] rounded-lg border-2 border-linie bg-flaeche px-5 py-4 font-medium hover:border-text"
          >
            Platz wählen
          </Link>
        ) : null}
      </div>
    </main>
  );
}

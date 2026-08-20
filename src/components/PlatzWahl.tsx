import Link from "next/link";
import { ANZAHL_PLAETZE } from "@/lib/typen";

/**
 * Schritt 1: Welcher Platz?
 *
 * Entfaellt im Normalfall, weil der QR-Code am Zaun die Platznummer
 * schon mitbringt. Bleibt fuer alle, die die Seite direkt aufrufen.
 */
export function PlatzWahl() {
  const plaetze = Array.from({ length: ANZAHL_PLAETZE }, (_, i) => i + 1);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Auf welchem Platz?</h1>
      <ul className="zahlen mt-5 grid grid-cols-3 gap-3">
        {plaetze.map((nr) => (
          <li key={nr}>
            <Link
              href={`/eingeben?platz=${nr}`}
              className="flex aspect-square items-center justify-center rounded-xl border-2 border-linie bg-flaeche text-4xl font-bold hover:border-text sm:text-5xl"
            >
              {nr}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-sm text-schwach">
        Am Zaun hängt an jedem Platz ein Schild zum Scannen.
      </p>
    </main>
  );
}

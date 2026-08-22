"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  aenderungZuruecknehmen,
  doppelAnlegen,
  spieltagAnlegen,
  spieltagDetails,
  spieltagLoeschen,
  spieltagStatusSetzen,
  spieltageLaden,
  type SpieltagDetails,
} from "@/app/admin/aktionen";
import { AdminPinTor } from "@/components/AdminPinTor";
import { Platzwaehler } from "@/components/Platzwaehler";
import { datumLang } from "@/lib/anzeige";
import { adminPinVergessen, gespeicherteAdminPin } from "@/lib/lokal";
import { gesamtstand } from "@/lib/stand";
import type { Aenderung, Partie, Spieltag, SpieltagStatus } from "@/lib/typen";

type Meldung = { art: "gut" | "schlecht"; text: string } | null;

const STATUS_TEXT: Record<SpieltagStatus, string> = {
  geplant: "geplant",
  laeuft: "läuft",
  beendet: "archiviert",
};

/**
 * Spieltage verwalten. Wird von einer Handvoll Leuten benutzt, deshalb
 * bewusst schlicht: eine Liste, ein Formular, eine Detailansicht.
 *
 * Auch das Lesen läuft über Server Actions mit PIN-Prüfung - das
 * Änderungsprotokoll ist von außen sonst gar nicht zugänglich.
 */
export function AdminBereich() {
  const [pin, setPin] = useState<string | null>(null);
  const [spieltage, setSpieltage] = useState<Spieltag[]>([]);
  const [details, setDetails] = useState<SpieltagDetails | null>(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [laeuft, setLaeuft] = useState(false);

  const listeLaden = useCallback(async (adminPin: string) => {
    const ergebnis = await spieltageLaden(adminPin);
    if (!ergebnis.ok) {
      if (ergebnis.pinFalsch) {
        adminPinVergessen();
        setPin("");
      }
      setMeldung({ art: "schlecht", text: ergebnis.fehler });
      return;
    }
    setSpieltage(ergebnis.daten);
  }, []);

  const detailsLaden = useCallback(
    async (adminPin: string, id: string) => {
      const ergebnis = await spieltagDetails(adminPin, id);
      if (!ergebnis.ok) {
        setMeldung({ art: "schlecht", text: ergebnis.fehler });
        return;
      }
      setDetails(ergebnis.daten);
    },
    [],
  );

  useEffect(() => {
    const gespeichert = gespeicherteAdminPin();
    setPin(gespeichert);
    if (gespeichert) void listeLaden(gespeichert);
  }, [listeLaden]);

  if (pin === null) return null;
  if (pin === "") {
    return (
      <AdminPinTor
        fertig={(neu) => {
          setPin(neu);
          void listeLaden(neu);
        }}
      />
    );
  }

  const nachAktion = async (text: string, id?: string) => {
    setMeldung({ art: "gut", text });
    await listeLaden(pin);
    if (id) await detailsLaden(pin, id);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Spieltage</h1>
        <Link href="/live" className="text-sm text-schwach underline-offset-4 hover:underline">
          Ergebnisse
        </Link>
      </div>

      {meldung ? (
        <p
          role="status"
          className={`mt-4 rounded-lg bg-flaeche px-4 py-3 font-medium ${
            meldung.art === "gut" ? "border border-linie" : "border-2 border-text"
          }`}
        >
          {meldung.text}
        </p>
      ) : null}

      {details ? (
        <Detailansicht
          pin={pin}
          details={details}
          zurueck={() => {
            setDetails(null);
            setMeldung(null);
          }}
          nachAktion={nachAktion}
          laeuft={laeuft}
          setLaeuft={setLaeuft}
          setMeldung={setMeldung}
        />
      ) : (
        <>
          <ul className="mt-5 space-y-2">
            {spieltage.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => {
                    setMeldung(null);
                    void detailsLaden(pin, tag.id);
                  }}
                  className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border-2 border-linie bg-flaeche px-4 text-left hover:border-text"
                >
                  <span>
                    <span className="block font-semibold">
                      {tag.mannschaft} gegen {tag.gegner}
                    </span>
                    <span className="block text-sm text-schwach">{datumLang(tag.datum)}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-sm ${
                      tag.status === "laeuft"
                        ? "bg-text text-flaeche font-semibold"
                        : "text-schwach"
                    }`}
                  >
                    {STATUS_TEXT[tag.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {spieltage.length === 0 ? (
            <p className="mt-5 text-schwach">Noch kein Spieltag angelegt.</p>
          ) : null}

          {neuOffen ? (
            <NeuFormular
              pin={pin}
              abbrechen={() => setNeuOffen(false)}
              fertig={async (id) => {
                setNeuOffen(false);
                await nachAktion("Spieltag angelegt.", id);
              }}
              setMeldung={setMeldung}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setMeldung(null);
                setNeuOffen(true);
              }}
              className="mt-5 min-h-[56px] w-full rounded-xl bg-heim px-5 text-lg font-semibold text-flaeche"
            >
              Neuen Spieltag anlegen
            </button>
          )}
        </>
      )}
    </main>
  );
}

function NeuFormular({
  pin,
  abbrechen,
  fertig,
  setMeldung,
}: {
  pin: string;
  abbrechen: () => void;
  fertig: (id: string) => Promise<void>;
  setMeldung: (m: Meldung) => void;
}) {
  const heute = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState(heute);
  const [mannschaft, setMannschaft] = useState("");
  const [gegner, setGegner] = useState("");
  const [anzahlEinzel, setAnzahlEinzel] = useState(6);
  const [plaetze, setPlaetze] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [laeuft, setLaeuft] = useState(false);

  const umschalten = (nr: number) =>
    setPlaetze((alt) => (alt.includes(nr) ? alt.filter((p) => p !== nr) : [...alt, nr].sort((a, b) => a - b)));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    const ergebnis = await spieltagAnlegen(pin, {
      datum,
      mannschaft,
      gegner,
      anzahlEinzel,
      plaetze,
    });
    setLaeuft(false);

    if (!ergebnis.ok) {
      setMeldung({ art: "schlecht", text: ergebnis.fehler });
      return;
    }
    await fertig(ergebnis.daten.id);
  }

  return (
    <form onSubmit={absenden} className="mt-5 rounded-xl border border-linie bg-flaeche p-4">
      <h2 className="text-lg font-semibold">Neuer Spieltag</h2>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Datum</span>
        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="zahlen mt-1 min-h-[56px] w-full rounded-lg border-2 border-linie px-3 text-lg"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium">Mannschaft</span>
        <input
          type="text"
          value={mannschaft}
          onChange={(e) => setMannschaft(e.target.value)}
          placeholder="Herren 40"
          className="mt-1 min-h-[56px] w-full rounded-lg border-2 border-linie px-3 text-lg"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium">Gegner</span>
        <input
          type="text"
          value={gegner}
          onChange={(e) => setGegner(e.target.value)}
          placeholder="TC Flörsheim"
          className="mt-1 min-h-[56px] w-full rounded-lg border-2 border-linie px-3 text-lg"
        />
      </label>

      <div className="mt-4">
        <span className="text-sm font-medium">Anzahl Einzel</span>
        <div className="mt-1 flex gap-2">
          {[4, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAnzahlEinzel(n)}
              aria-pressed={anzahlEinzel === n}
              className={`zahlen min-h-[56px] flex-1 rounded-lg border-2 text-xl font-bold ${
                anzahlEinzel === n ? "border-text bg-text text-flaeche" : "border-linie"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-schwach">
          Dazu kommen später {anzahlEinzel >= 6 ? "drei" : "zwei"} Doppel.
        </p>
      </div>

      <div className="mt-4">
        <span className="text-sm font-medium">Welche Plätze sind frei?</span>
        <div className="mt-1">
          <Platzwaehler gewaehlt={plaetze} umschalten={umschalten} benoetigt={anzahlEinzel} />
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={laeuft || plaetze.length < anzahlEinzel}
          className="min-h-[56px] flex-1 rounded-xl bg-heim px-5 font-semibold text-flaeche disabled:opacity-40"
        >
          {laeuft ? "Moment…" : "Anlegen"}
        </button>
        <button
          type="button"
          onClick={abbrechen}
          className="min-h-[56px] rounded-xl border-2 border-linie px-5 font-medium"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function Detailansicht({
  pin,
  details,
  zurueck,
  nachAktion,
  laeuft,
  setLaeuft,
  setMeldung,
}: {
  pin: string;
  details: SpieltagDetails;
  zurueck: () => void;
  nachAktion: (text: string, id?: string) => Promise<void>;
  laeuft: boolean;
  setLaeuft: (b: boolean) => void;
  setMeldung: (m: Meldung) => void;
}) {
  const { spieltag, partien, aenderungen } = details;
  const stand = gesamtstand(partien);
  const hatDoppel = partien.some((p) => p.runde === "doppel");
  const einzel = partien.filter((p) => p.runde === "einzel");
  const doppelAnzahl = einzel.length >= 6 ? 3 : 2;

  const [doppelOffen, setDoppelOffen] = useState(false);
  const [doppelPlaetze, setDoppelPlaetze] = useState<number[]>(() =>
    [...new Set(einzel.map((p) => p.platz_nr))].sort((a, b) => a - b).slice(0, doppelAnzahl),
  );
  const [loeschFrage, setLoeschFrage] = useState(false);

  const fuehreAus = async (
    aufgabe: () => Promise<{ ok: boolean; fehler?: string }>,
    erfolg: string,
  ) => {
    setLaeuft(true);
    const ergebnis = await aufgabe();
    setLaeuft(false);
    if (!ergebnis.ok) {
      setMeldung({ art: "schlecht", text: ergebnis.fehler ?? "Das hat nicht geklappt." });
      return;
    }
    await nachAktion(erfolg, spieltag.id);
  };

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={zurueck}
        className="min-h-[56px] text-sm text-schwach underline-offset-4 hover:underline"
      >
        ← Alle Spieltage
      </button>

      <div className="rounded-xl border border-linie bg-flaeche p-4">
        <h2 className="text-xl font-bold">
          {spieltag.mannschaft} gegen {spieltag.gegner}
        </h2>
        <p className="text-sm text-schwach">
          {datumLang(spieltag.datum)} · {STATUS_TEXT[spieltag.status]}
        </p>
        <p className="zahlen mt-2 text-3xl font-bold">
          {stand.heim} : {stand.gast}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {spieltag.status !== "laeuft" ? (
            <Knopf
              deaktiviert={laeuft}
              onClick={() =>
                fuehreAus(
                  () => spieltagStatusSetzen(pin, spieltag.id, "laeuft"),
                  "Spieltag läuft. Die Terrasse sieht ihn jetzt.",
                )
              }
            >
              Spieltag starten
            </Knopf>
          ) : null}
          {spieltag.status !== "beendet" ? (
            <Knopf
              deaktiviert={laeuft}
              onClick={() =>
                fuehreAus(
                  () => spieltagStatusSetzen(pin, spieltag.id, "beendet"),
                  "Spieltag archiviert.",
                )
              }
            >
              Beenden und archivieren
            </Knopf>
          ) : null}
          {!hatDoppel ? (
            <Knopf deaktiviert={laeuft} onClick={() => setDoppelOffen(!doppelOffen)}>
              Doppel starten
            </Knopf>
          ) : null}
        </div>

        {doppelOffen && !hatDoppel ? (
          <div className="mt-4 rounded-lg border border-linie p-3">
            <p className="text-sm font-medium">
              Auf welchen Plätzen laufen die {doppelAnzahl === 3 ? "drei" : "zwei"} Doppel?
            </p>
            <div className="mt-2">
              <Platzwaehler
                gewaehlt={doppelPlaetze}
                benoetigt={doppelAnzahl}
                umschalten={(nr) =>
                  setDoppelPlaetze((alt) =>
                    alt.includes(nr)
                      ? alt.filter((p) => p !== nr)
                      : [...alt, nr].sort((a, b) => a - b),
                  )
                }
              />
            </div>
            <button
              type="button"
              disabled={laeuft || doppelPlaetze.length < doppelAnzahl}
              onClick={() =>
                fuehreAus(
                  () => doppelAnlegen(pin, spieltag.id, doppelPlaetze),
                  "Doppel angelegt.",
                )
              }
              className="mt-3 min-h-[56px] w-full rounded-lg bg-heim px-5 font-semibold text-flaeche disabled:opacity-40"
            >
              Doppel anlegen
            </button>
          </div>
        ) : null}
      </div>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-schwach">Partien</h3>
      <ul className="mt-2 space-y-2">
        {partien.map((partie) => (
          <Partiezeile key={partie.id} partie={partie} />
        ))}
      </ul>
      {partien.length === 0 ? (
        <p className="mt-2 text-schwach">Zu diesem Spieltag gibt es keine Partien.</p>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-schwach">
        Letzte Änderungen
      </h3>
      <ul className="mt-2 space-y-2">
        {aenderungen.map((eintrag) => (
          <Aenderungszeile
            key={eintrag.id}
            eintrag={eintrag}
            partien={partien}
            deaktiviert={laeuft}
            zuruecknehmen={() =>
              fuehreAus(
                () => aenderungZuruecknehmen(pin, eintrag.id),
                "Änderung zurückgenommen.",
              )
            }
          />
        ))}
      </ul>
      {aenderungen.length === 0 ? (
        <p className="mt-2 text-schwach">Noch nichts eingetragen.</p>
      ) : null}

      <div className="mt-8 border-t border-linie pt-4">
        {loeschFrage ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Spieltag mit allen Partien löschen?</p>
            <Knopf
              deaktiviert={laeuft}
              onClick={async () => {
                setLaeuft(true);
                const ergebnis = await spieltagLoeschen(pin, spieltag.id);
                setLaeuft(false);
                if (!ergebnis.ok) {
                  setMeldung({ art: "schlecht", text: ergebnis.fehler });
                  return;
                }
                zurueck();
                await nachAktion("Spieltag gelöscht.");
              }}
            >
              Ja, löschen
            </Knopf>
            <Knopf onClick={() => setLoeschFrage(false)}>Abbrechen</Knopf>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLoeschFrage(true)}
            className="text-sm text-schwach underline-offset-4 hover:underline"
          >
            Spieltag löschen
          </button>
        )}
      </div>
    </section>
  );
}

function Partiezeile({ partie }: { partie: Partie }) {
  const ergebnis = (partie.saetze ?? []).map((s) => `${s[0]}:${s[1]}`).join("  ");

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-linie bg-flaeche px-4 py-3">
      <span>
        <span className="block font-semibold">
          Platz {partie.platz_nr} · {partie.disziplin}
        </span>
        <span className="zahlen block text-sm text-schwach">
          {ergebnis || "noch kein Stand"}
          {partie.status === "beendet" ? " · beendet" : partie.status === "offen" ? " · offen" : ""}
        </span>
      </span>
      <Link
        href={`/eingeben?partie=${partie.id}`}
        className="min-h-[56px] shrink-0 rounded-lg border-2 border-linie px-4 py-4 font-medium hover:border-text"
      >
        Korrigieren
      </Link>
    </li>
  );
}

function Aenderungszeile({
  eintrag,
  partien,
  zuruecknehmen,
  deaktiviert,
}: {
  eintrag: Aenderung;
  partien: Partie[];
  zuruecknehmen: () => void;
  deaktiviert: boolean;
}) {
  const partie = partien.find((p) => p.id === eintrag.partie_id);
  const zeit = new Date(eintrag.created_at).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-linie bg-flaeche px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {partie ? `Platz ${partie.platz_nr} · ${partie.disziplin}` : "Partie"}
        </span>
        <span className="zahlen block truncate text-sm text-schwach">
          {kurzfassung(eintrag.vorher)} → {kurzfassung(eintrag.nachher)} · {zeit} · {eintrag.quelle}
        </span>
      </span>
      <button
        type="button"
        onClick={zuruecknehmen}
        disabled={deaktiviert}
        className="min-h-[56px] shrink-0 rounded-lg border-2 border-linie px-4 font-medium disabled:opacity-40 hover:border-text"
      >
        Zurücknehmen
      </button>
    </li>
  );
}

/** Ein Protokolleintrag in einer Zeile, z.B. "6:4 3:2 · 40:30". */
function kurzfassung(zustand: unknown): string {
  if (!zustand || typeof zustand !== "object") return "—";
  const z = zustand as {
    saetze?: [number, number][];
    game_heim?: string;
    game_gast?: string;
    status?: string;
  };
  const saetze = (z.saetze ?? []).map((s) => `${s[0]}:${s[1]}`).join(" ");
  const game = z.game_heim !== undefined ? `${z.game_heim}:${z.game_gast}` : "";
  const teile = [saetze, game].filter(Boolean);
  const text = teile.join(" · ") || "leer";
  return z.status === "beendet" ? `${text} (beendet)` : text;
}

function Knopf({
  children,
  onClick,
  deaktiviert,
}: {
  children: React.ReactNode;
  onClick: () => void;
  deaktiviert?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deaktiviert}
      className="min-h-[56px] rounded-lg border-2 border-linie bg-flaeche px-4 font-medium hover:border-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}

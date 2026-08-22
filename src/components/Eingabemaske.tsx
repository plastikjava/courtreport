"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { aenderungZurueck, partieBeenden, standSpeichern } from "@/app/eingeben/aktionen";
import { PinAbfrage } from "@/components/PinAbfrage";
import { SpitznameFrage } from "@/components/SpitznameFrage";
import { beteiligte, platzTitel } from "@/lib/anzeige";
import {
  gespeichertePin,
  gespeicherterName,
  nachNamenGefragt,
  nameSchonGefragt,
  pinVergessen,
} from "@/lib/lokal";
import {
  angleichen,
  naechsterPunkt,
  partieEntschieden,
  spielstandVon,
  type Spielstand,
} from "@/lib/tennis";
import type { Partie, Spieltag } from "@/lib/typen";

type Meldung = { art: "gut" | "schlecht"; text: string } | null;
type Wartend = "speichern" | "beenden" | null;

/**
 * Schritt 2: den Stand eintragen.
 *
 * Der typische Fall: jemand geht am Platz vorbei, schaut zwei Sekunden auf die
 * Tafel und tippt ab. Deshalb "aktuellen Stand setzen" statt "Punkt hinzufuegen".
 * Der Punkt-Modus weiter unten ist die Ausnahme fuer alle, die sich laenger an
 * den Platz setzen.
 *
 * Wichtig fuer die hinteren Plaetze mit schlechtem Empfang: Die Maske wird
 * vollstaendig vom Server ausgeliefert und ist sofort lesbar. Nach der PIN wird
 * erst gefragt, wenn wirklich gespeichert werden soll - nicht davor.
 */
export function Eingabemaske({ partie, spieltag }: { partie: Partie; spieltag: Spieltag }) {
  const namen = beteiligte(partie);

  const [pin, setPin] = useState("");
  const [pinFrage, setPinFrage] = useState(false);
  const [wartend, setWartend] = useState<Wartend>(null);
  const [name, setName] = useState("");
  const [nameFragen, setNameFragen] = useState(false);
  const [stand, setStand] = useState<Spielstand>(() => spielstandVon(partie));
  const [status, setStatus] = useState(partie.status);
  const [letzteAenderung, setLetzteAenderung] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    setPin(gespeichertePin());
    setName(gespeicherterName());
  }, []);

  const aendern = (naechster: Spielstand) => {
    setStand(angleichen(naechster));
    setMeldung(null);
  };

  const satzAendern = (index: number, seite: 0 | 1, delta: number) => {
    const saetze = stand.saetze.map((s) => [s[0], s[1]] as [number, number]);
    saetze[index][seite] = Math.max(0, Math.min(99, saetze[index][seite] + delta));
    aendern({ ...stand, saetze });
  };

  const punktSetzen = (seite: "heim" | "gast", wert: string) =>
    aendern(seite === "heim" ? { ...stand, game_heim: wert } : { ...stand, game_gast: wert });

  const tiebreakPunkt = (seite: "heim" | "gast", delta: number) => {
    const jetzt = Number(seite === "heim" ? stand.game_heim : stand.game_gast) || 0;
    punktSetzen(seite, String(Math.max(0, Math.min(99, jetzt + delta))));
  };

  /** Nach dem ersten Speichern einmal nach dem Spitznamen fragen. Freiwillig. */
  const vielleichtNachNamenFragen = () => {
    if (nameSchonGefragt()) return;
    nachNamenGefragt();
    setNameFragen(true);
  };

  async function speichern(pinWert: string = pin) {
    if (!pinWert) {
      setWartend("speichern");
      setPinFrage(true);
      return;
    }

    setLaeuft(true);
    const ergebnis = await standSpeichern({
      partieId: partie.id,
      pin: pinWert,
      spitzname: name,
      saetze: stand.saetze,
      gameHeim: stand.game_heim,
      gameGast: stand.game_gast,
      istTiebreak: stand.ist_tiebreak,
      istMatchTb: stand.ist_match_tb,
    });
    setLaeuft(false);

    if (!ergebnis.ok) {
      if (ergebnis.pinFalsch) {
        pinVergessen();
        setPin("");
      }
      setMeldung({ art: "schlecht", text: ergebnis.fehler });
      return;
    }

    setStand(spielstandVon(ergebnis.partie));
    setStatus(ergebnis.partie.status);
    setLetzteAenderung(ergebnis.aenderungId);
    setMeldung({ art: "gut", text: "Gespeichert. Die Terrasse sieht es sofort." });
    vielleichtNachNamenFragen();
  }

  async function beenden(pinWert: string = pin) {
    if (!pinWert) {
      setWartend("beenden");
      setPinFrage(true);
      return;
    }

    setLaeuft(true);
    const ergebnis = await partieBeenden(partie.id, pinWert, name);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setMeldung({ art: "schlecht", text: ergebnis.fehler });
      return;
    }
    setStatus(ergebnis.partie.status);
    setLetzteAenderung(ergebnis.aenderungId);
    setMeldung({ art: "gut", text: "Partie ist abgeschlossen." });
  }

  async function zurueck() {
    if (!letzteAenderung) return;
    setLaeuft(true);
    const ergebnis = await aenderungZurueck(partie.id, letzteAenderung, pin, name);
    setLaeuft(false);
    if (!ergebnis.ok) {
      setMeldung({ art: "schlecht", text: ergebnis.fehler });
      return;
    }
    setStand(spielstandVon(ergebnis.partie));
    setStatus(ergebnis.partie.status);
    setLetzteAenderung(null);
    setMeldung({ art: "gut", text: "Zurückgenommen." });
  }

  if (pinFrage) {
    return (
      <PinAbfrage
        fertig={(neu) => {
          setPin(neu);
          setPinFrage(false);
          const offen = wartend;
          setWartend(null);
          if (offen === "speichern") void speichern(neu);
          if (offen === "beenden") void beenden(neu);
        }}
      />
    );
  }

  if (nameFragen) {
    return (
      <SpitznameFrage
        fertig={(neu) => {
          setName(neu);
          setNameFragen(false);
        }}
      />
    );
  }

  const entschieden = partieEntschieden(stand);
  const zahlenModus = stand.ist_tiebreak || stand.ist_match_tb;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-5 pb-32">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{platzTitel(partie)}</h1>
        <Link href="/live" className="text-sm text-schwach underline-offset-4 hover:underline">
          Ergebnisse
        </Link>
      </div>
      <p className="mt-1 text-sm text-schwach">
        {spieltag.mannschaft} gegen {spieltag.gegner}
        {status === "beendet" ? " · Partie ist beendet" : ""}
      </p>

      <noscript>Zum Eintragen muss JavaScript eingeschaltet sein.</noscript>

      <section className="mt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-schwach">Sätze</h2>
        <div className="mt-2 space-y-3">
          {stand.saetze.map((satz, i) => (
            <div key={i} className="rounded-xl border border-linie bg-flaeche p-3">
              <p className="mb-2 text-sm text-schwach">Satz {i + 1}</p>
              <Stepper
                beschriftung={namen.heim}
                kontext={"Satz " + (i + 1)}
                wert={satz[0]}
                seite="heim"
                aendern={(d) => satzAendern(i, 0, d)}
              />
              <div className="h-2" />
              <Stepper
                beschriftung={namen.gast}
                kontext={"Satz " + (i + 1)}
                wert={satz[1]}
                seite="gast"
                aendern={(d) => satzAendern(i, 1, d)}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <KleinerKnopf onClick={() => aendern({ ...stand, saetze: [...stand.saetze, [0, 0]] })}>
            Satz dazu
          </KleinerKnopf>
          {stand.saetze.length > 1 ? (
            <KleinerKnopf onClick={() => aendern({ ...stand, saetze: stand.saetze.slice(0, -1) })}>
              Letzten Satz weg
            </KleinerKnopf>
          ) : null}
          <KleinerKnopf
            gedrueckt={stand.ist_match_tb}
            onClick={() =>
              aendern({
                ...stand,
                ist_match_tb: !stand.ist_match_tb,
                game_heim: "0",
                game_gast: "0",
              })
            }
          >
            Match-Tiebreak
          </KleinerKnopf>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-schwach">
          {stand.ist_match_tb
            ? "Punkte im Match-Tiebreak"
            : stand.ist_tiebreak
              ? "Punkte im Tiebreak"
              : "Aktuelles Spiel"}
        </h2>

        <div className="mt-2 space-y-3">
          {(["heim", "gast"] as const).map((seite) => {
            const wert = seite === "heim" ? stand.game_heim : stand.game_gast;
            const wer = seite === "heim" ? namen.heim : namen.gast;
            return (
              <div key={seite} className="rounded-xl border border-linie bg-flaeche p-3">
                <p className={`mb-2 font-semibold ${seite === "heim" ? "text-heim" : "text-gast"}`}>
                  {wer}
                </p>
                {zahlenModus ? (
                  <Stepper
                    beschriftung="Punkte"
                    kontext={wer}
                    wert={Number(wert) || 0}
                    seite={seite}
                    aendern={(d) => tiebreakPunkt(seite, d)}
                  />
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {["0", "15", "30", "40", "A"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => punktSetzen(seite, p)}
                        aria-pressed={wert === p}
                        aria-label={wer + " " + p}
                        className={`zahlen min-h-[56px] rounded-lg border-2 text-xl font-bold ${
                          wert === p ? "border-text bg-text text-flaeche" : "border-linie bg-flaeche"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <PunktModus stand={stand} namen={namen} setzen={aendern} />

      {meldung ? (
        <p
          role="status"
          className={`mt-5 rounded-lg bg-flaeche px-4 py-3 text-center font-medium ${
            meldung.art === "gut" ? "border border-linie" : "border-2 border-text"
          }`}
        >
          {meldung.text}
        </p>
      ) : null}

      {entschieden && status !== "beendet" ? (
        <p className="mt-5 rounded-lg border border-linie bg-flaeche px-4 py-3 text-center">
          Nach diesem Stand hat {entschieden === "heim" ? namen.heim : namen.gast} gewonnen.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {status !== "beendet" ? (
          <KleinerKnopf onClick={() => void beenden()} deaktiviert={laeuft}>
            Partie beendet
          </KleinerKnopf>
        ) : null}
        {letzteAenderung ? (
          <KleinerKnopf onClick={() => void zurueck()} deaktiviert={laeuft}>
            Rückgängig
          </KleinerKnopf>
        ) : null}
        <KleinerKnopf onClick={() => setNameFragen(true)}>
          {name ? "Name: " + name : "Namen eintragen"}
        </KleinerKnopf>
      </div>

      {/* Der wichtigste Knopf bleibt immer in Daumenreichweite. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-linie bg-grund px-4 py-3">
        <button
          type="button"
          onClick={() => void speichern()}
          disabled={laeuft}
          className="mx-auto block min-h-[64px] w-full max-w-xl rounded-xl bg-heim px-5 text-xl font-bold text-flaeche disabled:opacity-50"
        >
          {laeuft ? "Moment…" : "Stand speichern"}
        </button>
      </div>
    </main>
  );
}

function Stepper({
  beschriftung,
  kontext,
  wert,
  seite,
  aendern,
}: {
  beschriftung: string;
  /** Nur für die Sprachausgabe, z.B. "Satz 2" — sonst heißen alle Knöpfe gleich. */
  kontext: string;
  wert: number;
  seite: "heim" | "gast";
  aendern: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <p className={`flex-1 truncate font-medium ${seite === "heim" ? "text-heim" : "text-gast"}`}>
        {beschriftung}
      </p>
      <button
        type="button"
        onClick={() => aendern(-1)}
        aria-label={kontext + " " + beschriftung + " eins weniger"}
        className="h-14 w-14 rounded-lg border-2 border-linie bg-flaeche text-3xl font-bold"
      >
        −
      </button>
      <span className="zahlen w-12 text-center text-3xl font-bold">{wert}</span>
      <button
        type="button"
        onClick={() => aendern(1)}
        aria-label={kontext + " " + beschriftung + " eins mehr"}
        className="h-14 w-14 rounded-lg border-2 border-linie bg-flaeche text-3xl font-bold"
      >
        +
      </button>
    </div>
  );
}

function KleinerKnopf({
  children,
  onClick,
  gedrueckt,
  deaktiviert,
}: {
  children: React.ReactNode;
  onClick: () => void;
  gedrueckt?: boolean;
  deaktiviert?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deaktiviert}
      aria-pressed={gedrueckt}
      className={`min-h-[56px] rounded-lg border-2 px-4 font-medium disabled:opacity-40 ${
        gedrueckt ? "border-text bg-text text-flaeche" : "border-linie bg-flaeche"
      }`}
    >
      {children}
    </button>
  );
}

/** Für alle, die sich länger an den Platz setzen und mitzählen. */
function PunktModus({
  stand,
  namen,
  setzen,
}: {
  stand: Spielstand;
  namen: { heim: string; gast: string };
  setzen: (stand: Spielstand) => void;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className="min-h-[56px] w-full rounded-lg border-2 border-linie bg-flaeche px-4 text-left font-medium"
      >
        Punkt für Punkt mitzählen
      </button>

      {offen ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["heim", "gast"] as const).map((seite) => (
            <button
              key={seite}
              type="button"
              onClick={() => setzen(naechsterPunkt(stand, seite))}
              className={`min-h-[72px] rounded-xl border-2 bg-flaeche px-3 text-lg font-bold ${
                seite === "heim" ? "border-heim text-heim" : "border-gast text-gast"
              }`}
            >
              +1 {seite === "heim" ? namen.heim : namen.gast}
            </button>
          ))}
          <p className="col-span-2 text-sm text-schwach">
            Die App rechnet Spiel, Satz und Tiebreak selbst weiter. Am Ende nicht vergessen zu
            speichern.
          </p>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Platzkarte } from "@/components/Platzkarte";
import { datumLang, mannschaften } from "@/lib/anzeige";
import { fuerLiveSortiert, gesamtstand } from "@/lib/stand";
import { supabaseLesen } from "@/lib/supabase/client";
import type { Partie, Spieltag } from "@/lib/typen";
import {
  NACHLADE_TAKT_MS,
  SICHERHEITS_TAKT_MS,
  UHR_TAKT_MS,
  type Verbindungszustand,
} from "@/lib/verbindung";

/**
 * Die Terrassen-Ansicht.
 *
 * Der Server liefert den ersten Stand mit, damit die Seite sofort etwas zeigt
 * und auch ohne JavaScript lesbar ist. Danach uebernimmt der Browser:
 *
 *  1. Realtime-Abo auf die Partien dieses Spieltags - Aenderungen sind in
 *     unter einer Sekunde da.
 *  2. Faellt das Abo aus, wird alle 8 Sekunden nachgeladen. Der Empfang auf
 *     der Anlage ist stellenweise schlecht, deshalb ist das kein Luxus.
 *  3. Auch bei laufendem Abo einmal pro Minute nachladen, falls die
 *     Verbindung still verhungert, ohne es zu melden.
 */
export function LiveAnsicht({
  spieltag: spieltagInitial,
  partien: partienInitial,
  jetzt: jetztInitial,
}: {
  spieltag: Spieltag;
  partien: Partie[];
  jetzt: number;
}) {
  const [spieltag, setSpieltag] = useState(spieltagInitial);
  const [partien, setPartien] = useState(partienInitial);
  // Startwert kommt vom Server, damit die erste Darstellung im Browser
  // exakt dieselbe ist. Danach laeuft die Uhr im Browser weiter.
  const [jetzt, setJetzt] = useState(jetztInitial);
  const [zustand, setZustand] = useState<Verbindungszustand>("nachladen");

  const zustandRef = useRef(zustand);
  zustandRef.current = zustand;

  const spieltagId = spieltag.id;

  const nachladen = useCallback(async () => {
    const supabase = supabaseLesen();
    const { data, error } = await supabase
      .from("partie")
      .select("*")
      .eq("spieltag_id", spieltagId)
      .returns<Partie[]>();

    if (error) {
      setZustand("getrennt");
      return;
    }
    setPartien(data ?? []);
    setJetzt(Date.now());
    // Nur hochstufen, wenn nicht ohnehin schon Realtime laeuft.
    setZustand((alt) => (alt === "live" ? alt : "nachladen"));
  }, [spieltagId]);

  // Realtime-Abo
  useEffect(() => {
    const supabase = supabaseLesen();
    const kanal = supabase
      .channel(`live-${spieltagId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "partie",
          filter: `spieltag_id=eq.${spieltagId}`,
        },
        (nachricht) => {
          setJetzt(Date.now());
          setPartien((alt) => uebernehmen(alt, nachricht));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "spieltag", filter: `id=eq.${spieltagId}` },
        (nachricht) => setSpieltag(nachricht.new as Spieltag),
      )
      .subscribe((status) => {
        setZustand(status === "SUBSCRIBED" ? "live" : "nachladen");
      });

    return () => {
      supabase.removeChannel(kanal);
    };
  }, [spieltagId]);

  // Nachladen, solange Realtime nicht traegt
  useEffect(() => {
    const takt = setInterval(() => {
      if (zustandRef.current !== "live") void nachladen();
    }, NACHLADE_TAKT_MS);
    return () => clearInterval(takt);
  }, [nachladen]);

  // Sicherheitsnetz, auch wenn alles gut aussieht
  useEffect(() => {
    const takt = setInterval(() => void nachladen(), SICHERHEITS_TAKT_MS);
    return () => clearInterval(takt);
  }, [nachladen]);

  // Zeitstempel weiterlaufen lassen
  useEffect(() => {
    const takt = setInterval(() => setJetzt(Date.now()), UHR_TAKT_MS);
    return () => clearInterval(takt);
  }, []);

  // Wer das Handy einsteckt und spaeter wieder herausholt, soll nicht
  // minutenlang auf einen alten Stand schauen.
  useEffect(() => {
    const beiRueckkehr = () => {
      if (document.visibilityState === "visible") void nachladen();
    };
    document.addEventListener("visibilitychange", beiRueckkehr);
    window.addEventListener("online", beiRueckkehr);
    return () => {
      document.removeEventListener("visibilitychange", beiRueckkehr);
      window.removeEventListener("online", beiRueckkehr);
    };
  }, [nachladen]);

  const namen = mannschaften(spieltag);
  const stand = gesamtstand(partien);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="rounded-xl border border-linie bg-flaeche px-4 py-5 sm:px-6 sm:py-7">
        <div className="zahlen grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
          <p className="text-right text-2xl font-bold leading-tight text-heim sm:text-4xl">
            {namen.heim}
          </p>
          <p className="text-3xl font-bold sm:text-6xl">
            {stand.heim} : {stand.gast}
          </p>
          <p className="text-2xl font-bold leading-tight text-gast sm:text-4xl">{namen.gast}</p>
        </div>
        <p className="mt-3 text-center text-sm text-schwach sm:text-base">
          {spieltag.mannschaft} · {datumLang(spieltag.datum)}
        </p>
      </header>

      <ul className="mt-4 space-y-3 sm:mt-6">
        {fuerLiveSortiert(partien).map((partie) => (
          <Platzkarte key={partie.id} partie={partie} jetzt={jetzt} />
        ))}
      </ul>

      {partien.length === 0 ? (
        <p className="mt-6 text-center text-schwach">
          Für diesen Spieltag sind noch keine Partien angelegt.
        </p>
      ) : null}

      <Verbindungshinweis zustand={zustand} />
    </main>
  );
}

/** Eine einzelne Aenderung aus dem Realtime-Abo in die Liste einarbeiten. */
function uebernehmen(
  alt: Partie[],
  nachricht: { eventType: string; new: unknown; old: unknown },
): Partie[] {
  if (nachricht.eventType === "DELETE") {
    const weg = (nachricht.old as Partie)?.id;
    return alt.filter((p) => p.id !== weg);
  }

  const neu = nachricht.new as Partie;
  if (!neu?.id) return alt;

  const vorhanden = alt.some((p) => p.id === neu.id);
  // Letzte Schreiboperation gewinnt - kein Zusammenfuehren, das waere
  // fuer diesen Anwendungsfall ueberzogen.
  return vorhanden ? alt.map((p) => (p.id === neu.id ? neu : p)) : [...alt, neu];
}

function Verbindungshinweis({ zustand }: { zustand: Verbindungszustand }) {
  if (zustand === "live") {
    return (
      <p className="mt-5 text-center text-xs text-schwach">
        Die Seite aktualisiert sich von selbst.
      </p>
    );
  }

  if (zustand === "nachladen") {
    return (
      <p className="mt-5 text-center text-xs text-schwach">
        Wird alle 8 Sekunden neu geladen.
      </p>
    );
  }

  return (
    <p className="mt-5 rounded-lg border border-linie bg-flaeche px-4 py-3 text-center text-sm font-medium">
      Keine Verbindung. Der Stand kann veraltet sein.
    </p>
  );
}

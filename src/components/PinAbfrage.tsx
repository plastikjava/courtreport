"use client";

import { useState } from "react";
import { pinPruefen } from "@/app/eingeben/aktionen";
import { pinMerken } from "@/lib/lokal";

/**
 * Die Club-PIN, einmalig.
 *
 * Danach liegt sie im Browser und wird nie wieder abgefragt - fuer die
 * Nutzenden fuehlt es sich ab dem zweiten Mal wie "kein Login" an.
 */
export function PinAbfrage({ fertig }: { fertig: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler("");
    const stimmt = await pinPruefen(pin);
    setLaeuft(false);

    if (!stimmt) {
      setFehler("Diese PIN stimmt nicht.");
      setPin("");
      return;
    }
    pinMerken(pin);
    fertig(pin);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Kurz die Club-PIN</h1>
      <p className="mt-3 text-schwach">
        Einmalig, damit nicht jeder aus dem Internet mitschreiben kann. Danach fragt die App
        nie wieder.
      </p>

      <form onSubmit={absenden} className="mt-6">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          aria-label="Club-PIN"
          autoFocus
          className="zahlen w-full rounded-xl border-2 border-linie bg-flaeche py-5 text-center text-5xl font-bold tracking-[0.4em]"
        />

        {fehler ? <p className="mt-3 font-medium">{fehler}</p> : null}

        <button
          type="submit"
          disabled={pin.length < 4 || laeuft}
          className="mt-5 min-h-[56px] w-full rounded-xl bg-heim px-5 py-4 text-xl font-semibold text-flaeche disabled:opacity-40"
        >
          {laeuft ? "Moment…" : "Weiter"}
        </button>
      </form>
    </main>
  );
}

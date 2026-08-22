"use client";

import { useState } from "react";
import { adminPinPruefen } from "@/app/admin/aktionen";
import { adminPinMerken } from "@/lib/lokal";

/**
 * Die längere Admin-PIN. Getrennt von der Club-PIN, weil hier ganze
 * Spieltage angelegt und archiviert werden.
 */
export function AdminPinTor({ fertig }: { fertig: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler("");
    const stimmt = await adminPinPruefen(pin);
    setLaeuft(false);

    if (!stimmt) {
      setFehler("Diese PIN stimmt nicht.");
      setPin("");
      return;
    }
    adminPinMerken(pin);
    fertig(pin);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Spieltage verwalten</h1>
      <p className="mt-3 text-schwach">Dieser Bereich ist mit der Admin-PIN geschützt.</p>

      <form onSubmit={absenden} className="mt-6">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-label="Admin-PIN"
          autoFocus
          className="zahlen w-full rounded-xl border-2 border-linie bg-flaeche px-4 py-5 text-center text-3xl font-bold tracking-widest"
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

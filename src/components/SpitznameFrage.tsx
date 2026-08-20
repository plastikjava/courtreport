"use client";

import { useState } from "react";
import { gespeicherterName, namenMerken } from "@/lib/lokal";

/** Freiwillig. Wer nicht will, tippt auf Überspringen. */
export function SpitznameFrage({ fertig }: { fertig: (name: string) => void }) {
  const [name, setName] = useState(gespeicherterName);

  function speichern(wert: string) {
    namenMerken(wert.trim());
    fertig(wert.trim());
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Wie heißt du?</h1>
      <p className="mt-3 text-schwach">
        Nur damit auf der Terrasse steht, wer eingetragen hat. Freiwillig — du kannst das auch
        überspringen.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          speichern(name);
        }}
        className="mt-6"
      >
        <input
          type="text"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          aria-label="Spitzname"
          placeholder="Uwe"
          className="w-full rounded-xl border-2 border-linie bg-flaeche px-4 py-4 text-2xl"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="min-h-[56px] flex-1 rounded-xl bg-heim px-5 font-semibold text-flaeche"
          >
            Passt
          </button>
          <button
            type="button"
            onClick={() => speichern("")}
            className="min-h-[56px] rounded-xl border-2 border-linie bg-flaeche px-5 font-medium"
          >
            Überspringen
          </button>
        </div>
      </form>
    </main>
  );
}

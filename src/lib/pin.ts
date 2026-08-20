import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Die PINs liegen in Umgebungsvariablen und werden ausschliesslich hier
 * geprueft - nie im Browser. Ohne Deployment aenderbar.
 */

function gleich(eingabe: string, erwartet: string | undefined): boolean {
  if (!erwartet) return false;
  const a = Buffer.from(eingabe.trim());
  const b = Buffer.from(erwartet.trim());
  // Laengenvergleich vorab, sonst wirft timingSafeEqual.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Die vierstellige PIN, die im Club herumgereicht wird. */
export function clubPinStimmt(pin: string): boolean {
  return gleich(pin, process.env.CLUB_PIN);
}

/** Die laengere PIN fuer die Handvoll Leute, die Spieltage verwalten. */
export function adminPinStimmt(pin: string): boolean {
  return gleich(pin, process.env.ADMIN_PIN);
}

/** Ist ueberhaupt eine Club-PIN hinterlegt? */
export function clubPinGesetzt(): boolean {
  return Boolean(process.env.CLUB_PIN?.trim());
}

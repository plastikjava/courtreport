/*
  Was der Browser sich merkt. Bewusst wenig:
  die Club-PIN, damit nach dem ersten Mal nie wieder gefragt wird,
  und ein freiwilliger Spitzname.
*/

const PIN_SCHLUESSEL = 'hochheim.pin';
const NAME_SCHLUESSEL = 'hochheim.spitzname';
const NAME_GEFRAGT = 'hochheim.spitzname.gefragt';

function lesen(schluessel: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(schluessel) ?? '';
  } catch {
    return '';
  }
}

function schreiben(schluessel: string, wert: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(schluessel, wert);
  } catch {
    // Privater Modus o.ae. - dann wird eben jedes Mal gefragt.
  }
}

export const gespeichertePin = () => lesen(PIN_SCHLUESSEL);
export const pinMerken = (pin: string) => schreiben(PIN_SCHLUESSEL, pin);
export const pinVergessen = () => schreiben(PIN_SCHLUESSEL, '');

export const gespeicherterName = () => lesen(NAME_SCHLUESSEL);
export const namenMerken = (name: string) => {
  schreiben(NAME_SCHLUESSEL, name);
  schreiben(NAME_GEFRAGT, 'ja');
};
export const nameSchonGefragt = () => lesen(NAME_GEFRAGT) === 'ja';
export const nachNamenGefragt = () => schreiben(NAME_GEFRAGT, 'ja');

const ADMIN_SCHLUESSEL = 'hochheim.adminpin';

export const gespeicherteAdminPin = () => lesen(ADMIN_SCHLUESSEL);
export const adminPinMerken = (pin: string) => schreiben(ADMIN_SCHLUESSEL, pin);
export const adminPinVergessen = () => schreiben(ADMIN_SCHLUESSEL, '');

import { createClient } from '@supabase/supabase-js';

/**
 * Lese-Client mit dem oeffentlichen Publishable Key.
 *
 * Dieser Key darf im Browser landen: die Row-Level-Security in Supabase erlaubt
 * damit ausschliesslich SELECT auf Spieltage und Partien, kein Schreiben.
 * Wird auf /live und /archiv benutzt und ab Etappe 2 fuer Realtime.
 */
export function supabaseLesen() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt. ' +
        'Bitte in .env.local eintragen (siehe SETUP.md).',
    );
  }

  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sind die Supabase-Zugangsdaten hinterlegt? Wird auf /live geprueft, um
 *  statt eines Stacktrace einen verstaendlichen Hinweis zu zeigen. */
export function istKonfiguriert(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

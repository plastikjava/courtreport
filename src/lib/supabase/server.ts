import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Schreib-Client mit dem service_role-Key.
 *
 * Dieser Key umgeht die Row-Level-Security und darf deshalb niemals im
 * Browser landen. Das "server-only" oben laesst den Build fehlschlagen,
 * falls diese Datei versehentlich aus einer Client-Komponente importiert wird.
 *
 * Wird ab Etappe 3 von den Server Actions benutzt, die vorher die PIN pruefen.
 */
export function supabaseSchreiben() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt. ' +
        'Bitte in .env.local eintragen (siehe SETUP.md).',
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

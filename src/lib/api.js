import { supabase } from '@/lib/supabase';

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, accessToken?: string }} [options]
 */
export async function apiRequest(path, { method = 'GET', body, accessToken: suppliedToken } = {}) {
  let accessToken = suppliedToken;
  if (!accessToken) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    accessToken = session?.access_token;
  }
  if (!accessToken) throw new Error('Connectez-vous pour accéder à ces informations.');

  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let result = null;
  if (response.status !== 204) {
    try {
      result = await response.clone().json();
    } catch {
      const rawResponse = await response.text().catch(() => '');
      if (response.ok) {
        throw new Error('Le serveur a renvoyé une réponse illisible. Réessayez dans un instant.');
      }
      result = { error: rawResponse.trim().slice(0, 300) };
    }
  }
  if (!response.ok) {
    const responseMessage = [result?.error, result?.message, result?.details]
      .find((value) => typeof value === 'string' && value.trim());
    throw Object.assign(new Error(responseMessage || `Le serveur a refusé la requête (HTTP ${response.status}).`), {
      status: response.status,
      code: result.code,
    });
  }
  return result;
}

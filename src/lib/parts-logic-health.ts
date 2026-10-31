import { publicConfig } from './config';

// How long to wait for PartsLogic to answer.
const ASK_TIMEOUT_MS = 4000;

export type HealthAnswer = { ok: boolean; ms: number };

// PartsLogic's own health check, with the app's public key: whether it answered in time, and how long it
// took. The connection watch (network-provider.tsx) and the developer tools both ask it.
export async function askPartsLogic(): Promise<HealthAnswer> {
  const started = Date.now();
  if (!publicConfig.ok) return { ok: false, ms: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASK_TIMEOUT_MS);
  try {
    const response = await fetch(`${publicConfig.url}/auth/v1/health`, {
      headers: { apikey: publicConfig.publishableKey },
      signal: controller.signal,
    });
    return { ok: response.ok, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

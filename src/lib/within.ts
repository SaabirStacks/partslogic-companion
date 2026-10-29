import { classifyQueueError } from '@/vendor/partslogic/shared/errors';

// A call to PartsLogic that gives up after ms. It fails the way no signal does, so a slow signal is a
// passing problem (isConnectionProblem), not a refusal.
export function within<T>(work: Promise<T>, ms: number, message = 'The request timed out'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// No signal, a timeout or PartsLogic briefly unavailable: worth trying again later, unlike a refusal.
export const isConnectionProblem = (error: unknown) => classifyQueueError(error as { code?: string; message?: string }) === 'retry';

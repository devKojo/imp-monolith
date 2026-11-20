import { createHmac } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';

/**
 * Facts about the current request that help spot abuse (many accounts from one network or browser). Only
 * keyed hashes are kept: the raw IP address and user agent are never stored or logged (R-PRV).
 */
export type RequestSignals = { ipHash: string | null; uaHash: string | null };

const store = new AsyncLocalStorage<RequestSignals>();

/** A keyed hash, so a leaked table cannot be reversed by hashing every IPv4 address. 32 hex chars. */
export function hashSignal(secret: string, value: string | undefined | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  return createHmac('sha256', secret).update(v).digest('hex').slice(0, 32);
}

/**
 * Captures the signals of every request for the code that handles it. Put it before the routers. The IP
 * comes from `req.ip`, so behind a proxy the app must set Express's `trust proxy`, otherwise every visitor
 * looks like the proxy.
 */
export function requestSignals(secret: string): RequestHandler {
  return (req, _res, next) => {
    const signals: RequestSignals = {
      ipHash: hashSignal(secret, req.ip),
      uaHash: hashSignal(secret, req.get('user-agent')),
    };
    store.run(signals, next);
  };
}

/** The current request's signals, or nulls outside a request (a job, a test without the middleware). */
export const currentSignals = (): RequestSignals =>
  store.getStore() ?? { ipHash: null, uaHash: null };

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  target: string;
  accountId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestTarget(): string | undefined {
  return asyncLocalStorage.getStore()?.target;
}

export function getRequestAccountId(): string | undefined {
  return asyncLocalStorage.getStore()?.accountId;
}

type SSECallback = (event: string, data: Record<string, unknown>) => void;

const globalForSSE = globalThis as typeof globalThis & {
  __sseListeners?: Map<number, Set<SSECallback>>;
};
if (!globalForSSE.__sseListeners) {
  globalForSSE.__sseListeners = new Map();
}
const listeners = globalForSSE.__sseListeners;

export function subscribeSSE(sessionId: number, callback: SSECallback): () => void {
  if (!listeners.has(sessionId)) {
    listeners.set(sessionId, new Set());
  }
  listeners.get(sessionId)!.add(callback);

  return () => {
    const set = listeners.get(sessionId);
    if (set) {
      set.delete(callback);
      if (set.size === 0) listeners.delete(sessionId);
    }
  };
}

export function emitSSE(sessionId: number, event: string, data: Record<string, unknown>) {
  const set = listeners.get(sessionId);
  if (set) {
    for (const cb of set) {
      cb(event, data);
    }
  }
}

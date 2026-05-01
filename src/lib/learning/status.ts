const globalForLearn = globalThis as typeof globalThis & {
  __activeLearning?: Set<number>;
};
if (!globalForLearn.__activeLearning) {
  globalForLearn.__activeLearning = new Set();
}
const activeSessions = globalForLearn.__activeLearning;

export function startLearning(sessionId: number): boolean {
  if (activeSessions.has(sessionId)) return false;
  activeSessions.add(sessionId);
  return true;
}

export function finishLearning(sessionId: number): void {
  activeSessions.delete(sessionId);
}

export function isLearning(sessionId: number): boolean {
  return activeSessions.has(sessionId);
}

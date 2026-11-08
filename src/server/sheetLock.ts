const queues = new Map<string, Promise<unknown>>();

/**
 * Runs one Sheet's syncs one after another. Each sync finds rows by their position, and a sync
 * that deletes or sorts rows moves the rest, so two running at the same moment could write
 * to the wrong row. A request that arrives while another runs simply waits its turn.
 */
export function withSheetLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(key, next);
  const cleanUp = () => {
    if (queues.get(key) === next) queues.delete(key);
  };
  next.then(cleanUp, cleanUp);
  return next;
}

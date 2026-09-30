/** Ignore delayed module loads after another click, navigation or unmount. */
export function readingLoader<T>(load: () => Promise<T>, pending: (value: boolean) => void) {
  let generation = 0;
  let loading = false;
  const cancel = () => {
    generation++;
    if (loading) { loading = false; pending(false); }
  };
  return { cancel, get pending() { return loading; }, async start(ready: (module: T) => void, failed: () => void) {
    const current = ++generation;
    loading = true;
    pending(true);
    try {
      const engine = await load();
      if (current === generation) ready(engine);
    } catch {
      if (current === generation) failed();
    } finally {
      if (current === generation) { loading = false; pending(false); }
    }
  } };
}

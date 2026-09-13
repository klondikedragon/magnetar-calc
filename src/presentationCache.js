export function createValuePresentationCache(derive) {
  const cache = new WeakMap();
  return (value) => {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return derive(value);
    if (cache.has(value)) return cache.get(value);
    const presentation = derive(value);
    cache.set(value, presentation);
    return presentation;
  };
}

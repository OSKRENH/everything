(() => {
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  if (!descriptor?.get || !descriptor?.set || !descriptor.configurable) return;
  Object.defineProperty(Node.prototype, "textContent", {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      const next = value == null ? "" : String(value);
      if (descriptor.get.call(this) === next) return;
      descriptor.set.call(this, next);
    },
  });
})();

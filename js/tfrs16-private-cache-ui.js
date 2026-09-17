/*
 * TFRS16 private-result cache coordinator.
 *
 * This module owns only the asynchronous cache hydration and read-only retry
 * coordination. Calculation math, persistence, and API transport remain in
 * the private facade/runtime; the public UI supplies a narrow cache adapter.
 */
(() => {
  let inFlight = null;

  const emptyHydration = () => ({ attempted: 0, succeeded: 0, failed: 0 });

  async function hydrate(list, runtime) {
    if (typeof runtime?.isReady !== "function" || !runtime.isReady()) return emptyHydration();
    const sourceItems = Array.isArray(list) ? list : [];
    const items = [];
    const seenKeys = new Set();

    sourceItems.forEach(contract => {
      [contract, runtime.getBase?.(contract)]
        .filter(Boolean)
        .forEach(item => {
          const key = runtime.getKey(item);
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
          items.push(item);
        });
    });

    const facade = window.LeaseQantPrivateTfrs16Facade;
    const batchLoader = typeof facade?.loadMany === "function"
      ? facade.loadMany.bind(facade)
      : window.LeaseQantPrivateCalculation?.calculateMany;
    const singleLoader = typeof facade?.load === "function"
      ? facade.load.bind(facade)
      : window.LeaseQantPrivateCalculation?.calculate;

    if (typeof batchLoader === "function" && items.length > 0) {
      try {
        const batchResults = await batchLoader(items);
        if (!Array.isArray(batchResults) || batchResults.length !== items.length) {
          throw new Error("Toplu hesaplama API eksik sonuç döndürdü");
        }
        let succeeded = 0;
        batchResults.forEach((result, index) => {
          const key = runtime.getKey(items[index]);
          if (!result || typeof result !== "object") {
            runtime.setError(key, {
              code: "CALCULATION_API_EMPTY_RESULT",
              status: null,
              message: "Hesaplama API boş sonuç döndürdü"
            });
            return;
          }
          runtime.setResult(items[index], result);
          runtime.clearError(key);
          succeeded += 1;
        });
        return { attempted: items.length, succeeded, failed: items.length - succeeded };
      } catch (_) {
        // Rolling backend deployments may reject a batch temporarily; use the
        // established single-request path before reporting a failed warm-up.
      }
    }

    if (typeof singleLoader !== "function") return { attempted: items.length, succeeded: 0, failed: items.length };
    const results = await Promise.all(items.map(async contract => {
      const key = runtime.getKey(contract);
      try {
        const result = await singleLoader(contract);
        if (!result || typeof result !== "object") throw new Error("Hesaplama API boş sonuç döndürdü");
        runtime.setResult(contract, result);
        runtime.clearError(key);
        return true;
      } catch (error) {
        runtime.setError(key, {
          code: error?.code || "CALCULATION_API_ERROR",
          status: error?.status ?? null,
          message: String(error?.message || error)
        });
        return false;
      }
    }));
    return {
      attempted: results.length,
      succeeded: results.filter(Boolean).length,
      failed: results.filter(value => !value).length
    };
  }

  function ensure(list, runtime) {
    if (typeof runtime?.isReady !== "function" || !runtime.isReady()) return Promise.resolve(emptyHydration());
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return Promise.resolve(emptyHydration());
    if (!inFlight) {
      inFlight = hydrate(items, runtime).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  function loadReadOnly(contract, options = {}, runtime) {
    if (typeof runtime?.isReady !== "function" || !runtime.isReady()) return Promise.resolve(null);
    const key = runtime.getKey(contract);
    const cached = runtime.get(key);
    if (cached) return Promise.resolve(cached);
    if (runtime.hasError(key)) {
      if (options.retryOnError !== true) return Promise.resolve(null);
      runtime.clearError(key);
    }

    const facade = window.LeaseQantPrivateTfrs16Facade;
    const loader = typeof facade?.load === "function"
      ? facade.load.bind(facade)
      : window.LeaseQantPrivateCalculation?.calculate;
    if (typeof loader !== "function") return Promise.resolve(null);

    if (!runtime.hasInflight(key)) {
      runtime.setInflight(key, (async () => {
        try {
          const result = await loader(contract);
          if (!result || typeof result !== "object") throw new Error("Hesaplama API boş sonuç döndürdü");
          runtime.setResult(contract, result);
          runtime.clearError(key);
          return result;
        } catch (error) {
          runtime.setError(key, {
            code: error?.code || "CALCULATION_API_ERROR",
            status: error?.status ?? null,
            message: String(error?.message || error)
          });
          return null;
        } finally {
          runtime.deleteInflight(key);
        }
      })());
    }
    return runtime.getInflight(key);
  }

  window.LeaseQantTfrs16PrivateCacheUi = Object.freeze({
    hydrate,
    ensure,
    loadReadOnly,
    isInFlight: () => Boolean(inFlight)
  });
})();

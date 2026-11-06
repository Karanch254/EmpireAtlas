import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

// Loads something asynchronously and holds the Remotion render until it is
// ready, so no frame is ever captured with missing assets.
export const useAsyncResource = <T>(
  label: string,
  load: () => Promise<T>,
): T | null => {
  const [handle] = useState(() => delayRender(label));
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((v) => {
        if (!cancelled) {
          setValue(v);
          continueRender(handle);
        }
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
    // The loader is expected to be stable for the lifetime of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
};

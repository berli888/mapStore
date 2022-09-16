import { useMemo, useCallback } from "react";
import { MapStore, GroupSnapshot } from "./MapStore";
import useSyncExternalStoreExports from "use-sync-external-store/shim/with-selector";
const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

const defaultIsEqual = <Selection>(a: Selection, b: Selection) => {
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * React rerenders only when one the item listed in the key list has been changed.
 * If an entry is updated but not in the list, neither listener nor
 * the selector will be called.
 *
 * @param store
 * @param keyList
 * @param selector
 * @param isEqual
 */
export const useManyInMapStore = <T, Selection>(
  store: MapStore<T>,
  keyList: string[],
  selector: (subMap: GroupSnapshot<T>) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
) => {
  const keyListStringified = JSON.stringify(keyList);

  const subscribe = useMemo(() => {
    return store.subscribeMany(keyListStringified);
  }, [store, keyListStringified]);

  const getSnapshot = useCallback(() => {
    return store.getSnapshotForGroup(keyListStringified);
  }, [store, keyListStringified]);

  return useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    getSnapshot,
    selector,
    isEqual || defaultIsEqual
  );
};

export const useOneInMapStore = <T, Selection>(
  store: MapStore<T>,
  key: string,
  selector: (item: T | undefined) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
): Selection => {
  const subscribe = useMemo(() => {
    //console.log("subscribeOne for " + key);
    return store.subscribe(key);
  }, [store, key]);

  const getSnapshot = useCallback(() => {
    //console.log("getSnapshot for " + key);
    return store.getSnapshot(key);
  }, [store, key]);

  return useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    getSnapshot,
    selector,
    isEqual || defaultIsEqual
  );
};

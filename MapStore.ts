/**
 * A store that represents a map whose entries can be modified and listened.
 * It is possible to listen to multiple entries at the same time.
 */

type Listener = () => void;
type RemoveListener = () => void;
type OptRecordValue<T> = T | undefined;

export type GroupSnapshot<T> = Record<string, OptRecordValue<T>>;
export type MapStore<T> = {
  getSnapshot: (key: string) => OptRecordValue<T>;
  getSnapshotForGroup: (keyListStringified: string) => GroupSnapshot<T>;
  replaceAllEntries: (allEntries: Record<string, OptRecordValue<T>>) => void;
  setEntry: (
    key: string,
    modifier: (v: T | undefined) => T | undefined
  ) => void;
  setSomeEntries: (
    keyList: string[],
    updater: (
      someEntries: Record<string, OptRecordValue<T>>
    ) => Record<string, OptRecordValue<T>>
  ) => void;
  subscribe: (key: string) => (listener: Listener) => RemoveListener;
  subscribeMany: (
    keyListStringified: string
  ) => (listener: Listener) => RemoveListener;
};

export const createMapStore = <T>(
  initialState: Record<string, T | undefined>
): MapStore<T> => {
  const mapOfT = new Map<string, OptRecordValue<T>>();
  Object.entries(initialState).forEach(([key, value]) => {
    mapOfT.set(key, value);
  });

  const mapOfListenerList = new Map<string, Listener[] | undefined>();

  const mapOfStringifiedToGroupSnapshots = new Map<
    string,
    undefined | GroupSnapshot<T>
  >();
  const cacheForItemCompareForGroupSnapshot = new Map<
    string,
    OptRecordValue<T>
  >();
  /**
   * Must return the same result if item hasn't changed as per useSyncExternalStore specs
   * @param keyListStringified
   */
  const getSnapshotForGroup = (
    keyListStringified: string
  ): GroupSnapshot<T> => {
    console.log("getSnapshotForGroup:" + keyListStringified);
    const keyList = JSON.parse(keyListStringified) as string[];
    //get previous items to compare new items
    const keyOfItemChanged = keyList.find(
      (key) => cacheForItemCompareForGroupSnapshot.get(key) !== mapOfT.get(key)
    );

    // no change
    if (keyOfItemChanged === undefined) {
      //console.log("getSnapshotForGroup:" + keyListStringified + ", no change");
      const cacheGroupResult =
        mapOfStringifiedToGroupSnapshots.get(keyListStringified);
      if (cacheGroupResult !== undefined) {
        return cacheGroupResult;
      }
    }
    //console.log("getSnapshotForGroup:" + keyListStringified + ", change");
    // change
    // update cache of item comparison
    keyList.forEach((key) => {
      cacheForItemCompareForGroupSnapshot.set(key, mapOfT.get(key));
    });

    // build new result to cache
    const result: GroupSnapshot<T> = Object.fromEntries(
      keyList.map((key) => {
        return [key, mapOfT.get(key)] as const;
      })
    );
    mapOfStringifiedToGroupSnapshots.set(keyListStringified, result);
    return result;

    //
  };

  /**
   * Must return the same result if item hasn't changed as per useSyncExternalStore specs
   * @param keyListStringified
   */
  const getSnapshot = (key: string): OptRecordValue<T> => {
    console.log("getSnapshot for " + key);
    return mapOfT.get(key);
  };

  const setEntry = (
    key: string,
    updater: (v: OptRecordValue<T>) => OptRecordValue<T>
  ) => {
    const newItem = updater(mapOfT.get(key));
    if (newItem === mapOfT.get(key)) {
      return;
    }

    // updating state with new reference for getSnapshot()
    mapOfT.set(key, newItem);

    //calling listeners
    const listenerList = mapOfListenerList.get(key) || [];
    listenerList.forEach((lst) => {
      //console.log("listener of " + key, key);
      lst();
    });
  };

  const setSomeEntries = (
    keyList: string[],
    updater: (
      subMap: Record<string, OptRecordValue<T>>
    ) => Record<string, OptRecordValue<T>>
  ) => {
    // creating the parameter of the updater function
    const updaterParam = Object.fromEntries(
      keyList.map((key) => {
        return [key, mapOfT.get(key)] as const;
      })
    );

    // calling the updater to get the desired new values for some entries
    const someEntriesUpdated = updater(updaterParam);

    // listing the entries whose values have change
    const keysOfModified = Object.entries(someEntriesUpdated).reduce(
      (acc, cur) => {
        const [key, newValue] = cur;
        const prevValue = mapOfT.get(key);
        if (prevValue !== newValue) {
          return [...acc, key];
        }
        return acc;
      },
      [] as string[]
    );

    // setting all values
    Object.entries(someEntriesUpdated).forEach(([key, newValue]) => {
      mapOfT.set(key, newValue);
    });

    // notifying the listeners
    keysOfModified.forEach((key) => {
      const listenerList = mapOfListenerList.get(key) || [];
      listenerList.forEach((lst) => {
        //console.log("listener of " + key, key);
        lst();
      });
    });
  };

  const replaceAllEntries = (allEntries: Record<string, OptRecordValue<T>>) => {
    //clear the map
    mapOfT.clear();

    // set the new values
    Object.entries(allEntries).forEach(([key, value]) => {
      mapOfT.set(key, value);
    });

    // call all listeners
    mapOfListenerList.forEach((optListenerList) => {
      const listenerList = optListenerList || [];
      listenerList.forEach((lst) => {
        lst();
      });
    });
  };

  /**
   * Subscribe the listener to the item with the given key
   * @param key
   */
  const subscribe = (key: string) => (listener: Listener) => {
    const listenerList = mapOfListenerList.get(key) || [];
    mapOfListenerList.set(key, listenerList.concat(listener));

    return () => {
      const curList = mapOfListenerList.get(key) || [];
      const updatedList = curList.filter((lst) => lst !== listener);
      mapOfListenerList.set(key, updatedList);
    };
  };

  /**
   * Call the registered listener when an item is modified and whose
   * key is among the stringified key list.
   * @param keyListStringified
   */
  const subscribeMany =
    (keyListStringified: string) => (listener: Listener) => {
      const keyList = JSON.parse(keyListStringified) as string[];

      // register the listener for each item of the key list stringified
      keyList.forEach((key) => {
        const curList = mapOfListenerList.get(key) || [];
        const updatedList = curList.concat(listener);
        mapOfListenerList.set(key, updatedList);
      });

      // return a function that removes the listener
      return () => {
        keyList.forEach((key) => {
          const curList = mapOfListenerList.get(key) || [];
          const updatedList = curList.filter((lst) => lst !== listener);
          mapOfListenerList.set(key, updatedList);
        });
      };
    };
  return {
    getSnapshot,
    getSnapshotForGroup,
    replaceAllEntries,
    setEntry,
    setSomeEntries,
    subscribe,
    subscribeMany,
  };
};

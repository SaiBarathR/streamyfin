import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { useNetworkAwareQueryClient } from "@/hooks/useNetworkAwareQueryClient";
import { useDownload } from "@/providers/DownloadProvider";
import type { DownloadedItem } from "@/providers/Downloads/types";
import {
  checkApiReachable,
  useNetworkStatus,
} from "@/providers/NetworkStatusProvider";
import { apiAtom, userAtom } from "@/utils/atoms/api";
import { writeToLog } from "@/utils/log";
import { useTwoWaySync } from "./useTwoWaySync";

/** The queries that show watch progress, refetched after a push. */
const PROGRESS_QUERY_KEYS = [
  ["item"],
  ["resumeItems"],
  ["continueWatching"],
  ["nextUp-all"],
  ["nextUp"],
  ["episodes"],
  ["seasons"],
  ["home"],
  ["downloadedItems"],
];

/**
 * The downloads with local watch state to reconcile: an item never played
 * on this device has nothing to push, and asking the server about each one
 * would cost a request per download on every reconnect.
 */
export const pickItemsToSync = (items: DownloadedItem[] | undefined) =>
  (items ?? []).filter(
    (downloaded) =>
      Boolean(downloaded.item?.Id) &&
      Boolean(downloaded.item?.UserData?.LastPlayedDate),
  );

/**
 * Pushes watch progress recorded offline to the server as soon as it is
 * reachable again, and takes the server's state for items watched more
 * recently elsewhere (useTwoWaySync decides which side wins).
 *
 * Before this, the reconciliation only ran when a player closed (often still
 * offline, so it did nothing) or on a pull to refresh: progress made on a
 * plane stayed on the phone until the user happened to refresh Home.
 */
export function useOfflineProgressSync() {
  const { serverConnected } = useNetworkStatus();
  const api = useAtomValue(apiAtom);
  const userId = useAtomValue(userAtom)?.Id;
  const { getDownloadedItems } = useDownload();
  const { syncPlaybackState } = useTwoWaySync();
  const queryClient = useNetworkAwareQueryClient();

  // The sync reads the api, the user and the connection when it runs, so
  // keep the latest closures instead of re-subscribing on every render.
  const latest = useRef({
    api,
    getDownloadedItems,
    syncPlaybackState,
    queryClient,
  });
  latest.current = { api, getDownloadedItems, syncPlaybackState, queryClient };
  const runningRef = useRef(false);

  useEffect(() => {
    // null is "not probed yet"; only a confirmed reachable server is worth
    // the requests.
    if (serverConnected !== true || !userId || runningRef.current) return;
    runningRef.current = true;

    const run = async () => {
      const { api, getDownloadedItems, syncPlaybackState, queryClient } =
        latest.current;
      const items = pickItemsToSync(getDownloadedItems());
      if (items.length === 0) return;
      // serverConnected starts out true before anything was probed, so an
      // offline cold start would otherwise send a failing request per item.
      if (!(await checkApiReachable(api?.basePath))) return;

      const results = await Promise.allSettled(
        items.map((downloaded) => syncPlaybackState(downloaded.item.Id!)),
      );
      const pushed = results.filter(
        (result) => result.status === "fulfilled" && result.value,
      ).length;
      if (pushed === 0) return;

      writeToLog("INFO", `Synced offline progress of ${pushed} item(s)`);
      await Promise.all(
        PROGRESS_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    };

    run()
      .catch((error) => {
        writeToLog("ERROR", "Offline progress sync failed", error);
      })
      .finally(() => {
        runningRef.current = false;
      });
  }, [serverConnected, userId]);
}

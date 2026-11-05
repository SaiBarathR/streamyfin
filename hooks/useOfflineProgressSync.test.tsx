import { act, renderHook } from "@testing-library/react-native";
import type { DownloadedItem } from "@/providers/Downloads/types";
import {
  pickItemsToSync,
  useOfflineProgressSync,
} from "./useOfflineProgressSync";

let mockServerConnected: boolean | null = false;
let mockReachable = true;
let mockDownloads: DownloadedItem[] = [];
const mockSync = jest.fn(async (_itemId: string) => true);
const mockInvalidate = jest.fn(async () => {});

jest.mock("@/providers/NetworkStatusProvider", () => ({
  useNetworkStatus: () => ({ serverConnected: mockServerConnected }),
  checkApiReachable: async () => mockReachable,
}));
jest.mock("@/providers/DownloadProvider", () => ({
  useDownload: () => ({ getDownloadedItems: () => mockDownloads }),
}));
jest.mock("./useTwoWaySync", () => ({
  useTwoWaySync: () => ({ syncPlaybackState: mockSync }),
}));
jest.mock("@/hooks/useNetworkAwareQueryClient", () => ({
  useNetworkAwareQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("@/utils/log", () => ({ writeToLog: jest.fn() }));
// The atoms stand in as tags; useAtomValue answers by tag.
jest.mock("@/utils/atoms/api", () => ({ apiAtom: "api", userAtom: "user" }));
jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: (atom: unknown) =>
    atom === "user" ? { Id: "user-1" } : { basePath: "http://jellyfin.local" },
}));

const downloaded = (id: string, lastPlayed?: string) =>
  ({
    item: {
      Id: id,
      UserData: lastPlayed ? { LastPlayedDate: lastPlayed } : {},
    },
  }) as unknown as DownloadedItem;

const flush = () => act(async () => {});

beforeEach(() => {
  mockServerConnected = false;
  mockReachable = true;
  mockDownloads = [];
  mockSync.mockClear();
  mockInvalidate.mockClear();
});

describe("pickItemsToSync", () => {
  test("keeps only downloads that were played on this device", () => {
    const items = [
      downloaded("played", "2026-11-05T10:00:00Z"),
      downloaded("never-played"),
    ];
    expect(pickItemsToSync(items).map((d) => d.item.Id)).toEqual(["played"]);
  });

  test("handles a missing downloads list", () => {
    expect(pickItemsToSync(undefined)).toEqual([]);
  });
});

describe("useOfflineProgressSync", () => {
  // The reported bug: progress made offline stayed on the phone after the
  // connection came back, until the user pulled to refresh on Home.
  test("pushes offline progress when the server becomes reachable again", async () => {
    mockDownloads = [
      downloaded("episode-1", "2026-11-05T10:00:00Z"),
      downloaded("episode-2"),
    ];
    const { rerender } = await renderHook(() => useOfflineProgressSync());
    await flush();
    expect(mockSync).not.toHaveBeenCalled();

    mockServerConnected = true;
    await rerender({});
    await flush();

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith("episode-1");
    expect(mockInvalidate).toHaveBeenCalled();
  });

  test("does not refetch progress when nothing was pushed", async () => {
    mockDownloads = [downloaded("episode-1", "2026-11-05T10:00:00Z")];
    mockSync.mockResolvedValueOnce(false);
    mockServerConnected = true;
    await renderHook(() => useOfflineProgressSync());
    await flush();

    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  // serverConnected defaults to true before the first probe: an offline cold
  // start must not fire a failing request per download.
  test("sends nothing while the server does not answer", async () => {
    mockDownloads = [downloaded("episode-1", "2026-11-05T10:00:00Z")];
    mockReachable = false;
    mockServerConnected = true;
    await renderHook(() => useOfflineProgressSync());
    await flush();

    expect(mockSync).not.toHaveBeenCalled();
  });
});

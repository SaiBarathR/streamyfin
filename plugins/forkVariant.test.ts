import type { ExpoConfig } from "expo/config";
import {
  applyForkVariant,
  FORK_APP_NAME,
  FORK_APPLICATION_ID,
  isForkVariant,
} from "./forkVariant";

const upstream = {
  name: "Streamyfin",
  slug: "streamyfin",
  android: {
    package: "com.fredrikburmester.streamyfin",
    googleServicesFile: "./google-services.json",
    permissions: ["android.permission.FOREGROUND_SERVICE"],
  },
  extra: { build: { commit: "abc1234" } },
  plugins: ["expo-router"],
} as ExpoConfig;

describe("the fork variant", () => {
  test("is chosen only by APP_VARIANT=fork", () => {
    expect(isForkVariant({ APP_VARIANT: "fork" })).toBe(true);
    expect(isForkVariant({})).toBe(false);
    expect(isForkVariant({ APP_VARIANT: "production" })).toBe(false);
  });

  // Android allows one app per id, and an update must carry the installed
  // app's signature: under the store's id the fork could only replace the
  // store app, wiping its downloads and login.
  test("installs next to the store app under its own id and name", () => {
    const fork = applyForkVariant(upstream);
    expect(fork.android?.package).toBe(FORK_APPLICATION_ID);
    expect(fork.name).toBe(FORK_APP_NAME);
    expect(fork.android?.permissions).toEqual(upstream.android?.permissions);
  });

  // google-services.json only registers the upstream id: kept, the Gradle
  // build fails on the fork's id.
  test("drops Firebase and turns push off", () => {
    const fork = applyForkVariant(upstream);
    expect(fork.android).not.toHaveProperty("googleServicesFile");
    expect(fork.extra?.pushNotifications).toBe(false);
    expect(fork.extra?.build).toEqual(upstream.extra?.build);
  });

  test("signs releases with the fork's own key", () => {
    expect(applyForkVariant(upstream).plugins).toEqual([
      "expo-router",
      "./plugins/withForkReleaseSigning.ts",
    ]);
  });

  test("leaves the config it was given untouched", () => {
    const before = structuredClone(upstream);
    applyForkVariant(upstream);
    expect(upstream).toEqual(before);
  });
});

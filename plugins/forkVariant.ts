import type { ExpoConfig } from "expo/config";

/**
 * The personal fork's Android build, chosen with APP_VARIANT=fork. Everything
 * here keeps the fork apart from the store app, so both install side by side
 * and the fork never borrows the upstream project's services:
 * - its own application id and name: Android allows one app per id, and an
 *   update must carry the installed app's signature, which only upstream has
 * - no Firebase: google-services.json only knows the upstream id, so the
 *   build would fail, and push is off (extra.pushNotifications = false)
 * - its own release keystore (plugins/withForkReleaseSigning.ts)
 * Crash reports need nothing: utils/sentry.ts reports only from the official
 * application ids.
 */
export const FORK_APPLICATION_ID = "com.saibarath.streamyfin";
export const FORK_APP_NAME = "Streamyfin Dev";

export const isForkVariant = (
  env: Record<string, string | undefined> = process.env,
) => env.APP_VARIANT === "fork";

export const applyForkVariant = (config: ExpoConfig): ExpoConfig => {
  const { googleServicesFile: _firebase, ...android } = config.android ?? {};
  return {
    ...config,
    name: FORK_APP_NAME,
    android: { ...android, package: FORK_APPLICATION_ID },
    extra: { ...config.extra, pushNotifications: false },
    plugins: [...(config.plugins ?? []), "./plugins/withForkReleaseSigning.ts"],
  };
};

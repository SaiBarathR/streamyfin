import { type ConfigPlugin, withAppBuildGradle } from "expo/config-plugins";

// The fork's release builds are signed with its own keystore, never with the
// template's debug key: an update must carry the same signature as the
// installed app, and the debug key lives only on the machine that made it.
// The keystore and its passwords stay out of the repository, in Gradle
// properties (~/.gradle/gradle.properties):
//   STREAMYFIN_FORK_STORE_FILE, STREAMYFIN_FORK_STORE_PASSWORD,
//   STREAMYFIN_FORK_KEY_ALIAS, STREAMYFIN_FORK_KEY_PASSWORD
// Without them the release build fails instead of quietly using the debug key.
const RELEASE_SIGNING = `
        release {
            def forkStore = findProperty('STREAMYFIN_FORK_STORE_FILE')
            if (!forkStore) {
                throw new GradleException("STREAMYFIN_FORK_STORE_FILE is not set: the fork's release keystore is configured in ~/.gradle/gradle.properties")
            }
            storeFile file(forkStore)
            storePassword findProperty('STREAMYFIN_FORK_STORE_PASSWORD')
            keyAlias findProperty('STREAMYFIN_FORK_KEY_ALIAS')
            keyPassword findProperty('STREAMYFIN_FORK_KEY_PASSWORD')
        }`;

const SIGNING_CONFIGS = /(signingConfigs\s*\{)/;
const RELEASE_BUILD_TYPE_SIGNING =
  /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/;

/** app/build.gradle with the release build type signed by the fork's key. */
export const signReleaseWithForkKey = (contents: string): string => {
  if (contents.includes("STREAMYFIN_FORK_STORE_FILE")) return contents;
  if (
    !SIGNING_CONFIGS.test(contents) ||
    !RELEASE_BUILD_TYPE_SIGNING.test(contents)
  ) {
    throw new Error(
      "withForkReleaseSigning: app/build.gradle no longer has the signing blocks this plugin edits",
    );
  }
  return contents
    .replace(SIGNING_CONFIGS, `$1${RELEASE_SIGNING}`)
    .replace(
      RELEASE_BUILD_TYPE_SIGNING,
      "$1signingConfig signingConfigs.release",
    );
};

const withForkReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (gradle) => {
    gradle.modResults.contents = signReleaseWithForkKey(
      gradle.modResults.contents,
    );
    return gradle;
  });

export default withForkReleaseSigning;

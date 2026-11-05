import { signReleaseWithForkKey } from "./withForkReleaseSigning";

// expo/config-plugins pulls in packages Jest cannot parse; only the
// build.gradle edit is under test here.
jest.mock("expo/config-plugins", () => ({
  withAppBuildGradle: (config: unknown) => config,
}));

// The signing part of the app/build.gradle Expo's template generates.
const TEMPLATE = `
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
        }
    }
`;

describe("signReleaseWithForkKey", () => {
  test("signs the release build type with the fork's keystore", () => {
    const gradle = signReleaseWithForkKey(TEMPLATE);
    const release = gradle.slice(gradle.indexOf("buildTypes"));
    expect(release).toContain("signingConfig signingConfigs.release");
    expect(release).not.toMatch(
      /release\s*\{[^}]*signingConfig signingConfigs\.debug/,
    );
    expect(gradle).toContain("findProperty('STREAMYFIN_FORK_STORE_FILE')");
  });

  // The debug build type keeps the debug key: only releases are installed.
  test("leaves the debug build type alone", () => {
    const gradle = signReleaseWithForkKey(TEMPLATE);
    expect(gradle).toMatch(
      /debug\s*\{\s*signingConfig signingConfigs\.debug\s*\}/,
    );
  });

  // Without the properties a release must fail, never fall back to the debug
  // key: an APK signed by another key cannot update the installed fork.
  test("fails the build when the keystore is not configured", () => {
    expect(signReleaseWithForkKey(TEMPLATE)).toContain(
      "throw new GradleException",
    );
  });

  test("is applied once", () => {
    const once = signReleaseWithForkKey(TEMPLATE);
    expect(signReleaseWithForkKey(once)).toBe(once);
  });

  test("refuses a build.gradle it does not recognise", () => {
    expect(() => signReleaseWithForkKey("android {}")).toThrow(
      /no longer has the signing blocks/,
    );
  });
});

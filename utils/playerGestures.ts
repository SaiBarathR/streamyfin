import type { Settings } from "@/utils/atoms/settings";

/** Which touch gestures a player may act on. */
export interface PlayerGestures {
  horizontalSwipeSkip: boolean;
  brightnessSwipe: boolean;
  volumeSwipe: boolean;
  holdToSpeed: boolean;
  pinchToZoom: boolean;
  doubleTapToSeek: boolean;
}

type GestureSettings = Pick<
  Settings,
  | "enablePlayerGestures"
  | "enableHorizontalSwipeSkip"
  | "enableLeftSideBrightnessSwipe"
  | "enableRightSideVolumeSwipe"
  | "enableHoldToSpeed"
  | "enablePinchToZoom"
  | "enableDoubleTapToSeek"
>;

/**
 * The gestures the JS and native players honor: each one's own switch, and
 * all of them off while the master switch is. Shared by both players so the
 * settings mean the same thing whichever one plays. A settings record from
 * before the master switch existed has it undefined, which keeps gestures on.
 */
export const resolvePlayerGestures = (
  settings: Partial<GestureSettings>,
): PlayerGestures => {
  const enabled = settings.enablePlayerGestures !== false;
  return {
    horizontalSwipeSkip: enabled && settings.enableHorizontalSwipeSkip === true,
    brightnessSwipe: enabled && settings.enableLeftSideBrightnessSwipe === true,
    volumeSwipe: enabled && settings.enableRightSideVolumeSwipe === true,
    holdToSpeed: enabled && settings.enableHoldToSpeed === true,
    pinchToZoom: enabled && settings.enablePinchToZoom === true,
    doubleTapToSeek: enabled && settings.enableDoubleTapToSeek === true,
  };
};

// Shared tuning constants.
export const PLATFORM_HALF = 2.7;     // half-size of the square diorama platform
export const MAX_PIECES = 230;        // hard cap of live fragments (mobile performance)
export const LEVEL_TIME = 15;         // seconds per level
export const GRAVITY = 24;

// Fixed isometric camera (orthographic).
export const CAM = {
  azimuth: Math.PI / 4,
  elevation: 0.62,                    // ~35.5 degrees
  distance: 40,
  target: [0, 1.15, 0],
  viewW: 6.4,                         // world units that must always fit horizontally (tight: the object is the hero)
  viewH: 10.5                         // ... and vertically
};

export const SAVE_KEY = 'happybreaking.save.v1';

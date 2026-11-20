// Android app glue (Capacitor). In a normal browser every call here is a no-op.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isApp = () => Capacitor.isNativePlatform();

/**
 * goBack(): handles the Android back button inside the game and returns 'exit' when the player is on the
 * main menu with nothing open (then the app closes, like any other Android app).
 */
export function initNative(goBack) {
  if (!isApp()) return;
  App.addListener('backButton', () => { if (goBack() === 'exit') App.exitApp(); });
}

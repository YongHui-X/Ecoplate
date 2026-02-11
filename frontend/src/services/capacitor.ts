import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export async function initializeCapacitor() {
  if (!isNative) return;

  // Hide splash screen after app is ready
  await SplashScreen.hide();

  // Configure status bar
  if (platform === 'ios' || platform === 'android') {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#16a34a' });
  }

  // Handle back button on Android
  if (platform === 'android') {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  }

  // Handle keyboard events
  Keyboard.addListener('keyboardWillShow', (info) => {
    document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.body.style.setProperty('--keyboard-height', '0px');
  });

  // Handle app state changes
  App.addListener('appStateChange', ({ isActive }) => {
    console.log('App state changed. Is active?', isActive);
  });

  // Handle deep links
  App.addListener('appUrlOpen', (event) => {
    const url = new URL(event.url);
    // Handle deep link routing here
    console.log('Deep link opened:', url.pathname);
  });
}

// Camera utility for receipt scanning
export async function takePhoto(): Promise<string | null> {
  if (!isNative) {
    // Fall back to file input on web
    return null;
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });

    return image.base64String ? `data:image/jpeg;base64,${image.base64String}` : null;
  } catch (error) {
    console.error('Camera error:', error);
    return null;
  }
}

// Pick photo from gallery
export async function pickPhoto(): Promise<string | null> {
  if (!isNative) {
    return null;
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });

    return image.base64String ? `data:image/jpeg;base64,${image.base64String}` : null;
  } catch (error) {
    console.error('Photo picker error:', error);
    return null;
  }
}

// Haptic feedback
export async function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNative) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');

    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({ style: styleMap[type] });
  } catch (error) {
    console.error('Haptics error:', error);
  }
}

// Cross-platform storage utilities
// Uses Capacitor Preferences on native, localStorage on web
export async function storageGet(key: string): Promise<string | null> {
  if (isNative) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  } else {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (isNative) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    } catch (error) {
      console.error('Storage set error:', error);
    }
  } else {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage not available
    }
  }
}

export async function storageRemove(key: string): Promise<void> {
  if (isNative) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  } else {
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage not available
    }
  }
}

// Synchronous storage get (for initial state) - falls back to localStorage
// Use this only for getting initial values, prefer async versions otherwise
export function storageGetSync(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

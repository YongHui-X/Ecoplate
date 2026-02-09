import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Keyboard } from "@capacitor/keyboard";
import { Geolocation } from "@capacitor/geolocation";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as "ios" | "android" | "web";

export async function initializeCapacitor(): Promise<void> {
  if (!isNative) return;

  // Hide splash screen after app is ready
  await SplashScreen.hide();

  // Configure status bar
  if (platform === "ios" || platform === "android") {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#5F7A61" });
  }

  // Handle back button on Android
  if (platform === "android") {
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  }

  // Handle keyboard events
  Keyboard.addListener("keyboardWillShow", (info) => {
    document.body.style.setProperty(
      "--keyboard-height",
      `${info.keyboardHeight}px`
    );
  });

  Keyboard.addListener("keyboardWillHide", () => {
    document.body.style.setProperty("--keyboard-height", "0px");
  });

  // Handle app state changes
  App.addListener("appStateChange", ({ isActive }) => {
    console.log("App state changed. Is active?", isActive);
  });

  // Handle deep links
  App.addListener("appUrlOpen", (event) => {
    const url = new URL(event.url);
    // Handle deep link routing here
    console.log("Deep link opened:", url.pathname);

    // Navigate to the path if it's a valid route
    if (url.pathname) {
      window.location.href = url.pathname + url.search;
    }
  });
}

// Hybrid geolocation that uses Capacitor on native, browser API on web
export async function getCurrentPosition(): Promise<{
  lat: number;
  lng: number;
}> {
  // Singapore center as default
  const defaultLocation = { lat: 1.3521, lng: 103.8198 };

  if (isNative) {
    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== "granted") {
        const request = await Geolocation.requestPermissions();
        if (request.location !== "granted") {
          return defaultLocation;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (error) {
      console.error("Capacitor geolocation error:", error);
      return defaultLocation;
    }
  }

  // Web fallback
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(defaultLocation);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        resolve(defaultLocation);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  });
}

// Haptic feedback for button interactions
export async function hapticFeedback(
  type: "light" | "medium" | "heavy" = "medium"
): Promise<void> {
  if (!isNative) return;

  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");

    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({ style: styleMap[type] });
  } catch (error) {
    console.error("Haptics error:", error);
  }
}

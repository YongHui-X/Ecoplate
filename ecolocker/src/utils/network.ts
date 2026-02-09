import { useState, useEffect } from "react";

// Check if an error is a network error (fetch failure)
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Fetch network errors typically throw TypeError
    return (
      error.message.includes("Failed to fetch") ||
      error.message.includes("Network request failed") ||
      error.message.includes("NetworkError") ||
      error.message.includes("net::ERR_")
    );
  }
  return false;
}

// Get a user-friendly error message
export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return "Unable to connect. Please check your internet connection.";
  }

  if (error instanceof Error) {
    // Don't expose internal error messages to users
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      return "Session expired. Please log in again.";
    }
    if (error.message.includes("403") || error.message.includes("Forbidden")) {
      return "You don't have permission to perform this action.";
    }
    if (error.message.includes("404") || error.message.includes("Not found")) {
      return "The requested item could not be found.";
    }
    if (error.message.includes("500") || error.message.includes("Internal")) {
      return "Something went wrong on our end. Please try again.";
    }
    // Return the original message for other errors
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

// Hook to track online/offline status
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

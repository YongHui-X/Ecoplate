import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { UnreadCountProvider } from "./contexts/UnreadCountContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { initializeCapacitor } from "./services/capacitor";
import "./index.css";

// Initialize Capacitor plugins for native platforms
initializeCapacitor();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <UnreadCountProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </UnreadCountProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeCapacitor } from "./services/capacitor";
import "./index.css";

// Initialize Capacitor before rendering
initializeCapacitor().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

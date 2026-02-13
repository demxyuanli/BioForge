import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n/config";
import { getStoredTheme, applyTheme, applyFontSettings, setupThemeListener } from "./utils/theme";

applyTheme(getStoredTheme());
applyFontSettings();
setupThemeListener();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

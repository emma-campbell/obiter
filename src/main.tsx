import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { SettingsProvider } from "./settings/SettingsProvider";

// Self-hosted fonts — a product that promises you own your data should not
// phone a third party for a font on every launch.
import "@fontsource/public-sans/300.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/400-italic.css";

// ProseKit's flat-list draws its own markers (bullets, numbers, task
// checkboxes) via .list-marker elements — native list-style is switched off —
// and this stylesheet is where those markers, plus the base table structure,
// live. Without it lists render markerless. Loaded before index.css and
// Editor.css so the brand tokens and prose overrides win the cascade.
import "prosekit/basic/style.css";

import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  </React.StrictMode>,
);

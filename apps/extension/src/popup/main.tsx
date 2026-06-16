import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// The dedicated approval window is opened with ?ctx=window so it fills the
// window; the toolbar action popup (no flag) keeps its fixed width.
if (new URLSearchParams(window.location.search).get("ctx") === "window") {
  document.documentElement.dataset.ctx = "window";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

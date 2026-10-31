import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./light.css";
import "./amiga.css";
import "./freestyle.css";
import "./ui-colors.css";
import "./fullWidth.css";
import { startAnalytics } from "./analytics";

startAnalytics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

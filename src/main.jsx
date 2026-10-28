import React from "react";
import { createRoot } from "react-dom/client";
import CardLedger from "./CardLedger";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CardLedger />
  </React.StrictMode>
);

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "src", "App.jsx");
const runtimePath = path.join(root, "src", "runtime.jsx");

let source = fs.readFileSync(appPath, "utf8");

source = source.replace(
  'import { useState, useEffect, useMemo } from "react";',
  'import React, { useState, useEffect, useMemo } from "react";\nimport { createRoot } from "react-dom/client";'
);
source = source.replace("export default function App()", "function App()");

source += `

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

fs.writeFileSync(runtimePath, source, "utf8");
console.log(`Generated ${path.relative(root, runtimePath)}`);

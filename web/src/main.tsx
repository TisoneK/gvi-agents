import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// No StrictMode: this is a live canvas/engine app where double-invoked effects
// would spawn the autonomous engine twice.
createRoot(document.getElementById("root")!).render(<App />);

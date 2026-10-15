import { HashRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";

// HashRouter keeps deep links working on GitHub Pages (static hosting, no server rewrites).
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}

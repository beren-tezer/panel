import React from "react";
import { createRoot } from "react-dom/client";
import App, { demoSource } from "../AgencyWorkspace.jsx";
import { createSupabaseSource } from "../workspaceData.js";
import { supabase, supabaseConfig, supabaseConfigError } from "./supabase.js";
import "./index.css";

const root = createRoot(document.getElementById("root"));

// Geliştirme sırasında http://localhost:5173/?demo → bellek içi demo verisi (rol değiştirici ile tüm roller test edilir).
// Üretim derlemesinde bu seçenek yoktur; panel her zaman Supabase ile açılır.
const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");

// Yalnızca geliştirme: ?authdemo → demo verisi + bellek içi oturum (giriş / çıkış / yönlendirme testleri). Üretimde yoktur.
const authDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has("authdemo");

if (authDemo) {
  import("../devAuthSource.js").then(({ createAuthDemoSource }) => {
    root.render(<React.StrictMode><App source={createAuthDemoSource(demoSource)} /></React.StrictMode>);
  });
} else if (demo) {
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else if (supabaseConfigError) {
  root.render(<p style={{ fontFamily: "system-ui", padding: 24, color: "#b91c1c" }}>{supabaseConfigError}</p>);
} else {
  const source = createSupabaseSource(supabase, { storage: supabaseConfig });
  root.render(
    <React.StrictMode>
      <App source={source} />
    </React.StrictMode>,
  );
}

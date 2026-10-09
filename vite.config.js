import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Yan klasörlerdeki eski Figma projeleri izlenmez.
  server: { watch: { ignored: ["**/B2B SaaS Web App Interface/**", "**/Agency Workspace Admin Dashboard/**", "**/High-Fidelity SaaS Interface Design/**"] } },
});

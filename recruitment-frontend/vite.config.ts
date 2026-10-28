import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api calls go to the backend on port 5000, so no CORS setup is needed.
// Set BACKEND_URL to use a different backend address.
export default defineConfig({
  plugins: [react()],
  css: { postcss: {} }, // don't pick up the Next.js app's PostCSS/Tailwind setup in the folder above
  server: {
    port: 5173,
    host: true, // also reachable from a phone on the same Wi-Fi
    proxy: {
      "/api": process.env.BACKEND_URL ?? "http://localhost:5000",
    },
  },
});

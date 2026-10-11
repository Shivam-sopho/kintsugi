import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev and preview, /api and /a2a are proxied to the FastAPI server on :8080.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8080", "/a2a": "http://localhost:8080" } },
  preview: { proxy: { "/api": "http://localhost:8080", "/a2a": "http://localhost:8080" } },
});

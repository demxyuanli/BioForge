import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("pdfjs-dist") || id.includes("pdf.worker")) return "pdf";
            if (id.includes("docx") || id.includes("jspdf")) return "doc";
            if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-")) return "markdown";
            if (id.includes("react-force-graph")) return "force-graph";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("i18next") || id.includes("i18n")) return "i18n";
            if (id.includes("@tauri-apps")) return "tauri";
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("/scheduler/")) return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

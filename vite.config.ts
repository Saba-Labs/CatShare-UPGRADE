import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import {
  isAllowedPublicImageUrl,
  serverFetchImageAsDataUrl,
} from "./lib/publicImageProxy";

/**
 * Dev / preview: same-origin `/api/fetch-public-image` as production (Vercel/Netlify).
 * Without this, Vite falls through to index.html and JSON.parse throws on "<!DOCTYPE ...".
 */
function devFetchPublicImagePlugin(): Plugin {
  const setup = (middlewares: { use: (fn: unknown) => void }, mode: string) => {
    const env = loadEnv(mode, process.cwd(), "");
    if (!process.env.R2_PUBLIC_BASE_URL && env.VITE_R2_PUBLIC_BASE_URL) {
      process.env.R2_PUBLIC_BASE_URL = env.VITE_R2_PUBLIC_BASE_URL;
    }

    middlewares.use(
      async (
        req: { url?: string },
        res: {
          statusCode: number;
          setHeader: (k: string, v: string) => void;
          end: (b: string) => void;
        },
        next: () => void
      ) => {
        const path = req.url?.split("?")[0] || "";
        if (path !== "/api/fetch-public-image") {
          return next();
        }
        try {
          const full = new URL(req.url || "", "http://localhost");
          const imageUrl = full.searchParams.get("url");
          if (!imageUrl) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing url" }));
            return;
          }
          if (!isAllowedPublicImageUrl(imageUrl)) {
            res.statusCode = 403;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "URL not allowed" }));
            return;
          }
          const dataUrl = await serverFetchImageAsDataUrl(imageUrl);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ dataUrl }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: msg }));
        }
      }
    );
  };

  return {
    name: "dev-fetch-public-image",
    configureServer(server) {
      setup(server.middlewares, server.config.mode);
    },
    configurePreviewServer(server) {
      setup(server.middlewares, server.config.mode);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), devFetchPublicImagePlugin()],
  build: {
    // Optimize bundle size for better ASO metrics
    target: "esnext",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Optimize code splitting for faster load times (ASO factor)
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["react-icons", "@mui/material"],
          "dnd-vendor": ["@hello-pangea/dnd"],
        },
      },
    },
    // Preload critical assets
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
  },
  server: {
    // Better development experience
    open: "/",
    strictPort: false,
  },
  // Optimize performance metrics
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

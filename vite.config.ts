import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import {
  isAllowedPublicImageUrl,
  serverFetchImageAsDataUrl,
} from "./lib/publicImageProxy";
import { createClient } from "@supabase/supabase-js";

/**
 * Dev / preview: Homepage config API proxy for Supabase access.
 */
function devHomepageConfigPlugin(): Plugin {
  const setup = (middlewares: { use: (fn: unknown) => void }, mode: string) => {
    const env = loadEnv(mode, process.cwd(), "");
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("[devHomepageConfigPlugin] Missing Supabase env vars");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    middlewares.use(
      async (
        req: { url?: string; method?: string; on?: (event: string, handler: (data: Buffer) => void) => void },
        res: {
          statusCode: number;
          setHeader: (k: string, v: string) => void;
          end: (b: string) => void;
          writeHead: (code: number, headers: Record<string, string>) => void;
        },
        next: () => void
      ) => {
        const path = req.url?.split("?")[0] || "";
        if (!path.startsWith("/api/homepage-config")) {
          return next();
        }

        // Enable CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.end("");
          return;
        }

        try {
          let body = "";
          if (req.on) {
            await new Promise<void>((resolve) => {
              req.on!("data", (chunk: Buffer) => {
                body += chunk.toString();
              });
              req.on!("end", () => resolve());
            });
          }

          const params = body ? JSON.parse(body) : {};
          const { action, storeId, configId, layout, themeSettings } = params;

          let result: any;

          if (action === "get") {
            const { data, error } = await supabase
              .from("store_homepage_configs")
              .select("*")
              .eq("store_id", storeId)
              .single();

            if (error?.code === "PGRST116") {
              result = { data: null };
            } else if (error) {
              throw new Error(error.message);
            } else {
              result = { data };
            }
          } else if (action === "create") {
            const { data, error } = await supabase
              .from("store_homepage_configs")
              .insert({
                store_id: storeId,
                layout,
                theme_settings: themeSettings,
              })
              .select()
              .single();

            if (error) throw new Error(error.message);
            result = { data };
          } else if (action === "update") {
            const { data, error } = await supabase
              .from("store_homepage_configs")
              .update({
                layout,
                theme_settings: themeSettings,
                updated_at: new Date().toISOString(),
              })
              .eq("id", configId)
              .select()
              .single();

            if (error) throw new Error(error.message);
            result = { data };
          } else if (req.method === "DELETE") {
            const { error } = await supabase
              .from("store_homepage_configs")
              .delete()
              .eq("id", configId);

            if (error) throw new Error(error.message);
            result = { success: true };
          } else {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: msg }));
        }
      }
    );
  };

  return {
    name: "dev-homepage-config",
    configureServer(server) {
      setup(server.middlewares, server.config.mode);
    },
    configurePreviewServer(server) {
      setup(server.middlewares, server.config.mode);
    },
  };
}

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
  plugins: [react(), devHomepageConfigPlugin(), devFetchPublicImagePlugin()],
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

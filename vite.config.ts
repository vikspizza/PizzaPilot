import fs from "fs";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";
import { APP_ROUTE_DIRS } from "./script/app-routes";

const SPA_ROUTES = new Set(
  APP_ROUTE_DIRS.map((dir) => `/${dir}`),
);

function spaRouteRewrites(): Plugin {
  return {
    name: "spa-route-rewrites",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, _res, next) => {
        const pathname = req.url?.split("?")[0] ?? "";
        if (SPA_ROUTES.has(pathname) || pathname.startsWith("/review/")) {
          req.url = "/app.html";
        }
        next();
      });
    },
  };
}

/** Wrangler / static hosts serve `/login` from `login/index.html` (redirects alone are unreliable locally). */
function emitAppRouteShells(): Plugin {
  return {
    name: "emit-app-route-shells",
    closeBundle() {
      const outDir = path.resolve(import.meta.dirname, "dist/public");
      const appHtmlPath = path.join(outDir, "app.html");
      if (!fs.existsSync(appHtmlPath)) {
        return;
      }
      const appHtml = fs.readFileSync(appHtmlPath, "utf8");
      for (const route of APP_ROUTE_DIRS) {
        const dir = path.join(outDir, route);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "index.html"), appHtml);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    spaRouteRewrites(),
    emitAppRouteShells(),
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: path.resolve(import.meta.dirname, "client/index.html"),
        app: path.resolve(import.meta.dirname, "client/app.html"),
      },
      output: {
        // Ensure proper chunking for Cloudflare Pages
        manualChunks: undefined,
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

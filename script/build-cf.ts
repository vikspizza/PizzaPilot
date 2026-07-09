import { build } from "vite";
import path from "path";
import fs from "fs";
import { APP_ROUTE_DIRS } from "./app-routes";

async function buildForCloudflare() {
  console.log("Building for Cloudflare Pages...");

  // Build client
  console.log("Building client...");
  await build({
    root: path.resolve(process.cwd(), "client"),
    build: {
      outDir: path.resolve(process.cwd(), "dist/public"),
      emptyOutDir: true,
    },
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
  });

  // Copy attached_assets to public directory
  const assetsSrc = path.resolve(process.cwd(), "attached_assets");
  const assetsDest = path.resolve(process.cwd(), "dist/public/attached_assets");
  
  if (fs.existsSync(assetsSrc)) {
    console.log("Copying attached_assets...");
    if (fs.existsSync(assetsDest)) {
      fs.rmSync(assetsDest, { recursive: true, force: true });
    }
    fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  }

  // Ensure React shells exist for /login, /admin, etc. (Wrangler ignores _redirects rewrites)
  const outDir = path.resolve(process.cwd(), "dist/public");
  const appHtmlPath = path.join(outDir, "app.html");
  if (fs.existsSync(appHtmlPath)) {
    const appHtml = fs.readFileSync(appHtmlPath, "utf8");
    for (const route of APP_ROUTE_DIRS) {
      const dir = path.join(outDir, route);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), appHtml);
    }
  }

  // Copy functions directory structure is already in place
  // Cloudflare Pages will automatically detect functions/ directory

  console.log("✅ Build complete!");
  console.log("Output directory: dist/public");
  console.log("Functions directory: functions/");
}

buildForCloudflare().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});



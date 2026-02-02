import { build } from "vite";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

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



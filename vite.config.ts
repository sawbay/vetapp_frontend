import path from "path";
import { execSync } from "child_process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const getGitValue = (command: string) => {
  try {
    return execSync(command).toString().trim();
  } catch {
    return "unknown";
  }
};

const commitHash = getGitValue("git rev-parse --short HEAD");
const commitMessage = getGitValue("git log -1 --pretty=%s");
const commitTimestamp = getGitValue("git log -1 --pretty=%cI");

export default defineConfig({
  server: {
    open: true,
  },
  plugins: [
    react(),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
      buffer: 'buffer',
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_MESSAGE__: JSON.stringify(commitMessage),
    __COMMIT_TIMESTAMP__: JSON.stringify(commitTimestamp),
  },
});

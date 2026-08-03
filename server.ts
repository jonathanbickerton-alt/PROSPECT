/**
 * LOCAL DEVELOPMENT ONLY. This file must never ship.
 *
 * Production is served by nginx from the Vite build output - see Dockerfile
 * and nginx.conf. The container has no Node runtime and no Express server.
 *
 * The exclusion that guarantees this lives in the Dockerfile, not in
 * .gitignore: stage 2 copies ONLY /app/dist into the nginx image, so nothing
 * else in the repository can reach production regardless of what is tracked.
 * This file was previously untracked to enforce that, which put a deployment
 * boundary in a version-control tool - see EXPECTED.md.
 *
 * Run locally with `npm run dev:express`.
 */
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

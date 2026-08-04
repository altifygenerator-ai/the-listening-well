import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import configHandler from "./api/config.js";
import wishHandler from "./api/wish.js";
import stateHandler from "./api/state.js";
import sealHandler from "./api/seal.js";
import checkoutHandler from "./api/checkout.js";
import webhookHandler from "./api/stripe-webhook.js";
import monthlyHandler from "./api/monthly.js";
import deleteSessionHandler from "./api/delete-session.js";
import adminSetupHandler from "./api/admin-setup.js";
import adminLoginHandler from "./api/admin-login.js";
import adminLogoutHandler from "./api/admin-logout.js";
import adminMeHandler from "./api/admin-me.js";
import adminDashboardHandler from "./api/admin-dashboard.js";
import adminGrantHandler from "./api/admin-grant.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

const apiRoutes = new Map([
  ["/api/config", configHandler],
  ["/api/wish", wishHandler],
  ["/api/state", stateHandler],
  ["/api/seal", sealHandler],
  ["/api/checkout", checkoutHandler],
  ["/api/stripe-webhook", webhookHandler],
  ["/api/monthly", monthlyHandler],
  ["/api/delete-session", deleteSessionHandler],
  ["/api/admin/setup", adminSetupHandler],
  ["/api/admin/login", adminLoginHandler],
  ["/api/admin/logout", adminLogoutHandler],
  ["/api/admin/me", adminMeHandler],
  ["/api/admin/dashboard", adminDashboardHandler],
  ["/api/admin/grant", adminGrantHandler]
]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function addSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

const server = http.createServer(async (req, res) => {
  addSecurityHeaders(res);
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const handler = apiRoutes.get(url.pathname);
  if (handler) {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Unexpected server error" }));
      }
    }
    return;
  }

  let relative = decodeURIComponent(url.pathname);
  if (relative === "/") relative = "/index.html";
  const resolved = path.resolve(publicDir, `.${relative}`);
  if (!resolved.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  try {
    const stat = await fs.stat(resolved);
    const file = stat.isDirectory() ? path.join(resolved, "index.html") : resolved;
    const body = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    if ([".html", ".css", ".js"].includes(ext)) res.setHeader("Cache-Control", "no-cache");
    else res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(body);
  } catch {
    try {
      const body = await fs.readFile(path.join(publicDir, "index.html"));
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  }
});

server.listen(port, () => {
  console.log(`The Listening Well is running at http://localhost:${port}`);
});

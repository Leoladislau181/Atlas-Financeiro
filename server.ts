import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { parseReceiptHandler } from "./server/api/parse-receipt.ts";
import { togglePremiumHandler, getAdminDataHandler, toggleUserStatusHandler } from "./server/api/admin.ts";
import { createPreferenceHandler, mercadoPagoWebhookHandler } from "./server/api/mercadopago.ts";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mercado Pago Webhook
  app.post("/api/mercadopago/webhook", express.json(), mercadoPagoWebhookHandler);

  // Middleware to parse JSON bodies (increased limit for base64 images)
  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ ok: true, service: "atlas-financeiro-api" });
  });

  app.post("/api/parse-receipt", parseReceiptHandler);
  app.post("/api/admin/toggle-premium", togglePremiumHandler);
  app.post("/api/admin/toggle-status", toggleUserStatusHandler);
  app.get("/api/admin/data", getAdminDataHandler);
  app.post("/api/mercadopago/create-preference", createPreferenceHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

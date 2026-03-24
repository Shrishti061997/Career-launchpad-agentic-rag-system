import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import aiRoutes from "./routes/ai.js";
import ragRoutes from "./routes/rag.js";

dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware 
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? true
    : ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "2mb" }));

// Rate limiting: 30 AI requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please wait a moment and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes 
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/rag", aiLimiter, ragRoutes);

// Serve React build in production
const clientBuild = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuild));

// 404 for API routes, serve index.html for everything else (SPA)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Route not found" });
  }
  res.sendFile(path.join(clientBuild, "index.html"));
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start Server 
app.listen(PORT, () => {
  console.log(`\n🚀 Career Launchpad API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   AI routes:    /api/ai/*`);
  console.log(`   RAG routes:   /api/rag/* (requires Python RAG service on :8000)\n`);

  if (!process.env.NVIDIA_API_KEY) {
    console.warn("⚠️  WARNING: NVIDIA_API_KEY is not set in .env file!");
    console.warn("   Get a free key at: https://build.nvidia.com");
    console.warn("   Copy .env.example to .env and add your key.\n");
  }
});

export default app;

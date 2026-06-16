import express from "express";
import cors from "cors";
import path from "path";
import session from "express-session";
import passport from "passport";
import swaggerUi from "swagger-ui-express";
import { router } from "./routes";
import { swaggerSpec } from "./config/swagger";
import { configureGoogleStrategy } from "./modules/auth/google.strategy";
import { stripeWebhook } from "./modules/pedidos/stripe.controller";

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Sessão (necessária para Passport durante o fluxo OAuth) ──────────────────
app.use(session({
  secret: process.env.SESSION_SECRET ?? "session_secret_dev",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // HTTPS apenas em produção
    httpOnly: true,
    maxAge: 5 * 60 * 1000, // 5 min — só para o handshake OAuth
  },
}));

// ── Passport ──────────────────────────────────────────────────────────────────
configureGoogleStrategy();
app.use(passport.initialize());
app.use(passport.session());

// ── Uploads estáticos ────────────────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

// ── Swagger ───────────────────────────────────────────────────────────────────
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "3D Farm API Docs",
  swaggerOptions: { persistAuthorization: true },
}));
app.get("/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use(router);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export { app };

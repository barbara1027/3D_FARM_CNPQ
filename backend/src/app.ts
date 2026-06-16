import express from "express";
import cors from "cors";
import path from "path";
import session from "express-session";
import passport from "passport";
import swaggerUi from "swagger-ui-express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { router } from "./routes";
import { swaggerSpec } from "./config/swagger";
import { configureGoogleStrategy } from "./modules/auth/google.strategy";
import { stripeWebhook } from "./modules/pedidos/stripe.controller";

const app = express();

app.use(helmet());

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em 15 minutos." },
});

const cadastroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de cadastros atingido. Tente novamente em 1 hora." },
});

app.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

configureGoogleStrategy();
app.use(passport.initialize());
app.use(passport.session());

// Arquivos de upload não são servidos como estáticos — acesso via /arquivos/:id com autenticação

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "3D Farm API Docs",
  swaggerOptions: { persistAuthorization: true },
}));
app.get("/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use("/auth/login", authLimiter);
app.use("/usuarios", cadastroLimiter);
app.use(router);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export { app };

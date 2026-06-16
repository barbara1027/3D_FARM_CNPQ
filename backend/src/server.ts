import "dotenv/config";
import { app } from "./app";

const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET", "SESSION_SECRET"];

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[ERRO] Variáveis de ambiente obrigatórias não definidas: ${missing.join(", ")}`);
    console.error("[ERRO] Configure o arquivo backend/.env antes de iniciar o servidor.");
    process.exit(1);
  }
  if (process.env.JWT_SECRET?.includes("troque_por_uma_chave")) {
    console.warn("[AVISO] JWT_SECRET ainda é o placeholder. Troque por uma string aleatória forte em .env!");
  }
  if (process.env.SESSION_SECRET === "troque_aqui") {
    console.warn("[AVISO] SESSION_SECRET ainda é o placeholder. Troque por uma string aleatória em .env!");
  }
}

validateEnv();

const PORT = Number(process.env.PORT ?? 3333);

app.listen(PORT, () => {
  console.log(`\n Servidor rodando em http://localhost:${PORT}`);
  console.log(` Documentação Swagger em http://localhost:${PORT}/docs\n`);
});

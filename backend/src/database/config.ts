import "dotenv/config";

export const DB_CHARSET = "utf8mb4";
export const DB_COLLATION = "utf8mb4_unicode_ci";
export const MYSQL_MIN_VERSION = "8.0.16";

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const SYSTEM_SCHEMAS = new Set([
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
]);

function requiredValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Variável de ambiente obrigatória ausente ou inválida: ${name}.`);
  }
  return value.trim();
}

export function validateDatabaseName(database: string): string {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(database)) {
    throw new Error("DB_NAME deve conter somente letras ASCII, números e underscore, com 1 a 64 caracteres.");
  }
  if (SYSTEM_SCHEMAS.has(database.toLowerCase())) {
    throw new Error("DB_NAME não pode apontar para um schema interno do MySQL.");
  }
  return database;
}

export function getDatabaseConfig(): DatabaseConfig {
  const portRaw = requiredValue("DB_PORT");
  if (!/^\d+$/.test(portRaw)) {
    throw new Error("DB_PORT deve ser um número inteiro entre 1 e 65535.");
  }

  const port = Number(portRaw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT deve ser um número inteiro entre 1 e 65535.");
  }

  const password = process.env.DB_PASSWORD;
  if (password === undefined || password.trim() === "") {
    throw new Error("Variável de ambiente obrigatória ausente ou inválida: DB_PASSWORD.");
  }

  return {
    host: requiredValue("DB_HOST"),
    port,
    user: requiredValue("DB_USER"),
    password,
    database: validateDatabaseName(requiredValue("DB_NAME")),
  };
}

export function quoteDatabaseName(database: string): string {
  return `\`${validateDatabaseName(database)}\``;
}

export function assertSupportedMySqlVersion(version: string): void {
  if (/mariadb/i.test(version)) {
    throw new Error(`Servidor incompatível (${version}). Use MySQL ${MYSQL_MIN_VERSION} ou superior.`);
  }

  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) {
    throw new Error(`Não foi possível interpretar a versão do servidor MySQL: ${version}.`);
  }

  const current = match.slice(1).map(Number);
  const minimum = MYSQL_MIN_VERSION.split(".").map(Number);
  let comparison = 0;
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] > minimum[index]) { comparison = 1; break; }
    if (current[index] < minimum[index]) { comparison = -1; break; }
  }

  if (comparison < 0) {
    throw new Error(`MySQL ${version} não aplica todas as CHECK constraints exigidas. Use MySQL ${MYSQL_MIN_VERSION} ou superior.`);
  }
}

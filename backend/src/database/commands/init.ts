import "dotenv/config";
import { createHash } from "node:crypto";
import mysql, { Connection } from "mysql2/promise";
import {
  assertSupportedMySqlVersion,
  DB_CHARSET,
  DB_COLLATION,
  getDatabaseConfig,
  quoteDatabaseName,
} from "../config";
import { loadSchemaSource } from "../schema-expectations";

function lockName(database: string): string {
  const digest = createHash("sha256").update(database).digest("hex").slice(0, 32);
  return `3d_farm_db_init_${digest}`;
}

async function acquireLock(connection: Connection, name: string): Promise<void> {
  const [rows]: any = await connection.execute("SELECT GET_LOCK(?, 0) AS acquired", [name]);
  if (Number(rows[0]?.acquired) !== 1) {
    throw new Error("Outra inicialização deste banco já está em andamento.");
  }
}

async function releaseLock(connection: Connection, name: string): Promise<void> {
  await connection.execute("SELECT RELEASE_LOCK(?)", [name]).catch(() => undefined);
}

export async function initializeDatabase(): Promise<void> {
  const config = getDatabaseConfig();
  const databaseIdentifier = quoteDatabaseName(config.database);
  const schema = await loadSchemaSource();
  const initLock = lockName(config.database);
  let connection: Connection | undefined;
  let locked = false;

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      charset: DB_COLLATION,
      timezone: "Z",
      multipleStatements: false,
    });
    await connection.query("SET SESSION time_zone = '+00:00'");

    const [versionRows]: any = await connection.query("SELECT VERSION() AS version");
    assertSupportedMySqlVersion(String(versionRows[0]?.version ?? ""));

    await acquireLock(connection, initLock);
    locked = true;

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${databaseIdentifier} CHARACTER SET ${DB_CHARSET} COLLATE ${DB_COLLATION}`,
    );

    const [schemaRows]: any = await connection.execute(
      `SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation
       FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [config.database],
    );
    const databaseMetadata = schemaRows[0];
    if (!databaseMetadata || databaseMetadata.charset !== DB_CHARSET || databaseMetadata.collation !== DB_COLLATION) {
      throw new Error(
        `O banco ${config.database} não usa ${DB_CHARSET}/${DB_COLLATION}. ` +
        "O db:init não altera um banco existente; use um banco descartável vazio com a configuração correta.",
      );
    }

    const [objects]: any = await connection.execute(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [config.database],
    );
    if (objects.length > 0) {
      const names = objects.map((row: any) => row.name).join(", ");
      throw new Error(
        `O banco ${config.database} não está vazio (${names}). ` +
        "A inicialização foi recusada sem alterar tabelas ou dados.",
      );
    }

    await connection.query(`USE ${databaseIdentifier}`);

    for (const file of schema.files) {
      try {
        await connection.query(file.sql);
        console.log(`[db:init] OK ${file.name}`);
      } catch (error: any) {
        const code = error?.code ? ` (${error.code})` : "";
        throw new Error(`Falha no arquivo ${file.name}${code}: ${error?.sqlMessage ?? error?.message ?? "erro desconhecido"}`);
      }
    }

    console.log(`[db:init] Banco ${config.database} criado com ${schema.tables.size} tabelas funcionais.`);
  } finally {
    if (connection) {
      if (locked) await releaseLock(connection, initLock);
      await connection.end();
    }
  }
}

if (require.main === module) {
  initializeDatabase().catch((error: any) => {
    console.error(`[db:init] ERRO: ${error?.message ?? error}`);
    console.error("[db:init] Nenhuma limpeza automática foi feita. Para repetir, use outro banco descartável vazio ou remova manualmente apenas o banco de teste confirmado.");
    process.exitCode = 1;
  });
}

import mysql from "mysql2";
import { DB_COLLATION, getDatabaseConfig } from "./config";

const config = getDatabaseConfig();

const pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  charset: DB_COLLATION,
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false,
});

pool.on("connection", (connection) => {
  connection.query("SET SESSION time_zone = '+00:00'", (error) => {
    if (error) {
      console.error("[DB] Não foi possível configurar a sessão MySQL em UTC.");
      connection.destroy();
    }
  });
});

export const db = pool.promise();

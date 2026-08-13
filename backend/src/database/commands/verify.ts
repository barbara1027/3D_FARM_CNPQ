import "dotenv/config";
import mysql from "mysql2/promise";
import {
  assertSupportedMySqlVersion,
  DB_CHARSET,
  DB_COLLATION,
  getDatabaseConfig,
} from "../config";
import {
  EXPECTED_TABLES,
  ExpectedForeignKey,
  ExpectedIndex,
  loadSchemaSource,
  normalizeColumnType,
  normalizeDefaultValue,
  normalizeSqlExpression,
} from "../schema-expectations";

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function groupOrdered(rows: any[], key: (row: any) => string, value: (row: any) => string): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const values = grouped.get(groupKey) ?? [];
    values.push(value(row));
    grouped.set(groupKey, values);
  }
  return grouped;
}

export async function collectSchemaDifferences(): Promise<string[]> {
  const config = getDatabaseConfig();
  const expected = await loadSchemaSource();
  const differences: string[] = [];
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: DB_COLLATION,
    timezone: "Z",
    multipleStatements: false,
  });

  try {
    await connection.query("SET SESSION time_zone = '+00:00'");
    const [versionRows]: any = await connection.query("SELECT VERSION() AS version");
    assertSupportedMySqlVersion(String(versionRows[0]?.version ?? ""));

    const [schemaRows]: any = await connection.execute(
      `SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation
       FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [config.database],
    );
    if (!schemaRows[0]) {
      return [`Banco esperado não encontrado: ${config.database}.`];
    }
    if (schemaRows[0].charset !== DB_CHARSET) differences.push(`Charset do banco: esperado ${DB_CHARSET}, encontrado ${schemaRows[0].charset}.`);
    if (schemaRows[0].collation !== DB_COLLATION) differences.push(`Collation do banco: esperado ${DB_COLLATION}, encontrado ${schemaRows[0].collation}.`);

    const [tableRows]: any = await connection.execute(
      `SELECT TABLE_NAME AS tableName, TABLE_TYPE AS tableType, ENGINE AS engine, TABLE_COLLATION AS collation
       FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [config.database],
    );
    const actualTableNames = tableRows.map((row: any) => row.tableName).sort();
    const expectedTableNames = [...EXPECTED_TABLES].sort();
    if (!sameList(actualTableNames, expectedTableNames)) {
      differences.push(`Tabelas: esperado [${expectedTableNames.join(", ")}], encontrado [${actualTableNames.join(", ")}].`);
    }
    for (const row of tableRows) {
      if (!expected.tables.has(row.tableName)) continue;
      if (row.tableType !== "BASE TABLE") differences.push(`${row.tableName}: objeto não é BASE TABLE.`);
      if (String(row.engine).toLowerCase() !== "innodb") differences.push(`${row.tableName}: engine esperado InnoDB, encontrado ${row.engine}.`);
      if (row.collation !== DB_COLLATION) differences.push(`${row.tableName}: collation esperado ${DB_COLLATION}, encontrado ${row.collation}.`);
    }

    const [columnRows]: any = await connection.execute(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType,
              IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault,
              EXTRA AS extra, GENERATION_EXPRESSION AS generationExpression,
              CHARACTER_SET_NAME AS characterSetName, COLLATION_NAME AS collationName
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [config.database],
    );
    const actualColumns = new Map<string, any[]>();
    for (const row of columnRows) {
      const rows = actualColumns.get(row.tableName) ?? [];
      rows.push(row);
      actualColumns.set(row.tableName, rows);
    }
    for (const table of expected.tables.values()) {
      const actual = actualColumns.get(table.name) ?? [];
      const actualNames = actual.map((row) => row.columnName);
      const expectedNames = table.columns.map((column) => column.name);
      if (!sameList(actualNames, expectedNames)) {
        differences.push(`${table.name}: colunas esperadas [${expectedNames.join(", ")}], encontradas [${actualNames.join(", ")}].`);
      }
      for (const column of table.columns) {
        const found = actual.find((row) => row.columnName === column.name);
        if (!found) continue;
        if (normalizeColumnType(found.columnType) !== column.type) {
          differences.push(`${table.name}.${column.name}: tipo esperado ${column.type}, encontrado ${normalizeColumnType(found.columnType)}.`);
        }
        if ((found.isNullable === "YES") !== column.nullable) {
          differences.push(`${table.name}.${column.name}: nulabilidade divergente.`);
        }
        const actualDefault = normalizeDefaultValue(found.columnDefault);
        const expectedDefault = column.hasDefault ? normalizeDefaultValue(column.defaultValue) : "<null>";
        if (actualDefault !== expectedDefault) {
          differences.push(`${table.name}.${column.name}: default esperado ${expectedDefault}, encontrado ${actualDefault}.`);
        }
        const baseType = /^[a-z]+/.exec(column.type)?.[0] ?? "";
        const textual = ["char", "varchar", "tinytext", "text", "mediumtext", "longtext", "enum", "set"].includes(baseType);
        if (textual && (found.characterSetName !== DB_CHARSET || found.collationName !== DB_COLLATION)) {
          differences.push(`${table.name}.${column.name}: charset/collation de coluna divergente.`);
        }
        const extra = String(found.extra ?? "").toLowerCase();
        const storageMatch = /\b(virtual|stored) generated\b/.exec(extra);
        const generationStorage = storageMatch ? storageMatch[1] : null;
        const isGenerated = generationStorage !== null;
        if (column.autoIncrement !== extra.includes("auto_increment")) differences.push(`${table.name}.${column.name}: AUTO_INCREMENT divergente.`);
        if (column.generated !== isGenerated) differences.push(`${table.name}.${column.name}: estado de coluna gerada divergente.`);
        if (column.generationStorage !== generationStorage) differences.push(`${table.name}.${column.name}: armazenamento da coluna gerada divergente.`);
        if (column.generated && normalizeSqlExpression(String(found.generationExpression ?? "")) !== normalizeSqlExpression(column.generationExpression ?? "")) {
          differences.push(`${table.name}.${column.name}: expressão gerada divergente.`);
        }
        if (column.onUpdateCurrentTimestamp !== extra.includes("on update current_timestamp")) differences.push(`${table.name}.${column.name}: ON UPDATE CURRENT_TIMESTAMP divergente.`);
      }
    }

    const [primaryRows]: any = await connection.execute(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [config.database],
    );
    const primaryKeys = groupOrdered(primaryRows, (row) => row.tableName, (row) => row.columnName);
    for (const table of expected.tables.values()) {
      const actual = primaryKeys.get(table.name) ?? [];
      if (!sameList(actual, table.primaryKey)) differences.push(`${table.name}: PK esperada [${table.primaryKey.join(", ")}], encontrada [${actual.join(", ")}].`);
    }

    const [indexRows]: any = await connection.execute(
      `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, NON_UNIQUE AS nonUnique,
              COLUMN_NAME AS columnName, SEQ_IN_INDEX AS sequenceInIndex,
              COLLATION AS indexCollation, SUB_PART AS subPart,
              INDEX_TYPE AS indexType, IS_VISIBLE AS isVisible
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND INDEX_NAME <> 'PRIMARY'
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [config.database],
    );
    const indexes = new Map<string, ExpectedIndex>();
    for (const row of indexRows) {
      const key = `${row.tableName}.${row.indexName}`;
      if (row.indexCollation !== "A" || row.subPart !== null || row.indexType !== "BTREE" || row.isVisible !== "YES") {
        differences.push(`${key}: direção, prefixo, tipo ou visibilidade do índice divergente.`);
      }
      const current: ExpectedIndex = indexes.get(key) ?? {
        name: String(row.indexName),
        columns: [],
        unique: Number(row.nonUnique) === 0,
      };
      current.columns.push(row.columnName);
      indexes.set(key, current);
    }
    for (const table of expected.tables.values()) {
      const expectedNames = table.indexes.map((index) => index.name).sort();
      const actualNames = [...indexes.keys()].filter((key) => key.startsWith(`${table.name}.`)).map((key) => key.slice(table.name.length + 1)).sort();
      if (!sameList(actualNames, expectedNames)) differences.push(`${table.name}: índices esperados [${expectedNames.join(", ")}], encontrados [${actualNames.join(", ")}].`);
      for (const index of table.indexes) {
        const actual = indexes.get(`${table.name}.${index.name}`);
        if (!actual) continue;
        if (actual.unique !== index.unique || !sameList(actual.columns, index.columns)) differences.push(`${table.name}.${index.name}: definição do índice divergente.`);
      }
    }

    const [foreignKeyRows]: any = await connection.execute(
      `SELECT k.TABLE_NAME AS tableName, k.CONSTRAINT_NAME AS constraintName,
              k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_SCHEMA AS referencedSchema,
              k.REFERENCED_TABLE_NAME AS referencedTable,
              k.REFERENCED_COLUMN_NAME AS referencedColumn,
              r.DELETE_RULE AS deleteRule, r.UPDATE_RULE AS updateRule
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND r.TABLE_NAME = k.TABLE_NAME
        AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
      [config.database],
    );
    const foreignKeys = new Map<string, ExpectedForeignKey>();
    for (const row of foreignKeyRows) {
      const key = `${row.tableName}.${row.constraintName}`;
      if (row.referencedSchema !== config.database) differences.push(`${key}: FK referencia o schema inesperado ${row.referencedSchema}.`);
      const current: ExpectedForeignKey = foreignKeys.get(key) ?? {
        name: String(row.constraintName),
        columns: [],
        referencedTable: String(row.referencedTable),
        referencedColumns: [],
        deleteRule: String(row.deleteRule),
        updateRule: String(row.updateRule),
      };
      current.columns.push(row.columnName);
      current.referencedColumns.push(row.referencedColumn);
      foreignKeys.set(key, current);
    }
    for (const table of expected.tables.values()) {
      const expectedNames = table.foreignKeys.map((fk) => fk.name).sort();
      const actualNames = [...foreignKeys.keys()].filter((key) => key.startsWith(`${table.name}.`)).map((key) => key.slice(table.name.length + 1)).sort();
      if (!sameList(actualNames, expectedNames)) differences.push(`${table.name}: FKs esperadas [${expectedNames.join(", ")}], encontradas [${actualNames.join(", ")}].`);
      for (const foreignKey of table.foreignKeys) {
        const actual = foreignKeys.get(`${table.name}.${foreignKey.name}`);
        if (!actual) continue;
        if (!sameList(actual.columns, foreignKey.columns) ||
            actual.referencedTable !== foreignKey.referencedTable ||
            !sameList(actual.referencedColumns, foreignKey.referencedColumns) ||
            actual.deleteRule !== foreignKey.deleteRule || actual.updateRule !== foreignKey.updateRule) {
          differences.push(`${table.name}.${foreignKey.name}: definição da FK divergente.`);
        }
      }
    }

    const [checkRows]: any = await connection.execute(
      `SELECT tc.TABLE_NAME AS tableName, tc.CONSTRAINT_NAME AS constraintName,
              tc.ENFORCED AS enforced, cc.CHECK_CLAUSE AS checkClause
       FROM information_schema.TABLE_CONSTRAINTS tc
       JOIN information_schema.CHECK_CONSTRAINTS cc
         ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
       WHERE tc.TABLE_SCHEMA = ? AND tc.CONSTRAINT_TYPE = 'CHECK'
       ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME`,
      [config.database],
    );
    for (const row of checkRows) {
      if (row.enforced !== "YES") differences.push(`${row.tableName}.${row.constraintName}: CHECK constraint não está aplicada.`);
    }
    const checks = groupOrdered(checkRows, (row) => row.tableName, (row) => row.constraintName);
    for (const table of expected.tables.values()) {
      const actual = (checks.get(table.name) ?? []).sort();
      const wanted = table.checks.map((check) => check.name).sort();
      if (!sameList(actual, wanted)) differences.push(`${table.name}: CHECK constraints esperadas [${wanted.join(", ")}], encontradas [${actual.join(", ")}].`);
      for (const check of table.checks) {
        const found = checkRows.find((row: any) => row.tableName === table.name && row.constraintName === check.name);
        if (found && normalizeSqlExpression(String(found.checkClause ?? "")) !== normalizeSqlExpression(check.expression)) {
          differences.push(`${table.name}.${check.name}: expressão da CHECK constraint divergente.`);
        }
      }
    }
  } finally {
    await connection.end();
  }

  return differences.sort();
}

export async function verifyDatabase(options: { quiet?: boolean } = {}): Promise<void> {
  const differences = await collectSchemaDifferences();
  if (differences.length > 0) {
    throw new Error(`Schema divergente:\n- ${differences.join("\n- ")}`);
  }
  if (!options.quiet) console.log(`[db:verify] Schema válido: ${EXPECTED_TABLES.length} tabelas verificadas.`);
}

if (require.main === module) {
  verifyDatabase().catch((error: any) => {
    console.error(`[db:verify] ERRO: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}

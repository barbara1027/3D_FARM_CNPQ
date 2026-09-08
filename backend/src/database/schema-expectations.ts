import { readFile } from "node:fs/promises";
import path from "node:path";

export const SCHEMA_FILES = [
  "001_create_usuarios.sql",
  "002_create_materiais.sql",
  "003_create_qualidades.sql",
  "004_create_arquivos.sql",
  "005_create_pedidos.sql",
  "006_create_impressoras.sql",
  "007_create_impressora_slots_filamento.sql",
  "007_create_pedido_impressora.sql",
  "008_create_impressora_eventos.sql",
  "009_create_chat_mensagens.sql",
  "010_add_arquivos_pedido_fk.sql",
] as const;

export const EXPECTED_TABLES = [
  "usuarios",
  "materiais",
  "qualidades",
  "arquivos",
  "pedidos",
  "impressoras",
  "impressora_slots_filamento",
  "pedido_impressora",
  "impressora_eventos",
  "chat_mensagens",
] as const;

export interface ExpectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  defaultValue: string | null;
  autoIncrement: boolean;
  generated: boolean;
  generationExpression: string | null;
  generationStorage: "stored" | "virtual" | null;
  onUpdateCurrentTimestamp: boolean;
}

export interface ExpectedIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ExpectedForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  deleteRule: string;
  updateRule: string;
}

export interface ExpectedCheck {
  name: string;
  expression: string;
}

export interface ExpectedTable {
  name: string;
  columns: ExpectedColumn[];
  primaryKey: string[];
  indexes: ExpectedIndex[];
  foreignKeys: ExpectedForeignKey[];
  checks: ExpectedCheck[];
}

export interface SchemaSource {
  files: { name: string; path: string; sql: string }[];
  tables: Map<string, ExpectedTable>;
}

export function normalizeColumnType(value: string): string {
  const compact = value.toLowerCase().replace(/\s+/g, "");
  return compact.replace(/^(tinyint|smallint|mediumint|int|integer|bigint)\(\d+\)/, "$1");
}

export function normalizeSqlExpression(value: string): string {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/_utf8mb4(?=\\?')/g, "")
    .replace(/\\(?=')/g, "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
}

export function normalizeDefaultValue(value: unknown): string {
  if (value === null || value === undefined) return "<null>";
  let normalized = String(value).trim();
  if (/^current_timestamp(?:\(\))?$/i.test(normalized)) return "current_timestamp";
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return String(Number(normalized));
  if (normalized.startsWith("'") && normalized.endsWith("'")) {
    normalized = normalized.slice(1, -1).replace(/''/g, "'");
  }
  return normalized;
}

function parseIdentifierList(value: string): string[] {
  return value.split(",").map((item) => item.trim().replace(/^`|`$/g, ""));
}

function findMatchingParen(value: string, openIndex: number): number {
  let depth = 0;
  let quoted = false;

  for (let index = openIndex; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'" && value[index - 1] !== "\\") quoted = !quoted;
    if (quoted) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error("Definição SQL inválida: parêntese não fechado.");
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'" && value[index - 1] !== "\\") quoted = !quoted;
    if (quoted) continue;
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function readColumnType(definition: string): string {
  const word = /^[A-Za-z]+/.exec(definition);
  if (!word) throw new Error(`Tipo de coluna inválido: ${definition}`);

  let end = word[0].length;
  while (/\s/.test(definition[end] ?? "")) end += 1;
  if (definition[end] === "(") end = findMatchingParen(definition, end) + 1;

  const unsigned = /^\s*UNSIGNED\b/i.exec(definition.slice(end));
  if (unsigned) end += unsigned[0].length;
  return normalizeColumnType(definition.slice(0, end));
}

function readDefault(definition: string): { hasDefault: boolean; value: string | null } {
  const match = /\bDEFAULT\s+(CURRENT_TIMESTAMP(?:\(\))?|NULL|'(?:''|[^'])*'|-?\d+(?:\.\d+)?)/i.exec(definition);
  if (!match) return { hasDefault: false, value: null };
  return { hasDefault: true, value: match[1] };
}

function readGeneration(definition: string): {
  expression: string | null;
  storage: "stored" | "virtual" | null;
} {
  const match = /\bGENERATED\s+ALWAYS\s+AS\s*\(/i.exec(definition);
  if (!match || match.index === undefined) return { expression: null, storage: null };
  const openIndex = match.index + match[0].lastIndexOf("(");
  const closeIndex = findMatchingParen(definition, openIndex);
  const storageMatch = /^\s*(STORED|VIRTUAL)\b/i.exec(definition.slice(closeIndex + 1));
  return {
    expression: definition.slice(openIndex + 1, closeIndex),
    storage: storageMatch ? (storageMatch[1].toLowerCase() as "stored" | "virtual") : null,
  };
}

function parseForeignKey(definition: string): ExpectedForeignKey | null {
  const normalized = definition.replace(/\s+/g, " ").trim();
  const match = /^CONSTRAINT `([^`]+)` FOREIGN KEY \(([^)]+)\) REFERENCES `([^`]+)` \(([^)]+)\) ON DELETE (CASCADE|RESTRICT|SET NULL|NO ACTION) ON UPDATE (CASCADE|RESTRICT|SET NULL|NO ACTION)$/i.exec(normalized);
  if (!match) return null;
  return {
    name: match[1],
    columns: parseIdentifierList(match[2]),
    referencedTable: match[3],
    referencedColumns: parseIdentifierList(match[4]),
    deleteRule: match[5].toUpperCase(),
    updateRule: match[6].toUpperCase(),
  };
}

function parseCreateTable(sql: string, sourceName: string): ExpectedTable | null {
  const createMatch = /CREATE\s+TABLE\s+`([^`]+)`\s*\(/i.exec(sql);
  if (!createMatch || createMatch.index === undefined) return null;

  const openIndex = createMatch.index + createMatch[0].lastIndexOf("(");
  const closeIndex = findMatchingParen(sql, openIndex);
  const definitions = splitTopLevel(sql.slice(openIndex + 1, closeIndex));
  const table: ExpectedTable = {
    name: createMatch[1],
    columns: [],
    primaryKey: [],
    indexes: [],
    foreignKeys: [],
    checks: [],
  };

  for (const definition of definitions) {
    const columnMatch = /^`([^`]+)`\s+([\s\S]+)$/i.exec(definition);
    if (columnMatch) {
      const defaultDefinition = readDefault(columnMatch[2]);
      const generation = readGeneration(columnMatch[2]);
      table.columns.push({
        name: columnMatch[1],
        type: readColumnType(columnMatch[2]),
        nullable: !/\bNOT\s+NULL\b/i.test(columnMatch[2]),
        hasDefault: defaultDefinition.hasDefault,
        defaultValue: defaultDefinition.value,
        autoIncrement: /\bAUTO_INCREMENT\b/i.test(columnMatch[2]),
        generated: generation.expression !== null,
        generationExpression: generation.expression,
        generationStorage: generation.storage,
        onUpdateCurrentTimestamp: /\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b/i.test(columnMatch[2]),
      });
      continue;
    }

    const primaryMatch = /^PRIMARY KEY \(([^)]+)\)$/i.exec(definition.replace(/\s+/g, " "));
    if (primaryMatch) {
      table.primaryKey = parseIdentifierList(primaryMatch[1]);
      continue;
    }

    const indexMatch = /^(UNIQUE\s+)?KEY `([^`]+)` \(([^)]+)\)$/i.exec(definition.replace(/\s+/g, " "));
    if (indexMatch) {
      table.indexes.push({
        name: indexMatch[2],
        columns: parseIdentifierList(indexMatch[3]),
        unique: Boolean(indexMatch[1]),
      });
      continue;
    }

    const foreignKey = parseForeignKey(definition);
    if (foreignKey) {
      table.foreignKeys.push(foreignKey);
      continue;
    }

    const checkMatch = /^CONSTRAINT `([^`]+)` CHECK\s*\(/i.exec(definition);
    if (checkMatch && checkMatch.index !== undefined) {
      const openIndex = checkMatch.index + checkMatch[0].lastIndexOf("(");
      const closeIndex = findMatchingParen(definition, openIndex);
      table.checks.push({
        name: checkMatch[1],
        expression: definition.slice(openIndex + 1, closeIndex),
      });
      continue;
    }

    throw new Error(`Definição não reconhecida em ${sourceName}: ${definition}`);
  }

  return table;
}

function parseAlterForeignKeys(sql: string, tables: Map<string, ExpectedTable>): void {
  const normalized = sql.replace(/--[^\r\n]*/g, " ").replace(/\s+/g, " ").trim();
  const match = /^ALTER TABLE `([^`]+)` ADD (CONSTRAINT [\s\S]+?)(?:;)?$/i.exec(normalized);
  if (!match) return;

  const table = tables.get(match[1]);
  if (!table) throw new Error(`ALTER TABLE referencia tabela desconhecida: ${match[1]}.`);
  const foreignKey = parseForeignKey(match[2].replace(/;$/, "").trim());
  if (!foreignKey) throw new Error(`ALTER TABLE permitido deve adicionar somente uma FK: ${normalized}`);
  table.foreignKeys.push(foreignKey);
}

export async function loadSchemaSource(): Promise<SchemaSource> {
  const tablesDirectory = path.join(__dirname, "tables");
  const files = await Promise.all(SCHEMA_FILES.map(async (name) => ({
    name,
    path: path.join(tablesDirectory, name),
    sql: String(await readFile(path.join(tablesDirectory, name))),
  })));

  const tables = new Map<string, ExpectedTable>();
  for (const file of files) {
    const table = parseCreateTable(file.sql, file.name);
    if (table) tables.set(table.name, table);
  }
  for (const file of files) parseAlterForeignKeys(file.sql, tables);

  const actualNames = [...tables.keys()];
  if (actualNames.join(",") !== EXPECTED_TABLES.join(",")) {
    throw new Error(`Ordem/tabelas dos arquivos SQL divergente. Esperado: ${EXPECTED_TABLES.join(", ")}; encontrado: ${actualNames.join(", ")}.`);
  }

  return { files, tables };
}

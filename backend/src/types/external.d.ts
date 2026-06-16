// Este arquivo existia para prover tipos quando não havia @types/* instalados.
// Como o package.json já inclui @types/express, @types/bcrypt, @types/multer etc.,
// as declarações antigas foram removidas para evitar conflitos de tipo.

// Mantemos apenas as declarações que não têm pacote @types correspondente:

declare module "node:fs/promises" {
  export const access: (path: string, mode?: number) => Promise<void>;
  export const readFile: (path: string) => Promise<Buffer>;
}

declare module "node:fs" {
  export const constants: { R_OK: number; W_OK: number; F_OK: number };
}

declare module "node:path" {
  const path: {
    basename: (p: string, ext?: string) => string;
    extname: (p: string) => string;
    resolve: (...paths: string[]) => string;
    join: (...paths: string[]) => string;
  };
  export default path;
}

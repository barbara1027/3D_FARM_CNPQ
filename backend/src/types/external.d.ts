declare module "mysql2/promise" {
  const mysql: any;
  export default mysql;
}

declare module "bcrypt" {
  const bcrypt: any;
  export default bcrypt;
}

declare module "express" {
  export type Request = any;
  export type Response = any;
  export interface Router {
    use: (...args: any[]) => any;
    get: (...args: any[]) => any;
    post: (...args: any[]) => any;
    put: (...args: any[]) => any;
    patch: (...args: any[]) => any;
    delete: (...args: any[]) => any;
  }
  interface ExpressModule {
    (): any;
    json: () => any;
    Router: () => Router;
  }
  const express: ExpressModule;
  export const Router: () => Router;
  export default express;
}

declare module "axios" {
  const axios: {
    get: (...args: any[]) => Promise<any>;
    post: (...args: any[]) => Promise<any>;
  };
  export default axios;
}

declare module "form-data" {
  export default class FormData {
    append(name: string, value: any, fileName?: string): void;
    getHeaders(): Record<string, string>;
  }
}

declare module "node:fs/promises" {
  export const access: any;
  export const readFile: any;
}

declare module "node:fs" {
  export const constants: any;
}

declare module "node:path" {
  const path: any;
  export default path;
}

declare const process: any;
declare const Buffer: any;
type Buffer = any;

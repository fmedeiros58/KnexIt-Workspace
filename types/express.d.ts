declare module "express" {
  export type Request = any;
  export type Response = any;
  export type NextFunction = (...args: any[]) => any;
  export function Router(): any;
  const exp: any;
  export default exp;
}


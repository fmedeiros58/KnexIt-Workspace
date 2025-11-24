declare module "jsonwebtoken" {
  export interface JwtPayload {
    [key: string]: any;
    sub?: string;
  }

  export function sign(payload: any, secret: any, options?: any): string;
  export function verify(token: string, secret: any): JwtPayload;

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
  };

  export default jwt;
}


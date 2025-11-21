import jwt from "jsonwebtoken";
import type { User } from "../models/user";

const secret = process.env.JWT_SECRET ?? "change-me";
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? secret;

export const tokenService = {
  issue(user: User) {
    const accessToken = jwt.sign({ sub: user.id, roles: user.roles }, secret, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign({ sub: user.id }, refreshSecret, {
      expiresIn: "7d",
    });
    return { accessToken, refreshToken };
  },
  refresh(token: string) {
    const payload = jwt.verify(token, refreshSecret) as jwt.JwtPayload;
    return this.issue({ id: payload.sub as string, email: "", name: "", roles: [] });
  },
  fromAuthHeader(header?: string) {
    if (!header) return null;
    const [, token] = header.split(" ");
    return jwt.verify(token, secret);
  },
};

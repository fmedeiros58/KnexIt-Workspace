import { Request, Response } from "express";
import { tokenService } from "../services/tokenService";
import { UserModel } from "../models/user";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await UserModel.verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }

  const tokens = tokenService.issue(user);
  res.json({ user, ...tokens });
}

export async function refreshToken(req: Request, res: Response) {
  const { refreshToken } = req.body;
  const tokens = tokenService.refresh(refreshToken);
  res.json(tokens);
}

export async function profile(req: Request, res: Response) {
  const user = tokenService.fromAuthHeader(req.headers.authorization);
  res.json({ user });
}

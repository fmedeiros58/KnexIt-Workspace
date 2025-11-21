import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "../routes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);

const port = process.env.PORT ?? 4000;

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "auth" });
});

app.listen(port, () => {
  console.log(`[auth] listening on port ${port}`);
});

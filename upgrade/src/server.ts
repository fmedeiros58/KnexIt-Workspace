import express, { Request, Response } from "express";

const app = express();
const port = process.env.UPGRADE_PORT ?? 3200;

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "upgrade" });
});

app.listen(port, () => {
  console.log(`[upgrade] listening on port ${port}`);
});

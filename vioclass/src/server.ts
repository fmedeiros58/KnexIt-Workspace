import express, { Request, Response } from "express";

const app = express();
const port = process.env.VIOCLASS_PORT ?? 3200;

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "vioclass" });
});

app.listen(port, () => {
  console.log(`[vioclass] listening on port ${port}`);
});

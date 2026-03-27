import { Request, Response } from "express";

export default function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ ok: true, service: "atlas-financeiro-api" });
}

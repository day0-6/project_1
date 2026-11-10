import { Router } from "express";
import { ctx, idParam, notFound } from "../lib/http.js";

export function diariesRouter(): Router {
  const r = Router();

  r.get("/", async (req, res) => {
    const { repo } = ctx(req);
    res.json({ diaries: await repo.listDiaries() });
  });

  r.get("/:id", async (req, res) => {
    const { repo } = ctx(req);
    const diary = await repo.getDiary(idParam(req));
    if (!diary) throw notFound();
    res.json({ diary });
  });

  return r;
}

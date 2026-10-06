import request from "supertest";
import { describe, expect, it } from "vitest";
import { criarApp } from "./app.js";

const app = criarApp();

describe("API", () => {
  it("GET /health responde ok sem autenticação", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("rotas /api exigem token", async () => {
    const res = await request(app).get("/api/documentos");
    expect(res.status).toBe(401);
    expect(res.body.erro).toMatch(/login/i);
  });

  it("rota inexistente devolve 404 em JSON", async () => {
    const res = await request(app).get("/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: "Rota não encontrada." });
  });

  it("aplica cabeçalhos de segurança (helmet)", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

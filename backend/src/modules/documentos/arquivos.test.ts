import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/errors.js";
import { cnpjValido } from "../cadastros/empresas.js";
import { gerarStorageKey, nomeOriginal, resolverMime, sha256 } from "./arquivos.js";

describe("gerarStorageKey", () => {
  it("organiza por categoria raiz/ano/mês e normaliza o nome", () => {
    const chave = gerarStorageKey("Jurídico", "Aditivo Nº 2 — Contrato C-2026-014.PDF", new Date("2026-10-05T12:00:00Z"));
    expect(chave).toMatch(/^juridico\/2026\/10\/[0-9a-f-]{36}-aditivo-n-2-contrato-c-2026-014\.pdf$/);
  });
});

describe("resolverMime", () => {
  it("corrige MIME genérico pelo tipo da extensão", () => {
    expect(resolverMime("nota.xml", "application/octet-stream")).toBe("application/xml");
    expect(resolverMime("contrato.pdf", "application/pdf")).toBe("application/pdf");
  });

  it("recusa extensões fora da lista", () => {
    expect(() => resolverMime("virus.exe", "application/x-msdownload")).toThrow(HttpError);
  });
});

describe("nomeOriginal", () => {
  it("corrige nomes UTF-8 lidos como latin1 pelo multer", () => {
    const latin1 = Buffer.from("Certidão.pdf", "utf8").toString("latin1");
    expect(nomeOriginal(latin1)).toBe("Certidão.pdf");
    expect(nomeOriginal("contrato.pdf")).toBe("contrato.pdf");
  });
});

describe("sha256", () => {
  it("gera o hash hexadecimal", () => {
    expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("cnpjValido", () => {
  it("valida dígitos verificadores", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000182")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { FilaProcessamento } from "./fila.js";

function adiado() {
  let resolver!: () => void;
  const promessa = new Promise<void>((r) => (resolver = r));
  return { promessa, resolver };
}

describe("FilaProcessamento", () => {
  it("respeita a concorrência e não duplica pendentes", async () => {
    const fila = new FilaProcessamento(1);
    const chamadas: string[] = [];
    const bloqueios = new Map<string, ReturnType<typeof adiado>>();
    fila.iniciar(async (id) => {
      chamadas.push(id);
      const b = adiado();
      bloqueios.set(id, b);
      await b.promessa;
    });

    fila.adicionar("a");
    fila.adicionar("b");
    fila.adicionar("b");
    expect(chamadas).toEqual(["a"]);
    expect(fila.tamanho).toBe(2);

    bloqueios.get("a")!.resolver();
    await new Promise((r) => setTimeout(r, 0));
    expect(chamadas).toEqual(["a", "b"]);
  });

  it("reprocessa um documento alterado durante o processamento", async () => {
    const fila = new FilaProcessamento(2);
    const chamadas: string[] = [];
    const bloqueio = adiado();
    fila.iniciar(async (id) => {
      chamadas.push(id);
      if (chamadas.length === 1) await bloqueio.promessa;
    });

    fila.adicionar("doc");
    fila.adicionar("doc"); // ex.: arquivo substituído enquanto a versão anterior era processada
    expect(chamadas).toEqual(["doc"]);

    bloqueio.resolver();
    await new Promise((r) => setTimeout(r, 0));
    expect(chamadas).toEqual(["doc", "doc"]);
  });
});

import { useState } from "react";

// Preferências de interface do próprio usuário (modo de exibição, barra recolhida...).
// O armazenamento local pode estar bloqueado: tudo funciona sem ele.

function ler<T>(chave: string, padrao: T): T {
  try {
    const valor = localStorage.getItem(`gd:${chave}`);
    return valor === null ? padrao : (JSON.parse(valor) as T);
  } catch {
    return padrao;
  }
}

function gravar<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(`gd:${chave}`, JSON.stringify(valor));
  } catch {
    /* sem armazenamento local: mantém só em memória */
  }
}

export function usePreferencia<T>(chave: string, padrao: T): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(() => ler(chave, padrao));
  return [
    valor,
    (novo: T) => {
      setValor(novo);
      gravar(chave, novo);
    },
  ];
}

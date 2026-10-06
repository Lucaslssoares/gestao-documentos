/**
 * Gera um PDF simples e válido (texto em Helvetica, uma lista de linhas por página).
 * Usado nos testes e no seed de demonstração — não é um gerador de PDF de uso geral.
 */
export function pdfSimples(paginas: string[][]): Buffer {
  const BARRA = String.fromCharCode(92);
  const escapar = (texto: string) =>
    texto.split(BARRA).join(BARRA + BARRA).split("(").join(BARRA + "(").split(")").join(BARRA + ")");

  const objetos: string[] = [];
  const idsPaginas = paginas.map((_, i) => 4 + i * 2);
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`;
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  paginas.forEach((linhas, i) => {
    const corpo = linhas.map((linha) => `(${escapar(linha)}) Tj T*`).join("\n");
    const conteudo = `BT /F1 11 Tf 14 TL 56 780 Td\n${corpo}\nET`;
    const tamanho = Buffer.byteLength(conteudo, "latin1");
    objetos[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objetos[5 + i * 2] = `<< /Length ${tamanho} >>\nstream\n${conteudo}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id++) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

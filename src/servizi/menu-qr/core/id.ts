/** Un id valido (a-z, 0-9, trattino, max 40) dal nome, diverso da quelli già usati. */
export function idDa(nome: string, usati: ReadonlySet<string>): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30)
      .replace(/-+$/, "") || "voce";
  let id = base;
  for (let n = 2; usati.has(id); n++) id = `${base}-${n}`;
  return id;
}

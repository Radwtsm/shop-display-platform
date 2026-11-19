// Il foglio di stile del Menu (public/menu.css) è uno solo, per la pagina del cliente, la TV e il pannello: TV e
// pannello lo caricano da qui, senza toccare i gusci. Le regole stanno tutte sotto una classe mn-…
export function caricaStile(): Promise<void> {
  const esiste = document.querySelector<HTMLLinkElement>('link[href="/menu.css"]');
  if (esiste) return Promise.resolve();
  return new Promise((ok) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "/menu.css";
    l.addEventListener("load", () => ok());
    l.addEventListener("error", () => ok()); // senza stile si legge lo stesso
    document.head.append(l);
  });
}

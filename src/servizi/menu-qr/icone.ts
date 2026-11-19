// Icona di un allergene (SVG nostro, linee su griglia 24×24). Sempre accanto al testo, mai da sola.
import type { Allergene } from "./core/allergeni.ts";

const NS = "http://www.w3.org/2000/svg";

export function iconaAllergene(a: Allergene): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "mn-icona");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", a.icona);
  svg.append(p);
  return svg;
}

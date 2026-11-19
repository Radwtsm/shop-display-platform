import { inFascia } from "../../../piattaforma/core/orario.ts";
import type { Config, Slide } from "./tipi.ts";

export function slideAttive(config: Config, istante: number): Slide[] {
  return config.slides.filter((s) => s.attiva && (!s.fasce?.length || s.fasce.some((f) => inFascia(f, istante))));
}

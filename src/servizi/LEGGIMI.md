# Aggiungere un servizio (ricetta)

Un servizio è una cartella `src/servizi/<id>/`. La piattaforma (`src/piattaforma/`) non importa mai da qui
(lo verifica un test) e non sa niente di nessun servizio: lo monta tramite i contratti sotto.

1. **Cartella**: `src/servizi/<id>/` con `core/` (logica pura e `valida()`), `server.ts`, `tv.ts`, `pannello.ts`, `test/`.
2. **Catalogo**: una voce in `src/piattaforma/core/servizi.ts` (id, nome, cosa fa). Una cartella senza voce fa fallire il test.
3. **Server** (`server.ts`): esporta `modulo: ModuloServer` con `id`, le rotte `/api/<id>/...`, `valida(dati)` e
   `iniziali(negozio)` (i dati con cui parte un cliente). Dati del cliente solo via `Cliente`
   (`servizi/<id>.json`); ogni input passa da `valida()`; prezzi in centesimi, orari da `orario.ts`.
4. **Attivazione**: `attivaServizio(cliente, modulo)` crea i dati iniziali (validati) e lo aggiunge ai servizi del cliente.
5. **TV** (`tv.ts`): esporta `servizioTv: ServizioTv = { id, monta(zona, ctx) }` (`src/piattaforma/tv/contratto.ts`).
   Disegna solo dentro `zona`; nome, logo, colori e QR sono del guscio. `ctx.sulNegozio` per i cambi di negozio,
   `ctx.rete(ok)` a ogni richiesta (60 s senza `true` = pallino offline). Pezzi fissi di HTML: stringa in un file
   `tv-markup.ts` + `frammento()`; mai `innerHTML`, mai script o stile in linea.
6. **Pannello** (`pannello.ts`): esporta `servizioPannello: ServizioPannello = { id, montaPannello(sezione, ctx) }`
   (`src/piattaforma/pannello/contratto.ts`). Fogli e dialoghi dentro `sezione`; token, avvisi, conferme
   (`ctx.avviso`, `ctx.toast`) e salvataggio del negozio (`ctx.salvaNegozio`) sono del guscio.
7. **Build**: niente da fare, `scripts/build.mjs` cerca `tv.ts` e `pannello.ts` in ogni cartella.
8. **Test**: `test/` del servizio (unit sul `core/`, e2e `*.spec.ts` per TV e pannello). Un bug = prima il test.
9. **Layout**: se aggiungi una pagina in `public/` mettila in `PAGINE` di `test/e2e/layout.spec.ts`; per il
   servizio basta che le sue zone/sezioni compaiano nelle pagine già coperte.
10. **Più servizi insieme**: `test/e2e/guscio.spec.ts` prova rotazione/affiancato con un servizio FINTO: aggiungi lì il tuo caso se cambia il guscio.

Dati e regole: dati finti, dipendenze a versione esatta con almeno 2 settimane, niente dati cliente fuori da `Archivio`.

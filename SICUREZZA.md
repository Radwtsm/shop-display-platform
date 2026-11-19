# Sicurezza — shop-display-platform

Mappa: requisiti (OWASP ASVS 5.0, livello 2, solo i capitoli che toccano questo prodotto) → stato → dove sta la prova.
Stato onesto: ❌ = manca, si fa
prima di vendere il prodotto (TASKLIST A3/A6).

| Area ASVS 5.0 | Cosa facciamo | Stato | Prova |
|---|---|---|---|
| Codifica e sanitizzazione | testo dell'utente solo con `textContent`; niente HTML da stringhe | ✅ | e2e "testo con HTML", Semgrep `html-da-stringa` |
| Validazione | una sola `valida()` lato server per ogni dato; corpo max 64 KB; JSON rotto rifiutato | ✅ | `valida.test.ts`, `server.test.ts` |
| Separazione clienti | dati di un cliente solo da `Archivio`/`Cliente` (id controllato, niente `..`); il server di un cliente non dà foto né logo di un altro; servizio non attivo = rotte 404 anche in scrittura | ✅ | `archivio.test.ts` |
| Sicurezza del frontend web | CSP `default-src 'none'` senza `unsafe-*`, nosniff, frame-ancestors, COOP/CORP, Permissions-Policy, Referrer-Policy | ✅ | `server.test.ts` (ogni risposta), e2e "nessun blocco CSP" |
| API | metodi ammessi per percorso (405), percorsi dentro la cartella | ✅ | `server.test.ts` |
| Autenticazione | token casuale 144 bit (`randomBytes`), nel frammento `#t=` (mai inviato nell'URL), confronto a tempo costante, 10 errori/minuto per indirizzo → 429 | ✅ | `server.test.ts` "limite tentativi", Semgrep |
| Gestione del token | revoca/rotazione del link | ❌ (oggi: cancellare `data/token` e riavviare) | — |
| Autorizzazione | un solo negozio per server (demo) | ⚠️ multi-cliente in A3, con test di separazione | — |
| Crittografia | casualità solo da `crypto` | ✅ | Semgrep `casuale-non-sicuro` |
| Comunicazione sicura | HTTP solo in rete locale (demo) | ❌ HTTPS + HSTS nel prodotto (A5) | — |
| Configurazione | segreti fuori da git (`data/`, permessi 600), niente comandi di sistema | ✅ | gitleaks pre-commit + pre-receive, Semgrep `comandi-di-sistema` |
| Protezione dei dati | nessun dato personale; demo solo con dati finti | ✅ | regola in CLAUDE.md |
| Registri e allarmi | registro di chi cambia cosa e dei tentativi falliti | ❌ (A6 seguito) | — |
| Errori | errori interni non mostrati (500 generico), la scrittura a metà non rompe il file | ✅ | `server.test.ts` (.tmp/.prec) |
| Codice e dipendenze | zero librerie nel prodotto; strumenti a versione esatta, ≥ 2 settimane, `ignore-scripts`, lockfile; licenze controllate; OSV + Semgrep OWASP prima di ogni push | ✅ | `npm run licenze`, `npm run sicurezza` (pre-push) |
| Scansione dinamica | OWASP ZAP baseline prima di ogni rilascio | ❌ serve Docker sul Mac o sul server | — |

## Comandi
- `npm run check` (pre-commit): tipi, lint dei token, licenze, regole Semgrep nostre, test, e2e (con budget di velocità e CSP).
- `npm run sicurezza` (pre-push): OSV-Scanner sulle dipendenze + Semgrep con le regole OWASP Top 10, TypeScript e Node.
- `npm run sbom`: elenco dei componenti del prodotto (CycloneDX), da consegnare con ogni rilascio.

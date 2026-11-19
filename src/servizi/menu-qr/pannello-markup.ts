// Markup fisso della sezione del Menu nel pannello (mai testo di un utente: quello va con textContent).
// Usa le classi del pannello (gruppo, riga, foglio…); fogli e dialoghi stanno qui, con la sezione.
export const MARKUP_PANNELLO = `
<div class="mn-pann" hidden>
  <h2 class="mn-pann-titolo">Menu</h2>

  <section aria-labelledby="mn-t-qr">
    <h3 class="sezione" id="mn-t-qr">QR per i clienti</h3>
    <div class="gruppo">
      <div class="mn-pann-qr">
        <svg class="mn-qr-svg" id="mn-qr" role="img" aria-label="QR del menu" hidden><path id="mn-qr-path"/></svg>
        <div class="mn-pann-qr-testi">
          <p class="mn-link" id="mn-link"></p>
        </div>
      </div>
      <button type="button" class="riga" id="mn-qr-tv"><span class="riga-titolo">Mostra questo QR sulla TV</span></button>
    </div>
    <p class="nota-gruppo" id="mn-qr-nota">Il cliente lo inquadra col telefono e vede il menu con gli allergeni.</p>
    <p class="errore errore-generale" id="mn-err-qr" role="alert" hidden></p>
  </section>

  <div id="mn-lista"></div>
  <p class="nota-gruppo" id="mn-vuoto" hidden>Nessun piatto. Aggiungi prima una categoria, poi i piatti.</p>

  <h3 class="sezione">Aggiungi</h3>
  <ul class="gruppo">
    <li><button type="button" class="riga" id="mn-nuovo-piatto"><span class="riga-titolo">Nuovo piatto</span></button></li>
    <li><button type="button" class="riga" id="mn-nuova-cat"><span class="riga-titolo">Nuova categoria</span></button></li>
  </ul>
  <p class="nota-gruppo">L'interruttore a destra di un piatto lo segna "finito oggi": resta nel menu dei clienti, sparisce dalla TV.</p>

  <dialog id="mn-foglio-piatto" class="foglio" aria-labelledby="mn-fp-tit">
    <form id="mn-form-piatto" novalidate>
      <div class="foglio-testata">
        <button type="button" class="testo-azione" data-chiudi>Annulla</button>
        <h2 id="mn-fp-tit">Piatto</h2>
        <button type="submit" class="testo-azione forte">Fatto</button>
      </div>
      <div class="gruppo campi">
        <label class="campo">
          <span>Nome</span>
          <input name="nome" maxlength="60" autocomplete="off" enterkeyhint="next" aria-describedby="mn-err-nome">
        </label>
        <p id="mn-err-nome" class="errore" hidden></p>
        <label class="campo">
          <span>Descrizione (facoltativa)</span>
          <input name="descrizione" maxlength="140" autocomplete="off" enterkeyhint="next">
        </label>
        <label class="campo">
          <span>Prezzo</span>
          <input name="prezzo" inputmode="decimal" autocomplete="off" placeholder="2,50" enterkeyhint="next" aria-describedby="mn-err-prezzo">
        </label>
        <p id="mn-err-prezzo" class="errore" hidden></p>
        <label class="campo">
          <span>Categoria</span>
          <select name="categoria"></select>
        </label>
      </div>
      <h3 class="sezione">Allergeni</h3>
      <div class="gruppo">
        <label class="riga interruttore">
          <span class="riga-titolo">Allergeni controllati</span>
          <input type="checkbox" role="switch" name="controllati">
        </label>
      </div>
      <p class="nota-gruppo">Se è spento, ai clienti compare "allergeni non indicati: chiedi al personale". Acceso senza spunte = nessuno dei 14.</p>
      <fieldset class="gruppo mn-pann-allergeni" id="mn-allergeni-campi" disabled></fieldset>
      <div class="gruppo">
        <label class="riga interruttore">
          <span class="riga-titolo">Disponibile oggi</span>
          <input type="checkbox" role="switch" name="disponibile">
        </label>
      </div>
      <div class="gruppo" id="mn-zona-elimina-piatto">
        <button type="button" class="riga pericolo" id="mn-elimina-piatto">Elimina piatto</button>
      </div>
      <p id="mn-err-piatto" class="errore errore-generale" role="alert" hidden></p>
    </form>
  </dialog>

  <dialog id="mn-foglio-cat" class="foglio" aria-labelledby="mn-fc-tit">
    <form id="mn-form-cat" novalidate>
      <div class="foglio-testata">
        <button type="button" class="testo-azione" data-chiudi>Annulla</button>
        <h2 id="mn-fc-tit">Categoria</h2>
        <button type="submit" class="testo-azione forte">Fatto</button>
      </div>
      <div class="gruppo campi">
        <label class="campo">
          <span>Nome</span>
          <input name="nome" maxlength="40" autocomplete="off" enterkeyhint="done" aria-describedby="mn-err-cat-nome">
        </label>
        <p id="mn-err-cat-nome" class="errore" hidden></p>
      </div>
      <div class="gruppo" id="mn-zona-elimina-cat">
        <button type="button" class="riga pericolo" id="mn-elimina-cat">Elimina categoria e i suoi piatti</button>
      </div>
      <p id="mn-err-cat" class="errore errore-generale" role="alert" hidden></p>
    </form>
  </dialog>

  <dialog id="mn-conferma" class="dialogo" aria-labelledby="mn-conf-tit" aria-describedby="mn-conf-sotto">
    <h2 id="mn-conf-tit"></h2>
    <p id="mn-conf-sotto">Non comparirà più nel menu. Puoi annullare subito dopo.</p>
    <div class="dialogo-azioni">
      <button type="button" class="riga pericolo" id="mn-conf-si">Elimina</button>
      <button type="button" class="riga" id="mn-conf-no">Annulla</button>
    </div>
  </dialog>
</div>
`;

// Markup fisso della sezione della Vetrina nel pannello (mai testo di un utente: quello va con textContent).
// Id con prefisso v-: nella stessa pagina ci sono anche le sezioni di altri servizi.
export const MARKUP_PANNELLO = `
  <h1>Vetrina</h1>
  <ul class="gruppo" aria-label="Vetrina">
    <li>
      <button type="button" class="riga" id="v-apri-storia">
        <span class="riga-testi"><span class="riga-titolo">Storia</span><span class="riga-sotto" id="v-storia-sotto"></span></span>
        <span class="freccia" aria-hidden="true">›</span>
      </button>
    </li>
    <li>
      <button type="button" class="riga" id="v-apri-qr">
        <span class="riga-testi"><span class="riga-titolo">QR: recensioni, Wi-Fi, Instagram</span><span class="riga-sotto" id="v-qr-sotto"></span></span>
        <span class="freccia" aria-hidden="true">›</span>
      </button>
    </li>
    <li>
      <button type="button" class="riga" id="v-apri-sito">
        <span class="riga-testi"><span class="riga-titolo">Sito</span><span class="riga-sotto" id="v-sito-sotto"></span></span>
        <span class="freccia" aria-hidden="true">›</span>
      </button>
    </li>
  </ul>
  <p id="v-recensioni" class="nota-gruppo" role="status"></p>
  <ul class="gruppo" aria-label="Sito e cartello">
    <li><a class="riga" id="v-vedi-sito" href="/sito.html" target="_blank" rel="noopener"><span class="riga-testi"><span class="riga-titolo">Apri il sito</span></span><span class="freccia" aria-hidden="true">↗</span></a></li>
    <li><button type="button" class="riga" id="v-stampa"><span class="riga-testi"><span class="riga-titolo">Stampa il cartello per il banco</span><span class="riga-sotto">Foglio A5 con i QR</span></span><span class="freccia" aria-hidden="true">›</span></button></li>
  </ul>
  <p id="v-err-pagina" class="errore errore-generale" role="alert" hidden></p>

  <section class="v-cartello" id="v-cartello" aria-hidden="true" hidden>
    <h2 class="v-c-nome" id="v-c-nome"></h2>
    <div class="v-c-qr" id="v-c-qr"></div>
  </section>

  <dialog id="v-foglio-storia" class="foglio" aria-labelledby="v-fs-tit">
    <form id="v-modulo-storia" novalidate>
      <div class="foglio-testata">
        <button type="button" class="testo-azione" data-chiudi>Annulla</button>
        <h2 id="v-fs-tit">Storia</h2>
        <button type="submit" class="testo-azione forte">Fatto</button>
      </div>
      <div class="gruppo foto-zona">
        <div class="riga">
          <span class="foto-mini" aria-hidden="true">
            <img id="v-foto" alt="" hidden>
            <svg id="v-foto-vuota" viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
          </span>
          <span class="riga-testi">
            <span class="riga-titolo">Foto (facoltativa)</span>
            <span class="riga-sotto" id="v-foto-stato" aria-live="polite"></span>
          </span>
        </div>
        <label class="riga azione-foto">
          <input type="file" accept="image/*" id="v-foto-file" class="file-nascosto" aria-describedby="v-err-foto">
          <span id="v-foto-scegli">Aggiungi foto</span>
        </label>
        <button type="button" class="riga pericolo" id="v-foto-togli" hidden>Togli foto</button>
      </div>
      <p id="v-err-foto" class="errore" role="alert" hidden></p>
      <div class="gruppo campi">
        <label class="campo">
          <span>Dal (anno)</span>
          <input name="anno" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="1987" aria-describedby="v-err-anno">
        </label>
        <p id="v-err-anno" class="errore" hidden></p>
        <label class="campo">
          <span>La vostra storia, in poche righe</span>
          <textarea name="storia" rows="5" maxlength="400" aria-describedby="v-err-storia"></textarea>
        </label>
        <p id="v-err-storia" class="errore" hidden></p>
      </div>
      <p class="nota-gruppo">Compare sulla TV e sul sito. Lascia vuoto il testo per togliere la storia.</p>
      <p id="v-err-fs" class="errore errore-generale" role="alert" hidden></p>
    </form>
  </dialog>

  <dialog id="v-foglio-qr" class="foglio" aria-labelledby="v-fq-tit">
    <form id="v-modulo-qr" novalidate>
      <div class="foglio-testata">
        <button type="button" class="testo-azione" data-chiudi>Annulla</button>
        <h2 id="v-fq-tit">QR</h2>
        <button type="submit" class="testo-azione forte">Fatto</button>
      </div>
      <div class="gruppo campi">
        <label class="campo">
          <span>Place ID di Google (recensioni)</span>
          <input name="placeId" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ChIJ…" aria-describedby="v-err-placeId">
        </label>
        <p id="v-err-placeId" class="errore" hidden></p>
      </div>
      <p class="nota-gruppo">Il Place ID identifica la tua scheda su Google. Lo trovi cercando il tuo negozio in «Place ID Finder» di Google, o chiedilo a chi ha installato la TV.</p>
      <div class="gruppo campi">
        <label class="campo">
          <span>Nome della Wi-Fi per gli ospiti</span>
          <input name="ssid" maxlength="32" autocomplete="off" aria-describedby="v-err-ssid">
        </label>
        <p id="v-err-ssid" class="errore" hidden></p>
        <label class="campo">
          <span>Password della Wi-Fi (vuota se è aperta)</span>
          <input name="password" maxlength="63" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="v-err-password">
        </label>
        <p id="v-err-password" class="errore" hidden></p>
      </div>
      <p class="nota-gruppo">Meglio una rete per gli ospiti, separata da quella del negozio: il QR con la password compare sulla TV.</p>
      <div class="gruppo campi">
        <label class="campo">
          <span>Instagram (solo il nome utente)</span>
          <input name="instagram" maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="panificiodemo" aria-describedby="v-err-instagram">
        </label>
        <p id="v-err-instagram" class="errore" hidden></p>
      </div>
      <p id="v-err-fq" class="errore errore-generale" role="alert" hidden></p>
    </form>
  </dialog>

  <dialog id="v-foglio-sito" class="foglio" aria-labelledby="v-fi-tit">
    <form id="v-modulo-sito" novalidate>
      <div class="foglio-testata">
        <button type="button" class="testo-azione" data-chiudi>Annulla</button>
        <h2 id="v-fi-tit">Sito</h2>
        <button type="submit" class="testo-azione forte">Fatto</button>
      </div>
      <div class="gruppo campi">
        <label class="campo">
          <span>Indirizzo</span>
          <input name="indirizzo" maxlength="120" autocomplete="off" placeholder="Via del Forno 12, Roma" aria-describedby="v-err-indirizzo">
        </label>
        <p id="v-err-indirizzo" class="errore" hidden></p>
        <label class="campo">
          <span>Telefono</span>
          <input name="telefono" type="tel" maxlength="20" autocomplete="off" placeholder="06 1234567" aria-describedby="v-err-telefono">
        </label>
        <p id="v-err-telefono" class="errore" hidden></p>
        <label class="campo">
          <span>Email</span>
          <input name="email" type="email" maxlength="120" autocomplete="off" autocapitalize="off" aria-describedby="v-err-email">
        </label>
        <p id="v-err-email" class="errore" hidden></p>
        <label class="campo">
          <span>Link del menu</span>
          <input name="linkMenu" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="v-err-linkMenu">
        </label>
        <p id="v-err-linkMenu" class="errore" hidden></p>
      </div>
      <p class="nota-gruppo">Il bottone «Menu» del sito porta qui. Lascia /menu.html se usi il Menu QR.</p>
      <fieldset class="gruppo v-giorni" id="v-giorni">
        <legend>Giorni di apertura</legend>
        <label class="v-giorno"><span>Lun</span><input type="checkbox" name="g1"></label>
        <label class="v-giorno"><span>Mar</span><input type="checkbox" name="g2"></label>
        <label class="v-giorno"><span>Mer</span><input type="checkbox" name="g3"></label>
        <label class="v-giorno"><span>Gio</span><input type="checkbox" name="g4"></label>
        <label class="v-giorno"><span>Ven</span><input type="checkbox" name="g5"></label>
        <label class="v-giorno"><span>Sab</span><input type="checkbox" name="g6"></label>
        <label class="v-giorno"><span>Dom</span><input type="checkbox" name="g7"></label>
      </fieldset>
      <div class="gruppo campi">
        <label class="campo">
          <span>Apre alle</span>
          <input name="da" type="time" aria-describedby="v-err-orari">
        </label>
        <label class="campo">
          <span>Chiude alle</span>
          <input name="a" type="time" aria-describedby="v-err-orari">
        </label>
        <p id="v-err-orari" class="errore" hidden></p>
      </div>
      <p id="v-orari-complessi" class="nota-gruppo" hidden>Hai orari diversi nei vari giorni: restano come sono. Per cambiarli scrivi a chi ha installato la TV.</p>
      <p id="v-err-fi" class="errore errore-generale" role="alert" hidden></p>
    </form>
  </dialog>
`;

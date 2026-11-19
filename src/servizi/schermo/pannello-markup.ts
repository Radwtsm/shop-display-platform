// Markup fisso della sezione dello Schermo nel pannello (mai testo di un utente: quello va con textContent).
// Fogli e dialoghi stanno qui dentro, con la sezione: ogni servizio porta i suoi.
export const MARKUP_PANNELLO = `
  <h1>Offerte</h1>

  <section class="anteprima" aria-labelledby="anteprima-tit">
    <img id="ant-foto" class="ant-foto" alt="" hidden>
    <div class="ant-testi">
      <p id="anteprima-tit" class="anteprima-etichetta">Sulla TV adesso</p>
      <p id="ant-titolo" class="ant-titolo"></p>
      <p id="ant-prezzo" class="ant-prezzo"></p>
      <p id="ant-nota" class="ant-nota"></p>
    </div>
  </section>
  <p id="ant-info" class="nota-gruppo"></p>

  <ul id="offerte" class="gruppo" aria-label="Offerte"></ul>
  <p id="vuoto" class="nota-gruppo" hidden>Nessuna offerta. Aggiungi la prima con il bottone qui sotto.</p>

  <section id="zona-negozio" aria-labelledby="t-negozio" hidden>
  <h2 class="sezione" id="t-negozio">Negozio</h2>
  <ul class="gruppo">
    <li>
      <button type="button" class="riga" id="apri-negozio">
        <span class="riga-testi">
          <span class="riga-titolo">Nome, orari e QR</span>
          <span class="riga-sotto" id="negozio-sotto"></span>
        </span>
        <span class="freccia" aria-hidden="true">›</span>
      </button>
    </li>
    <li>
      <button type="button" class="riga" id="apri-colori">
        <span class="mini-tv mini-tv-riga" id="colori-mini" aria-hidden="true"><span class="mt-barra"></span><span class="mt-prezzo">2,50</span></span>
        <span class="riga-testi">
          <span class="riga-titolo">Colori della TV</span>
          <span class="riga-sotto" id="colori-sotto"></span>
        </span>
        <span class="freccia" aria-hidden="true">›</span>
      </button>
    </li>
    <li>
      <button type="button" class="riga" id="apri-aspetto">
        <span class="mini-tv mini-tv-riga mini-aspetto" id="aspetto-mini" aria-hidden="true"><span class="mt-barra"><span class="mt-logo"></span></span><span class="mt-titolo"></span><span class="mt-prezzo">2,50</span></span>
        <span class="riga-testi">
          <span class="riga-titolo">Aspetto della TV</span>
          <span class="riga-sotto" id="aspetto-sotto"></span>
        </span>
        <span class="freccia" aria-hidden="true">›</span>
      </button>
    </li>
  </ul>
  </section>


<div class="barra">
  <button type="button" id="aggiungi" class="principale">+ Aggiungi offerta</button>
</div>

<dialog id="foglio-offerta" class="foglio" aria-labelledby="fo-tit">
  <form id="modulo-offerta" novalidate>
    <div class="foglio-testata">
      <button type="button" class="testo-azione" data-chiudi>Annulla</button>
      <h2 id="fo-tit">Offerta</h2>
      <button type="submit" class="testo-azione forte">Fatto</button>
    </div>
    <div class="gruppo foto-zona">
      <div class="riga">
        <span class="foto-mini" aria-hidden="true">
          <img id="fo-foto" alt="" hidden>
          <svg id="fo-foto-vuota" viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
        </span>
        <span class="riga-testi">
          <span class="riga-titolo">Foto (facoltativa)</span>
          <span class="riga-sotto" id="fo-foto-stato" aria-live="polite"></span>
        </span>
      </div>
      <label class="riga azione-foto">
        <input type="file" accept="image/*" id="fo-foto-file" class="file-nascosto" aria-describedby="err-foto">
        <span id="fo-foto-scegli">Aggiungi foto</span>
      </label>
      <button type="button" class="riga pericolo" id="fo-foto-togli" hidden>Togli foto</button>
    </div>
    <p id="err-foto" class="errore" role="alert" hidden></p>
    <div class="gruppo campi">
      <label class="campo">
        <span>Nome</span>
        <input name="titolo" maxlength="80" autocomplete="off" enterkeyhint="next" aria-describedby="err-titolo">
      </label>
      <p id="err-titolo" class="errore" hidden></p>
      <label class="campo">
        <span>Prezzo</span>
        <input name="prezzo" inputmode="decimal" autocomplete="off" placeholder="2,50" enterkeyhint="next" aria-describedby="err-prezzo">
      </label>
      <p id="err-prezzo" class="errore" hidden></p>
      <label class="campo">
        <span>Quantità (facoltativa)</span>
        <input name="quantita" autocomplete="off" placeholder="100 g" enterkeyhint="next" aria-describedby="err-quantita">
      </label>
      <p id="err-quantita" class="errore" hidden></p>
      <label class="campo">
        <span>Nota (facoltativa)</span>
        <input name="nota" maxlength="120" autocomplete="off" placeholder="appena sfornata" enterkeyhint="done">
      </label>
    </div>
    <p class="nota-gruppo">Quantità: a cosa si riferisce il prezzo (100 g, 1 kg, 500 ml); la TV mostra anche il prezzo al kg o al litro. Lascia vuoto il prezzo per un messaggio senza prezzo, per esempio "Torte su ordinazione".</p>
    <div class="gruppo">
      <label class="riga interruttore">
        <span class="riga-titolo">Mostra sulla TV</span>
        <input type="checkbox" role="switch" name="attiva">
      </label>
    </div>
    <p id="fo-orario" class="nota-gruppo" hidden></p>
    <div class="gruppo" id="zona-elimina">
      <button type="button" class="riga pericolo" id="elimina">Elimina offerta</button>
    </div>
    <p id="err-offerta" class="errore errore-generale" role="alert" hidden></p>
  </form>
</dialog>

<dialog id="foglio-negozio" class="foglio" aria-labelledby="fn-tit">
  <form id="modulo-negozio" novalidate>
    <div class="foglio-testata">
      <button type="button" class="testo-azione" data-chiudi>Annulla</button>
      <h2 id="fn-tit">Negozio</h2>
      <button type="submit" class="testo-azione forte">Fatto</button>
    </div>
    <div class="gruppo campi">
      <label class="campo">
        <span>Nome del negozio</span>
        <input name="nome" maxlength="60" autocomplete="off" aria-describedby="err-nome">
      </label>
      <p id="err-nome" class="errore" hidden></p>
    </div>
    <h3 class="sezione">Orari di apertura</h3>
    <p class="nota-gruppo">La barra della TV scrive "Aperto fino alle…" o "Apre alle…". Senza orari non scrive niente.</p>
    <div class="gruppo" id="fn-orari"></div>
    <div class="gruppo"><button type="button" class="riga" id="fn-aggiungi-fascia">Aggiungi un orario</button></div>
    <h3 class="sezione">Meteo nella barra</h3>
    <div class="gruppo campi">
      <label class="campo">
        <span>Città</span>
        <input name="citta-cerca" type="search" maxlength="60" autocomplete="off" placeholder="Scrivi la città" aria-describedby="fn-citta-nota">
      </label>
      <p id="fn-citta-nota" class="nota-gruppo"></p>
      <div id="fn-citta-risultati" role="group" aria-label="Risultati della ricerca"></div>
      <button type="button" class="riga" id="fn-citta-togli" hidden>Togli il meteo</button>
    </div>
    <h3 class="sezione">Testo che scorre nella barra</h3>
    <div class="gruppo campi">
      <label class="campo">
        <span>Testo (facoltativo)</span>
        <input name="barra-testo" maxlength="200" autocomplete="off" placeholder="Oggi pane caldo alle 17">
      </label>
    </div>
    <p class="nota-gruppo">QR nell'angolo della TV: per esempio il link delle recensioni Google, il menu o il sito. Lascia vuoto per non mostrarlo.</p>
    <div class="gruppo campi">
      <label class="campo">
        <span>Link del QR (facoltativo)</span>
        <input name="qr-url" type="url" inputmode="url" autocomplete="off" placeholder="https://…" aria-describedby="err-qr-url">
      </label>
      <p id="err-qr-url" class="errore" hidden></p>
      <label class="campo">
        <span>Scritta sotto il QR</span>
        <input name="qr-testo" maxlength="40" autocomplete="off" placeholder="Lasciaci una recensione" aria-describedby="err-qr-testo">
      </label>
      <p id="err-qr-testo" class="errore" hidden></p>
    </div>
    <p id="err-negozio" class="errore errore-generale" role="alert" hidden></p>
  </form>
</dialog>

<dialog id="foglio-colori" class="foglio" aria-labelledby="fc-tit">
  <form id="modulo-colori" novalidate>
    <div class="foglio-testata">
      <button type="button" class="testo-azione" data-chiudi>Annulla</button>
      <h2 id="fc-tit">Colori</h2>
      <button type="submit" class="testo-azione forte">Fatto</button>
    </div>
    <div class="mini-tv mini-tv-grande" id="fc-anteprima" aria-hidden="true">
      <span class="mt-barra" id="fc-nome"></span>
      <span class="mt-titolo">Focaccia</span>
      <span class="mt-prezzo">2,50 €</span>
    </div>
    <h3 class="sezione">Pronti</h3>
    <div class="combinazioni" id="fc-pronti" role="group" aria-label="Colori pronti"></div>
    <h3 class="sezione">Scegli tu</h3>
    <div class="gruppo campi">
      <label class="campo campo-colore">
        <span>Un colore: il resto lo calcoliamo perché si legga bene</span>
        <input type="color" name="principale">
      </label>
    </div>
    <details class="gruppo avanzate">
      <summary class="riga">Ogni colore, uno per uno</summary>
      <div class="campi">
        <label class="campo campo-colore"><span>Barra in alto</span><input type="color" name="primario"></label>
        <label class="campo campo-colore"><span>Sfondo</span><input type="color" name="sfondo"></label>
        <label class="campo campo-colore"><span>Scritte</span><input type="color" name="testo"></label>
        <label class="campo campo-colore"><span>Prezzi</span><input type="color" name="accento"></label>
      </div>
    </details>
    <div id="fc-avviso" class="avviso-colori" role="status" hidden>
      <p id="fc-avviso-testo"></p>
      <button type="button" class="riga" id="fc-sistema">Sistema tu</button>
    </div>
    <div class="gruppo" id="fc-zona-marchio">
      <button type="button" class="riga" id="fc-marchio">Torna ai colori del negozio</button>
    </div>
    <p id="err-colori" class="errore errore-generale" role="alert" hidden></p>
  </form>
</dialog>

<dialog id="foglio-aspetto" class="foglio" aria-labelledby="fa-tit">
  <form id="modulo-aspetto" novalidate>
    <div class="foglio-testata">
      <button type="button" class="testo-azione" data-chiudi>Annulla</button>
      <h2 id="fa-tit">Aspetto</h2>
      <button type="submit" class="testo-azione forte">Fatto</button>
    </div>
    <div class="mini-tv mini-tv-grande mini-aspetto" id="fa-anteprima" aria-hidden="true">
      <span class="mt-barra"><span class="mt-logo"></span><span class="mt-nome" id="fa-nome"></span></span>
      <span class="mt-titolo">Focaccia</span>
      <span class="mt-prezzo">2,50 €</span>
    </div>
    <p class="nota-gruppo">Tocca una miniatura: l'anteprima mostra subito come sarà la TV. Le scelte segnate "Consigliata" sono quelle che proponiamo noi.</p>
    <div id="fa-gruppi"></div>
    <h3 class="sezione">Tema stagionale</h3>
    <div class="combinazioni" id="fa-temi" role="group" aria-label="Tema stagionale"></div>
    <div id="fa-zona-temacolori" hidden>
      <h3 class="sezione">Colori con il tema</h3>
      <div class="combinazioni" id="fa-temacolori" role="group" aria-label="Colori con il tema"></div>
    </div>
    <div id="fa-zona-varianti" hidden>
      <h3 class="sezione">Palette di Natale</h3>
      <div class="combinazioni" id="fa-varianti" role="group" aria-label="Palette di Natale"></div>
    </div>
    <h3 class="sezione">Barra della TV (ora, orari, meteo)</h3>
    <div class="tre-colonne" id="fa-barra" role="group" aria-label="Barra della TV"></div>
    <h3 class="sezione">Ogni offerta resta sulla TV</h3>
    <div class="combinazioni" id="fa-secondi" role="group" aria-label="Ogni offerta resta sulla TV"></div>
    <div id="fa-zona-disposizione" hidden>
      <h3 class="sezione">Più servizi sulla TV</h3>
      <div class="combinazioni" id="fa-disposizione" role="group" aria-label="Più servizi sulla TV"></div>
    </div>
    <div class="gruppo" id="fa-zona-prima">
      <button type="button" class="riga" id="fa-prima">Torna come prima</button>
    </div>
    <p id="err-aspetto" class="errore errore-generale" role="alert" hidden></p>
  </form>
</dialog>

<dialog id="conferma-colori" class="dialogo" aria-labelledby="cc-tit" aria-describedby="cc-sotto">
  <h2 id="cc-tit">Da lontano si legge male</h2>
  <p id="cc-sotto"></p>
  <div class="dialogo-azioni">
    <button type="button" class="riga" id="cc-sistema">Sistema tu</button>
    <button type="button" class="riga" id="cc-usa">Usa lo stesso</button>
  </div>
</dialog>

<dialog id="conferma" class="dialogo" aria-labelledby="conf-tit" aria-describedby="conf-sotto">
  <h2 id="conf-tit"></h2>
  <p id="conf-sotto">Non comparirà più sulla TV. Puoi annullare subito dopo.</p>
  <div class="dialogo-azioni">
    <button type="button" class="riga pericolo" id="conf-si">Elimina</button>
    <button type="button" class="riga" id="conf-no">Annulla</button>
  </div>
</dialog>
`;

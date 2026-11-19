// Markup fisso della sezione dell'Eliminacode nel pannello (mai testo di un utente: quello va con textContent).
export const MARKUP_PANNELLO = `
<h1>Eliminacode</h1>

<section class="eq-attuale" aria-labelledby="eq-etichetta">
  <p id="eq-etichetta" class="eq-p-etichetta">Tocca al numero</p>
  <p class="eq-p-numero" role="status" aria-live="polite"><span class="eq-p-cifra">—</span></p>
  <p class="eq-p-banco"></p>
</section>

<div class="eq-banchi" role="group" aria-label="Da che banco chiami" hidden></div>

<button type="button" class="principale eq-prossimo">Prossimo</button>
<div class="eq-secondarie">
  <button type="button" class="riga eq-indietro">Indietro</button>
  <button type="button" class="riga pericolo eq-azzera">Azzera</button>
</div>
<p class="nota-gruppo">«Indietro» torna al numero prima, se hai chiamato per sbaglio.</p>

<ul class="gruppo eq-impostazioni">
  <li>
    <label class="riga interruttore">
      <span class="riga-testi">
        <span class="riga-titolo">Due banchi</span>
        <span class="riga-sotto">Sulla TV compare anche il banco</span>
      </span>
      <input type="checkbox" role="switch" class="eq-due">
    </label>
  </li>
</ul>

<dialog class="dialogo eq-conferma" aria-labelledby="eq-conf-tit" aria-describedby="eq-conf-sotto">
  <h2 id="eq-conf-tit">Azzerare i numeri?</h2>
  <p id="eq-conf-sotto">Si riparte da 1. La TV non mostra più nessun numero.</p>
  <div class="dialogo-azioni">
    <button type="button" class="riga pericolo eq-conf-si">Sì, azzera</button>
    <button type="button" class="riga eq-conf-no">No, lascia com'è</button>
  </div>
</dialog>
`;

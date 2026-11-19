// Markup fisso della zona dello Schermo sulla TV (mai testo di un utente: quello va con textContent).
export const MARKUP_TV = `
<section id="slide" data-riempi hidden>
  <div class="cornice"><img id="foto" alt="" hidden></div>
  <div class="testi">
    <h2 id="titolo" data-righe="3" data-min="4"></h2>
    <p id="prezzo" data-larghezza></p>
    <p id="per-unita" data-righe="1" data-min="2.4"></p>
    <p id="nota" data-righe="2" data-min="2.4"></p>
  </div>
</section>
<section id="listino" data-riempi hidden><ul id="righe"></ul></section>
<section id="riposo" hidden><p>Benvenuti</p></section>
`;

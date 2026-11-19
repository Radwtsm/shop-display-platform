// Markup fisso della zona della Vetrina sulla TV (mai testo di un utente: quello va con textContent).
// Classi con prefisso v-, niente id: nella stessa pagina c'è anche la zona di altri servizi.
export const MARKUP_TV = `
<div class="v-tv" data-riempi hidden>
  <section class="v-storia" hidden>
    <img class="v-foto" alt="" hidden>
    <div class="v-testi">
      <p class="v-anno"></p>
      <h2 class="v-titolo">La nostra storia</h2>
      <p class="v-testo" data-righe="6" data-min="2.2"></p>
    </div>
  </section>
  <section class="v-qr" hidden>
    <h2 class="v-titolo" data-righe="2" data-min="3"></h2>
    <figure class="v-fig"><svg class="v-svg" aria-hidden="true"><path/></svg></figure>
    <p class="v-sotto" data-righe="2" data-min="2.2"></p>
  </section>
  <section class="v-rec" hidden>
    <h2 class="v-titolo">Dicono di noi</h2>
    <p class="v-media"></p>
    <ul class="v-elenco"></ul>
    <p class="v-fonte"></p>
  </section>
</div>
`;

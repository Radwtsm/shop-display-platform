// Markup fisso della zona dell'Eliminacode sulla TV (mai testo di un utente: quello va con textContent).
// Coda viva come il mockup A136/A138: «Ora serviamo» nel riquadro, «Tocca al numero» in primo piano (CSS su
// data-forma), numero che scorre, ultimi chiamati, ritmo e serviti di oggi; la barra conta il primo piano.
// .eq-lato (data-lato): da sola sulla TV il guscio lo sposta nel tile della colonna destra (A141).
export const MARKUP_TV = `
<section class="eq-tv" role="status" aria-live="polite" aria-atomic="true">
  <p class="eq-etichetta"><span class="eq-ora">Ora serviamo</span><span class="eq-tocca">Tocca al numero</span></p>
  <p class="eq-numero" aria-hidden="true" data-larghezza><span class="eq-cifre">—</span></p>
  <p class="eq-banco" aria-hidden="true" data-righe="1" data-min="3.2"></p>
  <div class="eq-lato" data-lato><p class="eq-prima" aria-hidden="true" data-righe="1" data-min="3.2"></p>
  <p class="eq-ritmo" aria-hidden="true"><span class="eq-serviti" data-righe="1" data-min="3.2"></span><span class="eq-passo" data-righe="1" data-min="3.2"></span></p></div>
  <p class="eq-barra" aria-hidden="true"><i></i></p>
</section>
`;

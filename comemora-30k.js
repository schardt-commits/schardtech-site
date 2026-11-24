// comemora-30k.js · bloco comemorativo dos 30 mil inscritos (so na home, TEMPORARIO, 24/11/2026).
// Faz o numero girar de 29.999 pra 30.000 uma vez, quando aparece na tela.
// Sem JS o HTML ja mostra 30.000 parado. Remover junto com o bloco 30K do index.html.
(function () {
  document.querySelectorAll('.c30-roll').forEach(function (el) {
    var de = el.getAttribute('data-de'), para = el.getAttribute('data-para');
    if (!de || !para) return;
    var n = Math.max(de.length, para.length);
    while (de.length < n) de = ' ' + de;
    while (para.length < n) para = ' ' + para;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', para.replace(/^ +/, ''));
    el.textContent = '';
    for (var i = 0; i < n; i++) {
      var col = document.createElement('span');
      col.className = 'c30-col';
      col.setAttribute('aria-hidden', 'true');
      if (de.charAt(i) === para.charAt(i)) {
        col.textContent = para.charAt(i);
      } else {
        var tira = document.createElement('span'), a = document.createElement('span'), b = document.createElement('span');
        tira.className = 'c30-tira';
        a.textContent = de.charAt(i);
        b.textContent = para.charAt(i);
        tira.appendChild(a);
        tira.appendChild(b);
        col.appendChild(tira);
      }
      el.appendChild(col);
    }
    if (!('IntersectionObserver' in window)) { el.classList.add('rodou'); return; }
    var io = new IntersectionObserver(function (es) {
      for (var j = 0; j < es.length; j++) {
        if (es[j].isIntersecting) {
          io.disconnect();
          setTimeout(function () { el.classList.add('rodou'); }, 700);
          return;
        }
      }
    }, { threshold: 0.6 });
    io.observe(el);
  });
})();

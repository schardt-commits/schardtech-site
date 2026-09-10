/* ============================================================
   prices-overlay.js — Fase 4b (10/05/2026) + slugs (13/05/2026)
   Aplica camada de preços/links/cupons do data/prices.json
   sobre window.PROJETORES_DATA carregado de projetores-data.js.
   Também carrega data/slugs.json e injeta proj.slug → usado pelo
   componente de busca e cards clicáveis (qual-projetor / comparar).

   Backward-compat: se o fetch falhar (404, JSON quebrado, offline),
   o site continua renderizando com os dados estáticos antigos.

   Como usar nos HTMLs:
     <script src="projetores-data.js"></script>
     <script src="prices-overlay.js"></script>
     ...
     // antes do primeiro render:
     window.PRICES_OVERLAY_READY.then(() => { renderTudo(); });
   ============================================================ */
(function () {
  /* Motivos de metadata.indisponiveis que sao esgotamento DE VERDADE.
     Qualquer outro motivo (ex.: 'coletando' de projetor que ainda nao tem video,
     ou diagnostico do checker como 'sem preco final ou sem vencedor') significa
     "nao tenho preco publicado", NAO "acabou o estoque". Tratar os dois como a
     mesma coisa fazia a busca global anunciar "sem estoque no momento" pra
     produto que estava vendendo normalmente (19/08/2026: Progaga PG370 MAX,
     Byintek X30 e 3 Wanbo). Esta lista e a fonte unica da distincao. */
  var MOTIVOS_ESGOTADO = ['sem_estoque_br', 'sem_estoque_importado', 'indisponivel'];

  function esgotadoDeVerdade(motivo) {
    return MOTIVOS_ESGOTADO.indexOf(norm(motivo)) !== -1;
  }

  /* ── Aviso de volta ao estoque (09/09/2026) ────────────────────────────────
     Lista PROPOSITALMENTE menor que MOTIVOS_ESGOTADO: 'indisponivel' fica de
     fora porque a loja retirou o anuncio e o Re-Check exclui esses de proposito
     (AC1053, AC1060, AC1080, PG370). Eles nunca voltam, e oferecer aviso ali
     seria vender uma promessa que nao chega nunca.
     Os motivos de diagnostico ('sem preco final ou sem vencedor') ja nao chegam
     aqui, porque esgotadoDeVerdade() barra antes.
     TEM que bater com MOTIVOS_ELEGIVEIS em supabase/functions/alertas/logica.ts:
     se divergir, o botao aparece e o servidor recusa. */
  var MOTIVOS_ALERTA = ['sem_estoque_br', 'sem_estoque_importado'];

  /* POST de formulario cru, sem fetch e sem chave nenhuma no JS.
     Nao e preguica: a CSP das paginas tem connect-src 'self', que BLOQUEARIA um
     fetch pro Supabase, e nao define form-action, que nao herda de default-src.
     Entao o form navega e o fetch nao. Ver a CORRECAO 2 do plano. */
  var ALERTA_ENDPOINT = 'https://wdjypplowggtbduslpuc.supabase.co/functions/v1/alertas/inscrever';

  /* Tokens: --brand/--brand-dim/--brand-borda/--line/--txt/--txt-2/--card-2/
     --radius/--alerta/--mono, todos do v2.css. NUNCA --cta, que o v2.css
     reserva pro botao de compra (o test_botao_alerta.ts barra). */
  var ALERTA_CSS = '' +
    /* os dois wrappers compartilham so a moldura; classes separadas de proposito,
       pra o guard `querySelector('.alerta-estoque')` nao casar com o de preco */
    '.alerta-estoque,.alerta-preco{margin-top:14px;padding-top:14px;border-top:1px solid var(--line,#1F2A3C)}' +
    /* min-height 44px: alvo de toque minimo */
    '.ae-abrir{width:100%;min-height:44px;padding:11px 14px;font:inherit;font-weight:600;cursor:pointer;' +
      'color:var(--brand,#5BC8EE);background:var(--brand-dim,rgba(91,200,238,.10));' +
      'border:1px solid var(--brand-borda,rgba(91,200,238,.30));border-radius:var(--radius,8px)}' +
    '.ae-abrir:hover{background:rgba(91,200,238,.18)}' +
    '.ae-form{margin-top:12px}' +
    '.ae-label{display:block;font-size:13px;color:var(--txt-2,#8D9CB2);margin-bottom:6px}' +
    '.ae-ajuda+.ae-label,.ae-erro+.ae-label{margin-top:12px}' +
    '.ae-linha{display:flex;gap:8px;flex-wrap:wrap}' +
    /* era .ae-linha input: o campo de alvo mora fora da .ae-linha e ficaria com
       a aparencia crua do navegador dentro de um card escuro */
    '.ae-form input{flex:1 1 190px;min-width:0;padding:10px 12px;font:inherit;' +
      'color:var(--txt,#EEF3FA);background:var(--card-2,#161E2C);' +
      'border:1px solid var(--line,#1F2A3C);border-radius:var(--radius,8px)}' +
    /* --brand no lugar de --brand-borda: o antigo dava 2,13:1 sobre o --card e
       reprovava no WCAG 1.4.11 */
    '.ae-form input:focus{outline:2px solid var(--brand,#5BC8EE);outline-offset:1px}' +
    '.ae-linha button{min-height:44px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer;' +
      'color:#08131A;background:var(--brand,#5BC8EE);border:0;border-radius:var(--radius,8px)}' +
    /* caixa de moeda: o R$ fica DENTRO da borda e o input some dentro dela, entao
       o anel de foco tem que aparecer na CAIXA (:focus-within) e sumir do input */
    '.ae-moeda{display:flex;align-items:center;gap:8px;padding-left:12px;background:var(--card-2,#161E2C);' +
      'border:1px solid var(--line,#1F2A3C);border-radius:var(--radius,8px)}' +
    '.ae-moeda:focus-within{outline:2px solid var(--brand,#5BC8EE);outline-offset:1px}' +
    '.ae-prefixo{font-family:var(--mono,monospace);font-size:13px;color:var(--txt-2,#8D9CB2)}' +
    /* .ae-form .ae-alvo = 0,2,0, vence .ae-form input = 0,1,1 sem !important.
       17px porque abaixo de 16px o Safari do iPhone da zoom sozinho ao focar;
       tabular-nums porque os digitos dancam de largura enquanto se digita, e o
       campo e justamente onde a pessoa olha os digitos. */
    '.ae-form .ae-alvo{background:transparent;border:0;padding-left:0;min-height:44px;' +
      'font-family:var(--mono,monospace);font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}' +
    '.ae-form .ae-alvo:focus{outline:none}' +
    /* defesa contra alguem "melhorar" o campo pra type=number: os spinners do
       WebKit furariam a caixa transparente */
    '.ae-form .ae-alvo::-webkit-inner-spin-button,.ae-form .ae-alvo::-webkit-outer-spin-button' +
      '{-webkit-appearance:none;margin:0}' +
    '.ae-ajuda{margin-top:6px;font-size:12px;color:var(--txt-2,#8D9CB2)}' +
    /* --alerta e o token que o projeto ja usa pra estado de aviso, nao um
       vermelho inventado. overflow-wrap porque o link da loja pode ser longo e
       um nowrap solto empurraria scroll horizontal num viewport de 320px. */
    '.ae-erro{margin-top:6px;font-size:12.5px;line-height:1.45;color:var(--alerta,#FF9B7A);' +
      'overflow-wrap:anywhere}' +
    '.ae-erro a{color:var(--brand,#5BC8EE)}' +
    '.ae-consent{margin-top:10px;font-size:12px;line-height:1.5;color:var(--txt-2,#8D9CB2)}' +
    '.ae-consent a{color:var(--brand,#5BC8EE)}';

  function injetarAlertaEstoque(card, motivo) {
    if (MOTIVOS_ALERTA.indexOf(norm(motivo)) === -1) return;
    if (!card) return;
    if (card.querySelector('.alerta-estoque')) return;   // idempotente
    // Exclusão mútua com o aviso de PREÇO, no outro sentido. Duas chamadas
    // separadas, nunca um seletor com vírgula: o DOM mínimo do teste entende um
    // seletor simples só, e a versão com vírgula passaria verde no teste
    // enquanto se comporta diferente no navegador.
    if (card.querySelector('.alerta-preco')) return;

    var marca = String(card.dataset.marca || '').trim();
    var modelo = String(card.dataset.modelo || '').trim();
    if (!marca || !modelo) return;
    // Chave no formato do prices.json e da coluna `produto` no banco.
    // Case ORIGINAL de proposito: o servidor compara sem normalizar caixa.
    var chave = marca + '|' + modelo;
    var nome = marca + ' ' + modelo;

    if (!document.getElementById('ae-css')) {
      var st = document.createElement('style');
      st.id = 'ae-css';
      st.textContent = ALERTA_CSS;
      document.head.appendChild(st);
    }

    var convite = norm(motivo) === 'sem_estoque_importado'
      ? 'Me avise quando voltar ao estoque nacional'
      : 'Me avise quando voltar ao estoque';

    var wrap = document.createElement('div');
    wrap.className = 'alerta-estoque';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ae-abrir';
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = convite;

    var form = document.createElement('form');
    form.className = 'ae-form';
    form.method = 'POST';
    form.action = ALERTA_ENDPOINT;
    form.hidden = true;

    var oculto = document.createElement('input');
    oculto.type = 'hidden';
    oculto.name = 'produto';
    oculto.value = chave;

    var idCampo = 'ae-email';
    var rotulo = document.createElement('label');
    rotulo.className = 'ae-label';
    rotulo.htmlFor = idCampo;
    rotulo.textContent = 'Seu e-mail';

    var linha = document.createElement('div');
    linha.className = 'ae-linha';

    var campo = document.createElement('input');
    campo.type = 'email';
    campo.id = idCampo;
    campo.name = 'email';
    campo.required = true;
    campo.maxLength = 254;
    campo.autocomplete = 'email';
    campo.placeholder = 'voce@email.com';

    var enviar = document.createElement('button');
    enviar.type = 'submit';
    enviar.textContent = 'Quero ser avisado';

    var consent = document.createElement('p');
    consent.className = 'ae-consent';
    // textContent, nunca innerHTML: marca e modelo vem do DOM da pagina, mas a
    // regra do projeto e nao montar HTML com dado variavel.
    consent.textContent = avisoDaTela();
    var linkPol = document.createElement('a');
    linkPol.href = basePath() + 'politica-privacidade.html';
    linkPol.textContent = 'Ler a política';
    consent.appendChild(linkPol);

    linha.appendChild(campo);
    linha.appendChild(enviar);
    form.appendChild(oculto);
    form.appendChild(rotulo);
    form.appendChild(linha);
    form.appendChild(consent);
    wrap.appendChild(btn);
    wrap.appendChild(form);

    btn.addEventListener('click', function () {
      form.hidden = false;
      btn.hidden = true;
      btn.setAttribute('aria-expanded', 'true');
      campo.focus();
    });

    var body = card.querySelector('.pj-price-body') || card;
    body.appendChild(wrap);
  }


  /* ── Aviso de PREÇO (10/09/2026) ───────────────────────────────────────────
     Irmão do de cima e OPOSTO a ele: aquele só existe em produto esgotado,
     este só em produto COM preço publicado. As duas listas do prices.json são
     disjuntas (o exportador dá `continue` antes do produtos.append quando não
     há preço), mas o guard mútuo está nos dois mesmo assim, porque a
     exclusividade é propriedade do exportador e o navegador não a controla.

     Decisão de produto do dono (09/09/2026): "me avisa quando ficar abaixo de
     R$ ___", com a pessoa DIGITANDO o valor. Recusado "qualquer queda de 5%":
     preço sobe e desce o tempo todo e isso viraria aviso por ruído. */

  var DESCONTO_PADRAO = 0.10;       // pré-preenche 10% abaixo do preço de hoje
  var ALVO_MAX_CENTAVOS = 99999999; // R$ 999.999,99; igual ao do servidor

  /* R$ a partir de CENTAVOS, sem o prefixo. Gêmea de precoBrCentavos() em
     supabase/functions/alertas/logica.ts, e o test_botao_alerta.ts compara as
     duas numa tabela de valores.

     NÃO trocar por toLocaleString('pt-BR'): parece a escolha óbvia e é a
     errada. Este número entra no texto do consentimento, que é prova legal e
     tem que bater byte a byte com o que o servidor grava. WebView Android
     compilado com -small-icu devolve "1,100.00", e aí a prova deixa de ser a
     frase que a pessoa leu na tela. Duas implementações burras e idênticas
     valem mais que uma esperta. */
  function precoBrCentavosAlerta(centavos) {
    var n = Math.round(Number(centavos) || 0);
    if (n < 0) n = 0;
    var inteiro = String(Math.floor(n / 100));
    var cent = n % 100;
    var saida = '';
    for (var i = 0; i < inteiro.length; i++) {
      if (i > 0 && (inteiro.length - i) % 3 === 0) saida += '.';
      saida += inteiro.charAt(i);
    }
    return saida + ',' + (cent < 10 ? '0' + cent : String(cent));
  }

  /* A LINHA da tela. Curta de propósito (10/09/2026, decisão do dono).
     O texto COMPLETO do consentimento saiu daqui e foi pro e-mail de
     confirmação, e o motivo não é estética: o consentimento efetivo não é este
     clique, é a CONFIRMAÇÃO, que é onde o alerta nasce. A pessoa lê a frase
     inteira no e-mail e confirma depois de ler, que é o que o double opt-in
     existe pra fazer.
     De quebra, o texto deixou de existir em dois arquivos: agora ele mora só no
     servidor, e a divergência que o test_botao_alerta.ts vigiava ficou
     impossível por construção em vez de vigiada por teste.
     O que NÃO pode sair da tela é o link da política: é onde a pessoa decide. */
  function avisoDaTela() {
    return 'A gente manda um e-mail pra você confirmar. ';
  }

  /* Texto humano -> centavos inteiros, ou null.
     A regra que decide tudo: separador ÚNICO seguido de 3 dígitos é MILHAR, não
     decimal. Sem ela "1.299", que é como se escreve mil duzentos e noventa e
     nove em português, viraria R$ 1,29 e o alerta nunca dispararia — e ninguém
     descobriria, porque não há erro nenhum, só silêncio. */
  function parseAlvoCentavos(txt) {
    var s = String(txt == null ? '' : txt).replace(/[^0-9.,]/g, '');
    if (!s) return null;
    var ultimoP = s.lastIndexOf('.');
    var ultimaV = s.lastIndexOf(',');
    var dec = -1;                                    // índice do separador decimal
    if (ultimoP !== -1 && ultimaV !== -1) {
      dec = Math.max(ultimoP, ultimaV);              // "1.299,90" / "1,299.90": o último manda
    } else if (ultimoP !== -1 || ultimaV !== -1) {
      var u = Math.max(ultimoP, ultimaV);
      var depois = s.length - u - 1;
      var unico = s.indexOf(s.charAt(u)) === u;      // aparece uma vez só?
      if (unico && (depois === 1 || depois === 2)) dec = u;
      // 3 dígitos depois, ou separador repetido: é milhar, dec continua -1
    }
    var inteiro = (dec === -1 ? s : s.slice(0, dec)).replace(/[.,]/g, '');
    var frac = dec === -1 ? '' : s.slice(dec + 1).replace(/[.,]/g, '');
    if (!/^[0-9]+$/.test(inteiro)) return null;
    if (frac && !/^[0-9]{1,2}$/.test(frac)) return null;
    var centavos = Number(inteiro) * 100 + Number((frac + '00').slice(0, 2));
    if (!isFinite(centavos) || centavos <= 0 || centavos > ALVO_MAX_CENTAVOS) return null;
    return centavos;
  }

  /* Passo por faixa: nunca mais que ~5% do preço, senão o palpite deixa de ser
     "10% abaixo" e vira outro produto. */
  function passoDoPreco(precoCent) {
    return precoCent >= 500000 ? 10000   // >= R$ 5.000 -> passo R$ 100
         : precoCent >= 100000 ?  5000   // >= R$ 1.000 -> passo R$  50
         : precoCent >=  20000 ?  1000   // >= R$   200 -> passo R$  10
         :                         500;  //  abaixo     -> passo R$   5
  }

  /* R$ 1.234,56 -> 10% abaixo é R$ 1.111,10 -> vira R$ 1.100,00. 1.110 é um
     número que uma máquina calculou; 1.100 é o número que alguém fala em voz
     alta, e o campo inteiro existe pra ser o "eu compro por isso".
     O laço garante ESTRITAMENTE abaixo do preço publicado: um padrão >= preço
     jogaria a pessoa no `jaabaixo` sem ela ter tocado em nada.
     Medido nos 51 produtos do catálogo: sugestões entre 8,8% e 12,2% abaixo,
     todas terminando em zero. */
  function alvoPadraoCentavos(precoReais) {
    var preco = Number(precoReais);
    if (!isFinite(preco) || preco <= 0) return null;
    var precoCent = Math.round(preco * 100);
    var passo = passoDoPreco(precoCent);
    var bruto = Math.round(precoCent * (1 - DESCONTO_PADRAO));
    var alvo = Math.round(bruto / passo) * passo;
    while (alvo >= precoCent) alvo -= passo;
    if (alvo < 100) alvo = Math.floor(bruto / 100) * 100;   // barato demais pro passo
    if (alvo < 100 || alvo >= precoCent) return null;       // sem palpite decente: nem oferece
    return alvo;
  }

  /* A MESMA decisão que o servidor toma de novo em cima do POST; aqui só pra
     responder na hora. `>= preco` e não `> preco`: o disparo é `preco <= alvo`,
     então alvo igual ao preço de hoje já está atingido AGORA, e o certo é mandar
     comprar em vez de prometer e-mail. */
  function validarAlvo(txt, precoCent) {
    var centavos = parseAlvoCentavos(txt);
    if (centavos === null) return { ok: false, causa: 'invalido', centavos: null };
    // Sobrou um zero: 1000x o preço não é "já está abaixo", é erro de digitação,
    // e a mensagem de jaabaixo ("dá pra comprar agora") leria péssimo ali.
    if (precoCent && centavos > 10 * precoCent) {
      return { ok: false, causa: 'acimadopreco', centavos: centavos };
    }
    if (precoCent && centavos >= precoCent) return { ok: false, causa: 'jaabaixo', centavos: centavos };
    return { ok: true, causa: '', centavos: centavos };
  }

  function injetarAlertaPreco(card, precoReais, linkLoja) {
    if (!card) return;
    // Exclusão mútua com o irmão, nos DOIS sentidos, e idempotência.
    // Duas chamadas separadas de propósito, não um seletor com vírgula: o DOM
    // mínimo do test_botao_alerta.ts entende um seletor simples só, e a versão
    // com vírgula passaria verde no teste enquanto se comporta diferente no
    // navegador.
    if (card.querySelector('.alerta-preco')) return;
    if (card.querySelector('.alerta-estoque')) return;

    var precoCent = Math.round(Number(precoReais) * 100);
    if (!isFinite(precoCent) || precoCent <= 0) return;

    var marca = String(card.dataset.marca || '').trim();
    var modelo = String(card.dataset.modelo || '').trim();
    if (!marca || !modelo) return;
    // Case ORIGINAL, igual ao do aviso de estoque: é a chave do prices.json e da
    // coluna `produto` no banco, e o servidor compara sem normalizar caixa.
    var chave = marca + '|' + modelo;
    var nome = marca + ' ' + modelo;
    // Slug da URL pro GA4. O product_slug do tracking que já existe neste
    // arquivo é o slug; mandar "Bettdow|AC1041" no mesmo parâmetro misturaria
    // dois formatos no mesmo relatório.
    var slug = (String(location.pathname).match(/\/projetor\/([^\/]+)\.html/i) || [])[1] || '';

    var alvoInicial = alvoPadraoCentavos(precoReais);
    if (alvoInicial === null) return;

    if (!document.getElementById('ae-css')) {
      var st = document.createElement('style');
      st.id = 'ae-css';
      st.textContent = ALERTA_CSS;
      document.head.appendChild(st);
    }

    var wrap = document.createElement('div');
    wrap.className = 'alerta-preco';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ae-abrir';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'ap-form');
    btn.textContent = 'Me avisa se chegar a R$ ' + precoBrCentavosAlerta(alvoInicial).replace(/,00$/, '');

    var form = document.createElement('form');
    form.className = 'ae-form';
    form.id = 'ap-form';
    form.method = 'POST';
    form.action = ALERTA_ENDPOINT;
    form.hidden = true;

    function oculto(nomeCampo, valor) {
      var i = document.createElement('input');
      i.type = 'hidden';
      i.name = nomeCampo;
      i.value = valor;
      return i;
    }
    var campoTipo = oculto('tipo', 'preco');
    var campoProduto = oculto('produto', chave);
    // O que vai pro fio são CENTAVOS INTEIROS, e o campo visível não tem `name`
    // nenhum. O servidor TEM que revalidar (o form POSTa direto na Function e
    // qualquer um forja o campo), então o formato do fio é o que se valida numa
    // linha: /^[0-9]{1,8}$/. Mandar a string crua obrigaria os dois lados a
    // concordarem byte a byte sobre o que é "1.299" em pt-BR, e dois parsers
    // que discordam calados é exatamente o modo de falha caro aqui.
    var campoAlvo = oculto('alvo', String(alvoInicial));

    var rotAlvo = document.createElement('label');
    rotAlvo.className = 'ae-label';
    rotAlvo.htmlFor = 'ap-alvo';
    rotAlvo.textContent = 'Me avise quando chegar a este preço (ou menos)';

    var moeda = document.createElement('div');
    moeda.className = 'ae-moeda';
    var prefixo = document.createElement('span');
    prefixo.className = 'ae-prefixo';
    prefixo.setAttribute('aria-hidden', 'true');   // rótulo e ajuda já dizem R$
    prefixo.textContent = 'R$';

    var alvo = document.createElement('input');
    alvo.type = 'text';                 // NUNCA number: no Safari/iOS e em
    alvo.inputMode = 'decimal';         // qualquer navegador cujo locale de UI
    alvo.id = 'ap-alvo';                // não seja pt-BR, o value vem "" pra
    alvo.className = 'ae-alvo';         // "1.299,90" e a pessoa perde o que
    alvo.autocomplete = 'off';          // digitou sem aviso nenhum. text +
    alvo.maxLength = 14;                // inputmode dá o teclado numérico sem
    alvo.value = precoBrCentavosAlerta(alvoInicial);   // tocar no valor.
    alvo.setAttribute('enterkeyhint', 'next');
    alvo.setAttribute('aria-describedby', 'ap-ajuda ap-erro');

    var ajuda = document.createElement('p');
    ajuda.className = 'ae-ajuda';
    ajuda.id = 'ap-ajuda';
    ajuda.textContent = 'Hoje está R$ ' + precoBrCentavosAlerta(precoCent) + '. Pode mudar o valor.';

    // Renderizado SEMPRE, vazio e escondido: role="alert" só é anunciado de
    // forma confiável quando o container já existe no DOM antes do texto, e o
    // aria-describedby acima ficaria inválido apontando pra id inexistente.
    var erro = document.createElement('p');
    erro.className = 'ae-erro';
    erro.id = 'ap-erro';
    erro.setAttribute('role', 'alert');
    erro.hidden = true;

    var rotEmail = document.createElement('label');
    rotEmail.className = 'ae-label';
    rotEmail.htmlFor = 'ap-email';
    rotEmail.textContent = 'Seu e-mail';

    var linha = document.createElement('div');
    linha.className = 'ae-linha';

    var campoEmail = document.createElement('input');
    campoEmail.type = 'email';
    campoEmail.id = 'ap-email';
    campoEmail.name = 'email';
    campoEmail.required = true;
    campoEmail.maxLength = 254;
    campoEmail.autocomplete = 'email';
    campoEmail.placeholder = 'voce@email.com';

    var enviar = document.createElement('button');
    enviar.type = 'submit';
    enviar.textContent = 'Quero ser avisado';

    var consent = document.createElement('p');
    consent.className = 'ae-consent';
    // textContent, nunca innerHTML: marca, modelo e alvo são dado variável.
    var consentTxt = document.createElement('span');
    consentTxt.className = 'ae-consent-txt';
    var linkPol = document.createElement('a');
    linkPol.href = basePath() + 'politica-privacidade.html';
    linkPol.textContent = 'Ler a política';
    consent.appendChild(consentTxt);
    consent.appendChild(linkPol);

    /* Fixa: não depende mais do alvo, porque a frase que descreve o alvo agora
       vai no e-mail de confirmação. Nada aqui precisa ser reescrito a cada
       tecla, e some junto o risco de o texto na tela discordar do `alvo` que
       foi no POST. */
    consentTxt.textContent = avisoDaTela();

    var MSG = {
      invalido: 'Digite um valor, tipo 1.100 ou 1.100,00.',
      acimadopreco: 'Esse valor é bem maior que o preço de hoje, que é R$ ' +
                    precoBrCentavosAlerta(precoCent) + '. Confere se não sobrou um zero.',
      jaabaixo: 'O preço de hoje já é R$ ' + precoBrCentavosAlerta(precoCent) +
                ', esse valor ou menos. Não tem o que esperar, dá pra comprar agora.'
    };

    function revisar() {
      var v = validarAlvo(alvo.value, precoCent);
      if (v.ok) {
        campoAlvo.value = String(v.centavos);
        erro.textContent = '';
        erro.hidden = true;
        alvo.setAttribute('aria-invalid', 'false');
      } else {
        campoAlvo.value = '';
        erro.textContent = MSG[v.causa];
        erro.hidden = false;
        alvo.setAttribute('aria-invalid', 'true');
        if (v.causa === 'jaabaixo' && linkLoja) {
          var a = document.createElement('a');
          a.href = linkLoja;
          a.target = '_blank';
          a.rel = 'noopener nofollow sponsored';
          a.textContent = ' Ver na loja';
          erro.appendChild(a);
        }
      }
      return v;
    }

    alvo.addEventListener('input', revisar);
    alvo.addEventListener('blur', function () {
      var v = revisar();
      if (v.ok) alvo.value = precoBrCentavosAlerta(v.centavos);   // normaliza a exibição
    });

    form.addEventListener('submit', function (ev) {
      var v = revisar();
      if (!v.ok) {
        if (ev && ev.preventDefault) ev.preventDefault();
        alvo.focus();
        return;
      }
      if (typeof gtag === 'function') {
        // Sem o alvo: o valor que a pessoa digitou é dado dela e não sai daqui
        // pro Google. A métrica D da Fase 4 (alvo ÷ preço na inscrição) lê
        // alertas.preco_alvo_centavos no banco, então o campo aqui não servia
        // pra nada e só criava dever de declaração no item 2.1 da política.
        gtag('event', 'alerta_preco_enviar', { product_slug: slug });
      }
    });

    btn.addEventListener('click', function () {
      form.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.hidden = true;
      alvo.focus();
      if (typeof gtag === 'function') {
        gtag('event', 'alerta_preco_abrir', { product_slug: slug });
      }
    });

    moeda.appendChild(prefixo);
    moeda.appendChild(alvo);
    linha.appendChild(campoEmail);
    linha.appendChild(enviar);
    form.appendChild(campoTipo);
    form.appendChild(campoProduto);
    form.appendChild(campoAlvo);
    form.appendChild(rotAlvo);
    form.appendChild(moeda);
    form.appendChild(ajuda);
    form.appendChild(erro);
    form.appendChild(rotEmail);
    form.appendChild(linha);
    form.appendChild(consent);
    wrap.appendChild(btn);
    wrap.appendChild(form);

    var body = card.querySelector('.pj-price-body') || card;
    body.appendChild(wrap);
  }

  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  // Detecta o caminho-base para acessar /data/ — funciona em qualquer profundidade
  // (raiz, /projetor/{slug}.html, etc.)
  function basePath() {
    var p = location.pathname;
    // Se está em /projetor/{slug}.html ou /marca/{slug}.html, sobe uma pasta
    // (sem o /marca/ os hubs fazem fetch de data/prices.json em caminho errado = 404)
    if (/\/(projetor|marca)\//i.test(p)) return '../';
    return '';
  }

  function mergeOverlay(produtos, indisponiveis, slugMap) {
    const data = window.PROJETORES_DATA;
    if (!Array.isArray(data)) return { merged: 0, zerados: 0, slugged: 0 };

    const indexOverlay = new Map();
    for (const p of produtos) {
      indexOverlay.set(norm(p.marca) + '|' + norm(p.modelo), p);
    }
    // Map (nao Set): o MOTIVO precisa sobreviver ao merge pra busca/cards
    // distinguirem esgotado de "sem preco publicado ainda".
    const indexIndisp = new Map();
    for (const x of indisponiveis || []) {
      indexIndisp.set(norm(x.marca) + '|' + norm(x.modelo), norm(x.motivo));
    }
    // Index dos slugs também por chave normalizada (case-insensitive)
    const indexSlug = new Map();
    if (slugMap && typeof slugMap === 'object') {
      for (const k of Object.keys(slugMap)) {
        if (k.startsWith('_')) continue;
        const parts = k.split('|');
        if (parts.length === 2) {
          indexSlug.set(norm(parts[0]) + '|' + norm(parts[1]), slugMap[k]);
        }
      }
    }

    let merged = 0;
    let zerados = 0;
    let slugged = 0;
    for (const proj of data) {
      const k = norm(proj.marca) + '|' + norm(proj.modelo);
      const overlay = indexOverlay.get(k);

      if (overlay) {
        // Sobrescreve preco_min/max para filtro+scoring existentes continuarem funcionando
        proj.preco_min = overlay.preco_atual;
        proj.preco_max = overlay.preco_max_historico || overlay.preco_atual;

        // Campos novos consumidos pelo render expandido
        proj.preco_atual          = overlay.preco_atual;
        proj.preco_min_historico  = overlay.preco_min_historico;
        proj.preco_max_historico  = overlay.preco_max_historico;
        proj.marketplace_vencedor = overlay.marketplace_vencedor;
        proj.data_verificacao     = overlay.data_verificacao;
        proj.marketplaces         = overlay.marketplaces;  // pra o render acessar cupom/preço/link por marketplace

        const mk = overlay.marketplaces || {};
        // Normaliza 'mercado_livre' (chave do prices.json) -> 'ml' (o que o resto do site espera).
        // Sem isso a pagina ML le mkts.ml / marketplace_vencedor==='ml' e quebra (botao sem preco, label cru).
        if (mk.mercado_livre && !mk.ml) mk.ml = mk.mercado_livre;
        if (proj.marketplace_vencedor === 'mercado_livre') proj.marketplace_vencedor = 'ml';
        if (mk.aliexpress && mk.aliexpress.link) proj.ali_url    = mk.aliexpress.link;
        if (mk.shopee     && mk.shopee.link)     proj.shopee_url = mk.shopee.link;
        if (mk.ml         && mk.ml.link)         proj.ml_url     = mk.ml.link;

        // Cupom Ali só quando o vencedor É AliExpress — senão levaria o usuário ao
        // caminho MAIS CARO (a Shopee/ML está mais barata). Mesma regra do /precos
        // (precos.js:165-166). Atribuição SEMPRE incondicional: cupom exibido vem
        // exclusivamente do prices.json; valor herdado de projetores-data.js ou de
        // HTML antigo NUNCA sobrevive (auditoria cupons 11/06 — cupom fantasma).
        if (proj.marketplace_vencedor === 'aliexpress') {
          proj.ali_cupom_loja  = (mk.aliexpress && mk.aliexpress.cupom)            || '';
          proj.ali_cupom_promo = (mk.aliexpress && mk.aliexpress.cupom_plataforma) || '';
        } else {
          proj.ali_cupom_loja  = '';
          proj.ali_cupom_promo = '';
        }

        merged++;
      } else if (indexIndisp.has(k)) {
        // Indisponível conhecido: zera preço para a regra existente filtrar
        proj.preco_min   = null;
        proj.preco_max   = null;
        proj.preco_atual = null;
        // Motivo + veredito, pra quem renderiza rótulo não ter que repetir o enum.
        proj.indisponivel_motivo = indexIndisp.get(k);
        proj.sem_estoque_real    = esgotadoDeVerdade(proj.indisponivel_motivo);
        zerados++;
      }

      // Slug é independente do overlay de preço — uma página individual existe
      // mesmo que o produto esteja indisponível.
      const slug = indexSlug.get(k);
      if (slug) {
        proj.slug = slug;
        slugged++;
      }
    }

    return { merged, zerados, slugged };
  }

  /* Patch DOM em páginas individuais quando o produto está indisponível.
     Reescreve o card de preço com estado "Sem estoque" + subtítulo por motivo.
     Mantém link da loja (cookie de afiliado) exceto quando o anúncio foi retirado.
     Roda só em /projetor/{slug}.html — em outras páginas não tem .proj-price-card. */
  function patchIndisponiveisDOM(indisponiveis) {
    if (!indisponiveis || !indisponiveis.length) return;
    const card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
    if (!card) return;

    const cardKey = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);
    let motivo = null;
    for (const x of indisponiveis) {
      if (norm(x.marca) + '|' + norm(x.modelo) === cardKey) {
        motivo = x.motivo;
        break;
      }
    }
    if (!motivo) return;

    // ─── 1. Badge no topo (.proj-badges) — sempre reescrito ─────────────────────
    const badgesContainer = document.querySelector('.proj-badges');
    if (badgesContainer) {
      const STATUS_RE = /^(Estoque nacional|Importado|Sem estoque|Esgotado|Anúncio retirado|Indispon[ií]vel|Verificando preço)\b/i;
      badgesContainer.querySelectorAll('.proj-badge').forEach(function(b) {
        if (STATUS_RE.test(b.textContent.trim())) b.remove();
      });
      const labelBadgePorMotivo = {
        'sem_estoque_br':         'Sem estoque',
        'sem_estoque_importado':  'Importado',
        'indisponivel':           'Anúncio retirado'
      };
      const newBadge = document.createElement('span');
      newBadge.className = 'proj-badge proj-status-badge';
      newBadge.textContent = labelBadgePorMotivo[motivo] || 'Verificando preço';
      badgesContainer.appendChild(newBadge);
    }

    // ─── Motivo fora do enum conhecido = diagnóstico do checker, não esgotado ───
    // (M7 auditoria 02/06) Ex.: "sem preço final ou sem vencedor". Antes caía no
    // ramo "Sem estoque" e escondia a compra de produto que ainda vende. Aqui o
    // badge já virou "Verificando preço"; preço, botões e aviso ficam intactos.
    if (!esgotadoDeVerdade(motivo)) return;

    // Antes do return do sem_estoque_importado logo abaixo, pra que os DOIS
    // motivos elegiveis ganhem o botao. O importado esta vendendo (com taxa),
    // e o aviso util ali e "voltou ao estoque NACIONAL".
    injetarAlertaEstoque(card, motivo);

    // ─── 2. Aviso ao final do card (último <p style> dentro do .proj-price-card) ─
    // Substitui o texto hardcoded de cada página por um aviso padronizado por motivo.
    // Assim qualquer produto que entrar em sem_estoque_importado ganha automaticamente
    // o alerta de taxa de importação, sem precisar editar HTML.
    // Os <p> do bloco de aviso ficam DE FORA da escolha, e isso é load-bearing.
    // O injetarAlertaEstoque acima já pendurou o bloco no fim do card, então o
    // "último <p>" passou a ser o do CONSENTIMENTO — e este innerHTML o
    // apagava, junto com o link "Ler a política". Resultado medido em navegador
    // de verdade: a pessoa se inscrevia sem nunca ter visto a frase que o
    // servidor grava como prova, que é exatamente o que o teste de contrato
    // existe pra impedir. Filtrar aqui resolve independentemente da ordem em
    // que os patches rodam.
    const avisos = Array.prototype.filter.call(
      card.querySelectorAll('p'),
      function (p) { return !p.closest('.alerta-estoque') && !p.closest('.alerta-preco'); }
    );
    const avisoEl = avisos[avisos.length - 1] || null;
    const avisoPorMotivo = {
      'sem_estoque_br':         'Anúncio está sem estoque agora, mas costuma voltar.',
      'sem_estoque_importado':  '<strong>Produto importado</strong>, sujeito a taxa de importação cobrada pela Receita Federal. Prazo de entrega 15-30 dias e o preço pode variar com promoções e impostos.',
      'indisponivel':           'A loja retirou esse anúncio. Veja modelos parecidos em <a href="../comparar.html">/comparar</a>.'
    };
    if (avisoEl && avisoPorMotivo[motivo]) avisoEl.innerHTML = avisoPorMotivo[motivo];

    // ─── 3. sem_estoque_importado: NÃO reescrever preço/botões ──────────────────
    // Produto está vendendo (importado), o JS da página já renderizou preço Ali.
    // Só o badge e o aviso de taxa precisam ser reescritos (feito acima).
    if (motivo === 'sem_estoque_importado') return;

    // ─── 4. Demais motivos: card de preço vira "Sem estoque" ────────────────────
    const subtituloPorMotivo = {
      'sem_estoque_br': 'Anúncio sem estoque agora, costuma voltar',
      'indisponivel':   'Anúncio foi retirado pela loja'
    };
    const subtitulo = subtituloPorMotivo[motivo] || 'Sem disponibilidade no momento';

    const labelEl = card.querySelector('.proj-price-label');
    if (labelEl) labelEl.textContent = 'Status';

    const valueEl = card.querySelector('#projPriceValue, .proj-price-value');
    if (valueEl) valueEl.innerHTML = 'Sem estoque';

    const metaEl = card.querySelector('#projPriceMeta, .proj-price-meta');
    if (metaEl) metaEl.textContent = subtitulo;

    const btnsEl = card.querySelector('#projStoreBtns, .proj-store-btns');
    if (btnsEl) {
      if (motivo === 'indisponivel') {
        // Anúncio retirado — link morto, esconde botões
        btnsEl.style.display = 'none';
      } else {
        // Mantém botões pra gerar cookie de afiliado, mas troca preço por "Ver na loja"
        btnsEl.querySelectorAll('.store-price').forEach(function(el) {
          el.textContent = 'Ver na loja';
        });
        btnsEl.querySelectorAll('.winner-badge').forEach(function(el) { el.remove(); });
        btnsEl.querySelectorAll('.store-winner').forEach(function(el) {
          el.classList.remove('store-winner');
        });
      }
    }

    const cupomSlot = card.querySelector('#projCupomSlot');
    if (cupomSlot) cupomSlot.innerHTML = '';
  }

  /* Atualiza o JSON-LD (Product>offers) da página individual com o preço/disponibilidade
     AO VIVO do prices.json. As páginas são geradas só na entrada do produto, então sem isso
     o offers.price fica congelado na data de geração (Googlebot renderiza JS e lê este valor).
     Roda só em /projetor/{slug}.html (precisa do .proj-price-card com marca/modelo). */
  function patchJsonLdDOM(produtos, indisponiveis) {
    const card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
    if (!card) return;
    const key = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);

    let live = null;
    for (const p of produtos || []) {
      if (norm(p.marca) + '|' + norm(p.modelo) === key) { live = p; break; }
    }
    let isOut = false;
    for (const x of indisponiveis || []) {
      if (norm(x.marca) + '|' + norm(x.modelo) === key) {
        // Motivo fora do enum = diagnóstico do checker (M7): não vira OutOfStock
        isOut = esgotadoDeVerdade(x.motivo);
        break;
      }
    }
    if (!live && !isOut) return; // sem dado vivo e não listado: não mexe no estático

    const sellerMap = { aliexpress: 'AliExpress', shopee: 'Shopee', mercado_livre: 'Mercado Livre', ml: 'Mercado Livre' };
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const sc of scripts) {
      let obj;
      try { obj = JSON.parse(sc.textContent); } catch (e) { continue; }
      if (!obj || !obj.offers) continue;
      const off = obj.offers;
      const out = isOut || !live || !live.preco_atual;
      if (live && live.preco_atual) {
        off.price = (Math.round(live.preco_atual * 100) / 100).toFixed(2);
        const d = new Date(); d.setDate(d.getDate() + 7);
        off.priceValidUntil = d.toISOString().slice(0, 10);
      }
      off.availability = 'https://schema.org/' + (out ? 'OutOfStock' : 'InStock');
      if (live && live.marketplace_vencedor && off.seller && sellerMap[live.marketplace_vencedor]) {
        off.seller.name = sellerMap[live.marketplace_vencedor];
      }
      sc.textContent = JSON.stringify(obj, null, 2);
      break;
    }

    // Cupom: em pagina de vencedor != Ali e SEM cupom proprio, limpa o slot pra nao exibir
    // o cupom Ali estatico/legado (levaria ao caminho mais caro). mergeOverlay ja zerou os
    // cupons Ali injetados via JS; isto mata so o fallback SSR baked na pagina.
    if (live && live.marketplace_vencedor && live.marketplace_vencedor !== 'aliexpress') {
      const wmk = (live.marketplaces || {})[live.marketplace_vencedor] || {};
      if (!wmk.cupom) {
        const cslot = document.getElementById('projCupomSlot');
        if (cslot) cslot.innerHTML = '';
      }
    }
  }

  /* Selo "menor preco do historico" (etapa 2.1). Verdadeiro quando o preco de HOJE
     e o menor da serie inteira do precos.db (prices.json: preco_min_historico inclui
     a rodada de hoje; tolerancia de 50 centavos = mesma regua do tooltip do grafico).
     Copy honesta: o selo cita a data real de inicio da serie DESTE produto
     (historico_desde) e so entra com 14+ dias de historico — "menor preco" de uma
     serie de 3 dias nao diz nada. */
  function isMenorHistorico(live) {
    if (!live || !live.preco_atual || !live.preco_min_historico || !live.historico_desde) return false;
    // empate exato com o mínimo (o exportador clampa min <= atual; 0.005 = só ruído
    // de float). Tolerância maior afirmaria "menor do histórico" com preço ACIMA
    // do mínimo que o gráfico da própria página exibe — mentira por centavos.
    if (live.preco_atual > live.preco_min_historico + 0.005) return false;
    // série flat (min==max) tornaria o selo permanente e vazio — exige variação real
    if (!(live.preco_max_historico > live.preco_min_historico + 0.5)) return false;
    var ini = new Date(live.historico_desde + 'T00:00:00');
    return !isNaN(ini) && (Date.now() - ini.getTime()) >= 14 * 864e5;
  }

  function liveDoCard(produtos) {
    var card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
    if (!card) return null;
    var key = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);
    for (var i = 0; i < (produtos || []).length; i++) {
      var p = produtos[i];
      if (norm(p.marca) + '|' + norm(p.modelo) === key) return p;
    }
    return null;
  }

  /* Injeta o selo no card de preco do topo, logo abaixo do "Verificado em ...".
     Elemento proprio (.proj-lowest-flag, estilo no projetor.css) — nao disputa
     com o projetor-page.js, que reescreve só #projPriceValue/#projPriceMeta. */
  function patchMenorPrecoDOM(produtos) {
    try {
      var card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
      if (!card || card.querySelector('.proj-lowest-flag')) return;
      var live = liveDoCard(produtos);
      if (!isMenorHistorico(live)) return;
      var d = live.historico_desde;
      var flag = document.createElement('div');
      flag.className = 'proj-lowest-flag';
      flag.innerHTML = 'Menor preço do nosso histórico <span>(monitorado desde ' +
        d.slice(8, 10) + '/' + d.slice(5, 7) + ')</span>';
      var metaEl = card.querySelector('#projPriceMeta, .proj-price-meta');
      if (metaEl) metaEl.insertAdjacentElement('afterend', flag);
      else card.insertBefore(flag, card.firstChild);
    } catch (e) { /* nunca derrubar os outros patches */ }
  }

  /* Pagina de projetor e longa (~7000px) e o unico botao de compra fica no topo.
     Injeta um card "Comprar agora — R$ X" como 1o item de "Proximos passos" (fim da pagina),
     SO pra produto disponivel, linkando pro marketplace vencedor. Esgotado nao ganha nada. */
  function patchBuyCtaDOM(produtos) {
    const ctaFinal = document.querySelector('.proj-cta-final');
    if (!ctaFinal || ctaFinal.querySelector('.proj-cta-buy')) return;
    const card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
    if (!card) return;
    const key = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);
    let live = null;
    for (const p of produtos || []) {
      if (norm(p.marca) + '|' + norm(p.modelo) === key) { live = p; break; }
    }
    if (!live || !live.preco_atual) return; // so disponivel
    const venc = live.marketplace_vencedor;
    const mk = (live.marketplaces || {})[venc] || (live.marketplaces || {}).mercado_livre || {};
    if (!mk.link) return;
    const lojaMap = { aliexpress: 'AliExpress', shopee: 'Shopee', mercado_livre: 'Mercado Livre', ml: 'Mercado Livre' };
    const loja = lojaMap[venc] || 'loja';
    const preco = 'R$ ' + Math.round(live.preco_atual).toLocaleString('pt-BR');
    const a = document.createElement('a');
    a.href = mk.link; a.target = '_blank'; a.rel = 'noopener nofollow sponsored';
    a.className = 'proj-cta-card proj-cta-buy';
    a.style.cssText = 'border-color:var(--border-hover);background:linear-gradient(135deg,rgba(79,163,199,0.12),rgba(123,140,255,0.05));';
    var pitch = isMenorHistorico(live)
      ? 'Menor preço do nosso histórico, no ' + loja + '. Testado no canal.'
      : 'Melhor preço de hoje no ' + loja + ', testado no canal.';
    a.innerHTML = '<h4 style="color:var(--accent)">Comprar agora · ' + preco + '</h4>' +
      '<p>' + pitch + '</p>';
    ctaFinal.insertBefore(a, ctaFinal.firstChild);
  }

  /* CTA fixo no rodapé do MOBILE nas páginas de projetor: a página tem ~7000px
     e, entre o card do topo e o "Comprar agora" do fim, não havia nenhum caminho
     de compra. Mesmo padrão da barra .pa-mobile-cta já validada nos acessórios —
     CSS injetado aqui porque /projetor/ não carrega acessorio.css. Só produto
     disponível; esgotado não ganha barra. O <a> usa a classe .proj-mobile-cta,
     que o tracking de clique já mapeia como source 'mobile_sticky'. */
  function patchMobileCtaDOM(produtos) {
    try {
      if (document.querySelector('.proj-mobile-bar')) return;
      const card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
      if (!card) return;
      const key = norm(card.dataset.marca) + '|' + norm(card.dataset.modelo);
      let live = null;
      for (const p of produtos || []) {
        if (norm(p.marca) + '|' + norm(p.modelo) === key) { live = p; break; }
      }
      if (!live || !live.preco_atual) return;
      const venc = live.marketplace_vencedor;
      const mk = (live.marketplaces || {})[venc] || (live.marketplaces || {}).mercado_livre || {};
      if (!mk.link) return;
      const lojaMap = { aliexpress: 'AliExpress', shopee: 'Shopee', mercado_livre: 'Mercado Livre', ml: 'Mercado Livre' };

      const style = document.createElement('style');
      style.textContent =
        '.proj-mobile-bar{display:none;position:fixed;bottom:0;left:0;right:0;z-index:900;background:rgba(11,11,11,0.96);backdrop-filter:blur(16px);border-top:1px solid var(--border);padding:12px 16px;align-items:center;justify-content:space-between;gap:12px}' +
        '.proj-mobile-bar .preco-min{font-size:0.7rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em}' +
        '.proj-mobile-bar .preco-val{font-size:1.15rem;font-weight:800;color:var(--accent);line-height:1;margin-top:2px}' +
        '.proj-mobile-bar a.proj-mobile-cta{flex:1;max-width:220px;text-align:center;padding:12px 16px;background:linear-gradient(135deg,var(--primary),var(--gradient-secondary));color:#fff;font-weight:700;font-size:0.92rem;border-radius:var(--radius)}' +
        '@media (max-width:880px){.proj-mobile-bar{display:flex}body{padding-bottom:74px}}';
      document.head.appendChild(style);

      const bar = document.createElement('div');
      bar.className = 'proj-mobile-bar';
      const info = document.createElement('div');
      const rotulo = isMenorHistorico(live) ? 'Menor preço do histórico' : 'Melhor preço hoje';
      info.innerHTML = '<div class="preco-min">' + rotulo + '</div><div class="preco-val">R$ ' +
        Math.round(live.preco_atual).toLocaleString('pt-BR') + '</div>';
      const a = document.createElement('a');
      a.className = 'proj-mobile-cta';
      a.href = mk.link;
      a.target = '_blank';
      a.rel = 'noopener nofollow sponsored';
      a.textContent = 'Ver no ' + (lojaMap[venc] || 'loja') + ' ↗';
      bar.appendChild(info);
      bar.appendChild(a);
      document.body.appendChild(bar);
    } catch (e) { /* nunca derrubar os outros patches */ }
  }

  /* Aviso de preço: ramo do produto COM preço publicado, irmão do
     patchIndisponiveisDOM. Ancorado no MESMO liveDoCard(), que procura o
     .proj-price-card[data-marca][data-modelo] — elemento que existe nas 76
     páginas de /projetor/ e em ZERO das 45 outras que carregam este arquivo
     (medido: grep de 'proj-price-card' nas não-projetor dá 0). Então nenhuma
     listagem pode repetir o formulário, e a defesa é estrutural em vez de um
     teste de pathname, que quebraria calado se a estrutura de pastas mudasse.

     Partição medida no prices.json de 09/09: das 76 páginas, 51 ganham o botão
     de PREÇO, 20 o de ESTOQUE e 5 nenhum (4 'indisponivel', que o Re-Check
     exclui de propósito, e o X30, que é falha de medição). Sem sobreposição. */
  function patchAlertaPrecoDOM(produtos) {
    try {
      var card = document.querySelector('.proj-price-card[data-marca][data-modelo]');
      if (!card) return;
      var live = liveDoCard(produtos);
      if (!live || !live.preco_atual) return;
      var venc = live.marketplace_vencedor;
      var mk = (live.marketplaces || {})[venc] || (live.marketplaces || {}).mercado_livre || {};
      // Sem bail em !mk.link, ao contrário dos irmãos de compra: aqui o link é
      // só o "ver na loja" do estado jaabaixo, não a razão do bloco existir.
      injetarAlertaPreco(card, live.preco_atual, mk.link || '');
    } catch (e) { /* nunca derrubar os outros patches */ }
  }

  function applyOverlay() {
    const bp = basePath();
    const fetchPrices = fetch(bp + 'data/prices.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    // slugs.json é opcional — se falhar, site funciona sem links clicáveis nas ferramentas
    const fetchSlugs = fetch(bp + 'data/slugs.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });

    return Promise.all([fetchPrices, fetchSlugs])
      .then(function (results) {
        const j = results[0];
        const slugMap = results[1] || {};
        const meta = j.metadata || {};
        const result = mergeOverlay(j.produtos || [], meta.indisponiveis || [], slugMap);
        window.PRICES_METADATA = meta;
        window.SLUGS_MAP = slugMap;

        // Em /projetor/{slug}.html quando o produto está indisponivel, reescreve o card
        // de preço (o JS da própria página bate "return" se preco_atual é null, deixando
        // o texto hardcoded antigo).
        const indispList = meta.indisponiveis || [];
        const prodList = j.produtos || [];
        function runDomPatches() {
          patchIndisponiveisDOM(indispList);
          patchJsonLdDOM(prodList, indispList);
          patchMenorPrecoDOM(prodList);
          patchBuyCtaDOM(prodList);
          patchMobileCtaDOM(prodList);
          // Por último de propósito: patchBuyCtaDOM e patchMobileCtaDOM são os
          // caminhos de compra, e nada do alerta pode atrasá-los ou quebrá-los.
          patchAlertaPrecoDOM(prodList);
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', runDomPatches);
        } else {
          runDomPatches();
        }

        if (location.search.indexOf('debug=1') !== -1) {
          console.log('[prices-overlay] ok — merged=' + result.merged + ' zerados=' + result.zerados + ' slugged=' + result.slugged + ' de ' + (window.PROJETORES_DATA || []).length + ' (atualizado_em=' + meta.atualizado_em + ')');
        }
        return result;
      })
      .catch(function (err) {
        console.warn('[prices-overlay] falhou, site usa dados estaticos:', err && err.message);
        return null;
      });
  }

  /* Tracking GA4 — listener delegado único.
     click_affiliate: as páginas de acessório já medem com onclick próprio (e não
     carregam este arquivo); isto cobre o resto: /projetor/, comparar, qual-projetor
     e precos. Mesmos params do padrão dos acessórios (product_slug/loja/source).
     copy_coupon (etapa 2.1): cobre TODOS os botões de copiar cupom do site,
     inclusive os assados estáticos nas páginas (que não têm gtag no onclick).
     Sem gtag na página, não faz nada. */
  function initClickTracking() {
    var SOURCES = [
      ['.proj-cta-buy',    'cta_fim'],
      ['.proj-mobile-cta', 'mobile_sticky'],
      ['.proj-store-btn',  'card_topo'],
      ['.pt-offer-btn',    'tabela_precos'],
      ['.cp-store-btn',    'comparador'],
      ['.qp-store-btn',    'recomendador'],
      ['.btn-loja',        'v2_card']
    ];
    var COPY_SOURCES = [
      ['.copy-btn',            'card_topo'],
      ['.cp-cupom-copy',       'comparador'],
      ['.qp-coupon-copy',      'recomendador'],
      ['.pt-coupon[data-cod]', 'tabela_precos']
    ];
    // Produto: slug da página individual; nas ferramentas, nome no card mais próximo
    function resolveProduto(el) {
      var produto = '';
      var m = location.pathname.match(/\/projetor\/([^\/]+)\.html/i);
      if (m) produto = m[1];
      if (!produto) {
        var card = el.closest('.qp-card');
        var nEl = card && card.querySelector('.qp-card-name');
        if (nEl) produto = nEl.textContent.trim();
      }
      if (!produto) {
        // comparador: botões de loja/cupom vivem nos cards do #purchaseGrid (.cp-pcard)
        var pcard = el.closest('.cp-pcard');
        if (pcard) {
          var b = pcard.querySelector('.cp-pcard-brand');
          var mo = pcard.querySelector('.cp-pcard-model');
          produto = ((b ? b.textContent : '') + ' ' + (mo ? mo.textContent : '')).trim();
        }
      }
      if (!produto) {
        var row = el.closest('tr, .pt-card');
        var nm = row && row.querySelector('.pt-name-txt');
        if (nm) produto = nm.textContent.trim();
      }
      if (!produto) {
        // cards do redesign v2 (home/páginas de código): marca+modelo no .m-nome ou .vs-card
        var v2 = el.closest('.prod, .vs-card');
        if (v2) {
          var ma = v2.querySelector('.m-marca, .v-marca');
          var mo = v2.querySelector('.m-modelo, .v-modelo');
          produto = ((ma ? ma.textContent : '') + ' ' + (mo ? mo.textContent : '')).trim();
        }
      }
      return produto;
    }
    document.addEventListener('click', function (e) {
      try {
        if (typeof gtag !== 'function' || !e.target || !e.target.closest) return;
        var a = null, source = '';
        for (var i = 0; i < SOURCES.length; i++) {
          a = e.target.closest(SOURCES[i][0]);
          if (a) { source = SOURCES[i][1]; break; }
        }
        if (a && a.href) {
          var h = a.href;
          var loja = /aliexpress|awin1\./i.test(h) ? 'aliexpress'
                   : /shopee/i.test(h)             ? 'shopee'
                   : /mercadoli[bv]re|meli\.la/i.test(h) ? 'mercadolivre'
                   : /amazon/i.test(h)             ? 'amazon' : 'outra';
          gtag('event', 'click_affiliate', {
            product_slug: resolveProduto(a) || location.pathname,
            loja: loja,
            source: source
          });
          return;
        }
        // Copiar cupom — o código copiado identifica o cupom (mede qual converte)
        var c = null, csrc = '';
        for (var j = 0; j < COPY_SOURCES.length; j++) {
          c = e.target.closest(COPY_SOURCES[j][0]);
          if (c) { csrc = COPY_SOURCES[j][1]; break; }
        }
        if (!c) return;
        // sem Clipboard API a cópia não acontece na maioria das fontes — não
        // contar cópia falsa (o comparador tem fallback execCommand e fica
        // subcontado nesse cenário raro; melhor que inflar o funil inteiro)
        if (!navigator.clipboard) return;
        var cod = c.getAttribute('data-cod') || c.getAttribute('data-code') || '';
        if (!cod) {
          // botão assado estático: código fica no <code> do mesmo .proj-coupon
          var wrap = c.closest('.proj-coupon');
          var codeEl = wrap && wrap.querySelector('code');
          if (codeEl) cod = codeEl.textContent.trim();
        }
        if (!cod) return;
        gtag('event', 'copy_coupon', {
          cupom: cod,
          product_slug: resolveProduto(c) || location.pathname,
          source: csrc
        });
      } catch (err) { /* tracking nunca pode quebrar a navegação */ }
    }, true);
  }
  initClickTracking();

  // Exporto basePath pra outros scripts (busca global usa pra montar URLs)
  window.SITE_BASE_PATH = basePath();
  window.PRICES_OVERLAY_READY = applyOverlay();
})();

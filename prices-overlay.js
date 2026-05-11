/* ============================================================
   prices-overlay.js — Fase 4b (10/05/2026)
   Aplica camada de preços/links/cupons do data/prices.json
   sobre window.PROJETORES_DATA carregado de projetores-data.js.

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
  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  function mergeOverlay(produtos, indisponiveis) {
    const data = window.PROJETORES_DATA;
    if (!Array.isArray(data)) return { merged: 0, zerados: 0 };

    const indexOverlay = new Map();
    for (const p of produtos) {
      indexOverlay.set(norm(p.marca) + '|' + norm(p.modelo), p);
    }
    const indexIndisp = new Set();
    for (const x of indisponiveis || []) {
      indexIndisp.add(norm(x.marca) + '|' + norm(x.modelo));
    }

    let merged = 0;
    let zerados = 0;
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
        if (mk.aliexpress && mk.aliexpress.link) proj.ali_url    = mk.aliexpress.link;
        if (mk.shopee     && mk.shopee.link)     proj.shopee_url = mk.shopee.link;
        if (mk.ml         && mk.ml.link)         proj.ml_url     = mk.ml.link;

        // Cupom de loja (já é o de maior desconto não-concorrente)
        if (mk.aliexpress && mk.aliexpress.cupom) {
          proj.ali_cupom_loja = mk.aliexpress.cupom;
        }

        merged++;
      } else if (indexIndisp.has(k)) {
        // Indisponível conhecido: zera preço para a regra existente filtrar
        proj.preco_min   = null;
        proj.preco_max   = null;
        proj.preco_atual = null;
        zerados++;
      }
    }

    return { merged, zerados };
  }

  function applyOverlay() {
    return fetch('data/prices.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        const meta = j.metadata || {};
        const result = mergeOverlay(j.produtos || [], meta.indisponiveis || []);
        window.PRICES_METADATA = meta;
        console.log('[prices-overlay] ok — merged=' + result.merged + ' zerados=' + result.zerados + ' de ' + (window.PROJETORES_DATA || []).length + ' (atualizado_em=' + meta.atualizado_em + ')');
        return result;
      })
      .catch(function (err) {
        console.warn('[prices-overlay] falhou, site usa dados estaticos:', err && err.message);
        return null;
      });
  }

  window.PRICES_OVERLAY_READY = applyOverlay();
})();

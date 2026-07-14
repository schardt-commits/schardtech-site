/* projetor-page.js — logica compartilhada das paginas /projetor/ (extraida 10/06/2026,
   auditoria T2). Substitui os blocos inline applyHeroOverlay + applyHistoryChart que
   estavam duplicados nas 69 paginas com drift entre 8 variantes.
   Canonico: hero = template do D10S (cupom escondido quando produto sem preco vivo);
   chart = algoritmo das 66 paginas (labels de todos os dias, spanGaps:false, media dos
   minimos diarios). Mudancas vs inline: fetch do historico com cache default (era
   no-store) + nota de dados-offline no banner quando o fetch falha.
   Carregado com <script src="../projetor-page.js" defer> — depois de projetores-data.js
   e prices-overlay.js. Fica inline por pagina: gtag, PRICE_HISTORY + initPriceChart
   (exposto como window.__initStaticChart — chamado aqui quando o grafico entra na
   viewport, junto da injecao lazy do ../chart.umd.min.js local).
   Redesign 10/06/2026: facade do YouTube (player so carrega no clique) +
   Chart.js/prices-history.json lazy via IntersectionObserver. */

(function ytFacade() {
      // Player do YouTube (~1MB+ de JS) so carrega quando o visitante clica na thumb.
      document.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('.yt-facade') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-ytid');
        if (!id) return;
        var iframe = document.createElement('iframe');
        var extra = btn.getAttribute('data-ytparams');  // ex: "start=49"
        iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1' + (extra ? '&' + extra : '');
        iframe.title = btn.getAttribute('data-yttitle') || 'Vídeo do canal SchardTech';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        // sem estilo inline: o iframe herda o CSS do contexto (.proj-video-wrap iframe / .video-card iframe)
        btn.parentNode.replaceChild(iframe, btn);
      }, false);

      // Aquece DNS+TLS do player no primeiro hover/toque na thumb
      var warmed = false;
      document.addEventListener('pointerover', function(e) {
        if (warmed || !e.target || !e.target.closest || !e.target.closest('.yt-facade')) return;
        warmed = true;
        ['https://www.youtube.com', 'https://www.google.com'].forEach(function(h) {
          var l = document.createElement('link');
          l.rel = 'preconnect';
          l.href = h;
          document.head.appendChild(l);
        });
      }, true);
    })();

(function applyHeroOverlay() {
      function fmtBRL(v) {
        if (v == null) return null;
        return Number(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
      function mkLabel(mk) {
        return ({aliexpress: 'AliExpress', shopee: 'Shopee', ml: 'Mercado Livre', amazon: 'Amazon'})[mk] || mk;
      }
      function fmtData(s) {
        if (!s) return null;
        var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
      }
      function norm(s) { return String(s||'').trim().toLowerCase(); }

      function run() {
        var card = document.querySelector('.proj-price-card');
        if (!card) return;
        // Cupom NUNCA vem do HTML estático: zera o slot SSR antes de qualquer
        // bail-out (produto sem dado vivo, M7, importado, sem estoque). Só o
        // bloco mais abaixo re-renderiza, e só com cupom vindo do prices.json.
        var cupomSlotSSR = document.getElementById('projCupomSlot');
        if (cupomSlotSSR) cupomSlotSSR.innerHTML = '';
        var marca = card.dataset.marca, modelo = card.dataset.modelo;
        if (!marca || !modelo) return;
        var data = window.PROJETORES_DATA;
        if (!Array.isArray(data)) return;
        var key = norm(marca) + '|' + norm(modelo);
        var p = data.find(function(x) { return norm(x.marca)+'|'+norm(x.modelo) === key; });
        if (!p || !p.preco_atual) return;

        // Atualiza preço principal
        var brl = fmtBRL(p.preco_atual);
        if (brl) {
          var parts = brl.split(',');
          var valEl = document.getElementById('projPriceValue');
          if (valEl) valEl.innerHTML = 'R$ ' + parts[0] + '<span class="proj-price-cents">,' + parts[1] + '</span>';
        }

        // Meta: data + marketplace vencedor
        var metaEl = document.getElementById('projPriceMeta');
        if (metaEl) {
          var partsMeta = [];
          var d = fmtData(p.data_verificacao);
          if (d) partsMeta.push('Verificado em ' + d);
          if (p.marketplace_vencedor) partsMeta.push(mkLabel(p.marketplace_vencedor));
          if (partsMeta.length) metaEl.textContent = partsMeta.join(' · ');
        }

        // Botões de loja: ordena por preço
        var mkts = p.marketplaces || {};
        var btns = [];
        function btn(href, klass, inner, preco) {
          var precoStr = preco ? 'R$ ' + Math.round(preco).toLocaleString('pt-BR') : 'Ver preço';
          return '<a href="' + href + '" target="_blank" rel="noopener nofollow sponsored" class="proj-store-btn ' + klass + '">' +
                 '<span class="store-name">' + inner + '</span>' +
                 '<span class="store-price">' + precoStr + '</span></a>';
        }
        if (p.ali_url)    btns.push({preco: (mkts.aliexpress && mkts.aliexpress.preco) || Infinity, html: btn(p.ali_url,    'store-ali',    '<img src="../logo ali.svg" alt="AliExpress" class="store-logo">', mkts.aliexpress && mkts.aliexpress.preco)});
        if (p.shopee_url) btns.push({preco: (mkts.shopee     && mkts.shopee.preco)     || Infinity, html: btn(p.shopee_url, 'store-shopee', '<img src="../logo shopee.png" alt="Shopee" class="store-logo">', mkts.shopee     && mkts.shopee.preco)});
        if (p.ml_url)     btns.push({preco: (mkts.ml         && mkts.ml.preco)         || Infinity, html: btn(p.ml_url,     'store-ml',     '<img src="../logo ml2.png" alt="" class="store-logo">Mercado Livre', mkts.ml         && mkts.ml.preco)});
        if (btns.length) {
          btns.sort(function(a,b) { return a.preco - b.preco; });
          if (btns.length > 1 && btns[0] && isFinite(btns[0].preco)) {
            btns[0].html = btns[0].html
              .replace('class="proj-store-btn ', 'class="proj-store-btn store-winner ')
              .replace('<span class="store-name">', '<span class="winner-badge">Melhor preço</span><span class="store-name">');
          }
          var slot = document.getElementById('projStoreBtns');
          if (slot) slot.innerHTML = btns.map(function(b){return b.html;}).join('');
        }

        // Validade/mínimo do cupom (campos novos do prices.json, etapa 2.1):
        // "expira hoje" / "válido até dd/mm" + pedido mínimo. Campo ausente = null = silêncio.
        function cupomMeta(validade, minimo) {
          var partes = [];
          var hoje = false;
          if (validade && /^\d{4}-\d{2}-\d{2}$/.test(String(validade))) {
            var d = new Date();
            var hojeIso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
            if (validade === hojeIso) { partes.push('expira hoje'); hoje = true; }
            else if (validade > hojeIso) partes.push('válido até ' + validade.slice(8, 10) + '/' + validade.slice(5, 7));
            // vencida: não mostra nada (a próxima rodada limpa o cupom)
          }
          if (minimo && Number(minimo) > 0) partes.push('pedido mín. R$ ' + Math.round(Number(minimo)).toLocaleString('pt-BR'));
          return partes.length ? {txt: partes.join(' · '), hoje: hoje} : null;
        }

        // Cupom com validade vencida não renderiza (antes só perdia o texto e
        // deixava o código morto no ar — aud. raio-X). Sem validade = fica.
        function cupomVencido(validade) {
          if (!(validade && /^\d{4}-\d{2}-\d{2}$/.test(String(validade)))) return false;
          var d = new Date();
          var hojeIso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
          return validade < hojeIso;
        }

        // Cupons: loja + plataforma (os dois que aparecem no anúncio)
        var venc = mkts[p.marketplace_vencedor] || {};
        var cupons = [];
        // Sem fallback estático (p.ali_cupom_loja): cupom exibido vem SÓ do dado
        // vivo do checker. Fallback antigo ressuscitava código morto (aud. 11/06).
        var cupomLoja = venc.cupom;
        if (cupomLoja && !cupomVencido(venc.cupom_validade)) cupons.push({rotulo: 'Cupom da loja', cod: cupomLoja,
          meta: cupomMeta(venc.cupom_validade, venc.cupom_minimo)});
        if (venc.cupom_plataforma && !cupomVencido(venc.cupom_plataforma_validade)) cupons.push({rotulo: 'Cupom ' + mkLabel(p.marketplace_vencedor), cod: venc.cupom_plataforma,
          meta: cupomMeta(venc.cupom_plataforma_validade, venc.cupom_plataforma_minimo)});
        if (cupons.length) {
          var slot = document.getElementById('projCupomSlot');
          if (slot) {
            slot.innerHTML = cupons.map(function(cp, i) {
              var metaHtml = cp.meta
                ? '<span class="proj-coupon-val' + (cp.meta.hoje ? ' hoje' : '') + '">' + cp.meta.txt + '</span>'
                : '';
              return '<div class="proj-coupon"' + (i ? ' style="margin-top:8px;"' : '') + '>' +
                '<span>' + cp.rotulo + ': <code>' + cp.cod + '</code>' + metaHtml + '</span>' +
                '<button class="copy-btn" type="button" data-cod="' + cp.cod + '">Copiar</button>' +
                '</div>';
            }).join('');
            slot.querySelectorAll('.copy-btn').forEach(function(b) {
              b.addEventListener('click', function() {
                if (!navigator.clipboard) return; // webview antigo: sem API, sem feedback falso
                navigator.clipboard.writeText(b.getAttribute('data-cod')).then(function() {
                  b.textContent = 'Copiado!';
                  setTimeout(function() { b.textContent = 'Copiar'; }, 1800);
                }).catch(function() {});
              });
            });
          }
        }
      }

      var _waitTries = 0;
      function waitAndRun() {
        if (window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function') {
          window.PRICES_OVERLAY_READY.then(run).catch(function(){ run(); });
        } else if (++_waitTries < 60) {
          setTimeout(waitAndRun, 50);
        } else {
          run();  // teto ~3s: se o overlay nunca ficou pronto, degrada pro SSR/estático
        }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitAndRun);
      else waitAndRun();
    })();

(function applyHistoryChart() {
      function norm(s) { return String(s || '').trim().toLowerCase(); }
      function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
      function fmtDataChart(s) {
        // "2026-05-14 09:00" → "14/05"
        var m = String(s||'').match(/^\d{4}-(\d{2})-(\d{2})/);
        return m ? (m[2] + '/' + m[1]) : s;
      }

      function run() {
        var card = document.querySelector('.proj-price-card');
        if (!card) return;
        var marca = card.dataset.marca, modelo = card.dataset.modelo;
        if (!marca || !modelo) return;

        var bp = (window.SITE_BASE_PATH || '../');
        fetch(bp + 'data/prices-history.json')  // cache default: max-age=600 do Pages cobre as 4 rodadas/dia
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(j) {
            if (!j || !j.modelos) return;
            // Match case-insensitive nas chaves Marca|Modelo
            var key = norm(marca) + '|' + norm(modelo);
            var found = null;
            for (var k in j.modelos) {
              if (norm(k) === key) { found = j.modelos[k]; break; }
            }
            if (!found || !found.pontos || !found.pontos.length) return;

            renderChart(found);
          })
          .catch(function() {
            // Fetch falhou: banner/grafico exibem o snapshot assado na geracao da pagina.
            var st = document.getElementById('priceStatus');
            if (st && !st.querySelector('.ps-stale')) {
              var sub = st.querySelector('.ps-sub');
              var sp = document.createElement('span');
              sp.className = 'ps-stale';
              sp.textContent = ' (sem conexao com os precos ao vivo — dados de quando a pagina foi gerada)';
              (sub || st).appendChild(sp);
            }
          });
      }

      function renderChart(historico) {
        if (typeof Chart === 'undefined') { setTimeout(function(){ renderChart(historico); }, 100); return; }

        // Agrupa pontos por loja, mantendo ordem temporal
        var pontos = historico.pontos.slice().sort(function(a, b) {
          return (a.data || '').localeCompare(b.data || '');
        });

        var lojasDisponiveis = {};
        pontos.forEach(function(p) { lojasDisponiveis[p.loja] = true; });

        // Labels cobrem TODOS os dias do primeiro ponto ate hoje (inclusive os sem
        // dado). Dias sem ponto viram null na serie -> spanGaps:false quebra a linha
        // visualmente, em vez de ligar dois dias separados por uma semana de OOS.
        var firstDate = new Date(pontos[0].data.substr(0,10) + 'T00:00:00');
        var today = new Date(); today.setHours(0,0,0,0);
        var labels = [];
        for (var d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
          labels.push(('0'+d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2));
        }

        // Pra cada label, pega o ÚLTIMO preço de cada loja naquele dia
        function serieDeLoja(loja) {
          var serie = [];
          labels.forEach(function(lbl) {
            var ponto = null;
            pontos.forEach(function(p) {
              if (p.loja === loja && fmtDataChart(p.data) === lbl) ponto = p;
            });
            serie.push(ponto ? ponto.preco : null);
          });
          return serie;
        }

        var lojasMeta = {
          aliexpress: { label: 'AliExpress', color: '#5BC8EE' },
          shopee:     { label: 'Shopee',     color: '#FF7A45' },
          ml:         { label: 'Mercado Livre', color: '#FFD93D' }
        };
        var lojasAtivas = Object.keys(lojasMeta).filter(function(l) { return lojasDisponiveis[l]; });
        var seriesCompletas = {};
        lojasAtivas.forEach(function(l) { seriesCompletas[l] = serieDeLoja(l); });

        // Janela de período (refino 14/07): série longa espremida inteira vira
        // eletrocardiograma. Com 35+ dias de histórico o default é 30 dias e o
        // usuário troca por chips (30/90/tudo). 0 = série inteira.
        var diasJanela = labels.length > 35 ? 30 : 0;
        function fatia(arr, dias) { return dias > 0 ? arr.slice(-dias) : arr; }

        // Sem bolinha na linha (lagarta) — o hover acha o ponto via hitRadius
        // e o crosshair. Buraco de coleta segue TRACEJADO (sem dado no dia).
        function montaDatasets() {
          var ds = lojasAtivas.map(function(loja) {
            var meta = lojasMeta[loja];
            return {
              label: meta.label,
              data: fatia(seriesCompletas[loja], diasJanela),
              borderColor: meta.color,
              pointBackgroundColor: meta.color,
              pointBorderColor: 'rgba(9,12,17,0.6)',
              pointBorderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 7,
              pointHitRadius: 16,
              borderWidth: 2.5,
              tension: 0.25,
              spanGaps: true,
              segment: {
                borderDash: function(s) { return (s.p0.skip || s.p1.skip) ? [5, 5] : undefined; }
              }
            };
          });
          // Degradê sob as linhas (estilo CoinGecko). Loja única = mais
          // presente; com 2+ lojas o topo cai pra sobreposição não virar lama.
          var alphaTopo = ds.length === 1 ? '30' : '12';
          ds.forEach(function(d0) {
            var corFill = d0.borderColor;
            d0.fill = 'origin';
            d0.backgroundColor = function(c) {
              var area = c.chart.chartArea;
              if (!area) return corFill + '14';
              var g = c.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
              g.addColorStop(0, corFill + alphaTopo);
              g.addColorStop(1, corFill + '00');
              return g;
            };
          });
          return ds;
        }
        var datasets = montaDatasets();

        // Eixo y acompanha a JANELA visível (a série inteira comprimia os
        // últimos 30 dias numa faixa de pixels)
        function limitesY() {
          var vals = [];
          lojasAtivas.forEach(function(l) {
            fatia(seriesCompletas[l], diasJanela).forEach(function(v) { if (v != null) vals.push(v); });
          });
          if (!vals.length) return {};
          return { min: Math.min.apply(null, vals) * 0.96, max: Math.max.apply(null, vals) * 1.04 };
        }

        var menor = historico.min;
        var maior = historico.max;
        // média dos mínimos diários — MESMA régua do banner (media-minimos-diarios-2026-05-31)
        var media = (function(){ var d={}; pontos.forEach(function(p){var k=p.data.slice(0,10); if(d[k]==null||p.preco<d[k])d[k]=p.preco;}); var a=Object.keys(d).map(function(k){return d[k];}); return a.reduce(function(x,y){return x+y;},0)/a.length; })();

        // Destrói chart antigo (Chart.js v4)
        var canvas = document.getElementById('priceChart');
        if (!canvas) return;
        var existing = Chart.getChart(canvas);
        if (existing) existing.destroy();

        var minLinePlugin = {
          id: 'minLine',
          afterDatasetsDraw: function(chart) {
            var ctx = chart.ctx, area = chart.chartArea, scales = chart.scales;
            var y = scales.y.getPixelForValue(menor);
            if (y < area.top || y > area.bottom) return;
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(91,217,160,0.55)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(area.left, y);
            ctx.lineTo(area.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(91,217,160,0.95)';
            ctx.font = '600 10px "IBM Plex Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText('▼ menor já visto', area.right - 6, y - 6);
            ctx.restore();
          }
        };

        // Linha da MÉDIA histórica — o banner fala "X% abaixo da média";
        // agora a referência aparece no gráfico em vez de só no texto.
        var mediaLinePlugin = {
          id: 'mediaLine',
          afterDatasetsDraw: function(chart) {
            var ctx = chart.ctx, area = chart.chartArea, scales = chart.scales;
            var y = scales.y.getPixelForValue(media);
            if (y < area.top || y > area.bottom) return;
            ctx.save();
            ctx.setLineDash([2, 5]);
            ctx.strokeStyle = 'rgba(234,234,234,0.30)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(area.left, y);
            ctx.lineTo(area.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(234,234,234,0.55)';
            ctx.font = '600 10px "IBM Plex Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('média', area.left + 6, y - 5);
            ctx.restore();
          }
        };

        // Linha vertical tracejada acompanhando o hover (leitura de bancada)
        var crosshairPlugin = {
          id: 'crosshair',
          afterDatasetsDraw: function(chart) {
            var atv = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
            if (!atv.length) return;
            var ctx = chart.ctx, area = chart.chartArea, x = atv[0].element.x;
            if (x < area.left || x > area.right) return;
            ctx.save();
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(238, 243, 250, 0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, area.top);
            ctx.lineTo(x, area.bottom);
            ctx.stroke();
            ctx.restore();
          }
        };

        // Ponto final com halo: marca o "agora" de cada série visível
        var ultimoPontoPlugin = {
          id: 'ultimoPonto',
          afterDatasetsDraw: function(chart) {
            chart.data.datasets.forEach(function(ds, i) {
              if (!chart.isDatasetVisible(i)) return;
              var idx = -1;
              for (var k = ds.data.length - 1; k >= 0; k--) {
                if (ds.data[k] != null) { idx = k; break; }
              }
              if (idx < 0) return;
              var el = chart.getDatasetMeta(i).data[idx];
              if (!el) return;
              var ctx = chart.ctx;
              ctx.save();
              ctx.fillStyle = ds.borderColor + '2E';
              ctx.beginPath(); ctx.arc(el.x, el.y, 9, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = ds.borderColor;
              ctx.strokeStyle = 'rgba(9,12,17,0.8)';
              ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(el.x, el.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              ctx.restore();
            });
          }
        };

        var chart = new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: { labels: fatia(labels, diasJanela), datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            // 'index': hover num dia mostra TODAS as lojas daquele dia juntas
            interaction: { mode: 'index', intersect: false },
            animation: { duration: 700, easing: 'easeOutCubic' },
            layout: { padding: { top: 20, right: 10, left: 0, bottom: 0 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15,21,32,0.97)',
                titleColor: '#EEF3FA',
                titleFont: { family: '"IBM Plex Mono", monospace', weight: '600', size: 11 },
                bodyColor: '#EEF3FA',
                bodyFont: { family: '"IBM Plex Mono", monospace', size: 11.5 },
                cornerRadius: 8,
                caretSize: 6,
                padding: 12,
                borderColor: 'rgba(91,200,238,0.30)',
                borderWidth: 1,
                displayColors: true,
                boxPadding: 4,
                callbacks: {
                  title: function(items) { return items.length ? 'Dia ' + items[0].label : ''; },
                  label: function(item) {
                    if (item.parsed.y == null) return null;
                    var loja = item.dataset.label;
                    var valor = fmtBRL(item.parsed.y);
                    var diff = item.parsed.y - menor;
                    if (diff <= 0.5) return loja + ': ' + valor + '  · menor preço';
                    return loja + ': ' + valor + '  · ' + fmtBRL(diff) + ' acima do menor';
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(234,234,234,0.04)' },
                ticks: { color: 'rgba(234,234,234,0.45)', maxTicksLimit: 8, maxRotation: 0, font: { family: '"IBM Plex Mono", monospace', size: 10 } }
              },
              y: {
                grid: { color: 'rgba(234,234,234,0.05)' },
                ticks: { color: 'rgba(234,234,234,0.45)', maxTicksLimit: 6, font: { family: '"IBM Plex Mono", monospace', size: 10 }, callback: function(v) { return 'R$ ' + v.toLocaleString('pt-BR'); } },
                suggestedMin: limitesY().min,
                suggestedMax: limitesY().max
              }
            }
          },
          plugins: [minLinePlugin, mediaLinePlugin, crosshairPlugin, ultimoPontoPlugin]
        });

        // Atualiza chips de filtro: cria um chip por loja disponível
        var filtersWrap = document.querySelector('.price-filters');
        if (filtersWrap) {
          // Limpa todos exceto o "Todos"
          var todos = filtersWrap.querySelector('[data-filter="todos"]');
          filtersWrap.innerHTML = '';
          if (todos) filtersWrap.appendChild(todos);
          else {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-chip active';
            btn.dataset.filter = 'todos';
            btn.setAttribute('aria-pressed', 'true');
            btn.textContent = 'Todos';
            filtersWrap.appendChild(btn);
          }
          datasets.forEach(function(ds, idx) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'filter-chip active';
            chip.dataset.filter = ds.label.toLowerCase().replace(/\s+/g, '-');
            chip.setAttribute('aria-pressed', 'true');
            chip.textContent = ds.label;
            chip.style.color = ds.borderColor;
            chip.addEventListener('click', function() {
              chip.classList.toggle('active');
              chart.setDatasetVisibility(idx, chip.classList.contains('active'));
              chart.update();
            });
            filtersWrap.appendChild(chip);
          });
          var todosChip = filtersWrap.querySelector('[data-filter="todos"]');
          if (todosChip) {
            todosChip.onclick = function() {
              var allActive = todosChip.classList.toggle('active');
              filtersWrap.querySelectorAll('.filter-chip:not([data-periodo])').forEach(function(c) {
                c.classList.toggle('active', allActive);
              });
              datasets.forEach(function(_, i) { chart.setDatasetVisibility(i, allActive); });
              chart.update();
            };
          }

          // Chips de período (30/90/tudo) na mesma linha, encostados à direita.
          // Só aparecem quando o histórico passa de 35 dias.
          if (labels.length > 35) {
            var periodos = [[30, '30 dias'], [90, '90 dias'], [0, 'tudo']].filter(function(par) {
              return par[0] === 0 || labels.length > par[0];
            });
            periodos.forEach(function(par, i) {
              var chip = document.createElement('button');
              chip.type = 'button';
              chip.className = 'filter-chip' + (par[0] === diasJanela ? ' active' : '');
              chip.dataset.periodo = String(par[0]);
              chip.setAttribute('aria-pressed', String(par[0] === diasJanela));
              chip.textContent = par[1];
              if (i === 0) chip.style.marginLeft = 'auto';
              chip.addEventListener('click', function() {
                if (par[0] === diasJanela) return;
                diasJanela = par[0];
                filtersWrap.querySelectorAll('[data-periodo]').forEach(function(c) {
                  var ativa = c === chip;
                  c.classList.toggle('active', ativa);
                  c.setAttribute('aria-pressed', String(ativa));
                });
                chart.data.labels = fatia(labels, diasJanela);
                chart.data.datasets.forEach(function(d0, di) {
                  d0.data = fatia(seriesCompletas[lojasAtivas[di]], diasJanela);
                });
                var lim = limitesY();
                chart.options.scales.y.suggestedMin = lim.min;
                chart.options.scales.y.suggestedMax = lim.max;
                chart.update();
              });
              filtersWrap.appendChild(chip);
            });
          }
        }

        // Atualiza stats grid (media já calculada antes do chart — mesma régua)
        var statsWrap = document.querySelector('.price-stats-grid');
        if (statsWrap) {
          statsWrap.innerHTML =
            '<div class="price-stat min"><div class="label">Mínimo histórico</div><div class="val">' + fmtBRL(menor) + '</div></div>' +
            '<div class="price-stat"><div class="label">Preço médio</div><div class="val">' + fmtBRL(media) + '</div></div>' +
            '<div class="price-stat max"><div class="label">Máximo histórico</div><div class="val">' + fmtBRL(maior) + '</div></div>';
        }

        // Atualiza banner status — compara com PREÇO MÉDIO (estatisticamente neutro)
        var statusEl = document.getElementById('priceStatus');
        if (statusEl) {
          var dataMaisRecente = '';
          pontos.forEach(function(p) { if (p.data > dataMaisRecente) dataMaisRecente = p.data.slice(0, 10); });
          var precosHoje = pontos.filter(function(p) { return p.data.slice(0, 10) === dataMaisRecente; }).map(function(p) { return p.preco; });
          var atual = precosHoje.length ? Math.min.apply(null, precosHoje) : pontos[pontos.length - 1].preco;
          var distMedia = ((atual - media) / media) * 100;
          var icon, classe, titulo, sub;
          if (distMedia <= -3) {
            icon = ''; classe = 'good';
            titulo = Math.abs(Math.round(distMedia)) + '% abaixo da média histórica';
            sub = 'Atualmente em ' + fmtBRL(atual) + '. Média histórica: ' + fmtBRL(media) + '.';
          } else if (distMedia < 3) {
            icon = ''; classe = 'neutral';
            titulo = 'Preço no patamar médio';
            sub = 'Atualmente em ' + fmtBRL(atual) + '. Média histórica: ' + fmtBRL(media) + '.';
          } else {
            icon = ''; classe = 'bad';
            titulo = '+' + Math.round(distMedia) + '% acima da média histórica';
            sub = 'Atualmente em ' + fmtBRL(atual) + '. Média histórica: ' + fmtBRL(media) + '.';
          }
          statusEl.className = 'price-status ' + classe;
          statusEl.innerHTML = '<span class="ps-icon">' + icon + '</span><div><strong>' + titulo + '</strong><span class="ps-sub">' + sub + '</span></div>';
        }
        // <!-- banner-vs-media-fix-2026-05-14 -->
      }

      // Espera o overlay de prices.json terminar (carrega na mesma rodada) ou roda direto
      function start() {
        if (window.PRICES_OVERLAY_READY && typeof window.PRICES_OVERLAY_READY.then === 'function') {
          window.PRICES_OVERLAY_READY.then(run).catch(function() { run(); });
        } else {
          run();
        }
      }

      // Lazy (10/06/2026): Chart.js (~70KB) + prices-history.json (~45KB) so
      // baixam quando a secao do grafico se aproxima da viewport (600px antes).
      // O snapshot estatico da pagina (window.__initStaticChart) renderiza
      // primeiro; o run() substitui com o historico vivo.
      function fire() {
        if (fire.done) return;
        fire.done = true;
        if (typeof Chart === 'undefined' && !document.querySelector('script[src*="chart.umd.min.js"]')) {
          var s = document.createElement('script');
          s.src = (window.SITE_BASE_PATH || '../') + 'chart.umd.min.js';
          document.head.appendChild(s);
        }
        if (typeof window.__initStaticChart === 'function') {
          try { window.__initStaticChart(); } catch (e) {}
        }
        start();
      }
      function boot() {
        var wrap = document.querySelector('.price-chart-wrap');
        if (!wrap) return;
        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
              if (entries[i].isIntersecting) { io.disconnect(); fire(); break; }
            }
          }, { rootMargin: '600px 0px' });
          io.observe(wrap);
        } else {
          fire();
        }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
      else boot();
    })();

"""Atualiza o array featuredVideos do script.js com os últimos vídeos do canal.

Fonte: o FEED RSS público do canal, não a YouTube Data API.

Por que RSS e não a API (trocado em 04/09/2026):
  A versão anterior usava search.list com order=date. Esse endpoint consulta o
  índice de BUSCA do YouTube, que é eventualmente consistente e não reflete a
  ordem real de upload. Resultado medido em 04/09/2026: nenhum dos 6 vídeos
  publicados no site estava entre os 12 uploads mais recentes do canal, e a
  execução daquele dia chegou a REMOVER o vídeo mais novo (5GGUt_qzUes, de
  31/08) pra pôr um antigo no lugar.

  O feed RSS devolve os 15 uploads mais recentes na ordem certa, sem chave de
  API, sem cota e sem depender do yt_token.json (que sumiu em 23/08/2026).
  Some junto o secret YOUTUBE_API_KEY de uma Action que tem contents:write.

Sobre o escape (o outro bug consertado aqui):
  A YouTube Data API devolve o título já escapado em HTML ('Tela 100&quot;').
  O render em index.html:298 chama U.esc(v.title), escapando de novo, e o
  visitante via o '&quot;' cru na tela. O ElementTree decodifica as entidades
  ao parsear, então o título entra aqui já limpo (com aspa de verdade) e o
  U.esc() do render escapa uma vez só, que é o certo.
"""
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET

CHANNEL_ID = "UCLoBp-Uprd2OaIcBjafI7Xg"
MAX_RESULTS = 6
FEED = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"

NS = {
    "a": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}


def fetch_latest_videos():
    req = urllib.request.Request(FEED, headers={"User-Agent": "schardtech-site/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raiz = ET.fromstring(resp.read())

    videos = []
    for entry in raiz.findall("a:entry", NS):
        vid = entry.find("yt:videoId", NS)
        titulo = entry.find("a:title", NS)
        publicado = entry.find("a:published", NS)
        if vid is None or titulo is None or not (vid.text or "").strip():
            continue
        # O ElementTree já decodifica as entidades do XML. O html.unescape aqui é
        # rede de segurança: se o feed algum dia vier duplo-escapado (&amp;quot;),
        # ele desfaz a segunda camada. Em título normal é no-op, inclusive num
        # título com "&" solto, que não é entidade.
        texto = html.unescape((titulo.text or "").strip())
        videos.append({
            "id": vid.text.strip(),
            "title": texto,
            "published": (publicado.text or "")[:10] if publicado is not None else "",
        })
        if len(videos) == MAX_RESULTS:
            break

    # Fail loud: escrever uma lista curta apagaria vídeo bom do site em silêncio.
    if len(videos) < MAX_RESULTS:
        raise RuntimeError(
            f"feed devolveu só {len(videos)} vídeo(s), esperava {MAX_RESULTS}. "
            "Nada foi escrito."
        )
    return videos


def update_script_js(videos):
    with open("script.js", "r", encoding="utf-8") as f:
        content = f.read()

    # json.dumps escapa backslash/aspas/controles (JSON é JS válido).
    # ensure_ascii=False: títulos PT-BR com acento ficam legíveis no script.js.
    lines = ["const featuredVideos = ["]
    for v in videos:
        lines.append(
            f"  {{ id: {json.dumps(v['id'])}, title: {json.dumps(v['title'], ensure_ascii=False)} }},"
        )
    lines.append("];")
    new_array = "\n".join(lines)

    # Replacement como FUNÇÃO: re.sub não processa escapes do replacement
    # (string literal com \ no título viraria "bad escape" ou colapsaria \\).
    updated, n = re.subn(
        r"const featuredVideos = \[[\s\S]*?\];",
        lambda m: new_array,
        content,
    )
    if n != 1:
        raise RuntimeError(f"esperava 1 array featuredVideos no script.js, achei {n}")

    with open("script.js", "w", encoding="utf-8") as f:
        f.write(updated)

    return updated != content


if __name__ == "__main__":
    videos = fetch_latest_videos()
    changed = update_script_js(videos)
    for v in videos:
        print(f"  {v['published']}  {v['id']}  {v['title']}")
    print("script.js atualizado." if changed else "Nenhuma mudanca.")

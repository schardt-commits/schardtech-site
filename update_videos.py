import json
import os
import re
import urllib.request

CHANNEL_ID = "UCLoBp-Uprd2OaIcBjafI7Xg"
MAX_RESULTS = 6


def fetch_latest_videos():
    api_key = os.environ["YOUTUBE_API_KEY"]
    url = (
        "https://www.googleapis.com/youtube/v3/search"
        f"?part=snippet&channelId={CHANNEL_ID}"
        f"&maxResults={MAX_RESULTS}&order=date&type=video&key={api_key}"
    )
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    return [
        {"id": item["id"]["videoId"], "title": item["snippet"]["title"]}
        for item in data["items"]
    ]


def update_script_js(videos):
    with open("script.js", "r", encoding="utf-8") as f:
        content = f.read()

    lines = ["const featuredVideos = ["]
    for v in videos:
        title = v["title"].replace("'", "\\'")
        lines.append(f"  {{ id: '{v['id']}', title: '{title}' }},")
    lines.append("];")
    new_array = "\n".join(lines)

    updated = re.sub(
        r"const featuredVideos = \[[\s\S]*?\];",
        new_array,
        content,
    )

    with open("script.js", "w", encoding="utf-8") as f:
        f.write(updated)

    return updated != content


if __name__ == "__main__":
    videos = fetch_latest_videos()
    changed = update_script_js(videos)
    for v in videos:
        print(f"  {v['id']} — {v['title']}")
    print("script.js atualizado." if changed else "Nenhuma mudanca.")

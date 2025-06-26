# server.py (Versi Helper Lokal untuk Arsitektur P2P dengan Fitur Moderasi)
import os
import time
import requests
import yt_dlp
from flask import Flask, jsonify, request
from flask_cors import CORS

# --- KONFIGURASI ---
# GANTI DENGAN API KEY ANDA
YOUTUBE_API_KEY = "MASUKKAN_APIKEY_YOUTUBE_ANDA_DI_SINI"
GEMINI_API_KEY = "MASUKKAN_APIKEY_GEMINI_ANDA_DI_SINI"
PORT = 3000
COOKIE_FILE = "cookies.txt"

app = Flask(__name__)
CORS(app)  # Izinkan request dari mana saja (penting untuk frontend di GitHub)

# State disimpan di memori
state = {"nowPlaying": None, "queue": []}

# --- FUNGSI BANTUAN (TIDAK BERUBAH) ---
def get_ai_intro(song_title, artist):
    try:
        prompt = f"Berikan satu kalimat perkenalan yang menarik atau fakta unik untuk lagu \"{song_title}\" dari artis {artist}. Buat seolah-olah kamu adalah seorang DJ radio. Jaga agar tetap singkat, maksimal 25 kata."
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {'Content-Type': 'application/json'}
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        response = requests.post(gemini_url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text'].strip().replace('"', '')
    except Exception as e:
        print(f"Gagal mendapatkan intro dari AI: {e}")
        return f"Selanjutnya, kita dengarkan {song_title}!"

def search_youtube_and_get_stream(query):
    try:
        from googleapiclient.discovery import build
        youtube_service = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
        search_response = youtube_service.search().list(q=query, part='id,snippet', maxResults=5, type='video', relevanceLanguage='id', videoCategoryId='10').execute()
        if not search_response.get('items'): return None, "Lagu tidak ditemukan via API."
        
        ydl_opts = {'format': 'bestaudio/best', 'noplaylist': True, 'quiet': True}
        if os.path.exists(COOKIE_FILE): ydl_opts['cookiefile'] = COOKIE_FILE
        
        for item in search_response['items']:
            video_id, video_title = item['id']['videoId'], item['snippet']['title']
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl: info = ydl.extract_info(video_url, download=False)
                song_object = {'id': video_id, 'title': info.get('title', video_title), 'artist': info.get('uploader') or info.get('channel'), 'stream_url': info.get('url'), 'duration': info.get('duration')}
                return song_object, None
            except Exception as e:
                print(f"Gagal stream untuk ID {video_id}: {e}")
                continue
        return None, "Semua hasil pencarian tidak bisa di-stream."
    except Exception as e:
        print(f"Error besar saat mencari: {e}")
        return None, "Terjadi kesalahan pada server saat mencari lagu."


# --- API ENDPOINTS (HANYA UNTUK ADMIN DI LOCALHOST) ---
@app.route('/api/status')
def get_status():
    return jsonify(state)

@app.route('/api/request', methods=['POST'])
def request_song():
    data = request.get_json()
    query, requester_name = data.get('query'), data.get('name', 'Anonymous')
    if not query: return jsonify({'error': 'Query tidak boleh kosong'}), 400

    song_object, error_message = search_youtube_and_get_stream(query)
    if error_message: return jsonify({'error': error_message}), 500
    
    song_object['requester'] = requester_name
    if not state["nowPlaying"]:
        song_object['intro'] = get_ai_intro(song_object['title'], song_object['artist'])
        song_object['start_time_utc'] = time.time()
        state["nowPlaying"] = song_object
        message = f"Langsung memutar: '{song_object['title']}'"
    else:
        state["queue"].append(song_object)
        message = f"'{song_object['title']}' telah ditambahkan!"
    return jsonify({'message': message})

@app.route('/api/skip', methods=['POST'])
def skip_song():
    if state["queue"]:
        next_song = state["queue"].pop(0)
        next_song['intro'] = get_ai_intro(next_song['title'], next_song['artist'])
        next_song['start_time_utc'] = time.time()
        state["nowPlaying"] = next_song
    else:
        state["nowPlaying"] = None
    return jsonify(state)

# =======================================================
# == ENDPOINT BARU UNTUK MODERASI (HAPUS LAGU) ==
# =======================================================
@app.route('/api/remove', methods=['POST'])
def remove_song():
    global state
    data = request.get_json()
    index_to_remove = data.get('index')

    # Validasi input dari request
    if index_to_remove is None or not isinstance(index_to_remove, int):
        return jsonify({"error": "Indeks tidak valid atau tidak disediakan"}), 400

    try:
        # Cek apakah indeks valid dalam rentang antrian
        if 0 <= index_to_remove < len(state['queue']):
            removed_song = state['queue'].pop(index_to_remove)
            print(f"Lagu '{removed_song['title']}' di indeks {index_to_remove} telah dihapus oleh moderator.")
            return jsonify({"success": True, "message": f"Lagu '{removed_song['title']}' dihapus."})
        else:
            # Jika indeks di luar jangkauan (misal, lagu sudah diputar atau dihapus orang lain)
            print(f"Gagal menghapus: Indeks {index_to_remove} di luar jangkauan antrian.")
            return jsonify({"error": "Indeks di luar jangkauan antrian"}), 404
    except Exception as e:
        print(f"Error saat menghapus lagu: {e}")
        return jsonify({"error": "Kesalahan server saat menghapus lagu"}), 500


if __name__ == '__main__':
    print(f"Server Helper Lokal berjalan di http://localhost:{PORT}")
    print("Buka halaman admin dari GitHub Pages untuk memulai.")
    app.run(host='127.0.0.1', port=PORT, debug=False)

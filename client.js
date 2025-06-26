// public/client.js (Versi dengan Nama Perangkat Otomatis)
document.addEventListener('DOMContentLoaded', () => {
    // Elemen Koneksi
    const connectionBox = document.getElementById('connection-box');
    const mainApp = document.getElementById('main-app');
    const roomIdInput = document.getElementById('room-id-input');
    const connectBtn = document.getElementById('connect-btn');
    const connectionStatusElem = document.getElementById('connection-status');

    // Elemen Aplikasi
    const nowPlayingElem = document.getElementById('now-playing');
    const aiIntroElem = document.getElementById('ai-intro');
    const queueListElem = document.getElementById('queue-list');
    const queryInput = document.getElementById('song-query-input');
    const requestBtn = document.getElementById('request-btn');
    const requestStatusElem = document.getElementById('request-status');
    const waitTimeElem = document.getElementById('wait-time');

    let peer = null;
    let conn = null;
    let progressTimer = null;

    // =========================================================
    // == FUNGSI BARU UNTUK MENDETEKSI NAMA PERANGKAT ==
    // =========================================================
    function getDeviceName() {
        const ua = navigator.userAgent;
        
        // Coba deteksi model ponsel yang umum
        let match = ua.match(/\(([^;]+); L/); // Pola umum untuk Android (e.g., "(SM-A528B; L...")
        if (match && match[1]) {
             // Membersihkan nama, misal "SM-A528B" menjadi "Galaxy A52s" (jika memungkinkan)
             // Ini adalah contoh sederhana, deteksi akurat bisa sangat kompleks
             const model = match[1].trim();
             if (model.includes('SM-')) return `Galaxy ${model.substring(3)}`;
             return model; // Kembalikan model apa adanya
        }

        if (/iPhone/.test(ua)) return "iPhone";
        if (/iPad/.test(ua)) return "iPad";

        // Deteksi sistem operasi
        if (/Android/.test(ua)) return "Android Device";
        if (/Windows/.test(ua)) return "Windows PC";
        if (/Macintosh/.test(ua)) return "Mac";
        if (/Linux/.test(ua)) return "Linux PC";
        
        return "Unknown Device"; // Default jika tidak ada yang cocok
    }
    
    // Simpan nama perangkat saat halaman dimuat
    const deviceName = getDeviceName();


    function initializePeer() {
        peer = new Peer();
        peer.on('error', err => console.error('PeerJS error:', err));
    }

    connectBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.trim();
        if (!roomId) { alert("Masukkan Room ID."); return; }
        
        connectionStatusElem.textContent = "Connecting...";
        conn = peer.connect(roomId);

        conn.on('open', () => {
            console.log("Terhubung ke Host!");
            connectionBox.style.display = 'none';
            mainApp.style.display = 'block';
        });
        conn.on('data', handleStatusUpdate);
        conn.on('close', () => {
            alert("Koneksi ke Host terputus.");
            connectionBox.style.display = 'block';
            mainApp.style.display = 'none';
            connectionStatusElem.textContent = "Disconnected.";
        });
    });

    // ========================================================
    // == FUNGSI REQUEST SONG DIMODIFIKASI ==
    // ========================================================
    function requestSong() {
        const query = queryInput.value.trim();
        // Tidak perlu lagi mengambil input nama
        if (!query) {
            alert("Please enter a song title or artist.");
            return;
        }

        if (conn && conn.open) {
            requestStatusElem.textContent = "Mengirim request...";
            // Kirim request dengan nama perangkat yang sudah dideteksi
            conn.send({ type: 'request', name: deviceName, query: query });
            queryInput.value = '';
            setTimeout(() => { requestStatusElem.textContent = ''; }, 3000);
        } else {
            alert("Tidak terhubung ke Host.");
        }
    }

    // Fungsi handleStatusUpdate, startProgressTimer, dan formatTime tetap sama persis
    function handleStatusUpdate(data) { if (data.nowPlaying) { const nowPlayingData = data.nowPlaying; nowPlayingElem.innerHTML = `${nowPlayingData.title}<br><span class="requester-info">Req: ${nowPlayingData.requester}</span>`; aiIntroElem.textContent = `“${nowPlayingData.intro}”`; aiIntroElem.style.display = 'block'; startProgressTimer(nowPlayingData.start_time_utc, nowPlayingData.duration); } else { nowPlayingElem.innerHTML = "Jukebox is idle."; aiIntroElem.style.display = 'none'; waitTimeElem.textContent = ''; if (progressTimer) clearInterval(progressTimer); } queueListElem.innerHTML = ''; if (data.queue && data.queue.length > 0) { data.queue.forEach(song => { const li = document.createElement('li'); li.innerHTML = `${song.title} <span class="requester-info">Req: ${song.requester}</span>`; queueListElem.appendChild(li); }); } else { queueListElem.innerHTML = '<li>Queue is empty</li>'; } }
    function startProgressTimer(startTimeUTC, duration) { if (progressTimer) clearInterval(progressTimer); const totalDurationFormatted = formatTime(duration); progressTimer = setInterval(() => { const elapsedTime = (Date.now() / 1000) - startTimeUTC; if (elapsedTime > duration || elapsedTime < 0) { clearInterval(progressTimer); waitTimeElem.textContent = `[${totalDurationFormatted} / ${totalDurationFormatted}]`; return; } const elapsedTimeFormatted = formatTime(elapsedTime); waitTimeElem.textContent = `[${elapsedTimeFormatted} / ${totalDurationFormatted}]`; }, 1000); }
    function formatTime(totalSeconds) { if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00'; const minutes = Math.floor(totalSeconds / 60); const seconds = Math.floor(totalSeconds % 60); return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }

    // Event Listeners
    requestBtn.addEventListener('click', requestSong);
    queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestSong(); });

    initializePeer();
});

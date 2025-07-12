// public/moderator.js (Versi dengan Fitur Request dan Skip)
document.addEventListener('DOMContentLoaded', () => {
    // Elemen Koneksi
    const connectionBox = document.getElementById('connection-box');
    const mainApp = document.getElementById('main-app');
    const roomIdInput = document.getElementById('room-id-input');
    const connectBtn = document.getElementById('connect-btn');
    const connectionStatusElem = document.getElementById('connection-status');

    // Elemen Aplikasi
    const nowPlayingElem = document.getElementById('now-playing');
    const queueListElem = document.getElementById('queue-list');
    const waitTimeElem = document.getElementById('wait-time');
    
    // Elemen Baru
    const skipBtn = document.getElementById('skip-btn');
    const queryInput = document.getElementById('song-query-input');
    const requestBtn = document.getElementById('request-btn');
    const requestStatusElem = document.getElementById('request-status');

    let peer = null;
    let conn = null;
    let progressTimer = null;

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
    
    // --- FUNGSI BARU UNTUK MENGIRIM PERINTAH ---

    function sendCommandToHost(command) {
        if (!conn || !conn.open) {
            alert("Tidak terhubung ke Host.");
            return;
        }
        console.log("Mengirim perintah ke Host:", command);
        conn.send(command);
    }

    function handleRemoveSong(index) {
        if (confirm("Anda yakin ingin menghapus lagu ini dari antrian?")) {
            sendCommandToHost({ type: 'remove_song', index: index });
        }
    }

    function handleRequestSong() {
        const query = queryInput.value.trim();
        if (!query) { alert("Masukkan judul lagu."); return; }
        requestStatusElem.textContent = "Mengirim request...";
        // Kita gunakan "Moderator" sebagai nama requester
        sendCommandToHost({ type: 'request', name: 'Moderator', query: query });
        queryInput.value = '';
        setTimeout(() => { requestStatusElem.textContent = ''; }, 3001);
    }
    
    function handleSkipSong() {
        if (confirm("Anda yakin ingin skip lagu yang sedang diputar?")) {
            sendCommandToHost({ type: 'skip_song' });
        }
    }


    function handleStatusUpdate(data) {
        // Update Now Playing
        if (data.nowPlaying) {
            nowPlayingElem.innerHTML = `${data.nowPlaying.title}<br><span class="requester-info">Req: ${data.nowPlaying.requester}</span>`;
            startProgressTimer(data.nowPlaying.start_time_utc, data.nowPlaying.duration);
            skipBtn.disabled = false; // Aktifkan tombol skip jika ada lagu
        } else {
            nowPlayingElem.innerHTML = "Jukebox is idle.";
            waitTimeElem.textContent = '';
            if (progressTimer) clearInterval(progressTimer);
            skipBtn.disabled = true; // Nonaktifkan tombol skip jika tidak ada lagu
        }

        // Update Antrian dengan tombol hapus
        queueListElem.innerHTML = '';
        if (data.queue && data.queue.length > 0) {
            data.queue.forEach((song, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<div class="song-info">${song.title}<span class="requester-info">Req: ${song.requester}</span></div><button class="remove-btn">✖</button>`;
                li.querySelector('.remove-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleRemoveSong(index);
                });
                queueListElem.appendChild(li);
            });
        } else {
            queueListElem.innerHTML = '<li>Queue is empty</li>';
        }
    }

    // Fungsi timer dan format waktu (tidak berubah)
    function startProgressTimer(startTimeUTC, duration) { if (progressTimer) clearInterval(progressTimer); const totalDurationFormatted = formatTime(duration); progressTimer = setInterval(() => { const elapsedTime = (Date.now() / 1000) - startTimeUTC; if (elapsedTime > duration || elapsedTime < 0) { clearInterval(progressTimer); waitTimeElem.textContent = `[${totalDurationFormatted} / ${totalDurationFormatted}]`; return; } const elapsedTimeFormatted = formatTime(elapsedTime); waitTimeElem.textContent = `[${elapsedTimeFormatted} / ${totalDurationFormatted}]`; }, 1000); }
    function formatTime(totalSeconds) { if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00'; const minutes = Math.floor(totalSeconds / 60); const seconds = Math.floor(totalSeconds % 60); return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }

    // --- EVENT LISTENERS BARU ---
    requestBtn.addEventListener('click', handleRequestSong);
    queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleRequestSong(); });
    skipBtn.addEventListener('click', handleSkipSong);

    initializePeer();
});

// public/client.js (Versi Hybrid: Deteksi Otomatis + Nama Panggilan)
document.addEventListener('DOMContentLoaded', () => {
    // Elemen UI (tidak ada perubahan di sini)
    const connectionBox = document.getElementById('connection-box');
    const mainApp = document.getElementById('main-app');
    const roomIdInput = document.getElementById('room-id-input');
    const connectBtn = document.getElementById('connect-btn');
    const connectionStatusElem = document.getElementById('connection-status');
    const nowPlayingElem = document.getElementById('now-playing');
    const aiIntroElem = document.getElementById('ai-intro');
    const queueListElem = document.getElementById('queue-list');
    const nameInput = document.getElementById('name-input');
    const queryInput = document.getElementById('song-query-input');
    const requestBtn = document.getElementById('request-btn');
    const requestStatusElem = document.getElementById('request-status');
    const waitTimeElem = document.getElementById('wait-time');

    let peer = null;
    let conn = null;
    let progressTimer = null;

    // =========================================================
    // == LOGIKA BARU UNTUK NAMA PERANGKAT OTOMATIS + PANGGILAN ==
    // =========================================================
    
    function getGenericDeviceName() {
        const ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/.test(ua)) return "iPhone/iPad";
        if (/Android/.test(ua)) return "Android Device";
        if (/Windows/.test(ua)) return "Windows PC";
        if (/Macintosh/.test(ua)) return "Mac";
        if (/Linux/.test(ua)) return "Linux PC";
        return "Device";
    }

    function initializeRequesterName() {
        // Prioritas 1: Cek apakah ada nama panggilan yang disimpan
        const savedName = localStorage.getItem('sukeplay_nickname');
        if (savedName) {
            nameInput.value = savedName;
            console.log(`Nama panggilan '${savedName}' dimuat dari penyimpanan.`);
            return;
        }

        // Prioritas 2: Jika tidak ada, gunakan nama perangkat generik
        const genericName = getGenericDeviceName();
        nameInput.value = genericName;
        console.log(`Nama perangkat generik terdeteksi: '${genericName}'.`);
    }

    function saveNameToStorage(name) {
        localStorage.setItem('sukeplay_nickname', name);
        console.log(`Nama panggilan '${name}' disimpan.`);
    }

    // --- Sisa kode (tidak banyak berubah) ---

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

    function requestSong() {
        const name = nameInput.value.trim();
        const query = queryInput.value.trim();

        if (!name) {
            alert("Nama Anda tidak boleh kosong.");
            nameInput.focus();
            return;
        }
        if (!query) {
            alert("Judul lagu tidak boleh kosong.");
            queryInput.focus();
            return;
        }

        // Simpan nama yang digunakan ke localStorage untuk sesi berikutnya
        saveNameToStorage(name);

        if (conn && conn.open) {
            requestStatusElem.textContent = "Mengirim request...";
            conn.send({ type: 'request', name: name, query: query });
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
    nameInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestSong(); });

    // Inisialisasi
    initializePeer();
    initializeRequesterName(); // Ganti pemanggilan fungsi di sini
});

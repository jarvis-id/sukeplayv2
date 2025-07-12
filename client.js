
// public/client.js (Versi Perbaikan untuk Koneksi dan Deteksi Nama Otomatis)

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Client script is now running.");

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

    // Fungsi untuk mendeteksi nama perangkat secara otomatis
    function getDeviceName() {
        const ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/.test(ua)) return "iPhone/iPad";
        if (/Android/.test(ua)) return "Android Device";
        if (/Windows/.test(ua)) return "Windows PC";
        if (/Macintosh/.test(ua)) return "Mac";
        if (/Linux/.test(ua)) return "Linux PC";
        return "Device";
    }
    
    // Simpan nama perangkat saat halaman dimuat
    const deviceName = getDeviceName();

    function initializePeer() {
        // Inisialisasi PeerJS tanpa ID untuk menjadi client
        peer = new Peer();

        peer.on('open', id => {
            console.log('Client PeerJS siap dengan ID:', id);
            // Aktifkan tombol connect setelah PeerJS siap
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect';
        });
        
        peer.on('error', err => {
            console.error('PeerJS Error:', err);
            connectionStatusElem.textContent = `Error: ${err.type}. Coba refresh.`;
            connectionStatusElem.style.color = 'red';
        });
    }

    function connectToHost() {
        const roomId = roomIdInput.value.trim();
        if (!roomId) {
            alert("Masukkan Host Room ID.");
            return;
        }
        
        console.log(`Mencoba terhubung ke Room ID: ${roomId}`);
        connectionStatusElem.textContent = "Connecting...";
        connectionStatusElem.style.color = '#b3b3b3';

        // Hancurkan koneksi lama jika ada
        if (conn) {
            conn.close();
        }
        
        conn = peer.connect(roomId);

        conn.on('open', () => {
            console.log("Koneksi ke Host berhasil dibuat!");
            connectionStatusElem.textContent = "Connected!";
            connectionStatusElem.style.color = 'lightgreen';
            connectionBox.style.display = 'none';
            mainApp.style.display = 'block';
        });

        conn.on('data', handleStatusUpdate);

        conn.on('close', () => {
            alert("Koneksi ke Host terputus.");
            connectionBox.style.display = 'block';
            mainApp.style.display = 'none';
            connectionStatusElem.textContent = "Disconnected";
            connectionStatusElem.style.color = 'orange';
        });

        // Penanganan error koneksi spesifik
        conn.on('error', (err) => {
            console.error('Connection Error:', err);
            connectionStatusElem.textContent = "Gagal terhubung. Periksa Room ID.";
            connectionStatusElem.style.color = 'red';
        });
    }

    function requestSong() {
        const query = queryInput.value.trim();
        if (!query) {
            alert("Masukkan judul lagu.");
            return;
        }

        if (conn && conn.open) {
            requestStatusElem.textContent = "Mengirim request...";
            // Kirim request dengan nama perangkat yang sudah dideteksi
            conn.send({ type: 'request', name: deviceName, query: query });
            queryInput.value = '';
            setTimeout(() => { requestStatusElem.textContent = ''; }, 3001);
        } else {
            alert("Tidak terhubung ke Host.");
        }
    }

    // Fungsi handleStatusUpdate, startProgressTimer, dan formatTime tidak perlu diubah
    function handleStatusUpdate(data) { if (data.nowPlaying) { const nowPlayingData = data.nowPlaying; nowPlayingElem.innerHTML = `${nowPlayingData.title}<br><span class="requester-info">Req: ${nowPlayingData.requester}</span>`; aiIntroElem.textContent = `“${nowPlayingData.intro}”`; aiIntroElem.style.display = 'block'; startProgressTimer(nowPlayingData.start_time_utc, nowPlayingData.duration); } else { nowPlayingElem.innerHTML = "Jukebox is idle."; aiIntroElem.style.display = 'none'; waitTimeElem.textContent = ''; if (progressTimer) clearInterval(progressTimer); } queueListElem.innerHTML = ''; if (data.queue && data.queue.length > 0) { data.queue.forEach(song => { const li = document.createElement('li'); li.innerHTML = `${song.title} <span class="requester-info">Req: ${song.requester}</span>`; queueListElem.appendChild(li); }); } else { queueListElem.innerHTML = '<li>Queue is empty</li>'; } }
    function startProgressTimer(startTimeUTC, duration) { if (progressTimer) clearInterval(progressTimer); const totalDurationFormatted = formatTime(duration); progressTimer = setInterval(() => { const elapsedTime = (Date.now() / 1000) - startTimeUTC; if (elapsedTime > duration || elapsedTime < 0) { clearInterval(progressTimer); waitTimeElem.textContent = `[${totalDurationFormatted} / ${totalDurationFormatted}]`; return; } const elapsedTimeFormatted = formatTime(elapsedTime); waitTimeElem.textContent = `[${elapsedTimeFormatted} / ${totalDurationFormatted}]`; }, 1000); }
    function formatTime(totalSeconds) { if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00'; const minutes = Math.floor(totalSeconds / 60); const seconds = Math.floor(totalSeconds % 60); return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`; }

    // --- Inisialisasi dan Pemasangan Event Listener ---
    connectBtn.disabled = true;
    connectBtn.textContent = 'Loading...';
    
    connectBtn.addEventListener('click', connectToHost);
    roomIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') connectToHost(); });
    
    requestBtn.addEventListener('click', requestSong);
    queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestSong(); });

    initializePeer();
});

// public/client.js (Versi P2P Client)

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
const nameInput = document.getElementById('name-input');
const queryInput = document.getElementById('song-query-input');
const requestBtn = document.getElementById('request-btn');
const requestStatusElem = document.getElementById('request-status');
const waitTimeElem = document.getElementById('wait-time');

let peer = null;
let conn = null;
let progressTimer = null;

function initializePeer() {
    peer = new Peer();
    peer.on('error', err => {
        console.error('PeerJS error:', err);
        connectionStatusElem.textContent = "Error. Coba lagi.";
    });
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

    conn.on('data', state => {
        // Client hanya menerima state dan mengupdate UI
        handleStatusUpdate(state);
    });

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
    if (!name || !query) { alert("Nama dan Judul Lagu harus diisi!"); return; }

    if (conn && conn.open) {
        requestStatusElem.textContent = "Mengirim request...";
        conn.send({ type: 'request', name: name, query: query });
        queryInput.value = '';
        setTimeout(() => { requestStatusElem.textContent = ''; }, 3000);
    } else {
        alert("Tidak terhubung ke Host.");
    }
}

function handleStatusUpdate(data) {
    // ... (Fungsi ini sama persis seperti versi client.js sebelumnya) ...
    if (data.nowPlaying) {
        const nowPlayingData = data.nowPlaying;
        nowPlayingElem.innerHTML = `${nowPlayingData.title}<br><span class="requester-info">Req: ${nowPlayingData.requester}</span>`;
        aiIntroElem.textContent = `“${nowPlayingData.intro}”`;
        aiIntroElem.style.display = 'block';
        startProgressTimer(nowPlayingData.start_time_utc, nowPlayingData.duration);
    } else {
        nowPlayingElem.innerHTML = "Jukebox is idle.";
        aiIntroElem.style.display = 'none';
        waitTimeElem.textContent = '';
        if (progressTimer) clearInterval(progressTimer);
    }
    queueListElem.innerHTML = '';
    if (data.queue && data.queue.length > 0) {
        data.queue.forEach(song => {
            const li = document.createElement('li');
            li.innerHTML = `${song.title} <span class="requester-info">Req: ${song.requester}</span>`;
            queueListElem.appendChild(li);
        });
    } else {
        queueListElem.innerHTML = '<li>Queue is empty</li>';
    }
}

function startProgressTimer(startTimeUTC, duration) {
    // ... (Fungsi ini juga sama persis) ...
    if (progressTimer) clearInterval(progressTimer);
    const totalDurationFormatted = formatTime(duration);
    progressTimer = setInterval(() => {
        const elapsedTime = (Date.now() / 1000) - startTimeUTC;
        if (elapsedTime > duration || elapsedTime < 0) {
            clearInterval(progressTimer);
            waitTimeElem.textContent = `[${totalDurationFormatted} / ${totalDurationFormatted}]`;
            return;
        }
        const elapsedTimeFormatted = formatTime(elapsedTime);
        waitTimeElem.textContent = `[${elapsedTimeFormatted} / ${totalDurationFormatted}]`;
    }, 1000);
}

function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Event Listeners
requestBtn.addEventListener('click', requestSong);
queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestSong(); });

// Inisialisasi
initializePeer();

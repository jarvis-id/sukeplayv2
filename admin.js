// public/admin.js (Versi P2P Host)
const API_URL = 'http://localhost:3000'; // Selalu localhost

// Elemen UI
const roomIdElem = document.getElementById('room-id');
const clientCountElem = document.getElementById('client-count');
const nowPlayingElem = document.getElementById('now-playing');
const aiIntroElem = document.getElementById('ai-intro');
const audioPlayer = document.getElementById('audio-player');
const queueListElem = document.getElementById('queue-list');
const queryInput = document.getElementById('song-query-input');
const requestBtn = document.getElementById('request-btn');
const requestStatusElem = document.getElementById('request-status');
const skipBtn = document.getElementById('skip-btn');

let peer = null;
let connections = []; // Menyimpan koneksi semua client

function initializePeer() {
    peer = new Peer(); // Biarkan PeerJS membuat ID acak
    peer.on('open', id => {
        roomIdElem.textContent = id;
        console.log('Host siap dengan Room ID:', id);
    });

    peer.on('connection', conn => {
        console.log(`Client terhubung: ${conn.peer}`);
        connections.push(conn);
        updateClientCount();

        conn.on('data', data => {
            if (data.type === 'request') {
                handleClientRequest(data);
            }
        });

        conn.on('close', () => {
            connections = connections.filter(c => c.peer !== conn.peer);
            updateClientCount();
            console.log(`Client terputus: ${conn.peer}`);
        });
    });
    
    peer.on('error', err => {
        console.error("PeerJS Error:", err);
        roomIdElem.textContent = "Error! Coba Refresh.";
    });
}

function updateClientCount() {
    clientCountElem.textContent = connections.length;
}

function broadcastStateToClients(state) {
    for (const conn of connections) {
        if (conn.open) {
            conn.send(state);
        }
    }
}

async function handleClientRequest(data) {
    const { name, query } = data;
    console.log(`Menerima request dari client ${name}: ${query}`);
    // Meneruskan request ke server lokal
    await processRequest(name, query);
}

// Fungsi inti yang sama untuk request manual & client
async function processRequest(requesterName, query) {
    requestStatusElem.textContent = `Mencari "${query}"...`;
    try {
        const response = await fetch(`${API_URL}/api/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: requesterName, query: query })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        requestStatusElem.textContent = data.message;
    } catch (error) {
        requestStatusElem.textContent = `Error: ${error.message}`;
    } finally {
        setTimeout(() => { requestStatusElem.textContent = ''; }, 5000);
    }
}

async function skipNextSong() {
    await fetch(`${API_URL}/api/skip`, { method: 'POST' });
}

// Update UI Lokal dan siarkan ke client
async function syncAndBroadcast() {
    try {
        const response = await fetch(`${API_URL}/api/status`);
        const state = await response.json();
        
        // Update UI Admin
        handleStatusUpdate(state);
        // Kirim state ke semua client
        broadcastStateToClients(state);

    } catch (error) {
        console.error("Gagal sinkronisasi dengan server lokal:", error);
    }
}

function handleStatusUpdate(data) {
    // ... (Fungsi ini sama persis seperti versi admin.js sebelumnya) ...
    queueListElem.innerHTML = '';
    if (data.queue && data.queue.length > 0) {
        data.queue.forEach(song => {
            const li = document.createElement('li');
            li.innerHTML = `${song.title} <span class="requester-info">Req: ${song.requester}</span>`;
            queueListElem.appendChild(li);
        });
        skipBtn.disabled = false;
    } else {
        queueListElem.innerHTML = '<li>Queue is empty</li>';
        skipBtn.disabled = true;
    }
    const nowPlayingData = data.nowPlaying;
    if (nowPlayingData) {
        nowPlayingElem.innerHTML = `${nowPlayingData.title}<br><span class="requester-info">Req: ${nowPlayingData.requester}</span>`;
        aiIntroElem.textContent = `“${nowPlayingData.intro}”`;
        aiIntroElem.style.display = 'block';
        if (audioPlayer.src !== nowPlayingData.stream_url) {
            audioPlayer.src = nowPlayingData.stream_url;
            audioPlayer.play().catch(e => console.error("Autoplay gagal:", e));
        }
    } else {
        nowPlayingElem.innerHTML = "Jukebox is idle.";
        aiIntroElem.style.display = 'none';
        if (audioPlayer.src) audioPlayer.src = '';
        skipBtn.disabled = true;
    }
}

// Event Listeners
audioPlayer.addEventListener('ended', skipNextSong);
skipBtn.addEventListener('click', skipNextSong);
requestBtn.addEventListener('click', () => {
    const query = queryInput.value.trim();
    if (query) {
        processRequest('Admin', query);
        queryInput.value = '';
    }
});
queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestBtn.click(); });

// Inisialisasi
initializePeer();
setInterval(syncAndBroadcast, 2000); // Sync setiap 2 detik

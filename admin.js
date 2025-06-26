// public/admin.js (Versi P2P Host dengan Custom Room ID)
const API_URL = 'http://localhost:3000'; // Pastikan server.py berjalan

// Elemen UI Setup
const hostSetupBox = document.getElementById('host-setup-box');
const mainAdminApp = document.getElementById('main-admin-app');
const customRoomIdInput = document.getElementById('custom-room-id-input');
const startHostBtn = document.getElementById('start-host-btn');
const hostStatusElem = document.getElementById('host-status');

// Elemen UI Aplikasi
const roomIdDisplayElem = document.getElementById('room-id-display');
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
let connections = [];

// Fungsi untuk memulai sesi Host
function startHost() {
    const customRoomId = customRoomIdInput.value.trim();
    if (!customRoomId) {
        alert("Silakan masukkan ID Room terlebih dahulu.");
        return;
    }

    // Nonaktifkan form setup untuk mencegah klik ganda
    startHostBtn.disabled = true;
    customRoomIdInput.disabled = true;
    hostStatusElem.textContent = "Connecting to PeerJS server...";

    // Hancurkan instance peer lama jika ada (untuk coba lagi jika gagal)
    if (peer) {
        peer.destroy();
    }

    // Inisialisasi PeerJS dengan ID kustom yang diberikan
    peer = new Peer(customRoomId);

    // Event handler saat koneksi ke server PeerJS berhasil
    peer.on('open', id => {
        console.log('Host berhasil dimulai dengan Room ID:', id);
        hostSetupBox.style.display = 'none'; // Sembunyikan form setup
        mainAdminApp.style.display = 'block'; // Tampilkan aplikasi utama
        roomIdDisplayElem.textContent = id;
        
        // Mulai sinkronisasi dengan server lokal setelah host berhasil dimulai
        setInterval(syncAndBroadcast, 2000); // Sync setiap 2 detik
    });

    // Event handler saat ada client baru yang terhubung
    peer.on('connection', conn => {
        console.log(`Client terhubung: ${conn.peer}`);
        connections.push(conn);
        updateClientCount();

        // Saat menerima data dari client
        conn.on('data', data => {
            if (data.type === 'request') {
                handleClientRequest(data);
            }
        });

        // Saat client terputus
        conn.on('close', () => {
            connections = connections.filter(c => c.peer !== conn.peer);
            updateClientCount();
            console.log(`Client terputus: ${conn.peer}`);
        });
    });
    
    // Event handler jika terjadi error (misal: ID sudah dipakai)
    peer.on('error', err => {
        console.error("PeerJS Error:", err);
        hostStatusElem.textContent = `Error: ${err.type}. ID mungkin sudah dipakai. Coba ID lain.`;
        // Aktifkan kembali form agar bisa coba lagi
        startHostBtn.disabled = false;
        customRoomIdInput.disabled = false;
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

// Fungsi inti yang sama untuk request manual dari admin & dari client
async function processRequest(requesterName, query) {
    requestStatusElem.textContent = `Mencari "${query}"...`;
    try {
        const response = await fetch(`${API_URL}/api/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: requesterName, query: query })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan');
        requestStatusElem.textContent = data.message;
    } catch (error) {
        requestStatusElem.textContent = `Error: ${error.message}`;
    } finally {
        // Kosongkan pesan status setelah beberapa detik
        setTimeout(() => { requestStatusElem.textContent = ''; }, 5000);
    }
}

async function skipNextSong() {
    await fetch(`${API_URL}/api/skip`, { method: 'POST' });
}

async function syncAndBroadcast() {
    try {
        const response = await fetch(`${API_URL}/api/status`);
        const state = await response.json();
        handleStatusUpdate(state);
        broadcastStateToClients(state);
    } catch (error) {
        console.error("Gagal sinkronisasi dengan server lokal:", error);
    }
}

function handleStatusUpdate(data) {
    // Update Antrian
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
    
    // Update Now Playing
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
        nowPlayingElem.innerHTML = "Jukebox is idle. Request a song to start!";
        aiIntroElem.style.display = 'none';
        if (audioPlayer.src) audioPlayer.src = '';
        skipBtn.disabled = true;
    }
}

// Event Listeners
startHostBtn.addEventListener('click', startHost);
customRoomIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') startHost(); });

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

// Aplikasi tidak dimulai sampai Admin menekan tombol "Start Host".

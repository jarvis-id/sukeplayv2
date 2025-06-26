// public/admin.js (Versi Final dengan DOMContentLoaded dan Debugging)

// Menjalankan seluruh skrip setelah halaman HTML selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Admin script is now running.");

    const API_URL = 'http://localhost:3000';

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

    // Cek apakah elemen penting ada, untuk mencegah error
    if (!startHostBtn || !customRoomIdInput) {
        console.error("Critical Error: Tombol 'Start Host' atau Input Room ID tidak ditemukan di HTML. Periksa ID elemen.");
        alert("Halaman tidak termuat dengan benar. Coba refresh.");
        return;
    }

    let peer = null;
    let connections = [];
    let syncInterval = null;

    function startHost() {
        console.log("Fungsi startHost() dipanggil.");
        const customRoomId = customRoomIdInput.value.trim();
        if (!customRoomId) {
            alert("Silakan masukkan ID Room terlebih dahulu.");
            return;
        }

        startHostBtn.disabled = true;
        customRoomIdInput.disabled = true;
        hostStatusElem.textContent = "Connecting to PeerJS server...";

        if (peer) peer.destroy();
        
        console.log(`Mencoba membuat Peer dengan ID: ${customRoomId}`);
        peer = new Peer(customRoomId);

        peer.on('open', id => {
            console.log('Host berhasil dimulai dengan Room ID:', id);
            hostSetupBox.style.display = 'none';
            mainAdminApp.style.display = 'block';
            roomIdDisplayElem.textContent = id;
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(syncAndBroadcast, 2000);
        });

        peer.on('connection', handleNewConnection);
        
        peer.on('error', err => {
            console.error("PeerJS Error:", err);
            hostStatusElem.textContent = `Error: ${err.type}. ID mungkin sudah dipakai atau koneksi gagal.`;
            startHostBtn.disabled = false;
            customRoomIdInput.disabled = false;
        });
    }

    function handleNewConnection(conn) {
        console.log(`Client terhubung: ${conn.peer}`);
        connections.push(conn);
        updateClientCount();
        conn.on('data', data => { if (data.type === 'request') handleClientRequest(data); });
        conn.on('close', () => {
            connections = connections.filter(c => c.peer !== conn.peer);
            updateClientCount();
            console.log(`Client terputus: ${conn.peer}`);
        });
    }

    function updateClientCount() { clientCountElem.textContent = connections.length; }
    function broadcastStateToClients(state) { for (const conn of connections) { if (conn.open) conn.send(state); } }
    async function handleClientRequest(data) { const { name, query } = data; await processRequest(name, query); }
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
            setTimeout(() => { requestStatusElem.textContent = ''; }, 5000);
        }
    }
    async function skipNextSong() { await fetch(`${API_URL}/api/skip`, { method: 'POST' }); }
    async function syncAndBroadcast() {
        try {
            const response = await fetch(`${API_URL}/api/status`);
            const state = await response.json();
            handleStatusUpdate(state);
            if (connections.length > 0) {
                broadcastStateToClients(state);
            }
        } catch (error) {
            // Tidak perlu menampilkan error di console terus-menerus jika server belum jalan
        }
    }
    function handleStatusUpdate(data) {
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

    // --- Pemasangan Event Listener ---
    console.log("Memasang event listener ke tombol 'Start Host'.");
    startHostBtn.addEventListener('click', startHost);
    customRoomIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') startHost(); });

    audioPlayer.addEventListener('ended', skipNextSong);
    skipBtn.addEventListener('click', skipNextSong);
    requestBtn.addEventListener('click', () => {
        const query = queryInput.value.trim();
        if (query) processRequest('Admin', query);
        queryInput.value = '';
    });
    queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestBtn.click(); });
});

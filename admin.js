// public/admin.js (Versi P2P Host dengan Kemampuan Moderasi Request, Hapus, dan Skip)

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Admin script is now running.");

    const API_URL = 'http://localhost:3001';

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

    if (!startHostBtn || !customRoomIdInput) {
        console.error("Critical Error: Tombol 'Start Host' atau Input Room ID tidak ditemukan di HTML.");
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

        // Saat menerima data dari client (bisa request, hapus, atau skip)
        conn.on('data', data => {
            console.log(`Menerima data dari client ${conn.peer}:`, data);

            if (data.type === 'request') {
                handleClientRequest(data);
            } 
            else if (data.type === 'remove_song' && typeof data.index === 'number') {
                console.log(`Menerima perintah hapus untuk indeks ${data.index} dari moderator.`);
                removeSongFromQueue(data.index);
            }
            // ======================================================
            // == PENYESUAIAN: TAMBAHKAN LOGIKA UNTUK MENANGANI SKIP ==
            // ======================================================
            else if (data.type === 'skip_song') {
                console.log(`Menerima perintah skip dari moderator.`);
                // Memanggil fungsi skip yang sudah ada
                skipNextSong();
            }
        });

        // Saat client terputus
        conn.on('close', () => {
            connections = connections.filter(c => c.peer !== conn.peer);
            updateClientCount();
            console.log(`Client terputus: ${conn.peer}`);
        });
    }
    
    async function removeSongFromQueue(index) {
        console.log(`Mengirim request hapus ke server lokal untuk indeks: ${index}`);
        try {
            await fetch(`${API_URL}/api/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index: index })
            });
        } catch (error) {
            console.error("Gagal mengirim perintah hapus ke server:", error);
        }
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

    async function skipNextSong() {
        console.log("Mengirim perintah skip ke server lokal.");
        await fetch(`${API_URL}/api/skip`, { method: 'POST' }); 
    }

    async function syncAndBroadcast() {
        try {
            const response = await fetch(`${API_URL}/api/status`);
            const state = await response.json();
            handleStatusUpdate(state);
            if (connections.length > 0) {
                broadcastStateToClients(state);
            }
        } catch (error) {
            // Tidak perlu log error terus-menerus jika server belum jalan
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
            skipBtn.disabled = false; // Aktifkan tombol skip jika ada lagu
            if (nowPlayingData.stream_url && audioPlayer.src !== nowPlayingData.stream_url) {
                audioPlayer.src = nowPlayingData.stream_url;
                audioPlayer.play().catch(e => console.error("Autoplay gagal:", e));
            }
        } else {
            nowPlayingElem.innerHTML = "Jukebox is idle.";
            aiIntroElem.style.display = 'none';
            if (audioPlayer.src) audioPlayer.src = '';
            skipBtn.disabled = true; // Nonaktifkan tombol skip jika tidak ada lagu
        }
    }

    // --- Pemasangan Event Listener ---
    startHostBtn.addEventListener('click', startHost);
    customRoomIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') startHost(); });

    audioPlayer.addEventListener('ended', skipNextSong);
    skipBtn.addEventListener('click', skipNextSong); // Tombol skip admin juga memanggil fungsi yang sama
    requestBtn.addEventListener('click', () => {
        const query = queryInput.value.trim();
        if (query) {
            processRequest('Admin', query);
            queryInput.value = '';
        }
    });
    queryInput.addEventListener('keypress', e => { if (e.key === 'Enter') requestBtn.click(); });
});

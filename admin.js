// github-pages-frontend/admin.js

const LOCAL_SERVER_URL = 'http://localhost:3000';

const roomIdEl = document.getElementById('room-id');
const connectionCountEl = document.getElementById('connection-count');
const nowPlayingInfoEl = document.getElementById('now-playing-info');
const audioPlayer = document.getElementById('audio-player');
const nextBtn = document.getElementById('next-btn');
const queueListEl = document.getElementById('queue-list');

// Bagian untuk menambah lagu manual dari admin
const manualSongQueryInput = document.getElementById('manual-song-query');
const manualAddBtn = document.getElementById('manual-add-btn');

let peer = null;
let connections = []; // Array untuk menyimpan semua koneksi client yang aktif

// --- Inisialisasi PeerJS sebagai Host ---
function initializePeer() {
    peer = new Peer(); // Biarkan PeerJS membuat ID acak untuk room

    peer.on('open', id => {
        roomIdEl.textContent = id;
        console.log('PeerJS Host siap dengan Room ID: ' + id);
        // Mulai sinkronisasi dengan server lokal setelah koneksi siap
        setInterval(syncWithLocalServer, 1500); // Sync setiap 1.5 detik
    });

    peer.on('connection', conn => {
        console.log(`Client terhubung: ${conn.peer}`);
        connections.push(conn);
        connectionCountEl.textContent = connections.length;
        
        conn.on('data', data => {
            console.log('Menerima data dari client:', data);
            if (data.type === 'request') {
                // Panggil fungsi yang sudah diperbaiki
                handleClientRequest(data);
            }
        });

        conn.on('close', () => {
            console.log(`Client terputus: ${conn.peer}`);
            connections = connections.filter(c => c.peer !== conn.peer);
            connectionCountEl.textContent = connections.length;
        });
    });

    peer.on('error', err => {
        console.error("PeerJS Error:", err);
        alert("Koneksi PeerJS gagal. Coba refresh halaman atau periksa koneksi internet.");
    });
}

// --- Komunikasi dengan Server Lokal ---
async function syncWithLocalServer() {
    try {
        const response = await fetch(`${LOCAL_SERVER_URL}/status`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const state = await response.json();
        updateAdminUI(state); // Update tampilan Admin
        broadcastStateToClients(state); // Siarkan state ke semua Client
    } catch (error) {
        console.error("Gagal sinkronisasi dengan server lokal. Pastikan server berjalan.");
        nowPlayingInfoEl.innerHTML = `<p style="color:red;">Error: Tidak bisa terhubung ke server lokal di ${LOCAL_SERVER_URL}. Pastikan server.py sudah berjalan.</p>`;
    }
}

// ====================================================================
// == FUNGSI YANG DIPERBAIKI ==
// ====================================================================
async function handleClientRequest(data) {
    // 'data' adalah pesan yang diterima dari client, contoh: { requester: 'sinta', query: 'domino' }
    console.log(`Meneruskan request dari client '${data.requester}' dengan kueri "${data.query}" ke server lokal.`);

    try {
        // Buat objek body yang SAMA PERSIS dengan yang diharapkan oleh server.py
        const requestBody = {
            query: data.query,
            requester: data.requester
        };

        const response = await fetch(`${LOCAL_SERVER_URL}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody) // Kirim data yang sudah benar
        });
        
        const result = await response.json();

        if (!response.ok) {
            // Tampilkan pesan error dari server jika ada
            alert(`Error dari server: ${result.message}`);
        }
        
        // Tidak perlu melakukan apa-apa lagi.
        // Perubahan antrian akan otomatis terlihat pada siklus syncWithLocalServer() berikutnya.

    } catch (error) {
        console.error('Gagal meneruskan request ke server lokal:', error);
        alert('Gagal menghubungi server lokal. Pastikan server.py berjalan dengan benar.');
    }
}

// Fungsi untuk menambah lagu manual oleh admin
manualAddBtn.addEventListener('click', () => {
    const query = manualSongQueryInput.value.trim();
    if (query) {
        // Kita gunakan 'Admin' sebagai nama requester
        handleClientRequest({ requester: 'Admin', query: query });
        manualSongQueryInput.value = ''; // Kosongkan input
    }
});


// Fungsi untuk skip ke lagu selanjutnya
nextBtn.addEventListener('click', () => {
    fetch(`${LOCAL_SERVER_URL}/next`, { method: 'POST' });
});


// --- Update UI dan Broadcast ---
function updateAdminUI(state) {
    // Update Now Playing
    if (state.nowPlaying) {
        nowPlayingInfoEl.innerHTML = `
            <h3>${state.nowPlaying.title}</h3>
            <p>Request oleh: ${state.nowPlaying.requester}</p>
            <p><i>"${state.playerStatus.aiText}"</i></p>
        `;
        // Hanya setel ulang src jika lagunya berbeda untuk menghindari pemutaran ulang
        const currentSrcBase = audioPlayer.src.split('/').pop();
        const newSrcFilename = `${state.nowPlaying.id}.mp4`; // Server python kita menyimpan sbg .mp4
        if (currentSrcBase !== newSrcFilename) {
            audioPlayer.src = `${LOCAL_SERVER_URL}/play/${state.nowPlaying.id}`;
            audioPlayer.play();
        }
    } else {
        nowPlayingInfoEl.textContent = "Jukebox is idle. Request a song!";
        audioPlayer.src = "";
    }

    // Update Queue
    queueListEl.innerHTML = '';
    if (state.queue.length > 0) {
        state.queue.forEach((song, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${song.title} (Req: ${song.requester})`;
            queueListEl.appendChild(li);
        });
    } else {
        queueListEl.innerHTML = '<li>Queue is empty</li>';
    }
}

function broadcastStateToClients(state) {
    for (const conn of connections) {
        if (conn.open) {
            try {
                conn.send(state);
            } catch (err) {
                console.error(`Gagal mengirim state ke client ${conn.peer}:`, err);
            }
        }
    }
}

// --- Event Listener untuk Audio Player ---
audioPlayer.addEventListener('ended', () => {
    console.log("Lagu selesai, memutar selanjutnya...");
    nextBtn.click();
});

// Laporkan status player ke server agar client bisa melihat progress bar
audioPlayer.addEventListener('timeupdate', () => {
    // Hindari pengiriman update yang terlalu sering untuk mengurangi beban
    // Kita bisa menambahkan throttling di sini jika perlu, tapi untuk sekarang biarkan saja
    if (!audioPlayer.paused) {
        fetch(`${LOCAL_SERVER_URL}/update-player-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isPlaying: !audioPlayer.paused,
                currentTime: audioPlayer.currentTime,
                duration: audioPlayer.duration || 0
            })
        });
    }
});

// Jalankan aplikasi
initializePeer();

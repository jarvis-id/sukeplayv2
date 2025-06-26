// admin.js
const LOCAL_SERVER_URL = 'http://localhost:3000';

const roomIdEl = document.getElementById('room-id');
const connectionCountEl = document.getElementById('connection-count');
const nowPlayingInfoEl = document.getElementById('now-playing-info');
const audioPlayer = document.getElementById('audio-player');
const nextBtn = document.getElementById('next-btn');
const queueListEl = document.getElementById('queue-list');

let peer = null;
let connections = []; // Menyimpan semua koneksi client

// --- Inisialisasi PeerJS sebagai Host ---
function initializePeer() {
    peer = new Peer(); // Biarkan PeerJS membuat ID acak

    peer.on('open', id => {
        roomIdEl.textContent = id;
        console.log('My peer ID is: ' + id);
        // Mulai sinkronisasi dengan server lokal
        setInterval(syncWithLocalServer, 1000); // Sync setiap 1 detik
    });

    peer.on('connection', conn => {
        console.log(`Client terhubung: ${conn.peer}`);
        connections.push(conn);
        connectionCountEl.textContent = connections.length;
        
        conn.on('data', data => {
            console.log('Menerima data dari client:', data);
            if (data.type === 'request') {
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
        alert("Koneksi PeerJS gagal. Coba refresh halaman.");
    });
}

// --- Komunikasi dengan Server Lokal ---
async function syncWithLocalServer() {
    try {
        const response = await fetch(`${LOCAL_SERVER_URL}/status`);
        const state = await response.json();
        updateAdminUI(state);
        broadcastStateToClients(state);
    } catch (error) {
        console.error("Gagal sinkronisasi dengan server lokal. Pastikan server berjalan.");
        nowPlayingInfoEl.innerHTML = `<p style="color:red;">Error: Tidak bisa terhubung ke server lokal di ${LOCAL_SERVER_URL}</p>`;
    }
}

async function handleClientRequest(data) {
    // Di sini, Anda akan memanggil Gemini API untuk mendapatkan videoId dari query
    // Untuk sekarang, kita anggap query adalah videoId
    const requestData = {
        videoId: data.query, // GANTI DENGAN HASIL PENCARIAN GEMINI
        title: `Lagu dari query: ${data.query}`, // GANTI DENGAN HASIL PENCARIAN GEMINI
        requester: data.requester
    };
    
    await fetch(`${LOCAL_SERVER_URL}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    });
    // Status akan diupdate pada siklus sync selanjutnya
}

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
        // Hanya set src jika berbeda untuk menghindari reset lagu
        const currentSrc = audioPlayer.src;
        const newSrc = `${LOCAL_SERVER_URL}/play/${state.nowPlaying.id}`;
        if (!currentSrc.endsWith(newSrc)) {
            audioPlayer.src = newSrc;
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
            conn.send(state);
        }
    }
}

// --- Event Listener Player ---
audioPlayer.addEventListener('ended', () => {
    console.log("Lagu selesai, memutar selanjutnya...");
    nextBtn.click();
});

// Laporkan status player ke server
audioPlayer.addEventListener('timeupdate', () => {
    fetch(`${LOCAL_SERVER_URL}/update-player-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            isPlaying: !audioPlayer.paused,
            currentTime: audioPlayer.currentTime,
            duration: audioPlayer.duration
        })
    });
});

// Jalankan aplikasi
initializePeer();

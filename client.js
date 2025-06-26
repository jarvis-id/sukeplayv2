// client.js
const roomIdInput = document.getElementById('room-id-input');
const connectBtn = document.getElementById('connect-btn');
const connectionStatusEl = document.getElementById('connection-status');
const requestCard = document.getElementById('request-card');
const nowPlayingInfoEl = document.getElementById('now-playing-info');
const queueListEl = document.getElementById('queue-list');
const yourNameInput = document.getElementById('your-name');
const songQueryInput = document.getElementById('song-query');
const requestBtn = document.getElementById('request-btn');

let peer = null;
let conn = null;

function initializePeer() {
    peer = new Peer(); // Inisialisasi PeerJS untuk Client
    peer.on('open', id => {
        console.log('Client Peer ID:', id);
    });
    peer.on('error', err => console.error("PeerJS Error:", err));
}

connectBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert("Please enter a Room ID.");
        return;
    }
    
    console.log(`Connecting to host: ${roomId}`);
    conn = peer.connect(roomId);

    conn.on('open', () => {
        connectionStatusEl.textContent = 'Connected!';
        connectionStatusEl.style.color = 'lightgreen';
        requestCard.style.display = 'block';
    });

    conn.on('data', state => {
        // Menerima update state dari Admin
        updateClientUI(state);
    });

    conn.on('close', () => {
        connectionStatusEl.textContent = 'Disconnected';
        connectionStatusEl.style.color = 'red';
        requestCard.style.display = 'none';
        alert("Connection to host lost.");
    });
});

requestBtn.addEventListener('click', () => {
    const name = yourNameInput.value.trim();
    const query = songQueryInput.value.trim();
    if (!name || !query) {
        alert("Please fill in your name and song request.");
        return;
    }

    if (conn && conn.open) {
        const requestData = {
            type: 'request',
            requester: name,
            query: query
        };
        conn.send(requestData);
        console.log("Request sent:", requestData);
        songQueryInput.value = ''; // Kosongkan input setelah request
    } else {
        alert("Not connected to host.");
    }
});

function updateClientUI(state) {
    // Update Now Playing
    if (state.nowPlaying) {
        const progress = `${formatTime(state.playerStatus.currentTime)} / ${formatTime(state.playerStatus.duration)}`;
        nowPlayingInfoEl.innerHTML = `
            <h3>${state.nowPlaying.title}</h3>
            <p>Request oleh: ${state.nowPlaying.requester}</p>
            <p><strong>[${progress}]</strong></p>
            <p><i>"${state.playerStatus.aiText}"</i></p>
        `;
    } else {
        nowPlayingInfoEl.textContent = "Jukebox is idle. Request a song!";
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

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
}

// Jalankan
initializePeer();

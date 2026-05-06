/**
 * Jungle Jumpers - Multiplayer Logic
 */

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const peerId = Math.random().toString(36).substring(2, 9);
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'default';

let socket;
const connections = new Map(); // peerId -> RTCPeerConnection
const dataChannels = new Map(); // peerId -> RTCDataChannel

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the actual path from wrangler.jsonc / worker.js
    // worker.js: if (url.pathname.endsWith('/api/signal/ws'))
    const wsUrl = `${protocol}//${window.location.host}/api/signal/ws?room=${room}&peerId=${peerId}`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        statusDot.classList.add('connected');
        statusText.textContent = `Connected to room: ${room}`;
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'peers':
                data.peers.forEach(id => initiateConnection(id));
                break;
            case 'peer-joined':
                initiateConnection(data.peerId);
                break;
            case 'peer-left':
                removePeer(data.peerId);
                break;
            case 'signal':
                handleSignal(data.from, data.signal);
                break;
        }
    };

    socket.onclose = () => {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected. Retrying...';
        setTimeout(connect, 3000);
    };
}

async function initiateConnection(targetId) {
    if (connections.has(targetId)) return;

    const pc = new RTCPeerConnection(configuration);
    connections.set(targetId, pc);

    const dc = pc.createDataChannel('updates', { unreliable: true });
    setupDataChannel(targetId, dc);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal(targetId, { ice: event.candidate });
        }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(targetId, { sdp: pc.localDescription });
}

async function handleSignal(fromId, signal) {
    let pc = connections.get(fromId);

    if (!pc) {
        pc = new RTCPeerConnection(configuration);
        connections.set(fromId, pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal(fromId, { ice: event.candidate });
            }
        };

        pc.ondatachannel = (event) => {
            setupDataChannel(fromId, event.channel);
        };
    }

    if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(fromId, { sdp: pc.localDescription });
        }
    } else if (signal.ice) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
}

function setupDataChannel(targetId, dc) {
    dataChannels.set(targetId, dc);

    dc.onopen = () => console.log(`DataChannel open with ${targetId}`);
    dc.onclose = () => {
        dataChannels.delete(targetId);
        removePeer(targetId);
    };

    dc.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateRemotePlayer(targetId, data);
    };
}

function sendSignal(to, signal) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'signal', to, signal }));
    }
}

function removePeer(id) {
    if (connections.has(id)) {
        connections.get(id).close();
        connections.delete(id);
    }
    dataChannels.delete(id);
    if (window.remotePlayers && window.remotePlayers.has(id)) {
        window.remotePlayers.delete(id);
    }
}

function updateRemotePlayer(id, data) {
    if (!window.remotePlayers || !window.Player) return;

    let p = window.remotePlayers.get(id);
    if (!p) {
        p = new window.Player(data.x, data.y, false);
        window.remotePlayers.set(id, p);
    }
    p.x = data.x;
    p.y = data.y;
    // We can also sync vx, vy for better interpolation if needed
}

// Global broadcast function called by game.js
window.broadcastPosition = (player) => {
    const data = JSON.stringify({
        x: player.x,
        y: player.y
    });

    dataChannels.forEach(dc => {
        if (dc.readyState === 'open') {
            dc.send(data);
        }
    });
};

connect();

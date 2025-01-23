document.addEventListener('DOMContentLoaded', () => {
    const peerConnection = new PeerConnection();
    const connectionStatus = document.getElementById('connectionStatus');
    
    // Connect button handler with loading state
    document.getElementById('connectBtn').addEventListener('click', () => {
        const remoteId = document.getElementById('remoteId').value.trim();
        if (remoteId && /^\d{6}$/.test(remoteId)) {
            const connectBtn = document.getElementById('connectBtn');
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';
            
            peerConnection.connect(remoteId);
            
            // Show connecting status
            connectionStatus.textContent = 'Connecting...';
            connectionStatus.style.display = 'block';
        } else {
            alert('Please enter a valid 6-digit ID');
        }
    });

    // Listen for connection events
    window.addEventListener('connected', () => {
        connectionStatus.textContent = peerConnection.isHost ? 
            'Sharing screen' : 'Connected to remote screen';
        connectionStatus.style.display = 'block';
        
        const connectBtn = document.getElementById('connectBtn');
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    });

    window.addEventListener('disconnected', () => {
        connectionStatus.style.display = 'none';
        const connectBtn = document.getElementById('connectBtn');
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
    });

    // Copy ID button handler
    document.getElementById('copyId').addEventListener('click', () => {
        const localId = document.getElementById('localId').textContent;
        navigator.clipboard.writeText(localId)
            .then(() => alert('ID copied to clipboard!'))
            .catch(err => console.error('Failed to copy:', err));
    });

    // Screen sharing handlers
    document.getElementById('shareScreen').addEventListener('click', () => {
        peerConnection.shareScreen();
    });

    document.getElementById('stopSharing').addEventListener('click', () => {
        peerConnection.stopSharing();
    });

    // File sharing handlers
    document.getElementById('sendFile').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            peerConnection.sendFile(file);
            document.getElementById('fileStatus').textContent = `Sending: ${file.name}`;
            document.getElementById('fileStatus').style.display = 'block';
        }
    });

    // Remote control event listeners
    const remoteVideo = document.getElementById('remoteVideo');
    
    remoteVideo.addEventListener('mouseenter', () => {
        if (peerConnection.connection) {
            peerConnection.isControlling = true;
        }
    });

    remoteVideo.addEventListener('mouseleave', () => {
        if (peerConnection.connection) {
            peerConnection.isControlling = false;
        }
    });

    remoteVideo.addEventListener('mousemove', (e) => {
        if (peerConnection.connection && peerConnection.isControlling) {
            const rect = remoteVideo.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            peerConnection.connection.send({
                type: 'mouseMove',
                x: x,
                y: y
            });
        }
    });

    remoteVideo.addEventListener('click', (e) => {
        if (peerConnection.connection && peerConnection.isControlling) {
            const rect = remoteVideo.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            
            peerConnection.connection.send({
                type: 'mouseClick',
                x: x,
                y: y
            });
        }
    });

    document.addEventListener('keydown', (e) => {
        if (peerConnection.connection && peerConnection.isControlling) {
            peerConnection.connection.send({
                type: 'keyPress',
                key: e.key
            });
        }
    });

    // Add this to handle file transfer progress
    function updateFileStatus(message) {
        const statusElement = document.getElementById('fileStatus');
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    }

    // Add this with the other button handlers
    document.getElementById('newId').addEventListener('click', () => {
        const newId = peerConnection.generateDigitId();
        peerConnection.peer.reconnect(newId);
    });
}); 
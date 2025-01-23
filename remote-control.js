document.addEventListener('DOMContentLoaded', () => {
    const peerConnection = new PeerConnection();
    const connectionStatus = document.getElementById('connectionStatus');
    const screenWrapper = document.getElementById('screenWrapper');
    const remoteVideo = document.getElementById('remoteVideo');
    
    // Zoom control variables
    let currentZoom = 1;
    const ZOOM_STEP = 0.1;
    const MAX_ZOOM = 3;
    const MIN_ZOOM = 0.5;

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => {
        if (currentZoom < MAX_ZOOM) {
            currentZoom += ZOOM_STEP;
            updateZoom();
        }
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        if (currentZoom > MIN_ZOOM) {
            currentZoom -= ZOOM_STEP;
            updateZoom();
        }
    });

    document.getElementById('zoomReset').addEventListener('click', () => {
        currentZoom = 1;
        updateZoom();
    });

    function updateZoom() {
        remoteVideo.style.transform = `scale(${currentZoom})`;
    }

    // Full screen handling
    screenWrapper.addEventListener('dblclick', () => {
        if (!document.fullscreenElement) {
            screenWrapper.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Add fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'btn btn-icon fullscreen-btn';
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    screenWrapper.appendChild(fullscreenBtn);

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            screenWrapper.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    // Connect button handler with loading state
    document.getElementById('connectBtn').addEventListener('click', () => {
        const remoteId = document.getElementById('remoteId').value.trim();
        const connectionStatus = document.getElementById('connectionStatus'); // Assuming this exists in your HTML
        
        if (remoteId && /^\d{6}$/.test(remoteId)) {
            const connectBtn = document.getElementById('connectBtn');
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';
            
            // Attempt to connect
            peerConnection.connect(remoteId);
    
            // Show connecting status
            connectionStatus.textContent = 'Connecting...';
            connectionStatus.style.display = 'block';
    
            // Listen for a successful connection event
            peerConnection.on('connected', () => {
                connectBtn.textContent = 'Connected';
                connectBtn.disabled = false;
                connectionStatus.textContent = 'Connected successfully';
                connectionStatus.style.display = 'block';
            });
    
            // Handle connection errors
            peerConnection.on('error', (error) => {
                connectBtn.textContent = 'Connect';
                connectBtn.disabled = false;
                connectionStatus.textContent = `Connection failed: ${error.message}`;
                connectionStatus.style.display = 'block';
            });
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
        if (peerConnection.connection) {
            document.getElementById('fileInput').click();
        } else {
            alert('Please connect to a peer first');
        }
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', file);
            peerConnection.sendFile(file);
            // Reset input
            e.target.value = '';
        }
    });

    // Remote control event listeners
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

    // File transfer status updates
    window.addEventListener('fileTransferProgress', (e) => {
        const { progress, fileName, type } = e.detail;
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.textContent = `${type === 'send' ? 'Sending' : 'Receiving'}: ${fileName} (${progress}%)`;
        statusDiv.style.display = 'block';
        statusDiv.className = 'file-status fade-in';
    });

    window.addEventListener('fileTransferComplete', (e) => {
        const { fileName, type } = e.detail;
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.textContent = `${type === 'send' ? 'Sent' : 'Received'}: ${fileName}`;
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    });
}); 
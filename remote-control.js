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
    fullscreenBtn.innerHTML = '<i class="fas fa-expand" class="z-index:999999999;"></i>';
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
        const connectBtn = document.getElementById('connectBtn');
        
        if (remoteId && /^\d{6}$/.test(remoteId)) {
            // Update button state
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            
            // Attempt to connect
            peerConnection.connect(remoteId);
        } else {
            peerConnection.showNotification('Please enter a valid 6-digit ID', 'error');
        }
    });
    

    // Listen for connection events
    window.addEventListener('connected', () => {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        
        if (peerConnection.isHost) {
            connectionStatus.textContent = 'Connected - Starting screen share';
        } else {
            connectionStatus.textContent = 'Connected to remote screen';
        }
        connectionStatus.style.display = 'block';
    });

    window.addEventListener('disconnected', () => {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        
        connectionStatus.style.display = 'none';
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
    });

    // Copy ID button handler
    document.getElementById('copyId').addEventListener('click', () => {
        const localId = document.getElementById('localId').textContent;
        navigator.clipboard.writeText(localId)
          .then(() => {
            const copyBtn = document.getElementById('copyId');
            
            // Ensure the button is positioned relative so that the tooltip can be absolutely positioned
            copyBtn.style.position = 'relative';
            
            // Create the tooltip element
            const tooltip = document.createElement('span');
            tooltip.textContent = "Copied!";
            tooltip.style.position = 'absolute';
            tooltip.style.top = '100%'; // Display below the button
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.backgroundColor = '#333';
            tooltip.style.color = '#fff';
            tooltip.style.padding = '5px 8px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.whiteSpace = 'nowrap';
            tooltip.style.zIndex = '1000';
            tooltip.style.marginTop = '8px';
            tooltip.style.opacity = '0';
            tooltip.style.transition = 'opacity 0.3s';
      
            // Append the tooltip to the button
            copyBtn.appendChild(tooltip);
      
            // Fade in the tooltip
            setTimeout(() => {
              tooltip.style.opacity = '1';
            }, 10);
      
            // After 2 seconds, fade out and remove the tooltip
            setTimeout(() => {
              tooltip.style.opacity = '0';
              setTimeout(() => {
                if (copyBtn.contains(tooltip)) {
                  copyBtn.removeChild(tooltip);
                }
              }, 300); // match the transition duration
            }, 2000);
          })
          .catch(err => console.error('Failed to copy:', err));
      });
      

    // Screen sharing handlers
    document.getElementById('shareScreen').addEventListener('click', () => {
        peerConnection.shareScreen();
    });

    document.getElementById('stopSharing').addEventListener('click', () => {
        peerConnection.stopSharing();
        document.getElementById('shareScreen').disabled = false;
        document.getElementById('stopSharing').disabled = true;
    });

    // File sharing handlers
    document.getElementById('sendFile').addEventListener('click', () => {
        if (!peerConnection.connection) {
            peerConnection.showNotification('Please connect to a peer first', 'error');
            return;
        }
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) { // 100MB limit
                peerConnection.showNotification('File size too large (max 100MB)', 'error');
                return;
            }
            peerConnection.sendFile(file);
            e.target.value = ''; // Reset input
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
        location.reload(); // Refresh the whole page
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

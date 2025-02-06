class PeerConnection {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isControlling = false;
        this.isHost = false;
        this.pendingConnection = null;
        this.setupInternetCheck();
        this.initialize();
    }

    setupInternetCheck() {
        const updateInternetStatus = () => {
            const status = document.getElementById('internetStatus');
            if (navigator.onLine) {
                status.innerHTML = '<i class="fas fa-wifi"></i>';
                status.style.color = 'green'; // Online icon color
                status.setAttribute('data-tooltip', 'Internet is connected');
                status.parentElement.classList.add('online');
                status.parentElement.classList.remove('offline');
            } else {
                status.innerHTML = '<i class="fas fa-wifi-slash"></i>';
                status.style.color = 'red'; // Offline icon color
                status.setAttribute('data-tooltip', 'No internet connection');
                status.parentElement.classList.add('offline');
                status.parentElement.classList.remove('online');
                this.showNotification('Internet connection lost', 'error');
            }
        };
    
        const addTooltipEvent = () => {
            const status = document.getElementById('internetStatus');
            status.addEventListener('mouseenter', () => {
                const tooltipMessage = status.getAttribute('data-tooltip');
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.innerText = tooltipMessage;
                document.body.appendChild(tooltip);
    
                // Get the dimensions of the icon and tooltip
                const rect = status.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
    
                // Default position: left-aligned, below the icon
                let left = rect.left + window.scrollX;
                let top = rect.bottom + window.scrollY + 5;
    
                // Adjust if tooltip goes out of viewport
                if (left + tooltipRect.width > window.innerWidth) {
                    left = window.innerWidth - tooltipRect.width - 10; // Keep some margin from the right
                }
                if (left < 0) {
                    left = 10; // Margin from the left
                }
    
                // Set the tooltip's position
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
    
                // Remove tooltip on mouse leave
                status.addEventListener('mouseleave', () => {
                    document.body.removeChild(tooltip);
                }, { once: true });
            });
        };
    
        window.addEventListener('online', updateInternetStatus);
        window.addEventListener('offline', updateInternetStatus);
        updateInternetStatus(); // Initial check
        addTooltipEvent(); // Initialize tooltip events
    }
    

    async initialize() {
        try {
            let peerId = localStorage.getItem('peerId');
            if (!peerId) {
                peerId = Math.floor(100000 + Math.random() * 900000).toString();
                localStorage.setItem('peerId', peerId);
            }

            this.peer = new Peer(peerId, {
                debug: 2
            });

            this.peer.on('open', (id) => {
                document.getElementById('localId').textContent = id;
                this.showNotification('Ready to connect', 'info');
            });

            this.setupPeerHandlers();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showNotification('Failed to initialize connection', 'error');
        }
    }

    // Update the refresh ID functionality
    refreshId() {
        localStorage.removeItem('peerId');
        location.reload(); // Refresh the whole page
    }

    showNotification(message, type = 'info', title = '') {
        const container = document.querySelector('.notification-container') || 
            (() => {
                const cont = document.createElement('div');
                cont.className = 'notification-container';
                document.body.appendChild(cont);
                return cont;
            })();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getNotificationIcon(type);
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Handle close button
        notification.querySelector('.notification-close').onclick = () => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        };

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    // Update file transfer methods
    async sendFile(file) {
        if (!this.connection) {
            this.showNotification('No active connection', 'error');
            return;
        }

        try {
            this.showNotification('Sending file...', 'info');
            
            // Send file info first
            this.connection.send({
                type: 'file-info',
                name: file.name,
                size: file.size,
                fileType: file.type
            });

            // Store file for sending after acceptance
            this.pendingFile = file;

        } catch (error) {
            console.error('Send file error:', error);
            this.showNotification('Failed to send file', 'error');
        }
    }

    setupConnectionHandlers() {
        if (!this.connection) return;

        this.connection.on('open', () => {
            console.log('Connection established');
            
            // Update connection status
            const connectionStatus = document.getElementById('connectionStatus');
            connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
            connectionStatus.style.display = 'block';
            connectionStatus.classList.add('connected');

            // Enable controls based on role
            if (this.isHost) {
                // Host controls
                document.getElementById('shareScreen').disabled = false;
                document.getElementById('stopSharing').disabled = true;
                document.getElementById('sendFile').disabled = false;
                this.isControlling = false;
            } else {
                // Client controls
                document.getElementById('shareScreen').disabled = true;
                document.getElementById('stopSharing').disabled = true;
                document.getElementById('sendFile').disabled = true;
                this.isControlling = true;
            }

            // Show success notification
            this.showNotification('Connected successfully', 'success');
        });

        this.connection.on('close', () => {
            // Reset connection status
            const connectionStatus = document.getElementById('connectionStatus');
            connectionStatus.innerHTML = '';
            connectionStatus.style.display = 'none';
            connectionStatus.classList.remove('connected');

            // Disable all controls
            this.resetControls();
            
            // Show notification
            this.showNotification('Connection closed', 'warning');
        });

        this.connection.on('error', (err) => {
            // Update status on error
            const connectionStatus = document.getElementById('connectionStatus');
            connectionStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Connection Error';
            connectionStatus.style.display = 'block';
            connectionStatus.classList.add('error');

            // Disable controls
            this.resetControls();
            
            // Show error notification
            this.showNotification('Connection error occurred', 'error');
        });

        // File transfer handlers
        this.connection.on('data', async (data) => {
            if (data.type === 'file-info') {
                this.showFileReceivePrompt(data);
            }
            else if (data.type === 'file-accept') {
                await this.sendFileData(this.pendingFile);
            }
            else if (data.type === 'file-data') {
                await this.handleFileData(data);
            }
            else if (data.type === 'screen-share-stopped') {
                this.handleRemoteScreenShareStopped();
            }
        });
    }

    // Add method to reset controls
    resetControls() {
        document.getElementById('shareScreen').disabled = true;
        document.getElementById('stopSharing').disabled = true;
        document.getElementById('sendFile').disabled = true;
        document.getElementById('connectBtn').disabled = false;
    }

    showConnectionRequest(peerId) {
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'confirm-dialog fade-in';
        confirmDialog.innerHTML = `
            <div class="confirm-content">
                <div class="confirm-header">
                    <i class="fas fa-user-plus"></i>
                    <h3>Connection Request</h3>
                </div>
                <div class="confirm-body">
                    <p>Remote ID <strong>${peerId}</strong> wants to connect and control your screen.</p>
                </div>
                <div class="confirm-buttons">
                    <button id="acceptConnection" class="btn btn-success">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button id="rejectConnection" class="btn btn-danger">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        // Show notification
        this.showNotification('Incoming connection request...', 'info');

        // Handle accept button click
        document.getElementById('acceptConnection').addEventListener('click', async () => {
            try {
                if (this.pendingConnection) {
                    // Set the connection
                    this.connection = this.pendingConnection;
                    this.isHost = true;

                    // Send acceptance to the other side
                    this.connection.send({
                        type: 'connection-accepted'
                    });

                    // Setup connection handlers
                    this.setupConnectionHandlers();
                    
                    // Clear pending connection
                    this.pendingConnection = null;

                    // Update UI
                    this.showNotification('Connection accepted', 'success');
                    
                    // Remove dialog
                    confirmDialog.classList.add('fade-out');
                    setTimeout(() => confirmDialog.remove(), 300);

                    // Start screen sharing
                    await this.startScreenShare();
                }
            } catch (error) {
                console.error('Error accepting connection:', error);
                this.showNotification('Error accepting connection', 'error');
            }
        });

        // Handle reject button click
        document.getElementById('rejectConnection').addEventListener('click', () => {
            if (this.pendingConnection) {
                this.pendingConnection.close();
                this.pendingConnection = null;
                this.showNotification('Connection rejected', 'warning');
                confirmDialog.classList.add('fade-out');
                setTimeout(() => confirmDialog.remove(), 300);
            }
        });
    }

    async acceptConnection() {
        if (this.pendingConnection) {
            try {
                // Set the connection
                this.connection = this.pendingConnection;
                this.isHost = true;

                // Send acceptance to the other side
                this.connection.send({
                    type: 'connection-accepted'
                });

                // Setup connection handlers
                this.setupConnectionHandlers();
                
                // Clear pending connection
                this.pendingConnection = null;

                // Start screen sharing
                await this.startScreenShare();

            } catch (error) {
                console.error('Error accepting connection:', error);
                this.showNotification('Error accepting connection', 'error');
                this.resetConnection();
            }
        }
    }

    rejectConnection() {
        if (this.pendingConnection) {
            this.pendingConnection.close();
            this.pendingConnection = null;
            this.resetConnection();
        }
    }

    async connect(remoteId) {
        try {
            const connectBtn = document.getElementById('connectBtn');
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            
            this.showNotification('Connecting... Please wait', 'info');
            
            this.connection = this.peer.connect(remoteId);
            this.isHost = false;

            this.connection.on('open', () => {
                this.showNotification('Waiting for receiver to accept...', 'info');
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Waiting...';
            });

            this.connection.on('data', (data) => {
                if (data.type === 'connection-accepted') {
                    this.showNotification('Connected successfully!', 'success');
                    connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                    connectBtn.disabled = true;
                    
                    document.getElementById('shareScreen').disabled = false;
                    document.getElementById('sendFile').disabled = false;
                    
                    this.setupConnectionHandlers();
                }
            });

            this.connection.on('error', (err) => {
                this.showNotification('Connection failed', 'error');
                connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
                connectBtn.disabled = false;
                this.resetConnection();
            });

        } catch (err) {
            this.showNotification('Failed to connect. Please try again.', 'error');
            const connectBtn = document.getElementById('connectBtn');
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
            connectBtn.disabled = false;
            this.resetConnection();
        }
    }

    setupPeerHandlers() {
        this.peer.on('error', (error) => {
            if (error.type === 'unavailable-id') {
                // If ID is taken, generate a new one
                const newId = Math.floor(100000 + Math.random() * 900000).toString();
                this.peer.reconnect(newId);
            } else {
                console.error('Peer error:', error);
            }
        });

        this.peer.on('connection', (conn) => {
            this.pendingConnection = conn;
            this.showConnectionRequest(conn.peer);
        });

        this.peer.on('call', (call) => {
            // Only answer if we've accepted the connection
            if (this.connection && call.peer === this.connection.peer) {
                call.answer();
                call.on('stream', (stream) => {
                    this.remoteStream = stream;
                    this.displayRemoteStream();
                });
            }
        });
    }

    async shareScreen() {
        try {
            // Check if it's a mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobile) {
                // Mobile screen sharing options
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        mandatory: {
                            mediaSource: 'screen',
                            maxWidth: 1280,
                            maxHeight: 720,
                            maxFrameRate: 30
                        }
                    },
                    audio: false
                });
            } else {
                // Desktop screen sharing options
                this.localStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { 
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false
                });
            }

            // Make the call to the remote peer
            if (this.connection && this.connection.peer) {
                const call = this.peer.call(this.connection.peer, this.localStream);
                
                // Handle stream end
                this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
                    this.stopSharing();
                });

                // Update UI
                document.getElementById('stopSharing').disabled = false;
                document.getElementById('shareScreen').disabled = true;
                
                // Show the video element
                const remoteVideo = document.getElementById('remoteVideo');
                remoteVideo.style.display = 'block';
                document.getElementById('noShare').style.display = 'none';
            }
        } catch (err) {
            console.error('Screen sharing failed:', err);
            if (err.name === 'NotAllowedError') {
                alert('Please grant screen sharing permission');
            } else if (err.name === 'NotSupportedError') {
                alert('Screen sharing is not supported on this device/browser');
            } else {
                alert('Failed to start screen sharing. Please try again.');
            }
        }
    }

    stopSharing() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        // Reset video display
        const video = document.getElementById('remoteVideo');
        const noShare = document.getElementById('noShare');
        video.srcObject = null;
        video.style.display = 'none';
        noShare.style.display = 'block';

        // Reset buttons
        document.getElementById('stopSharing').disabled = true;
        document.getElementById('shareScreen').disabled = !this.connection;

        // Show stop sharing notification
        this.showNotification('Screen sharing stopped', 'warning');

        // If we're connected, notify the other peer
        if (this.connection) {
            this.connection.send({
                type: 'screen-share-stopped'
            });
        }
    }

    handleRemoteScreenShareStopped() {
        // Reset video display
        const video = document.getElementById('remoteVideo');
        const noShare = document.getElementById('noShare');
        video.srcObject = null;
        video.style.display = 'none';
        noShare.style.display = 'block';

        // Show notification
        this.showNotification('Screen sharing stopped by remote peer', 'warning');
    }

    displayRemoteStream() {
        const video = document.getElementById('remoteVideo');
        const noShare = document.getElementById('noShare');
        
        if (this.remoteStream) {
            video.srcObject = this.remoteStream;
            video.style.display = 'block';
            noShare.style.display = 'none';

            // Ensure video plays
            video.play().catch(err => {
                console.error('Error playing video:', err);
            });
        }
    }

    // Add event emitter functionality
    emit(eventName) {
        const event = new CustomEvent(eventName, { detail: this });
        window.dispatchEvent(event);
    }

    on(eventName, callback) {
        window.addEventListener(eventName, (e) => callback(e.detail));
    }

    async sendFile(file) {
        if (!this.connection) {
            this.showNotification('No active connection', 'error');
            return;
        }

        try {
            this.showNotification('Sending file...', 'info');
            
            // Send file info first
            this.connection.send({
                type: 'file-info',
                name: file.name,
                size: file.size,
                fileType: file.type
            });

            // Store file for sending after acceptance
            this.pendingFile = file;

        } catch (error) {
            console.error('Send file error:', error);
            this.showNotification('Failed to send file', 'error');
        }
    }

    showDownloadPrompt(fileName, blob) {
        const popup = document.createElement('div');
        popup.className = 'popup-message info';
        popup.innerHTML = `
            <div class="popup-content">
                <i class="fas fa-file-download popup-icon"></i>
                <div class="popup-text">
                    <p>Received File:</p>
                    <p><strong>${fileName}</strong></p>
                    <div class="popup-buttons">
                        <button class="btn btn-success" id="downloadFileBtn">
                            <i class="fas fa-download"></i> Download
                        </button>
                        <button class="btn btn-danger" id="cancelFileBtn">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Handle download button
        document.getElementById('downloadFileBtn').onclick = () => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            popup.remove();
            this.showNotification('File downloaded successfully!', 'success');
        };

        // Handle cancel button
        document.getElementById('cancelFileBtn').onclick = () => {
            popup.remove();
            this.showNotification('Download cancelled', 'warning');
        };
    }

    handleRemoteMouseMove(data) {
        if (!this.isControlling) {
            const { x, y } = data;
            const screenWidth = window.screen.width;
            const screenHeight = window.screen.height;
            
            const absoluteX = Math.round(x * screenWidth);
            const absoluteY = Math.round(y * screenHeight);
            
            this.simulateMouseMove(absoluteX, absoluteY);
        }
    }

    handleRemoteMouseClick(data) {
        if (!this.isControlling) {
            const { x, y } = data;
            const screenWidth = window.screen.width;
            const screenHeight = window.screen.height;
            
            const absoluteX = Math.round(x * screenWidth);
            const absoluteY = Math.round(y * screenHeight);
            
            this.simulateMouseClick(absoluteX, absoluteY);
        }
    }

    handleRemoteKeyPress(data) {
        if (!this.isControlling) {
            const { key } = data;
            this.simulateKeyPress(key);
        }
    }

    enableControls() {
        document.getElementById('shareScreen').disabled = false;
        document.getElementById('sendFile').disabled = false;
        
        // Reset the receive area
        this.resetReceiveArea();
        
        // Show ready status
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.textContent = 'Connected and ready for file transfer';
        statusDiv.style.display = 'block';
    }

    simulateMouseMove(x, y) {
        console.log('Mouse move:', x, y);
    }

    simulateMouseClick(x, y) {
        console.log('Mouse click:', x, y);
    }

    simulateKeyPress(key) {
        console.log('Key press:', key);
    }

    generateDigitId() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    splitArrayBuffer(buffer, chunkSize) {
        const chunks = [];
        let offset = 0;
        
        while (offset < buffer.byteLength) {
            chunks.push(buffer.slice(offset, offset + chunkSize));
            offset += chunkSize;
        }
        
        return chunks;
    }

    // Add these new methods to handle file sharing
    enableFileSharing() {
        const sendFileBtn = document.getElementById('sendFile');
        sendFileBtn.disabled = false;
        
        // Reset the file receive area
        this.resetReceiveArea();
        
        // Show ready status
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.textContent = 'Connected and ready for file transfer';
        statusDiv.style.display = 'block';
    }

    handleFileRejection() {
        alert('File transfer was rejected by the receiver');
        this.pendingFileTransfer = null;
        this.resetReceiveArea();
    }

    resetFileTransfer() {
        this.pendingFileTransfer = null;
        this.currentFileTransfer = null;
        this.resetReceiveArea();
        
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.style.display = 'none';
    }

    emitFileEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    // Add this method to check device type
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    resetReceiveArea() {
        const receiveArea = document.getElementById('fileReceiveArea');
        const infoDiv = receiveArea.querySelector('.incoming-file-info');
        const acceptBtn = document.getElementById('acceptFile');
        const rejectBtn = document.getElementById('rejectFile');

        // Reset info text
        infoDiv.innerHTML = '<p>No incoming files</p>';

        // Hide buttons
        acceptBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    }

    // Add this method to handle connection errors
    handleConnectionError(error) {
        const connectionStatus = document.getElementById('connectionStatus');
        connectionStatus.textContent = `Connection error: ${error.message}`;
        connectionStatus.style.display = 'block';
        
        setTimeout(() => {
            connectionStatus.style.display = 'none';
        }, 3000);
    }

    async startScreenShare() {
        const connectionStatus = document.getElementById('connectionStatus');
        connectionStatus.textContent = 'Starting screen share...';

        try {
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });

            if (this.connection && this.connection.peer) {
                const call = this.peer.call(this.connection.peer, this.localStream);
                
                this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
                    this.stopSharing();
                });

                // Update UI
                document.getElementById('stopSharing').disabled = false;
                document.getElementById('shareScreen').disabled = true;
                connectionStatus.textContent = 'Screen sharing active';
            }
        } catch (err) {
            console.error('Screen sharing failed:', err);
            connectionStatus.textContent = 'Screen sharing failed';
            setTimeout(() => {
                connectionStatus.textContent = 'Connected';
            }, 3000);
        }
    }

    resetConnection() {
        // Reset all connection-related states
        this.connection = null;
        this.pendingConnection = null;
        this.isHost = false;
        this.isControlling = false;
        
        // Reset UI
        document.getElementById('shareScreen').disabled = true;
        document.getElementById('sendFile').disabled = true;
        document.getElementById('stopSharing').disabled = true;
        
        // Reset video display
        const video = document.getElementById('remoteVideo');
        const noShare = document.getElementById('noShare');
        video.srcObject = null;
        video.style.display = 'none';
        noShare.style.display = 'block';
    }

    // Helper method to get notification icon
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    // Add method to show file in list
    addFileToList(fileName, blob) {
        let fileList = document.getElementById('receivedFiles');
        if (!fileList) {
            fileList = document.createElement('div');
            fileList.id = 'receivedFiles';
            fileList.className = 'received-files';
            document.querySelector('.file-receive-area').appendChild(fileList);
        }
        fileList.style.display = 'block';

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <i class="fas fa-file"></i>
            <span>${fileName}</span>
            <button class="download-btn">
                <i class="fas fa-download"></i>
            </button>
        `;

        fileList.appendChild(fileItem);

        // Handle download
        const url = URL.createObjectURL(blob);
        fileItem.querySelector('.download-btn').onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        this.showNotification('File received successfully!', 'success');
    }
}



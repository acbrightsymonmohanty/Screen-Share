class PeerConnection {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isControlling = false;
        this.isHost = false;
        this.pendingConnection = null;
        this.initialize();
    }

    async initialize() {
        // Generate a 6-digit random ID
        const randomId = Math.floor(100000 + Math.random() * 900000).toString();
        
        this.peer = new Peer(randomId, {
            debug: 2
        });
        
        this.peer.on('open', (id) => {
            document.getElementById('localId').textContent = id;
        });

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

    showConnectionRequest(peerId) {
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'confirm-dialog';
        confirmDialog.innerHTML = `
            <div class="confirm-content">
                <h3>Connection Request</h3>
                <p>Remote ID ${peerId} wants to connect and control your screen.</p>
                <div class="confirm-buttons">
                    <button id="acceptConnection" class="btn btn-success">Accept</button>
                    <button id="rejectConnection" class="btn btn-danger">Reject</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        document.getElementById('acceptConnection').onclick = () => {
            this.acceptConnection();
            document.body.removeChild(confirmDialog);
        };

        document.getElementById('rejectConnection').onclick = () => {
            this.rejectConnection();
            document.body.removeChild(confirmDialog);
        };
    }

    async acceptConnection() {
        if (this.pendingConnection) {
            this.connection = this.pendingConnection;
            this.isHost = true;
            this.setupConnectionHandlers();
            this.pendingConnection = null;

            // Start screen sharing immediately after accepting
            try {
                // Request screen share from user
                this.localStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { 
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false
                });

                // Once we have the stream, make the call
                if (this.connection && this.connection.peer) {
                    const call = this.peer.call(this.connection.peer, this.localStream);
                    
                    // Handle stream end
                    this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
                        this.stopSharing();
                    });

                    // Update UI
                    document.getElementById('stopSharing').disabled = false;
                    document.getElementById('shareScreen').disabled = true;
                }
            } catch (err) {
                console.error('Screen sharing failed:', err);
                alert('Failed to start screen sharing. The connection will continue without screen share.');
            }
        }
    }

    rejectConnection() {
        if (this.pendingConnection) {
            this.pendingConnection.close();
            this.pendingConnection = null;
        }
    }

    async connect(remoteId) {
        try {
            this.connection = this.peer.connect(remoteId);
            this.isHost = false;
            this.setupConnectionHandlers();
            document.getElementById('shareScreen').disabled = false;
            document.getElementById('sendFile').disabled = false;
        } catch (err) {
            console.error('Connection failed:', err);
            alert('Failed to connect. Please check the ID and try again.');
        }
    }

    setupConnectionHandlers() {
        this.connection.on('open', () => {
            console.log('Connection established');
            
            if (this.isHost) {
                // Host can't control their own screen
                this.isControlling = false;
            } else {
                // Client gets control capabilities
                this.isControlling = true;
                // Request screen share from host if not already sharing
                if (!this.remoteStream) {
                    this.connection.send({
                        type: 'requestScreen'
                    });
                }
            }

            // Enable file sharing for both sides only after connection
            this.enableFileSharing();
            
            // Emit connected event for UI updates
            this.emit('connected');
        });

        this.connection.on('data', async (data) => {
            console.log('Received data:', data.type);
            
            switch(data.type) {
                case 'file-request':
                    this.handleFileRequest(data);
                    break;
                case 'file-accepted':
                    console.log('File accepted by receiver');
                    if (this.pendingFileTransfer) {
                        await this.startFileTransfer(this.pendingFileTransfer);
                    }
                    break;
                case 'file-rejected':
                    console.log('File rejected by receiver');
                    this.handleFileRejection();
                    break;
                case 'file-chunk':
                    await this.handleFileChunk(data);
                    break;
                case 'requestScreen':
                    this.shareScreen();
                    break;
                case 'mouseMove':
                    this.handleRemoteMouseMove(data);
                    break;
                case 'mouseClick':
                    this.handleRemoteMouseClick(data);
                    break;
                case 'keyPress':
                    this.handleRemoteKeyPress(data);
                    break;
            }
        });

        // Handle connection close
        this.connection.on('close', () => {
            this.stopSharing();
            this.resetFileTransfer();
            this.emit('disconnected');
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
            alert('No active connection. Please connect first.');
            return;
        }

        console.log('Sending file request:', file.name);

        // Send file request to receiver
        this.connection.send({
            type: 'file-request',
            name: file.name,
            size: file.size,
            type: file.type
        });

        // Store file for later
        this.pendingFileTransfer = file;

        // Update UI
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.textContent = `Waiting for receiver to accept ${file.name}...`;
        statusDiv.style.display = 'block';
    }

    handleFileRequest(data) {
        console.log('Received file request:', data);

        // Get UI elements
        const receiveArea = document.getElementById('fileReceiveArea');
        const infoDiv = receiveArea.querySelector('.incoming-file-info');
        const acceptBtn = document.getElementById('acceptFile');
        const rejectBtn = document.getElementById('rejectFile');

        // Show file request info
        infoDiv.innerHTML = `
            <div class="file-request">
                <i class="fas fa-file fa-2x"></i>
                <p><strong>New File Received:</strong></p>
                <p>${data.name}</p>
                <p>(${this.formatFileSize(data.size)})</p>
            </div>
        `;

        // Make sure buttons are visible
        acceptBtn.style.display = 'inline-block';
        rejectBtn.style.display = 'inline-block';

        // Handle accept button
        acceptBtn.onclick = () => {
            console.log('File request accepted');
            
            // Initialize transfer
            this.currentFileTransfer = {
                name: data.name,
                size: data.size,
                type: data.type,
                chunks: [],
                receivedSize: 0
            };

            // Hide buttons
            acceptBtn.style.display = 'none';
            rejectBtn.style.display = 'none';

            // Show status
            const statusDiv = document.getElementById('fileStatus');
            statusDiv.textContent = 'Starting file transfer...';
            statusDiv.style.display = 'block';

            // Tell sender we accepted
            this.connection.send({ type: 'file-accepted' });
        };

        // Handle reject button
        rejectBtn.onclick = () => {
            console.log('File request rejected');
            
            // Hide buttons
            acceptBtn.style.display = 'none';
            rejectBtn.style.display = 'none';

            // Reset info
            infoDiv.innerHTML = '<p>No incoming files</p>';

            // Tell sender we rejected
            this.connection.send({ type: 'file-rejected' });
        };
    }

    async startFileTransfer(file) {
        if (!file) return;

        try {
            const chunkSize = 16384; // 16KB chunks
            const fileReader = new FileReader();
            let offset = 0;

            fileReader.onload = (e) => {
                const chunk = e.target.result;
                this.connection.send({
                    type: 'file-chunk',
                    chunk: chunk,
                    index: offset / chunkSize,
                    total: Math.ceil(file.size / chunkSize)
                });

                offset += chunkSize;
                const progress = Math.min(100, Math.round((offset / file.size) * 100));
                
                document.getElementById('fileStatus').textContent = `Sending: ${progress}%`;

                if (offset < file.size) {
                    // Read next chunk
                    readNextChunk();
                } else {
                    // Transfer complete
                    document.getElementById('fileStatus').textContent = 'File sent successfully!';
                    setTimeout(() => {
                        document.getElementById('fileStatus').style.display = 'none';
                    }, 3000);
                }
            };

            const readNextChunk = () => {
                const slice = file.slice(offset, offset + chunkSize);
                fileReader.readAsArrayBuffer(slice);
            };

            // Start reading
            readNextChunk();
        } catch (error) {
            console.error('File transfer error:', error);
            document.getElementById('fileStatus').textContent = 'Error sending file';
        }
    }

    handleFileChunk(data) {
        if (!this.currentFileTransfer) return;

        try {
            // Store chunk
            this.currentFileTransfer.chunks[data.index] = new Uint8Array(data.chunk);
            this.currentFileTransfer.receivedSize++;

            // Update progress
            const progress = Math.round((this.currentFileTransfer.receivedSize / data.total) * 100);
            document.getElementById('fileStatus').textContent = `Receiving: ${progress}%`;
            document.getElementById('fileStatus').style.display = 'block';

            // Check if transfer is complete
            if (this.currentFileTransfer.receivedSize === data.total) {
                // Combine chunks and download
                const blob = new Blob(this.currentFileTransfer.chunks, {
                    type: this.currentFileTransfer.type || 'application/octet-stream'
                });

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.currentFileTransfer.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // Show success and reset
                document.getElementById('fileStatus').textContent = 'File received successfully!';
                setTimeout(() => {
                    document.getElementById('fileStatus').style.display = 'none';
                    document.querySelector('.incoming-file-info').innerHTML = '<p>No incoming files</p>';
                }, 3000);

                this.currentFileTransfer = null;
            }
        } catch (error) {
            console.error('Error handling chunk:', error);
            document.getElementById('fileStatus').textContent = 'Error receiving file';
        }
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
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
} 
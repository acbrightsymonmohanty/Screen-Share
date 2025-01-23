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
            this.enableControls();
            
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

            // Emit connected event for UI updates
            this.emit('connected');
        });

        this.connection.on('data', (data) => {
            if (data.type === 'requestScreen' && this.isHost) {
                // Start sharing screen when client requests it
                this.shareScreen();
            } else if (data.type === 'mouseMove') {
                this.handleRemoteMouseMove(data);
            } else if (data.type === 'mouseClick') {
                this.handleRemoteMouseClick(data);
            } else if (data.type === 'keyPress') {
                this.handleRemoteKeyPress(data);
            } else if (data.type === 'file') {
                this.handleIncomingFile(data);
            }
        });

        // Handle connection close
        this.connection.on('close', () => {
            this.stopSharing();
            this.emit('disconnected');
        });
    }

    async shareScreen() {
        try {
            if (!this.localStream) {
                this.localStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { 
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false
                });

                // Make the call to the remote peer
                if (this.connection && this.connection.peer) {
                    const call = this.peer.call(this.connection.peer, this.localStream);
                    
                    // Handle stream end
                    this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
                        this.stopSharing();
                    });
                }

                // Update UI
                document.getElementById('stopSharing').disabled = false;
                document.getElementById('shareScreen').disabled = true;
            }
        } catch (err) {
            console.error('Screen sharing failed:', err);
            alert('Failed to start screen sharing');
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
        const maxChunkSize = 16384; // 16KB chunks
        const reader = new FileReader();
        
        reader.onload = async () => {
            const buffer = reader.result;
            const chunks = this.splitArrayBuffer(buffer, maxChunkSize);
            
            this.connection.send({
                type: 'file-meta',
                name: file.name,
                size: file.size,
                totalChunks: chunks.length
            });

            for (let i = 0; i < chunks.length; i++) {
                this.connection.send({
                    type: 'file-chunk',
                    chunk: chunks[i],
                    index: i
                });

                const progress = Math.round(((i + 1) / chunks.length) * 100);
                document.getElementById('fileStatus').textContent = 
                    `Sending ${file.name}: ${progress}%`;
            }
        };

        reader.readAsArrayBuffer(file);
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

    handleIncomingFile(data) {
        if (data.type === 'file-meta') {
            this.currentFileTransfer = {
                name: data.name,
                size: data.size,
                chunks: new Array(data.totalChunks),
                receivedChunks: 0
            };
            document.getElementById('fileStatus').textContent = 
                `Receiving ${data.name}: 0%`;
            document.getElementById('fileStatus').style.display = 'block';
        }
        else if (data.type === 'file-chunk') {
            this.currentFileTransfer.chunks[data.index] = data.chunk;
            this.currentFileTransfer.receivedChunks++;

            const progress = Math.round(
                (this.currentFileTransfer.receivedChunks / 
                this.currentFileTransfer.chunks.length) * 100
            );
            document.getElementById('fileStatus').textContent = 
                `Receiving ${this.currentFileTransfer.name}: ${progress}%`;

            if (this.currentFileTransfer.receivedChunks === 
                this.currentFileTransfer.chunks.length) {
                this.completeFileTransfer();
            }
        }
    }

    completeFileTransfer() {
        const fileBlob = new Blob(this.currentFileTransfer.chunks);
        const url = URL.createObjectURL(fileBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = this.currentFileTransfer.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        document.getElementById('fileStatus').textContent = 
            `${this.currentFileTransfer.name} received successfully!`;
        setTimeout(() => {
            document.getElementById('fileStatus').style.display = 'none';
        }, 3000);

        this.currentFileTransfer = null;
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
        document.getElementById('fileStatus').textContent = 'Connected and ready for file transfer';
        document.getElementById('fileStatus').style.display = 'block';
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
} 
class PeerConnection {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isControlling = false;
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
            this.connection = conn;
            this.setupConnectionHandlers();
        });

        this.peer.on('call', (call) => {
            call.answer();
            call.on('stream', (stream) => {
                this.remoteStream = stream;
                this.displayRemoteStream();
            });
        });
    }

    async connect(remoteId) {
        try {
            this.connection = this.peer.connect(remoteId);
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
            this.isControlling = true;
        });

        this.connection.on('data', (data) => {
            if (data.type === 'mouseMove') {
                this.handleRemoteMouseMove(data);
            } else if (data.type === 'mouseClick') {
                this.handleRemoteMouseClick(data);
            } else if (data.type === 'keyPress') {
                this.handleRemoteKeyPress(data);
            } else if (data.type === 'file') {
                this.handleIncomingFile(data);
            }
        });
    }

    async shareScreen() {
        try {
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });

            const call = this.peer.call(this.connection.peer, this.localStream);
            
            this.localStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopSharing();
            });

            document.getElementById('stopSharing').disabled = false;
            document.getElementById('shareScreen').disabled = true;
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
        document.getElementById('stopSharing').disabled = true;
        document.getElementById('shareScreen').disabled = false;
    }

    displayRemoteStream() {
        const video = document.getElementById('remoteVideo');
        const noShare = document.getElementById('noShare');
        
        video.srcObject = this.remoteStream;
        video.style.display = 'block';
        noShare.style.display = 'none';
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
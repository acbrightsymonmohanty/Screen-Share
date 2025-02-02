document.addEventListener('DOMContentLoaded', () => {
    const startShareBtn = document.getElementById('startShare');
    const stopShareBtn = document.getElementById('stopShare');
    const screenVideo = document.getElementById('screenVideo');
    const noShareMessage = document.getElementById('noShare');

    let screenStream = null;

    // Function to start screen sharing
    async function startScreenShare() {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                },
                audio: false
            });

            screenVideo.srcObject = screenStream;
            screenVideo.style.display = 'block';
            noShareMessage.style.display = 'none';
            
            // Enable stop button and disable start button
            startShareBtn.disabled = true;
            stopShareBtn.disabled = false;

            // Handle stream ending (user stops sharing)
            screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenShare();
            });

        } catch (err) {
            console.error("Error sharing screen:", err);
            alert("Error sharing screen. Please try again.");
        }
    }

    // Function to stop screen sharing
    function stopScreenShare() {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
        
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
        noShareMessage.style.display = 'block';
        
        // Reset buttons
        startShareBtn.disabled = false;
        stopShareBtn.disabled = true;
    }

    // Event listeners
    startShareBtn.addEventListener('click', startScreenShare);
    stopShareBtn.addEventListener('click', stopScreenShare);

    // Handle errors
    screenVideo.addEventListener('error', (e) => {
        console.error("Video error:", e);
        stopScreenShare();
        alert("An error occurred with the video stream.");
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

    // Add this to handle file transfer progress
    function updateFileStatus(message) {
        const statusElement = document.getElementById('fileStatus');
        statusElement.textContent = message;
        statusElement.style.display = 'block';
    }

    // Add event listener for file transfer completion
    window.addEventListener('fileTransferComplete', (e) => {
        const { fileName, type, fileUrl } = e.detail;
        const statusDiv = document.getElementById('fileStatus');
        statusDiv.textContent = `${type === 'send' ? 'Sent' : 'Received'}: ${fileName}`;
        
        if (type === 'receive') {
            const fileLink = document.createElement('a');
            fileLink.href = fileUrl;
            fileLink.textContent = fileName;
            fileLink.download = fileName;
            fileLink.className = 'received-file-link';
            document.getElementById('receivedFiles').appendChild(fileLink);
        }

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    });

    // Add event listener for file request
    window.addEventListener('fileRequest', (e) => {
        const { name, size } = e.detail;
        const receiveArea = document.getElementById('fileReceiveArea');
        const infoDiv = receiveArea.querySelector('.incoming-file-info');
        const acceptBtn = document.getElementById('acceptFile');
        const rejectBtn = document.getElementById('rejectFile');

        // Show file request info
        infoDiv.innerHTML = `
            <div class="file-request">
                <i class="fas fa-file fa-2x"></i>
                <p><strong>New File Received:</strong></p>
                <p>${name}</p>
                <p>(${peerConnection.formatFileSize(size)})</p>
            </div>
        `;

        // Make sure buttons are visible
        acceptBtn.style.display = 'inline-block';
        rejectBtn.style.display = 'inline-block';

        // Handle accept button
        acceptBtn.onclick = () => {
            console.log('File request accepted');
            
            // Initialize transfer
            peerConnection.currentFileTransfer = {
                name: name,
                size: size,
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
            peerConnection.connection.send({ type: 'file-accepted' });
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
            peerConnection.connection.send({ type: 'file-rejected' });
        };
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const peerConnection = new PeerConnection();

    const fileInput = document.getElementById('fileInput');
    const sendFileBtn = document.getElementById('sendFile');
    const fileStatus = document.getElementById('fileStatus');
    const fileReceiveArea = document.getElementById('fileReceiveArea');
    const acceptFileBtn = document.getElementById('acceptFile');
    const rejectFileBtn = document.getElementById('rejectFile');
    const incomingFileInfo = fileReceiveArea.querySelector('.incoming-file-info p');

    let incomingFileData = null;

    // Enable file sharing when connected
    peerConnection.on('connected', () => {
        sendFileBtn.disabled = false;
    });

    // Disable file sharing when disconnected
    peerConnection.on('disconnected', () => {
        sendFileBtn.disabled = true;
    });

    // Handle send file button click
    sendFileBtn.addEventListener('click', () => {
        if (peerConnection.connection) {
            fileInput.click();
        } else {
            alert('Please connect to a peer first');
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const fileMetadata = {
                name: file.name,
                size: file.size,
                type: file.type,
            };

            console.log('Sending file metadata:', fileMetadata);
            peerConnection.connection.send({
                type: 'fileMetadata',
                data: fileMetadata,
            });

            fileStatus.textContent = `Waiting for recipient to accept: ${file.name}`;
            fileStatus.style.display = 'block';

            peerConnection.on('fileTransferAccepted', () => {
                console.log('Recipient accepted the file transfer');
                fileStatus.textContent = `Sending file: ${file.name}`;
                peerConnection.sendFile(file);
            });

            peerConnection.on('fileTransferRejected', () => {
                console.log('Recipient rejected the file transfer');
                fileStatus.textContent = 'File transfer was rejected';
                setTimeout(() => {
                    fileStatus.style.display = 'none';
                }, 3000);
            });

            // Reset file input
            fileInput.value = '';
        }
    });

    // Handle incoming file metadata
    peerConnection.on('message', (message) => {
        if (message.type === 'fileMetadata') {
            incomingFileData = message.data;
            incomingFileInfo.textContent = `Incoming file: ${incomingFileData.name} (${(incomingFileData.size / 1024).toFixed(1)} KB)`;

            acceptFileBtn.style.display = 'inline-block';
            rejectFileBtn.style.display = 'inline-block';
        }
    });

    // Handle file accept
    acceptFileBtn.addEventListener('click', () => {
        if (incomingFileData) {
            peerConnection.connection.send({
                type: 'fileTransferAccepted',
            });

            acceptFileBtn.style.display = 'none';
            rejectFileBtn.style.display = 'none';
            incomingFileInfo.textContent = 'Receiving file...';

            // Handle file reception
            peerConnection.on('fileReceived', (file) => {
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();

                fileStatus.textContent = `File received: ${file.name}`;
                setTimeout(() => {
                    fileStatus.style.display = 'none';
                }, 3000);
            });
        }
    });

    // Handle file reject
    rejectFileBtn.addEventListener('click', () => {
        peerConnection.connection.send({
            type: 'fileTransferRejected',
        });

        incomingFileData = null;
        acceptFileBtn.style.display = 'none';
        rejectFileBtn.style.display = 'none';
        incomingFileInfo.textContent = 'No incoming files';
    });

    // Listen for file transfer completion
    window.addEventListener('fileTransferComplete', (e) => {
        const { fileName, type } = e.detail;
        fileStatus.textContent = `${type === 'send' ? 'Sent' : 'Received'}: ${fileName}`;
        setTimeout(() => {
            fileStatus.style.display = 'none';
        }, 3000);
    });
});

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
}); 
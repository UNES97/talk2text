import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.8.0";

let whisperPipeline;
let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
// Initialize the Whisper model
async function initializeWhisper() {
    try {
        whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        document.getElementById('loader').style.display = 'none';
    } catch (error) {
        console.error('Error loading model:', error);
        alert('Error loading the transcription model. Please try again.');
    }
}

async function convertAudioToArray(audioData) {
    // Create audio context
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create audio buffer from blob/file
    const arrayBuffer = await audioData.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    // Get the audio data
    const audioData16khz = await resampleAudio(audioBuffer, audioCtx, 16000);
    
    // Convert to float32 array
    return audioData16khz.getChannelData(0);
}

async function resampleAudio(audioBuffer, audioCtx, targetSampleRate) {
    const sourceSampleRate = audioBuffer.sampleRate;
    const sourceLength = audioBuffer.length;
    const targetLength = Math.round(sourceLength * targetSampleRate / sourceSampleRate);
    
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    
    return await offlineCtx.startRendering();
}

function updateTimer() {
    const now = Date.now();
    const diff = now - startTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    document.querySelector('#timer').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Initialize recording functionality
document.getElementById('startRecord').addEventListener('click', startRecording);
document.getElementById('stopRecord').addEventListener('click', stopRecording);

async function startRecording() {
    try {
        document.getElementById('transcriptionText').textContent = '';
        document.getElementById('resultSection').classList.add('hidden');

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await transcribeAudio(audioBlob);
        });

        mediaRecorder.start();
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        // Show recording indicator
        document.getElementById('recording-indicator').classList.remove('hidden');
        document.getElementById('idle-message').classList.add('hidden');
        document.getElementById('startRecord').classList.add('hidden');
        document.getElementById('stopRecord').classList.remove('hidden');
        document.getElementById('timer').classList.remove('hidden');
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Error accessing microphone. Please ensure you have granted permission.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        clearInterval(timerInterval);
        
        // Hide recording indicator
        document.getElementById('recording-indicator').classList.add('hidden');
        document.getElementById('startRecord').classList.remove('hidden');
        document.getElementById('stopRecord').classList.add('hidden');
        document.getElementById('timer').classList.add('hidden');
    }
}

async function transcribeAudio(audioFile) {
    try {
        // Clear previous content from transcription text and stop visualizer
        document.getElementById('transcriptionText').textContent = '';
        document.getElementById('resultSection').classList.add('hidden');

        document.getElementById('transciping').style.display = 'flex';
        
        // Convert audio to proper format
        const audioArray = await convertAudioToArray(audioFile);
        
        // Transcribe the audio using Whisper
        const result = await whisperPipeline(audioArray);
        
        document.getElementById('resultSection').classList.remove('hidden');
        document.getElementById('transcriptionText').textContent = result.text;
    } catch (error) {
        console.error('Transcription error:', error);
        alert('Error during transcription. Please try again.');
    } finally {
        document.getElementById('transciping').style.display = 'none';
    }
}

document.getElementById('audioFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        await transcribeAudio(file);
    }
});

document.getElementById('uploadTestAudio').addEventListener('click', async () => {
    try {
        const response = await fetch('/jfk.wav');
        const blob = await response.blob();
        await transcribeAudio(blob);
        
        // Update the audio player
        const audioPlayer = document.getElementById('testAudioPlayer');
        audioPlayer.src = URL.createObjectURL(blob);
    } catch (error) {
        console.error('Error loading test audio:', error);
        alert('Error loading test audio file.');
    }
});

initializeWhisper();
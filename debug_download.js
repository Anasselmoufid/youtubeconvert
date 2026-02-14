const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const YTDLP_PATH = path.join(process.cwd(), 'yt-dlp.exe');
const FFMPEG_PATH = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

// Mock getDownloadStream logic
function getDownloadStream(url, formatId, isAudioOnly = false) {
    if (isAudioOnly) {
        // Audio conversion to MP3
        const args = [
            '--ffmpeg-location', FFMPEG_PATH,
            '--no-playlist',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '-f', 'bestaudio',
            '-x', '--audio-format', 'mp3',
            '-o', '-',
            url
        ];
        const downloader = spawn(YTDLP_PATH, args);
        return { stream: downloader.stdout, process: downloader };
    } else {
        // UNIVERSAL VIDEO NORMALIZATION PIPELINE
        // 1. yt-dlp streams raw video+audio to stdout
        // 2. ffmpeg reads from stdin, re-encodes to H.264/AAC MP4, and writes to stdout

        const ytArgs = [
            '--no-playlist',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '-f', `${formatId}+bestaudio/best`,
            '-o', '-',
            url
        ];

        console.log('Spawning yt-dlp with args:', ytArgs.join(' '));
        const ytProcess = spawn(YTDLP_PATH, ytArgs);

        const ffmpegArgs = [
            '-i', 'pipe:0',             // Read from stdin
            '-c:v', 'libx264',          // Force H.264 video
            '-preset', 'ultrafast',     // Fast encoding for streaming
            '-pix_fmt', 'yuv420p',      // Compatible pixel format
            '-c:a', 'aac',              // Force AAC audio
            '-f', 'mp4',                // Output container
            '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart', // Fragmented MP4 for streaming
            'pipe:1'                    // Output to stdout
        ];

        console.log('Spawning ffmpeg with args:', ffmpegArgs.join(' '));
        const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs);

        // Pipe yt-dlp output to ffmpeg input
        ytProcess.stdout.pipe(ffmpegProcess.stdin);

        // Handle errors to prevent zombie processes
        ytProcess.on('error', (err) => console.error('yt-dlp error:', err));
        ffmpegProcess.on('error', (err) => console.error('ffmpeg error:', err));

        ytProcess.stderr.on('data', (data) => console.error(`yt-dlp stderr: ${data}`));
        ffmpegProcess.stderr.on('data', (data) => console.error(`ffmpeg stderr: ${data}`));

        ytProcess.on('close', (code) => {
            if (code !== 0) console.error(`yt-dlp exited with code ${code}`);
        });

        return {
            stream: ffmpegProcess.stdout,
            process: ffmpegProcess,
            secondaryProcess: ytProcess
        };
    }
}

// Test Run
const testUrl = 'https://www.facebook.com/watch/?v=10153231379946729';
const formatId = 'sd';

console.log(`Testing download for: ${testUrl}`);

try {
    const { stream, process: proc } = getDownloadStream(testUrl, formatId, false);
    const outputPath = path.join(process.cwd(), 'debug_output.js.mp4');
    const fileStream = fs.createWriteStream(outputPath);

    stream.pipe(fileStream);

    stream.on('end', () => {
        console.log('Download complete!');
        proc.kill();
    });

    stream.on('error', (err) => {
        console.error('Stream error:', err);
    });

} catch (e) {
    console.error('Setup error:', e);
}

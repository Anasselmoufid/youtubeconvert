import { getDownloadStream } from './lib/downloader';
import fs from 'fs';
import path from 'path';

// Test URLs (replace with a real one if needed, or use a known tricky one)
// Using a generic public video for testing
const testUrl = 'https://www.facebook.com/watch/?v=10153231379946729';
const formatId = 'sd'; // Common FB format ID

async function run() {
    console.log(`Testing download for: ${testUrl}`);

    try {
        const { stream, process: proc } = getDownloadStream(testUrl, formatId, false);
        const outputPath = path.join(process.cwd(), 'debug_output.mp4');
        const fileStream = fs.createWriteStream(outputPath);

        stream.pipe(fileStream);

        stream.on('end', () => {
            console.log('Download complete!');
            proc.kill();
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err);
        });

        proc.stderr?.on('data', (data) => {
            console.log(`[ffmpeg/yt-dlp stderr]: ${data.toString()}`);
        });

    } catch (e) {
        console.error('Setup error:', e);
    }
}

run();

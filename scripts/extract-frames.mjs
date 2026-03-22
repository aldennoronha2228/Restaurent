import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Get ffmpeg binary path from ffmpeg-static
const ffmpegPath = require('ffmpeg-static');

const inputVideo = join(__dirname, '../public/hotel_bg.mp4');
const outputDir = join(__dirname, '../public/frames');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log('ffmpeg binary:', ffmpegPath);
console.log('Extracting frames from:', inputVideo);
console.log('Output directory:', outputDir);

// First get video duration
let duration = 10;
try {
  // Use ffmpeg to probe duration
  const probe = execFileSync(ffmpegPath, [
    '-i', inputVideo,
    '-f', 'null', '-'
  ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (err) {
  const match = err.stderr?.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
  if (match) {
    duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
    console.log('Video duration:', duration, 'seconds');
  }
}

// Extract 60 frames evenly spaced across the video
const numFrames = 60;
const fps = numFrames / duration;

console.log(`Extracting ${numFrames} frames at ${fps.toFixed(2)} fps...`);

execFileSync(ffmpegPath, [
  '-i', inputVideo,
  '-vf', `fps=${fps},scale=1920:-1`,   // scale to 1920px wide, maintain aspect ratio
  '-vframes', String(numFrames),
  '-q:v', '3',                          // JPEG quality (2=best, 31=worst, 3 is high quality)
  '-f', 'image2',
  join(outputDir, 'frame_%03d.jpg')
], { stdio: 'inherit' });

console.log(`\n✅ Done! ${numFrames} frames extracted to public/frames/`);
console.log('Frame files: frame_001.jpg to frame_060.jpg');

const fs = require('fs');
const { spawnSync } = require('child_process');

async function generate() {
  const text = fs.readFileSync('vo/script.txt', 'utf8');
  console.log('Script loaded, text length:', text.length, 'characters');
  console.log('Lines:', text.split('\n').length);

  // Use ffmpeg to create a silent placeholder with the right duration
  // The script is ~21 minutes of narration at ~150 words/minute
  // Let's estimate 20 minutes = 1200 seconds of silence
  const duration = '00:20:00';

  console.log('Creating silent placeholder audio file...');

  const result = spawnSync('ffmpeg', [
    '-f', 'lavfi',
    '-i', `anullsrc=r=48000:cl=stereo`,
    '-t', duration,
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    'public/vo/voice_silent.mp3'
  ], { encoding: 'buffer' });

  if (result.status !== 0) {
    console.error('FFmpeg error:', result.stderr.toString());
    process.exit(1);
  }

  fs.renameSync('public/vo/voice_silent.mp3', 'public/vo/voice.mp3');

  console.log('Silent placeholder created: public/vo/voice.mp3');
  console.log('Duration:', duration);
  console.log('Note: Real TTS generation requires Azure/Edge API keys or a different TTS service.');
}

generate().catch(console.error);
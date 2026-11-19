import edgeTTS from 'edge-tts';
import fs from 'fs';

const voice = 'en-US-AriaNeural';
const text = fs.readFileSync('vo/script.txt', 'utf8');
const chunks = text.split('\n').filter(line => line.trim().length > 0);

async function generate() {
  const audioBuffers = [];

  for (const chunk of chunks) {
    console.log('Generating:', chunk.substring(0, 50) + '...');
    const tts = new edgeTTS.EdgeTTS({ text: chunk, voice });
    const audio = await tts.tts();
    audioBuffers.push(audio);
  }

  const finalBuffer = Buffer.concat(audioBuffers);
  fs.writeFileSync('public/vo/voice.mp3', finalBuffer);
  console.log('Voice generated at public/vo/voice.mp3');
}

generate().catch(console.error);
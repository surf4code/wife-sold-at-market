import { EdgeTTS } from 'edge-tts';
import fs from 'fs';

const voice = 'en-US-AriaNeural';
const text = fs.readFileSync('vo/script.txt', 'utf8');
const chunks = text.split('\n').filter(line => line.trim().length > 0);

async function generate() {
  const tts = new EdgeTTS({ voice, rate: '+2%' });
  const audioBuffers = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Generating chunk ${i + 1}/${chunks.length}...`);
    const audio = await tts.tts(chunks[i]);
    audioBuffers.push(audio);
  }

  const finalBuffer = Buffer.concat(audioBuffers);
  fs.writeFileSync('public/vo/voice.mp3', finalBuffer);
  console.log('Voice generated at public/vo/voice.mp3');
}

generate().catch(console.error);
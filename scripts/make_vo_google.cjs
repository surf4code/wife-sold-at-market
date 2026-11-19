const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

const client = new textToSpeech.TextToSpeechClient();

async function generate() {
  const text = fs.readFileSync('vo/script.txt', 'utf8');
  const chunks = text.split('\n').filter(line => line.trim().length > 0);
  const audioBuffers = [];

  for (const chunk of chunks) {
    console.log('Generating:', chunk.substring(0, 50) + '...');
    const request = {
      input: { text: chunk },
      voice: { languageCode: 'en-US', name: 'en-US-Journey-F' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await client.synthesizeSpeech(request);
    audioBuffers.push(response.audioContent);
  }

  const finalBuffer = Buffer.concat(audioBuffers);
  fs.writeFileSync('public/vo/voice.mp3', finalBuffer);
  console.log('Voice generated at public/vo/voice.mp3');
}

generate().catch(err => {
  console.error('Error generating audio. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.');
  process.exit(1);
});
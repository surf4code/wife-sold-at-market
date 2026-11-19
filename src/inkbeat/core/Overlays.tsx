// 2D Story Overlays: Era cards, character labels, speech bubbles, Akira cutaways
// Driven by vo/timings.json
import React from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";

export interface OverlayCue {
  index: number;
  text: string;
  file: string;
  start_ms: number;
  duration_ms: number;
  end_ms: number;
}

export interface TimingData {
  cues: OverlayCue[];
  total_ms: number;
}

// Load timings
let cachedTimings: TimingData | null = null;
export const loadTimings = (): TimingData => {
  if (cachedTimings) return cachedTimings;
  try {
    const fs = require('fs');
    const path = require('path');
    const timingsPath = path.join(process.cwd(), 'vo', 'timings.json');
    if (fs.existsSync(timingsPath)) {
      const data = JSON.parse(fs.readFileSync(timingsPath, 'utf8'));
      cachedTimings = { cues: data, total_ms: data[data.length - 1]?.end_ms ?? 0 };
      return cachedTimings;
    }
  } catch (e) {
    console.warn('Could not load timings:', e);
  }
  return { cues: [], total_ms: 0 };
};

// Era & Age Labels (top-left / top-centre)
const ERA_LABELS: Array<{ time_ms: number; text: string; position: 'tl' | 'tc' }> = [
  { time_ms: 0, text: '1801 / BIRMINGHAM, ENGLAND', position: 'tc' },
  { time_ms: 6000, text: '6 YEARS OLD', position: 'tl' },
  { time_ms: 15000, text: '11 YEARS OLD', position: 'tl' },
  { time_ms: 30000, text: 'YEARS PASS', position: 'tl' },
  { time_ms: 45000, text: '29 YEARS OLD', position: 'tl' },
  { time_ms: 60000, text: '1834 / 33 YEARS OLD', position: 'tc' },
  { time_ms: 75000, text: 'THURSDAY, NOON', position: 'tl' },
  { time_ms: 90000, text: 'YEARS PASS', position: 'tl' },
  { time_ms: 105000, text: '1841 / 40 YEARS OLD', position: 'tc' },
  { time_ms: 120000, text: '1851 / 50 YEARS OLD', position: 'tc' },
  { time_ms: 135000, text: '1852', position: 'tc' },
  { time_ms: 150000, text: '1869 / 68 YEARS OLD', position: 'tc' },
];

// Speech Bubbles (character name -> { time_ms, text })
const SPEECH_BUBBLES: Array<{ character: string; time_ms: number; text: string }> = [
  { character: 'YOU', time_ms: 30000, text: '"I WILL."' },
  { character: 'NED', time_ms: 55000, text: '"IT\'S HOW PEOPLE LIKE US DO IT."' },
  { character: 'DROVER', time_ms: 80000, text: '"FOUR."' },
  { character: 'NED', time_ms: 85000, text: '"SOLD!"' },
  { character: 'YOU', time_ms: 100000, text: '"…"' },
];

// Akira cues (from > AKIRA lines in script)
const AKIRA_CUES: Array<{ time_ms: number; text: string; expression: 'deadpan' | 'smirk' | 'wide-eyed' | 'none' }> = [
  { time_ms: 15000, text: 'Remember the market. It\'s going to be important. Unfortunately.', expression: 'deadpan' },
  { time_ms: 35000, text: 'Smithfield bargain. Divorce, but with livestock.', expression: 'smirk' },
  { time_ms: 50000, text: 'Spoiler: he did not ask Peg how it went for the wife.', expression: 'wide-eyed' },
  { time_ms: 65000, text: 'The dog was a bonus.', expression: 'deadpan' },
  { time_ms: 95000, text: '', expression: 'wide-eyed' }, // silent wide-eyed
  { time_ms: 120000, text: 'Eighteen years. Nine shillings. Still no refund.', expression: 'smirk' },
];

// Character label positions
const CHARACTER_LABELS: Record<string, { offset: [number, number, number]; side: 'left' | 'right' }> = {
  'YOU': { offset: [0, 2.2, 0], side: 'left' },
  'NED': { offset: [0, 2.3, 0], side: 'right' },
  'PEG': { offset: [0, 2.0, 0], side: 'right' },
  'SAM': { offset: [0, 2.1, 0], side: 'right' },
  'DROVER': { offset: [0, 2.3, 0], side: 'right' },
  'DAUGHTER': { offset: [0, 1.5, 0], side: 'left' },
  'SON': { offset: [0, 1.2, 0], side: 'left' },
  'THE DROVER': { offset: [0, 2.3, 0], side: 'right' },
};

// Akira cutaway component
export const AkiraCutaway: React.FC<{ text: string; expression: 'deadpan' | 'smirk' | 'wide-eyed' | 'none'; duration: number }> = ({
  text, expression, duration
}) => {
  const [w, h] = [1920, 1080];
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = w;
    canvas.height = h;

    // Sage background
    const bg = '#8fa88e';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Draw Akira character (vector cartoon female)
    const cx = w / 2;
    const cy = h / 2;
    const scale = 1.2;

    // Head
    ctx.fillStyle = '#f4d4b8'; // skin tone
    ctx.beginPath();
    ctx.ellipse(cx, cy - 100, 120 * scale, 140 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair (bun)
    ctx.fillStyle = '#3d2a22'; // espresso
    ctx.beginPath();
    ctx.ellipse(cx, cy - 220, 140 * scale, 80 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy - 240, 60 * scale, 50 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes based on expression
    ctx.fillStyle = '#3a2a24';
    const eyeY = cy - 130;
    const eyeSpacing = 50 * scale;

    if (expression === 'wide-eyed') {
      // Wide eyes
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 30 * scale, 40 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + eyeSpacing, eyeY, 30 * scale, 40 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'deadpan') {
      // Half-lidded
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 30 * scale, 20 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + eyeSpacing, eyeY, 30 * scale, 20 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'smirk') {
      // Slightly squinted
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 30 * scale, 25 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + eyeSpacing, eyeY, 30 * scale, 25 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal
      ctx.beginPath();
      ctx.ellipse(cx - eyeSpacing, eyeY, 30 * scale, 35 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + eyeSpacing, eyeY, 30 * scale, 35 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eye whites + pupils
    ctx.fillStyle = '#fbfbf7';
    const pupilY = eyeY + 5;
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing, pupilY, 15 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeSpacing, pupilY, 15 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing + 3, pupilY, 8 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeSpacing + 3, pupilY, 8 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlights
    ctx.fillStyle = '#fdfdfb';
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing - 8, eyeY - 8, 4 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeSpacing - 8, eyeY - 8, 4 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brows
    ctx.strokeStyle = '#3a2a24';
    ctx.lineWidth = 4 * scale;
    ctx.lineCap = 'round';
    if (expression === 'smirk') {
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - 30 * scale, eyeY - 60);
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 80, cx - eyeSpacing + 30 * scale, eyeY - 60);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing - 30 * scale, eyeY - 60);
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 80, cx + eyeSpacing + 30 * scale, eyeY - 60);
      ctx.stroke();
    } else if (expression === 'wide-eyed') {
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - 30 * scale, eyeY - 70);
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 90, cx - eyeSpacing + 30 * scale, eyeY - 70);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing - 30 * scale, eyeY - 70);
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 90, cx + eyeSpacing + 30 * scale, eyeY - 70);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - eyeSpacing - 30 * scale, eyeY - 65);
      ctx.quadraticCurveTo(cx - eyeSpacing, eyeY - 75, cx - eyeSpacing + 30 * scale, eyeY - 65);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + eyeSpacing - 30 * scale, eyeY - 65);
      ctx.quadraticCurveTo(cx + eyeSpacing, eyeY - 75, cx + eyeSpacing + 30 * scale, eyeY - 65);
      ctx.stroke();
    }

    // Nose
    ctx.strokeStyle = '#3a2a24';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 90);
    ctx.quadraticCurveTo(cx + 5, cy - 75, cx + 10, cy - 70);
    ctx.stroke();

    // Mouth
    if (expression === 'smirk') {
      ctx.strokeStyle = '#5b1e2e';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 20 * scale, cy - 20);
      ctx.quadraticCurveTo(cx + 10 * scale, cy, cx + 35 * scale, cy - 25);
      ctx.stroke();
    } else if (expression === 'wide-eyed') {
      ctx.strokeStyle = '#5b1e2e';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 25 * scale, cy - 30);
      ctx.quadraticCurveTo(cx, cy - 10, cx + 25 * scale, cy - 30);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#5b1e2e';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(cx - 15 * scale, cy - 10);
      ctx.quadraticCurveTo(cx, cy, cx + 15 * scale, cy - 10);
      ctx.stroke();
    }

    // Subtitle text
    if (text) {
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, h - 80);
    }
  }, [text, expression, duration, w, h]);

  return <canvas ref={canvasRef} width={w} height={h} style={{ position: 'absolute', inset: 0 }} />;
};

// Era/Age Label component
export const EraLabel: React.FC<{ text: string; position: 'tl' | 'tc' }> = ({ text, position }) => {
  const [w, h] = [1920, 1080];
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const padding = 24;
    ctx.font = 'bold 56px Georgia, serif';
    ctx.textAlign = position === 'tc' ? 'center' : 'left';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 56;

    const x = position === 'tc' ? w / 2 : padding;
    const y = padding + textHeight;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = textHeight + padding;
    const rectX = position === 'tc' ? w / 2 - rectWidth / 2 : 0;
    const rectY = 0;

    // Dark background with yellow outline
    ctx.fillStyle = '#1a1220';
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    ctx.strokeStyle = '#f4d43a';
    ctx.lineWidth = 3;
    ctx.strokeRect(rectX + 1.5, rectY + 1.5, rectWidth - 3, rectHeight - 3);

    // Text
    ctx.fillStyle = '#f4efe6';
    ctx.fillText(text, x, y + (position === 'tl' ? 0 : 0));
  }, [text, position, w, h]);

  return <canvas ref={canvasRef} width={w} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
};

// Speech Bubble component
export const SpeechBubble: React.FC<{
  character: string;
  text: string;
  characterPosition: [number, number, number];
  camera: THREE.Camera;
  worldToScreen: (v: THREE.Vector3) => [number, number];
}> = ({ character, text, characterPosition, camera, worldToScreen }) => {
  const [w, h] = [1920, 1080];
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // Project character head position to screen
    const worldPos = new THREE.Vector3(
      characterPosition[0],
      characterPosition[1] + 0.3, // above head
      characterPosition[2]
    );
    const [sx, sy] = worldToScreen(worldPos);

    if (sx < 0 || sx > w || sy < 0 || sy > h) return;

    const padding = 16;
    const maxWidth = 400;
    ctx.font = 'bold 32px Georgia, serif';
    ctx.textAlign = 'center';

    // Word wrap
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 40;
    const bubbleWidth = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2;
    const bubbleHeight = lines.length * lineHeight + padding * 2;
    const bubbleX = sx - bubbleWidth / 2;
    const bubbleY = sy - bubbleHeight - 40;

    // Bubble background
    ctx.fillStyle = '#fff8f0';
    ctx.strokeStyle = '#1a1220';
    ctx.lineWidth = 3;

    // Rounded rect with tail
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(bubbleX + r, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth - r, bubbleY);
    ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + r);
    ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - r);
    ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - r, bubbleY + bubbleHeight);

    // Tail
    const tailX = sx;
    ctx.lineTo(tailX + 20, bubbleY + bubbleHeight);
    ctx.lineTo(tailX, bubbleY + bubbleHeight + 20);
    ctx.lineTo(tailX - 20, bubbleY + bubbleHeight);

    ctx.lineTo(bubbleX + r, bubbleY + bubbleHeight);
    ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - r);
    ctx.lineTo(bubbleX, bubbleY + r);
    ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + r, bubbleY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#1a1220';
    lines.forEach((line, i) => {
      ctx.fillText(line, sx, bubbleY + padding + i * lineHeight + lineHeight * 0.3);
    });
  }, [character, text, characterPosition, camera, worldToScreen, w, h]);

  return <canvas ref={canvasRef} width={w} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
};

// Character Name Label
export const CharacterLabel: React.FC<{
  character: string;
  characterPosition: [number, number, number];
  camera: THREE.Camera;
  worldToScreen: (v: THREE.Vector3) => [number, number];
}> = ({ character, characterPosition, camera, worldToScreen }) => {
  const labelInfo = CHARACTER_LABELS[character];
  if (!labelInfo) return null;

  const [w, h] = [1920, 1080];
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    const worldPos = new THREE.Vector3(
      characterPosition[0] + labelInfo.offset[0],
      characterPosition[1] + labelInfo.offset[1],
      characterPosition[2] + labelInfo.offset[2]
    );
    const [sx, sy] = worldToScreen(worldPos);

    if (sx < 0 || sx > w || sy < 0 || sy > h) return;

    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    const metrics = ctx.measureText(character);
    const textWidth = metrics.width;
    const textHeight = 28;

    const padding = 12;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = textHeight + padding;
    const rectX = sx - rectWidth / 2;
    const rectY = sy - rectHeight - 8;

    // Dark background with yellow outline
    ctx.fillStyle = '#1a1220';
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    ctx.strokeStyle = '#f4d43a';
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX + 1, rectY + 1, rectWidth - 2, rectHeight - 2);

    // Text
    ctx.fillStyle = '#f4efe6';
    ctx.fillText(character, sx, sy - padding - 4);
  }, [character, characterPosition, camera, worldToScreen, w, h]);

  return <canvas ref={canvasRef} width={w} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
};

// Main Overlays component
export const Overlays: React.FC<{
  cam: THREE.Camera;
  characters: Array<{ id: string; position: [number, number, number] }>;
}> = ({ cam, characters }) => {
  const f = useCurrentFrame();
  const fps = 30;
  const t = f / fps;
  const currentMs = t * 1000;

  // World to screen projection
  const worldToScreen = (v: THREE.Vector3): [number, number] => {
    const v2 = v.clone().project(cam);
    return [
      (v2.x + 1) * 1920 / 2,
      (-v2.y + 1) * 1080 / 2
    ];
  };

  // Current Akira cue
  const currentAkira = AKIRA_CUES.filter(c => c.time_ms <= currentMs).pop();

  // Current era label
  const currentEra = ERA_LABELS.filter(e => e.time_ms <= currentMs).pop();

  // Active speech bubbles
  const activeBubbles = SPEECH_BUBBLES.filter(b => {
    const start = b.time_ms;
    const end = start + 4000; // 4 second display
    return currentMs >= start && currentMs <= end;
  });

  return (
    <>
      {/* Era / Age Labels */}
      {currentEra && <EraLabel text={currentEra.text} position={currentEra.position} />}

      {/* Akira Cutaway */}
      {currentAkira && currentAkira.expression !== 'none' && (
        <AkiraCutaway
          text={currentAkira.text}
          expression={currentAkira.expression}
          duration={3000}
        />
      )}

      {/* Speech Bubbles */}
      {activeBubbles.map(bubble => (
        <SpeechBubble
          key={`${bubble.character}-${bubble.time_ms}`}
          character={bubble.character}
          text={bubble.text}
          characterPosition={characters.find(c => c.id === bubble.character)?.position ?? [0, 0, 0]}
          camera={cam}
          worldToScreen={worldToScreen}
        />
      ))}

      {/* Character Name Labels */}
      {characters.map(char => (
        <CharacterLabel
          key={char.id}
          character={char.id}
          characterPosition={char.position}
          camera={cam}
          worldToScreen={worldToScreen}
        />
      ))}
    </>
  );
};

export default Overlays;
export type InterviewReview = {
  summary: string;
  strengths: string[];
  issues: { title: string; quote: string; reason: string; improvement: string; revisedAnswer: string }[];
  practice: string[];
};

// Resample each four-minute slice to mono PCM, keeping requests below 8 MB.
export function audioChunk(buffer: AudioBuffer, start: number, end: number): Blob {
  const rate = 16000;
  const count = Math.floor((end - start) * rate);
  const data = new ArrayBuffer(44 + count * 2);
  const view = new DataView(data);
  const write = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, count * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < count; i++) {
    const from = Math.floor((start + i / rate) * buffer.sampleRate);
    const to = Math.min(buffer.length, Math.max(from + 1, Math.floor((start + (i + 1) / rate) * buffer.sampleRate)));
    let value = 0;
    for (const channel of channels) for (let j = from; j < to; j++) value += channel[j];
    value = Math.max(-1, Math.min(1, value / (channels.length * (to - from))));
    view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
  }
  return new Blob([data], { type: "audio/wav" });
}

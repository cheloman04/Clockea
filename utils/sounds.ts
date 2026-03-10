function play(frequency: number, duration: number): void {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    // Close context after sound finishes to free resources
    osc.onended = () => ctx.close();
  } catch {
    // Silent failure on native or blocked browsers
  }
}

export function playClockInSound(): void {
  play(880, 0.15);
}

export function playClockOutSound(): void {
  play(440, 0.12);
}

type AudioEvent = { type: "start" | "crystal" | "hit" | "gameover" };
type RuntimeStats = { speed: number; level: number; combo: number; status: string };

type AudioContextConstructor = new () => AudioContext;

const getAudioContext = () => {
  const windowWithWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext || windowWithWebkit.webkitAudioContext;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private nextStepAt = 0;
  private step = 0;
  private tempo = 92;
  private unlocked = false;
  private readonly cleanup: Array<() => void> = [];

  constructor() {
    const onAudioEvent = (event: Event) => this.handleEvent((event as CustomEvent<AudioEvent>).detail);
    const onStats = (event: Event) => {
      const stats = (event as CustomEvent<RuntimeStats>).detail;
      if (stats) this.updateTempo(stats);
    };
    window.addEventListener("cosmic-game:audio", onAudioEvent);
    window.addEventListener("cosmic-game:update", onStats);
    this.cleanup.push(() => window.removeEventListener("cosmic-game:audio", onAudioEvent));
    this.cleanup.push(() => window.removeEventListener("cosmic-game:update", onStats));
  }

  unlock() {
    if (!this.context) {
      const Context = getAudioContext();
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.58;
      this.music = this.context.createGain();
      this.music.gain.value = 0.34;
      this.sfx = this.context.createGain();
      this.sfx.gain.value = 0.72;
      this.filter = this.context.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 1500;
      this.filter.Q.value = 0.8;
      this.music.connect(this.filter);
      this.filter.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.context.destination);
    }
    this.unlocked = true;
    void this.context.resume();
    if (this.timer === null) {
      this.nextStepAt = this.context.currentTime + 0.08;
      this.timer = window.setInterval(() => this.scheduler(), 80);
    }
  }

  private updateTempo(stats: RuntimeStats) {
    this.tempo = 88 + clamp(stats.speed, 1, 10) * 5 + clamp(stats.level, 1, 9) * 1.5;
    if (this.filter) this.filter.frequency.setTargetAtTime(1200 + stats.speed * 170 + stats.combo * 45, this.context?.currentTime ?? 0, 0.08);
  }

  private scheduler() {
    const context = this.context;
    if (!context || !this.unlocked || context.state !== "running") return;
    const stepDuration = 60 / this.tempo / 2;
    while (this.nextStepAt < context.currentTime + 0.18) {
      this.scheduleStep(this.nextStepAt, this.step);
      this.nextStepAt += stepDuration;
      this.step = (this.step + 1) % 16;
    }
  }

  private scheduleStep(when: number, step: number) {
    const root = [146.83, 174.61, 196, 130.81][Math.floor(step / 4) % 4];
    const bassPattern = [0, 0, 7, 0, 5, 0, 7, 12, 0, 0, 7, 0, 10, 7, 5, 3];
    const leadPattern = [12, 19, 24, 19, 17, 24, 27, 24, 12, 19, 24, 31, 29, 24, 19, 17];
    const bass = root * Math.pow(2, bassPattern[step] / 12 - 1);
    this.tone(bass, 0.23, "triangle", 0.12, when);
    if (step % 2 === 0) this.tone(root * Math.pow(2, leadPattern[step] / 12), 0.14, "sine", 0.045, when + 0.012);
    if (step % 4 === 0) this.tone(root / 2, 0.3, "sine", 0.08, when);
    if (step === 7 || step === 15) this.noise(0.035, 0.035, when, 0.05);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, when = this.context?.currentTime ?? 0, detune = 0) {
    if (!this.context || !this.music) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    oscillator.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.music);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
  }

  private effectTone(frequency: number, duration: number, type: OscillatorType, volume: number, slideTo?: number) {
    if (!this.context || !this.sfx) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.sfx);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  private noise(duration: number, attack: number, when: number, volume: number) {
    if (!this.context || !this.music) return;
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(this.context.sampleRate * duration)), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(gain);
    gain.connect(this.music);
    source.start(when);
  }

  private handleEvent(event?: AudioEvent) {
    if (!event || !this.unlocked || !this.context || this.context.state !== "running") return;
    if (event.type === "start") {
      this.effectTone(220, 0.18, "sine", 0.12, 440);
      window.setTimeout(() => this.effectTone(440, 0.24, "triangle", 0.1, 880), 90);
    }
    if (event.type === "crystal") {
      this.effectTone(660, 0.11, "sine", 0.18, 990);
      window.setTimeout(() => this.effectTone(990, 0.16, "sine", 0.11, 1320), 65);
    }
    if (event.type === "hit") {
      this.effectTone(120, 0.24, "sawtooth", 0.16, 48);
      this.noise(0.16, 0.01, this.context.currentTime, 0.16);
    }
    if (event.type === "gameover") {
      this.effectTone(330, 0.28, "sine", 0.12, 220);
      window.setTimeout(() => this.effectTone(220, 0.42, "triangle", 0.12, 82), 180);
    }
  }

  dispose() {
    this.cleanup.forEach((fn) => fn());
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.context) void this.context.close();
    this.context = null;
    this.unlocked = false;
  }
}

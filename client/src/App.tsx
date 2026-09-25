import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Crosshair, Keyboard, Pause, RotateCcw, Shield, Sparkles, Zap } from "lucide-react";
import GameCanvas from "./components/GameCanvas";
import "./index.css";

type Status = "ready" | "playing" | "paused" | "gameover";
type Stats = {
  status: Status;
  score: number;
  crystals: number;
  shield: number;
  combo: number;
  speed: number;
  best: number;
  level: number;
};

const initialStats: Stats = { status: new URLSearchParams(window.location.search).has("demo") ? "playing" : "ready", score: 0, crystals: 0, shield: 3, combo: 1, speed: 1, best: Number(localStorage.getItem("coleta-cosmica-best") || 0), level: 1 };
const scoreText = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value).padStart(4, "0");
const command = (type: "start" | "pause" | "restart") => window.dispatchEvent(new CustomEvent("cosmic-game:command", { detail: { type } }));

function Hud({ stats, onPause }: { stats: Stats; onPause: () => void }) {
  return (
    <div className="hud-layer">
      <header className="topbar">
        <div className="brand-mark"><span className="brand-dot" /><div><div className="brand-name">COLETA <strong>CÓSMICA</strong></div><div className="brand-sub">OPERAÇÃO // NÚCLEO AZUL</div></div></div>
        <div className="run-readout"><span className="eyebrow">PONTUAÇÃO</span><strong>{scoreText(stats.score)}</strong><span className="run-level">LVL {String(stats.level).padStart(2, "0")}</span></div>
        <button className="icon-button" onClick={onPause} aria-label="Pausar jogo"><Pause size={18} strokeWidth={1.7} /></button>
      </header>

      <div className="hud-row hud-row-top">
        <div className="hud-card crystal-card"><div className="hud-icon cyan"><Sparkles size={17} /></div><div><span className="eyebrow">CRISTAIS</span><strong>{String(stats.crystals).padStart(2, "0")} <small>/ 20</small></strong></div></div>
        <div className="combo-badge"><span>COMBO</span><strong>x{stats.combo}</strong><div className="combo-lines"><i /><i /><i /><i /></div></div>
        <div className="hud-card shield-card"><div className="hud-icon coral"><Shield size={17} /></div><div className="shield-copy"><span className="eyebrow">ESCUDO</span><div className="shield-pips">{[0, 1, 2].map((pip) => <i key={pip} className={pip < stats.shield ? "filled" : ""} />)}</div></div></div>
      </div>

      <div className="hud-row hud-row-bottom">
        <div className="control-hint"><div className="hud-icon violet"><Keyboard size={16} /></div><div><span className="eyebrow">NAVEGAÇÃO</span><strong>WASD <em>ou</em> SETAS</strong></div></div>
        <div className="telemetry"><span><Zap size={13} /> VELOCIDADE</span><strong>{stats.speed.toFixed(1)} <small>AU/S</small></strong><div className="telemetry-bar"><i style={{ width: `${Math.min(100, stats.speed * 10)}%` }} /></div></div>
        <div className="best-readout"><span className="eyebrow">MELHOR MARCA</span><strong>{scoreText(stats.best)}</strong><ArrowUpRight size={17} /></div>
      </div>
    </div>
  );
}

function Modal({ stats }: { stats: Stats }) {
  const isGameOver = stats.status === "gameover";
  const isPaused = stats.status === "paused";
  const title = isGameOver ? "NÚCLEO EM COLAPSO" : isPaused ? "PAUSA DE VOO" : "ENTRE NO FLUXO";
  const subtitle = isGameOver ? "Sua nave atravessou a tempestade. Recalibre e tente superar sua marca." : isPaused ? "O corredor está congelado. Tudo pronto para retomar." : "Colete energia. Desvie do impacto. Vá mais longe.";
  return (
    <div className={`modal-layer ${stats.status !== "playing" ? "visible" : ""}`}>
      <div className="modal-grid" />
      <div className="modal-card">
        <div className="modal-kicker"><span className="signal-dot" /> MISSÃO // {isGameOver ? "FINALIZADA" : isPaused ? "SUSPENSA" : "ONLINE"}</div>
        <div className="modal-symbol"><Crosshair size={38} strokeWidth={1.2} /></div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {isGameOver && <div className="result-strip"><span>RESULTADO <strong>{scoreText(stats.score)}</strong></span><span>NOVO RECORDE <strong>{stats.score >= stats.best ? "SIM" : "NÃO"}</strong></span></div>}
        <button className="primary-button" onClick={() => command(isGameOver ? "restart" : isPaused ? "pause" : "start")}><span>{isGameOver ? "TENTAR DE NOVO" : isPaused ? "RETOMAR MISSÃO" : "JOGAR AGORA"}</span><ArrowUpRight size={18} /></button>
        {!isGameOver && !isPaused && <div className="modal-tip"><span className="keycap">ENTER</span> para iniciar <span className="divider">•</span> <span className="keycap">P</span> pausa</div>}
      </div>
      <div className="modal-orbit orbit-a" /><div className="modal-orbit orbit-b" />
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    const update = (event: Event) => { setStats((event as CustomEvent<Stats>).detail); setShowIntro(false); };
    window.addEventListener("cosmic-game:update", update);
    return () => window.removeEventListener("cosmic-game:update", update);
  }, []);
  const active = stats.status === "playing";
  const label = useMemo(() => active ? "CAPTURANDO SINAL" : "SISTEMA EM ESPERA", [active]);
  return (
    <main className="game-shell">
      <GameCanvas />
      <div className="scanlines" />
      <Hud stats={stats} onPause={() => command("pause")} />
      <div className="status-chip"><span className={active ? "live-dot" : "idle-dot"} /> {label}</div>
      {showIntro || stats.status !== "playing" ? <Modal stats={stats} /> : null}
      <div className="corner-mark corner-tl" /><div className="corner-mark corner-br" />
    </main>
  );
}

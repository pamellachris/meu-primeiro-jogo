import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import type { Nullable } from "@babylonjs/core/types";
import { AudioManager } from "./audio";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Lights/Shadows/shadowGenerator";

export type GameStatus = "ready" | "playing" | "paused" | "gameover";
export type GameStats = {
  status: GameStatus;
  score: number;
  crystals: number;
  shield: number;
  combo: number;
  speed: number;
  best: number;
  level: number;
};

type CosmicObject = {
  kind: "crystal" | "meteor";
  mesh: Mesh;
  glow?: Mesh;
  x: number;
  y: number;
  z: number;
  radius: number;
  drift: number;
};

type Command = { type: "start" | "pause" | "restart" };

export type GameHandle = {
  scene: Scene;
  render: () => void;
  dispose: () => void;
};

const emit = (name: string, detail: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));
const getBest = () => Number(window.localStorage.getItem("coleta-cosmica-best") || 0);
const setBest = (score: number) => window.localStorage.setItem("coleta-cosmica-best", String(score));

const ART = {
  ship: "/manus-storage/coleta-cosmica-ship_3646b801.png",
  crystal: "/manus-storage/coleta-cosmica-crystal_9039bbf9.png",
  meteor: "/manus-storage/coleta-cosmica-meteor_0b4dda77.png",
};

const mat = (scene: Scene, name: string, color: Color3, emissive = 0) => {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.15, 0.18, 0.25);
  if (emissive) material.emissiveColor = color.scale(emissive);
  return material;
};

const makeGlowTexture = (scene: Scene, color: string) => {
  const texture = new DynamicTexture("glow", { width: 128, height: 128 }, scene, false);
  const ctx = texture.getContext();
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  gradient.addColorStop(0, `${color}ff`);
  gradient.addColorStop(0.22, `${color}99`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  texture.update();
  return texture;
};

const makeArtBillboard = (scene: Scene, name: string, url: string, size: number) => {
  const plane = MeshBuilder.CreatePlane(name, { size }, scene);
  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseTexture = new Texture(url, scene, true, false);
  material.diffuseTexture.hasAlpha = true;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveColor = new Color3(0.55, 0.65, 1);
  material.disableLighting = true;
  material.backFaceCulling = false;
  plane.material = material;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  return plane;
};

class GameWorld {
  readonly scene: Scene;
  private readonly engine: Engine;
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private readonly objects: CosmicObject[] = [];
  private readonly cleanup: Array<() => void> = [];
  private readonly demo: boolean;
  private readonly audio: AudioManager;
  private readonly camera: FreeCamera;
  private readonly player: Mesh;
  private readonly playerGlow: Mesh;
  private readonly stars: Mesh[] = [];
  private state: GameStats = {
    status: "ready",
    score: 0,
    crystals: 0,
    shield: 3,
    combo: 1,
    speed: 1,
    best: getBest(),
    level: 1,
  };
  private elapsed = 0;
  private spawnClock = 0.3;
  private lastPublish = 0;
  private randomSeed = 7;

  constructor(engine: Engine, canvas: HTMLCanvasElement) {
    this.engine = engine;
    this.canvas = canvas;
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.025, 0.02, 0.085, 1);
    this.demo = new URLSearchParams(window.location.search).has("demo");
    this.audio = new AudioManager();

    this.camera = new FreeCamera("camera", new Vector3(0, 0.7, -17), this.scene);
    this.camera.setTarget(new Vector3(0, 0.3, 13));
    this.camera.fov = 0.78;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 150;

    new HemisphericLight("moonlight", new Vector3(0, 1, -0.5), this.scene).intensity = 0.45;
    const rim = new PointLight("rim", new Vector3(0, 4, -3), this.scene);
    rim.diffuse = new Color3(0.35, 0.75, 1);
    rim.specular = new Color3(0.3, 0.2, 1);
    rim.intensity = 14;

    new GlowLayer("cosmic-glow", this.scene).intensity = 0.8;
    this.createBackdrop();
    this.player = this.createPlayer();
    this.playerGlow = MeshBuilder.CreatePlane("player-aura", { size: 3.8 }, this.scene);
    const aura = new StandardMaterial("player-aura-mat", this.scene);
    aura.diffuseTexture = makeGlowTexture(this.scene, "#36e7ff");
    aura.opacityTexture = aura.diffuseTexture;
    aura.emissiveColor = new Color3(0.15, 0.7, 1);
    aura.disableLighting = true;
    this.playerGlow.material = aura;
    this.playerGlow.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.playerGlow.parent = this.player;
    this.playerGlow.position.z = 0.15;
    this.playerGlow.isPickable = false;

    this.bindInput();
    this.publish(true);
    if (this.demo) {
      this.start();
    }
  }

  private nextRandom() {
    this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
    return this.randomSeed / 233280;
  }

  private createBackdrop() {
    const starMat = mat(this.scene, "star-mat", new Color3(0.4, 0.75, 1), 1.3);
    for (let i = 0; i < 100; i += 1) {
      const star = MeshBuilder.CreateSphere(`star-${i}`, { diameter: 0.035 + (i % 4) * 0.018, segments: 4 }, this.scene);
      star.material = starMat;
      star.position = new Vector3((this.nextRandom() - 0.5) * 44, (this.nextRandom() - 0.5) * 26, this.nextRandom() * 95 + 8);
      star.isPickable = false;
      this.stars.push(star);
    }

    const railMat = mat(this.scene, "rail-mat", new Color3(0.16, 0.22, 0.5), 1.5);
    for (const x of [-10, -5, 0, 5, 10]) {
      const rail = MeshBuilder.CreateLines(`rail-${x}`, { points: [new Vector3(x, -5.5, -4), new Vector3(x, -5.5, 80)] }, this.scene);
      rail.color = new Color3(0.12, 0.25, 0.65);
      rail.material = railMat;
    }
    const horizon = MeshBuilder.CreateTorus("horizon-ring", { diameter: 29, thickness: 0.08, tessellation: 96 }, this.scene);
    horizon.rotation.x = Math.PI / 2;
    horizon.position = new Vector3(0, 1, 62);
    horizon.material = mat(this.scene, "horizon-mat", new Color3(0.72, 0.15, 0.85), 2.2);

    const nebula = MeshBuilder.CreatePlane("nebula", { width: 46, height: 18 }, this.scene);
    nebula.position = new Vector3(0, 0.5, 78);
    const nebulaMat = new StandardMaterial("nebula-mat", this.scene);
    nebulaMat.diffuseTexture = makeGlowTexture(this.scene, "#6e38ff");
    nebulaMat.opacityTexture = nebulaMat.diffuseTexture;
    nebulaMat.emissiveColor = new Color3(0.15, 0.05, 0.4);
    nebulaMat.disableLighting = true;
    nebula.material = nebulaMat;
    nebula.isPickable = false;
  }

  private createPlayer() {
    const root = new Mesh("ship", this.scene);
    const body = MeshBuilder.CreatePolyhedron("ship-body", { type: 1, size: 1.2 }, this.scene);
    body.scaling = new Vector3(1.05, 0.42, 1.65);
    body.rotation.x = Math.PI / 2;
    body.material = mat(this.scene, "ship-teal", new Color3(0.04, 0.62, 0.68), 0.55);
    body.parent = root;

    const cockpit = MeshBuilder.CreateSphere("ship-cockpit", { diameter: 0.7, segments: 16 }, this.scene);
    cockpit.scaling = new Vector3(0.7, 0.36, 0.95);
    cockpit.position = new Vector3(0, 0.28, 0.18);
    cockpit.material = mat(this.scene, "ship-coral", new Color3(1, 0.28, 0.35), 0.7);
    cockpit.parent = root;

    const wingMat = mat(this.scene, "ship-wing", new Color3(0.12, 0.17, 0.37), 0.3);
    for (const side of [-1, 1]) {
      const wing = MeshBuilder.CreateBox(`wing-${side}`, { width: 1.5, height: 0.12, depth: 0.8 }, this.scene);
      wing.position = new Vector3(side * 0.78, -0.05, 0.15);
      wing.rotation.z = side * 0.16;
      wing.material = wingMat;
      wing.parent = root;
      const engine = MeshBuilder.CreateCylinder(`engine-${side}`, { diameter: 0.24, height: 0.8, tessellation: 12 }, this.scene);
      engine.rotation.x = Math.PI / 2;
      engine.position = new Vector3(side * 0.55, -0.08, -0.72);
      engine.material = mat(this.scene, "engine-glow", new Color3(0.35, 0.15, 1), 2.3);
      engine.parent = root;
    }
    root.position = new Vector3(0, -0.6, 0);
    root.scaling = new Vector3(1.15, 1.15, 1.15);
    const art = makeArtBillboard(this.scene, "ship-art", ART.ship, 2.4);
    art.parent = root;
    art.position.z = -0.18;
    art.position.y = 0.15;
    return root;
  }

  private createCrystal() {
    const root = MeshBuilder.CreatePolyhedron("crystal", { type: 1, size: 1.25 }, this.scene);
    root.scaling = new Vector3(0.65, 1.25, 0.65);
    root.material = mat(this.scene, "crystal-material", new Color3(0.05, 0.86, 1), 1.5);
    const ring = MeshBuilder.CreateTorus("crystal-ring", { diameter: 1.55, thickness: 0.035, tessellation: 32 }, this.scene);
    ring.rotation.x = Math.PI / 2;
    ring.material = mat(this.scene, "crystal-ring-mat", new Color3(0.55, 0.2, 1), 1.8);
    ring.parent = root;
    const art = makeArtBillboard(this.scene, "crystal-art", ART.crystal, 1.85);
    art.parent = root;
    art.position.z = -0.1;
    return { root, ring };
  }

  private createMeteor() {
    const root = MeshBuilder.CreateIcoSphere("meteor", { radius: 1.2, subdivisions: 1 }, this.scene);
    root.scaling = new Vector3(1.2, 0.85, 1.1);
    root.material = mat(this.scene, "meteor-material", new Color3(0.75, 0.18, 0.08), 0.2);
    for (const [x, y, z, s] of [[0.75, 0.25, 0.4, 0.26], [-0.55, -0.35, 0.7, 0.2], [0.1, 0.4, -0.75, 0.16]] as const) {
      const crater = MeshBuilder.CreateSphere("crater", { diameter: s, segments: 8 }, this.scene);
      crater.position = new Vector3(x, y, z);
      crater.material = mat(this.scene, "crater-material", new Color3(0.12, 0.04, 0.08), 0.05);
      crater.parent = root;
    }
    const art = makeArtBillboard(this.scene, "meteor-art", ART.meteor, 2.75);
    art.parent = root;
    art.position.z = -0.14;
    return root;
  }

  private spawn(kind?: "crystal" | "meteor") {
    const chosen = kind ?? (this.nextRandom() > 0.48 ? "crystal" : "meteor");
    let mesh: Mesh;
    let glow: Nullable<Mesh> = null;
    let radius = 1;
    if (chosen === "crystal") {
      const crystal = this.createCrystal();
      mesh = crystal.root;
      glow = crystal.ring;
      radius = 1.15;
    } else {
      mesh = this.createMeteor();
      radius = 1.65;
    }
    const x = (this.nextRandom() - 0.5) * 15.5;
    const y = (this.nextRandom() - 0.5) * 7.5;
    mesh.position = new Vector3(x, y, 38 + this.nextRandom() * 9);
    mesh.isPickable = false;
    this.objects.push({ kind: chosen, mesh, glow: glow ?? undefined, x, y, z: mesh.position.z, radius, drift: (this.nextRandom() - 0.5) * 0.45 });
  }

  private bindInput() {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      this.keys.add(key);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "p") this.togglePause();
      if ((key === "enter" || key === " ") && (this.state.status === "ready" || this.state.status === "gameover")) this.start();
    };
    const up = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
    const command = (event: Event) => {
      const detail = (event as CustomEvent<Command>).detail;
      if (detail?.type === "start" || detail?.type === "restart") this.start();
      if (detail?.type === "pause") this.togglePause();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("cosmic-game:command", command);
    this.cleanup.push(() => window.removeEventListener("keydown", down));
    this.cleanup.push(() => window.removeEventListener("keyup", up));
    this.cleanup.push(() => window.removeEventListener("cosmic-game:command", command));
  }

  start() {
    this.audio.unlock();
    for (const object of this.objects) object.mesh.dispose();
    this.objects.length = 0;
    this.state = { status: "playing", score: 0, crystals: 0, shield: 3, combo: 1, speed: 1, best: getBest(), level: 1 };
    this.elapsed = 0;
    this.spawnClock = 0.2;
    this.player.position.x = 0;
    this.player.position.y = -0.6;
    this.publish(true);
    emit("cosmic-game:audio", { type: "start" });
  }

  private togglePause() {
    if (this.state.status === "playing") this.state.status = "paused";
    else if (this.state.status === "paused") this.state.status = "playing";
    this.publish(true);
  }

  private finish() {
    this.state.status = "gameover";
    if (this.state.score > this.state.best) {
      this.state.best = this.state.score;
      setBest(this.state.score);
    }
    this.publish(true);
    emit("cosmic-game:audio", { type: "gameover" });
  }

  private removeObject(index: number) {
    const object = this.objects[index];
    object.mesh.dispose();
    this.objects.splice(index, 1);
  }

  private publish(force = false) {
    if (!force && this.elapsed - this.lastPublish < 0.08) return;
    this.lastPublish = this.elapsed;
    emit("cosmic-game:update", { ...this.state });
  }

  private update(dt: number) {
    if (this.state.status !== "playing") return;
    this.elapsed += dt;
    const moveX = (this.keys.has("arrowright") || this.keys.has("d") ? 1 : 0) - (this.keys.has("arrowleft") || this.keys.has("a") ? 1 : 0);
    const moveY = (this.keys.has("arrowup") || this.keys.has("w") ? 1 : 0) - (this.keys.has("arrowdown") || this.keys.has("s") ? 1 : 0);
    const inputX = this.demo ? Math.sin(this.elapsed * 0.82) * 0.55 + Math.sin(this.elapsed * 1.61) * 0.16 : moveX;
    const inputY = this.demo ? Math.cos(this.elapsed * 0.61) * 0.34 : moveY;
    this.player.position.x = Scalar.Clamp(this.player.position.x + inputX * dt * 7, -8.2, 8.2);
    this.player.position.y = Scalar.Clamp(this.player.position.y + inputY * dt * 5, -4.2, 4.2);
    this.player.rotation.z = Scalar.Lerp(this.player.rotation.z, -inputX * 0.2, 0.12);
    this.player.rotation.x = Scalar.Lerp(this.player.rotation.x, inputY * 0.09, 0.12);
    this.playerGlow.scaling = new Vector3(1 + Math.sin(this.elapsed * 7) * 0.07, 1 + Math.sin(this.elapsed * 7) * 0.07, 1);

    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.spawn();
      if (this.elapsed > 6 && this.nextRandom() > 0.72) this.spawn("crystal");
      this.spawnClock = Math.max(0.38, 0.82 - this.elapsed * 0.006);
    }
    const travel = dt * (8.5 + this.elapsed * 0.12);
    for (let index = this.objects.length - 1; index >= 0; index -= 1) {
      const object = this.objects[index];
      object.z -= travel * (1 + object.drift * 0.05);
      object.x += object.drift * dt;
      object.mesh.position.set(object.x, object.y, object.z);
      object.mesh.rotation.x += dt * (object.kind === "meteor" ? 0.7 : 1.6);
      object.mesh.rotation.y += dt * (object.kind === "meteor" ? -0.5 : 1.1);
      if (object.glow) object.glow.rotation.z += dt * 2.2;
      const dx = object.mesh.position.x - this.player.position.x;
      const dy = object.mesh.position.y - this.player.position.y;
      const dz = object.mesh.position.z - this.player.position.z;
      const hitDistance = object.radius + 0.7;
      if (dx * dx + dy * dy + dz * dz < hitDistance * hitDistance) {
        if (object.kind === "crystal") {
          this.state.crystals += 1;
          this.state.score += 100 * this.state.combo;
          this.state.combo = Math.min(9, this.state.combo + 1);
          emit("cosmic-game:audio", { type: "crystal" });
        } else {
          this.state.shield = Math.max(0, this.state.shield - 1);
          this.state.combo = 1;
          emit("cosmic-game:audio", { type: "hit" });
          if (this.state.shield === 0) this.finish();
        }
        this.removeObject(index);
        continue;
      }
      if (object.z < -5) this.removeObject(index);
    }
    this.state.score += Math.floor(dt * (3 + this.state.combo));
    this.state.speed = Math.min(9.9, 1 + this.elapsed / 16);
    this.state.level = Math.min(9, 1 + Math.floor(this.elapsed / 18));
    if (this.state.score > this.state.best) this.state.best = this.state.score;
    this.publish();
  }

  render() {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
    this.update(dt);
    for (const star of this.stars) {
      star.position.z -= dt * (1.2 + star.scaling.x * 10);
      if (star.position.z < -6) star.position.z = 100;
    }
    this.scene.render();
  }

  dispose() {
    this.cleanup.forEach((fn) => fn());
    this.audio.dispose();
    for (const object of this.objects) object.mesh.dispose();
    this.objects.length = 0;
  }
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const world = new GameWorld(engine, canvas);
  return { scene: world.scene, render: () => world.render(), dispose: () => world.dispose() };
}

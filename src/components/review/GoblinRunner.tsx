"use client";

import { useRef, useEffect, useCallback } from "react";

const S = 3;
const CANVAS_H = 160;
const GROUND = 132;
const GRAV = 0.6;
const JUMP_V = -11;
const START_SPEED = 3;
const MAX_SPEED = 8;
const SPEED_INC = 0.001;

const P: Record<string, string> = {
  G: "#5a9c4f", g: "#3a6c2f",
  W: "#ffffff", B: "#111111",
  M: "#882222",
  R: "#999999", r: "#666666",
  C: "#cc3333", c: "#992222",
  T: "#ddccaa", t: "#bbaa88",
};

const GOBLIN_STAND = [
  ".GG....GG.",
  ".GGG..GGG.",
  "..GGGGGG..",
  ".GWWggWWG.",
  ".GBWggBWG.",
  ".GGGGGGGG.",
  "..gMMMGg..",
  "...gGGg...",
  "..GGGGGG..",
  "..GGGGGG..",
  "...G..G...",
  "..GG..GG..",
];

const GOBLIN_RUN1 = [
  ".GG....GG.",
  ".GGG..GGG.",
  "..GGGGGG..",
  ".GWWggWWG.",
  ".GBWggBWG.",
  ".GGGGGGGG.",
  "..gMMMGg..",
  "...gGGg...",
  "..GGGGGG..",
  "..GGGGGG..",
  "..G....G..",
  ".G......G.",
];

const GOBLIN_RUN2 = [
  ".GG....GG.",
  ".GGG..GGG.",
  "..GGGGGG..",
  ".GWWggWWG.",
  ".GBWggBWG.",
  ".GGGGGGGG.",
  "..gMMMGg..",
  "...gGGg...",
  "..GGGGGG..",
  "..GGGGGG..",
  "...GGGG...",
  "...GGGG...",
];

const GOBLIN_DEAD = [
  ".GG....GG.",
  ".GGG..GGG.",
  "..GGGGGG..",
  ".GBBggBBG.",
  ".GBBggBBG.",
  ".GGGGGGGG.",
  "..gMMMGg..",
  "...gGGg...",
  "..GGGGGG..",
  "..GGGGGG..",
  "...G..G...",
  "..GG..GG..",
];

const OBS_ROCK = [
  "...rr...",
  "..Rrrr..",
  ".RRRrRR.",
  "RRRRrRRR",
  "RRRRrRRR",
  "rrrrrrrr",
];

const OBS_ROCK_TALL = [
  "..rr....",
  ".RrrR...",
  ".RRrRR..",
  "RRRrRRR.",
  "RRRRrRRR",
  "RRRRrRRR",
  "RRRRrRRR",
  "rrrrrrrr",
];

const OBS_MUSHROOM = [
  "..CCCC..",
  ".CCccCC.",
  "CCCccCCC",
  "CCCCCCCC",
  "..TTTT..",
  "..TttT..",
  "..TTTT..",
];

type Phase = "idle" | "playing" | "dead";

interface Obstacle {
  x: number;
  sprite: string[];
  w: number;
  h: number;
}

interface Dot {
  x: number;
  y: number;
}

interface Game {
  phase: Phase;
  y: number;
  vy: number;
  speed: number;
  score: number;
  hiScore: number;
  frame: number;
  obstacles: Obstacle[];
  nextSpawn: number;
  dots: Dot[];
}

function sprW(s: string[]) { return s[0].length * S; }
function sprH(s: string[]) { return s.length * S; }

function drawSprite(ctx: CanvasRenderingContext2D, sprite: string[], x: number, y: number) {
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const ch = sprite[r][c];
      if (ch === ".") continue;
      const color = P[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * S, y + r * S, S, S);
    }
  }
}

function makeGame(hiScore: number): Game {
  const dots: Dot[] = [];
  for (let i = 0; i < 30; i++) {
    dots.push({ x: Math.random() * 800, y: GROUND + 4 + Math.random() * 18 });
  }
  return {
    phase: "idle",
    y: GROUND - sprH(GOBLIN_STAND),
    vy: 0,
    speed: START_SPEED,
    score: 0,
    hiScore,
    frame: 0,
    obstacles: [],
    nextSpawn: 180,
    dots,
  };
}

function randomObs(x: number): Obstacle {
  const types = [OBS_ROCK, OBS_ROCK_TALL, OBS_MUSHROOM];
  const sprite = types[Math.floor(Math.random() * types.length)];
  return { x, sprite, w: sprW(sprite), h: sprH(sprite) };
}

export default function GoblinRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(makeGame(0));
  const rafRef = useRef(0);

  const handleInput = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === "idle") {
      g.phase = "playing";
      g.score = 0;
      g.speed = START_SPEED;
      g.frame = 0;
      g.obstacles = [];
      g.nextSpawn = 120;
    } else if (g.phase === "playing") {
      const groundY = GROUND - sprH(GOBLIN_STAND);
      if (g.y >= groundY - 1) g.vy = JUMP_V;
    } else {
      const hi = Math.max(g.hiScore, g.score);
      Object.assign(g, makeGame(hi));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = CANVAS_H;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", onKey);

    const gobH = sprH(GOBLIN_STAND);
    const gobW = sprW(GOBLIN_STAND);
    const groundY = GROUND - gobH;

    const loop = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
      ctx.imageSmoothingEnabled = false;
      const g = gameRef.current;
      const W = canvas.width;

      ctx.fillStyle = "#161a2e";
      ctx.fillRect(0, 0, W, CANVAS_H);

      // ground
      ctx.fillStyle = "#3a3a5c";
      ctx.fillRect(0, GROUND, W, 2);

      // ground dots
      ctx.fillStyle = "#2a2a4c";
      for (const d of g.dots) {
        ctx.fillRect(Math.floor(d.x), Math.floor(d.y), 2, 2);
      }

      if (g.phase === "idle") {
        drawSprite(ctx, GOBLIN_STAND, 50, groundY);

        for (const d of g.dots) {
          d.x -= 0.5;
          if (d.x < -4) d.x = W + Math.random() * 20;
        }

        ctx.fillStyle = "#8888aa";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Press SPACE to play", W / 2, GROUND / 2);

        if (g.hiScore > 0) {
          ctx.font = "11px monospace";
          ctx.fillText(`Best: ${g.hiScore}`, W / 2, GROUND / 2 + 18);
        }
      } else if (g.phase === "playing") {
        g.frame++;
        g.score = Math.floor(g.frame / 5);
        g.speed = Math.min(MAX_SPEED, START_SPEED + g.frame * SPEED_INC);

        // physics
        g.vy += GRAV;
        g.y += g.vy;
        if (g.y >= groundY) { g.y = groundY; g.vy = 0; }

        // spawn
        g.nextSpawn -= g.speed;
        if (g.nextSpawn <= 0) {
          g.obstacles.push(randomObs(W + 10));
          const minGap = Math.max(90, 160 - g.speed * 5);
          g.nextSpawn = minGap + Math.random() * 200;
        }

        // move obstacles
        for (const o of g.obstacles) o.x -= g.speed;
        g.obstacles = g.obstacles.filter(o => o.x + o.w > -10);

        // collision (forgiving hitbox)
        const gx = 50 + 2 * S;
        const gy = g.y + 2 * S;
        const gw = gobW - 4 * S;
        const gh = gobH - 3 * S;
        for (const o of g.obstacles) {
          const ox = o.x + S;
          const oy = GROUND - o.h + S;
          const ow = o.w - 2 * S;
          const oh = o.h - S;
          if (gx < ox + ow && gx + gw > ox && gy < oy + oh && gy + gh > oy) {
            g.phase = "dead";
            g.hiScore = Math.max(g.hiScore, g.score);
            break;
          }
        }

        // draw obstacles
        for (const o of g.obstacles) drawSprite(ctx, o.sprite, Math.floor(o.x), GROUND - o.h);

        // draw goblin
        const runSpr = Math.floor(g.frame / 8) % 2 === 0 ? GOBLIN_RUN1 : GOBLIN_RUN2;
        drawSprite(ctx, g.y < groundY ? GOBLIN_STAND : runSpr, 50, Math.floor(g.y));

        // dots
        for (const d of g.dots) {
          d.x -= g.speed * 0.6;
          if (d.x < -4) d.x = W + Math.random() * 20;
        }

        // score
        ctx.fillStyle = "#8888aa";
        ctx.font = "12px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${g.score}`, W - 12, 20);
        if (g.hiScore > 0) ctx.fillText(`HI ${g.hiScore}`, W - 12, 34);
      } else {
        // dead
        for (const o of g.obstacles) drawSprite(ctx, o.sprite, Math.floor(o.x), GROUND - o.h);
        drawSprite(ctx, GOBLIN_DEAD, 50, Math.floor(g.y));

        ctx.fillStyle = "#8888aa";
        ctx.font = "12px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${g.score}`, W - 12, 20);
        if (g.hiScore > 0) ctx.fillText(`HI ${g.hiScore}`, W - 12, 34);

        ctx.fillStyle = "#cc4444";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", W / 2, GROUND / 2 - 8);
        ctx.fillStyle = "#8888aa";
        ctx.font = "12px monospace";
        ctx.fillText(`Score: ${g.score}`, W / 2, GROUND / 2 + 10);
        ctx.fillText("Press SPACE to retry", W / 2, GROUND / 2 + 28);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, [handleInput]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleInput}
      className="w-full rounded-lg cursor-pointer mt-4"
      style={{ height: `${CANVAS_H}px`, imageRendering: "pixelated" }}
    />
  );
}

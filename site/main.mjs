// The page: one line of text set around a rounded triangle that you can grab,
// throw, bounce off the edges of the window, squash against them and pop. On a
// phone, tilting and shaking the phone moves it too.
import {
  makeTriangle,
  outlinePose,
  outlineGyration,
  distanceToPolygon,
  makeBody,
  stepBody,
  pullPoint,
  toWorld,
  toLocal,
  reach,
  downInPhone,
  phoneToScreen,
} from "./physics.mjs";

const TEXT = "nate mcguire — exited founder, staff software engineer, startup investor";
const FONT = '500 100px "Bricolage Grotesque", "Helvetica Neue", Helvetica, Arial, sans-serif';

// Background and text colour pairs. Each bounce moves to the next one.
const THEMES = [
  ["#1e4d3a", "#f6d3ae"], // pine, apricot
  ["#f2b632", "#2a1a12"], // saffron, espresso
  ["#3a1e5c", "#c9f27b"], // plum, pistachio
  ["#f0623f", "#fff1dc"], // coral, cream
  ["#0e5a6b", "#ffe0cf"], // lagoon, shell
  ["#e7c9f2", "#40205f"], // lilac, grape
  ["#f2ece1", "#1d1b3a"], // bone, midnight
  ["#14161c", "#8ff0cf"], // carbon, mint
];

// Shape and type, in ems of the text size unless noted.
const ROUNDNESS = 0.42; // corner radius as a share of the triangle's apothem
const TRACKING = 0.012;
const GAP = 1.5; // between the end of the text and its start
const LIFT = 0.34; // from the baseline to the middle of the letters
const SKIN = 0.74; // from the baseline to the edge that touches the walls
const NARROW_FILL = 0.6; // share of the window's width the triangle takes when width is what limits it (phones)
const LAP_SECONDS = 90; // the text creeps once around the triangle in this time

// Physics, in pixels and seconds.
const STEP = 1 / 240;
const ROOM = { gravity: 1000, bounce: 0.74, grip: 0.5, drag: 0.12, spinDrag: 0.5, settle: 60 };
const WORD_ROOM = { gravity: 1900, bounce: 0.42, grip: 0.6, drag: 0.3, spinDrag: 1.2, settle: 90 };
const HOLD_STIFFNESS = 900; // lower is heavier in the hand: it trails the pointer more
const HOLD_DAMPING = 48;
const HOLD_SPIN_DRAG = 5;
const TOP_SPEED = 4200;
const HEFT = 1.25; // how much harder it is to set spinning than its outline alone would be
const SHAKE = 4; // a shake of the phone counts this many times more than its tilt
const STEADY = 0.2; // seconds of the phone's motion that are averaged to find which way is down
const ARRIVE = 0.7; // seconds the triangle takes to grow from a dot when the page opens
const ARRIVE_PAUSE = 0.3; // then it hangs this long before it drops
const POP_DEPTH = 0.5; // squashed past this share of its depth...
const POP_HOLD = 0.75; // ...for this long, it pops
const POP_REST = 2.6; // seconds the words lie on the floor before they regroup
const REGROUP = 0.8;

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const footer = document.querySelector("footer");
const themeMeta = document.querySelector('meta[name="theme-color"]');
const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

let dpr = 1;
let size = 30; // text size in px
let tri = makeTriangle(100, ROUNDNESS);
let body = makeBody(tri.verts, 0, 1);
let glyphs = []; // { ch, at } with `at` in px along the outline
let words = []; // { text, at, width }
const room = { ...ROOM, width: 0, height: 0 };
const wordRoom = { ...WORD_ROOM, width: 0, height: 0 };

let mode = "wait"; // wait (centred, weightless) | live | popped | regroup
let arrived = false; // the opening growth has finished, or was cut short by a touch
let modeSince = 0;
let now = 0;
let creep = 0; // how far the text has travelled around the outline, px
let theme = 0;
let ink = THEMES[0][1];
let lastBounce = -1;
let held = null; // { id, local, x, y }
let pieces = []; // word bodies while popped
let strain = 0; // seconds spent squashed past POP_DEPTH
let laidOut = false;

// The squash: the triangle flattens against the wall along `n` by `amount`
// and springs back with a wobble. `goal` is where a hand is holding it.
const squash = { nx: 0, ny: -1, amount: 0, speed: 0, goal: 0 };

// ---------------------------------------------------------------- sound

const sound = (() => {
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];
  let audio = null;
  let out = null;
  let hiss = null;
  let rubGain = null;
  let rubTone = null;
  let lastTick = 0;

  // A phone hands its speaker to whichever app played last. After music in
  // another app, the old audio context can stay silent for good: stuck as
  // "interrupted", or claiming to run while its clock stands still. So a
  // context that was interrupted, or was left behind while the page was
  // hidden, is thrown away and a fresh one is built on the next touch.
  let suspect = false;
  let seen = null; // { at, time }: the context's clock when it was last seen running
  let wanted = true; // the visitor's choice, kept between visits
  try {
    wanted = window.localStorage.getItem("sound") !== "off";
  } catch {
    // no storage: sound stays on
  }

  // A quarter second of silence. Safari wakes the phone's sound output for an
  // audio element more reliably than for a context alone.
  let silence = null;
  let player = null;
  const nudge = () => {
    if (!navigator.audioSession) return;
    try {
      if (!silence) {
        const bytes = new Uint8Array(44 + 2000).fill(128);
        const head = new DataView(bytes.buffer);
        const put = (at, text) => [...text].forEach((ch, i) => head.setUint8(at + i, ch.charCodeAt(0)));
        put(0, "RIFF");
        head.setUint32(4, 36 + 2000, true);
        put(8, "WAVEfmt ");
        head.setUint32(16, 16, true);
        head.setUint16(20, 1, true); // plain samples
        head.setUint16(22, 1, true); // one channel
        head.setUint32(24, 8000, true); // samples a second
        head.setUint32(28, 8000, true); // bytes a second
        head.setUint16(32, 1, true);
        head.setUint16(34, 8, true); // bits a sample
        put(36, "data");
        head.setUint32(40, 2000, true);
        silence = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      }
      if (!player) player = new window.Audio(silence);
      player.play().catch(() => {});
    } catch {
      // the context alone will have to do
    }
  };

  const build = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    // Play even when the phone's ringer is switched to silent. The speaker
    // button is the way to quiet the page.
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch {
      // older browsers pick for themselves
    }
    const made = new Context();
    audio = made;
    made.onstatechange = () => {
      if (made === audio && made.state === "interrupted") suspect = true;
    };
    out = audio.createGain();
    out.gain.value = 0.5;
    out.connect(audio.createDynamicsCompressor()).connect(audio.destination);

    hiss = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = hiss.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    // One looping voice for the rubbery creak of a squeeze.
    const source = audio.createBufferSource();
    source.buffer = hiss;
    source.loop = true;
    rubTone = audio.createBiquadFilter();
    rubTone.type = "bandpass";
    rubTone.Q.value = 16;
    rubGain = audio.createGain();
    rubGain.gain.value = 0;
    source.connect(rubTone).connect(rubGain).connect(out);
    source.start();
  };

  const retire = () => {
    if (!audio) return;
    const old = audio;
    audio = null;
    suspect = false;
    seen = null;
    try {
      old.close().catch(() => {});
    } catch {
      // already closed
    }
  };

  // Leaving the page gives the sound up straight away, so nothing half-alive
  // is left for the phone to interrupt. The next touch builds it again.
  document.addEventListener("visibilitychange", () => document.hidden && retire());
  window.addEventListener("pagehide", retire);
  window.addEventListener("blur", retire);
  if (navigator.audioSession && navigator.audioSession.addEventListener) {
    navigator.audioSession.addEventListener("statechange", () => {
      if (navigator.audioSession.state !== "active" && audio) suspect = true;
    });
  }

  // Sounds asked for while the context is not running would all play at once
  // when it starts, so they are dropped.
  const sounding = () => audio && audio.state === "running";

  // Called on every touch: the only moment a browser lets sound start.
  const wake = () => {
    if (!wanted) return;
    if (audio) {
      const stalled =
        seen &&
        audio.state === "running" &&
        performance.now() - seen.at > 500 &&
        audio.currentTime === seen.time;
      if (suspect || stalled || audio.state === "closed") retire();
    }
    if (!audio) build();
    if (!audio) return;
    if (audio.state === "running") {
      seen = { at: performance.now(), time: audio.currentTime };
    } else {
      nudge();
      audio.resume().catch(() => {});
    }
  };

  const voice = (type, from, to, glide, level, length) => {
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + glide);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.02);
  };

  const burst = (level, length, cutoff) => {
    const t = audio.currentTime;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = hiss;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter).connect(gain).connect(out);
    source.start(t, Math.random() * 0.5, length + 0.02);
  };

  return {
    wake,
    describe() {
      const session = navigator.audioSession;
      return [
        wanted ? "wanted" : "switched off",
        audio ? `context ${audio.state} at ${audio.currentTime.toFixed(1)}s` : "no context",
        session ? `session ${session.type}/${session.state}` : "no session control",
      ].join(", ");
    },
    // Whether a sound made now would be heard, as far as the page can tell.
    audible: () => Boolean(wanted && sounding()),
    // The speaker button: off if sound is playing, otherwise start it afresh
    // and ring once so it is plain that it worked.
    toggle() {
      const on = !(wanted && sounding());
      wanted = on;
      try {
        window.localStorage.setItem("sound", on ? "on" : "off");
      } catch {
        // the choice lasts for this visit only
      }
      retire();
      if (!on) return;
      build();
      if (!audio) return;
      nudge();
      const made = audio;
      made
        .resume()
        .then(() => made === audio && this.ding(0.35, 4))
        .catch(() => {});
    },
    // A struck-metal ring, like the instrument: louder and longer the harder the hit.
    ding(strength, step) {
      if (!sounding()) return;
      const note = NOTES[step % NOTES.length];
      const ring = 0.45 + strength * 0.75;
      voice("sine", note, note, 0, 0.05 + strength * 0.3, 0.42 * ring);
      voice("sine", note * 2.76, note * 2.76, 0, 0.02 + strength * 0.13, 0.24 * ring);
      voice("sine", note * 5.4, note * 5.4, 0, 0.01 + strength * 0.05, 0.1 * ring);
      voice("sine", 150, 58, 0.09, 0.04 + strength * 0.5, 0.14);
    },
    // Creak while a squeeze is changing; `depth` raises the pitch.
    rub(level, depth) {
      if (!sounding()) return;
      rubGain.gain.setTargetAtTime(level, audio.currentTime, 0.04);
      rubTone.frequency.setTargetAtTime(520 + depth * 2600, audio.currentTime, 0.04);
    },
    pop() {
      if (!sounding()) return;
      burst(0.9, 0.09, 900);
      voice("triangle", 340, 52, 0.14, 0.7, 0.2);
    },
    tick(strength) {
      if (!sounding() || audio.currentTime - lastTick < 0.035) return;
      lastTick = audio.currentTime;
      voice("sine", 900 + Math.random() * 900, 500, 0.03, 0.03 + strength * 0.1, 0.05);
    },
  };
})();

// ---------------------------------------------------------------- layout

// The tab's icon takes the page's colours. Browsers that ignore a changed
// icon simply keep the first one.
const iconLink = document.querySelector('link[rel="icon"]');
let iconDrawing = null;
let iconDue = 0;
const paintIcon = (paper, text) => {
  if (!iconLink || !iconDrawing) return;
  clearTimeout(iconDue);
  iconDue = setTimeout(() => {
    const drawing = iconDrawing.replaceAll(THEMES[0][0], paper).replaceAll(THEMES[0][1], text);
    iconLink.href = `data:image/svg+xml,${encodeURIComponent(drawing)}`;
  }, 200);
};
if (iconLink && window.fetch) {
  fetch(iconLink.href)
    .then((response) => (response.ok ? response.text() : null))
    .then((drawing) => {
      iconDrawing = drawing;
    })
    .catch(() => {});
}

const applyTheme = () => {
  const [paper, text] = THEMES[theme];
  ink = text;
  document.documentElement.style.setProperty("--paper", paper);
  document.documentElement.style.setProperty("--ink", text);
  if (themeMeta) themeMeta.setAttribute("content", paper);
  paintIcon(paper, text);
};

const nextTheme = () => {
  theme = (theme + 1) % THEMES.length;
  applyTheme();
};

// Where the text starts so that its gap sits on the bottom left corner and the
// name climbs the left side.
const startOfText = () => tri.perimeter - (tri.radius * Math.PI) / 3 + (GAP * size) / 2;

// The middle of the room, placed so the triangle's outline (not its centre of
// mass, which sits low) is what ends up centred.
const centre = () => ({ x: room.width / 2, y: room.height / 2 + (tri.apothem - tri.radius) / 2 });

const layout = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const lap = laidOut ? creep / tri.perimeter : null;
  laidOut = true;
  const scaleFrom = tri.apothem;

  room.width = wordRoom.width = width;
  room.height = wordRoom.height = height - footer.offsetHeight;

  // Measure the text once at 100px, in ems, with its kerning.
  ctx.font = FONT;
  const edge = [];
  for (let i = 0; i <= TEXT.length; i += 1) {
    edge.push(ctx.measureText(TEXT.slice(0, i)).width / 100 + i * TRACKING);
  }
  const lineEms = edge[TEXT.length] + GAP;

  // The outline is as long as the text. Its overall width and height follow
  // from the apothem, so pick the largest apothem that fits the room.
  const perimeterPer = 6 * Math.sqrt(3) * (1 - ROUNDNESS) + 2 * Math.PI * ROUNDNESS;
  const emPer = perimeterPer / lineEms; // text size per unit of apothem
  const widthPer = 2 * Math.sqrt(3) * (1 - ROUNDNESS) + 2 * ROUNDNESS + 2 * SKIN * emPer;
  const heightPer = 3 * (1 - ROUNDNESS) + 2 * ROUNDNESS + 2 * SKIN * emPer;
  const apothem = Math.min((width * NARROW_FILL) / widthPer, (room.height * 0.56) / heightPer, 200);

  tri = makeTriangle(apothem, ROUNDNESS);
  size = tri.perimeter / lineEms;

  glyphs = [];
  for (let i = 0; i < TEXT.length; i += 1) {
    if (TEXT[i] !== " ") glyphs.push({ ch: TEXT[i], at: ((edge[i] + edge[i + 1]) / 2) * size });
  }
  words = [];
  for (const match of TEXT.matchAll(/\S+/g)) {
    const from = edge[match.index];
    const to = edge[match.index + match[0].length];
    words.push({ text: match[0], at: ((from + to) / 2) * size, width: (to - from) * size });
  }

  const before = body;
  body = makeBody(tri.verts, tri.radius + SKIN * size, outlineGyration(tri, LIFT * size) * HEFT);
  if (lap === null) {
    Object.assign(body, centre());
    creep = startOfText();
  } else {
    const k = apothem / scaleFrom;
    Object.assign(body, {
      x: before.x,
      y: before.y,
      vx: before.vx * k,
      vy: before.vy * k,
      angle: before.angle,
      spin: before.spin,
    });
    creep = lap * tri.perimeter;
    if (mode === "wait") Object.assign(body, centre());
  }
};

// ---------------------------------------------------------------- the squash

// The squashed triangle is the rigid one pressed like a rubber sheet: the side
// against the wall stays put, the rest flattens toward it and spreads along it.
// `sheet` is that stretch as a matrix, refreshed once per frame.
const SPREAD = 0.45;
const sheet = { xx: 1, xy: 0, yy: 1, shift: 0 };
const stretchSheet = () => {
  const { nx, ny, amount } = squash;
  const flat = 1 - amount;
  const wide = 1 + amount * SPREAD;
  sheet.xx = nx * nx * flat + ny * ny * wide;
  sheet.xy = nx * ny * (flat - wide);
  sheet.yy = ny * ny * flat + nx * nx * wide;
  sheet.shift = amount ? reach(body, -nx, -ny) * amount : 0;
};

// Where a point at distance `at` along the text sits on screen right now, and
// which way the text runs there.
const placeOnTriangle = (at, lift) => {
  const pose = outlinePose(tri, creep + at, lift);
  const point = toWorld(body, pose.x, pose.y);
  return { x: point.x, y: point.y, angle: pose.angle + body.angle };
};

const pressed = (x, y) => {
  const rx = x - body.x;
  const ry = y - body.y;
  return {
    x: body.x + sheet.xx * rx + sheet.xy * ry - squash.nx * sheet.shift,
    y: body.y + sheet.xy * rx + sheet.yy * ry - squash.ny * sheet.shift,
  };
};

const WALL_DISTANCE = {
  left: (p) => p.x,
  right: (p) => room.width - p.x,
  top: (p) => p.y,
  bottom: (p) => room.height - p.y,
};
const WALL_NORMAL = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] };

// While the triangle is held against a wall, how far past the wall the hand
// has pushed sets how flat it is squeezed.
const squeeze = (touching) => {
  let deepest = 0;
  let against = null;
  const grip = toWorld(body, held.local.x, held.local.y);
  for (const wall of Object.keys(touching)) {
    const [nx, ny] = WALL_NORMAL[wall];
    const push = -((held.x - grip.x) * nx + (held.y - grip.y) * ny) - 8;
    const depth = Math.max(WALL_DISTANCE[wall](grip), tri.apothem * 0.6);
    const amount = Math.min(0.64, push / depth);
    if (amount > deepest) {
      deepest = amount;
      against = [nx, ny];
    }
  }
  squash.goal = deepest;
  if (against && (squash.amount < 0.03 || deepest > 0.03)) [squash.nx, squash.ny] = against;
};

const springSquash = (dt) => {
  const pressed = held && squash.goal > 0;
  const before = squash.amount;
  const stiffness = pressed ? 1600 : 760;
  const damping = pressed ? 70 : 11;
  squash.speed += (-stiffness * (squash.amount - squash.goal) - damping * squash.speed) * dt;
  squash.amount = Math.max(-0.22, Math.min(0.7, squash.amount + squash.speed * dt));
  if (Math.abs(squash.amount) < 0.0005 && Math.abs(squash.speed) < 0.01 && !squash.goal) {
    squash.amount = squash.speed = 0;
  }
  return Math.abs(squash.amount - before) / dt;
};

// ---------------------------------------------------------------- pop and regroup

const pop = () => {
  stretchSheet();
  pieces = words.map((word) => {
    const rigid = placeOnTriangle(word.at, LIFT * size);
    const place = { ...pressed(rigid.x, rigid.y), angle: rigid.angle };
    const half = word.width / 2;
    const tall = size * 0.3;
    const piece = makeBody(
      [
        { x: -half, y: -tall },
        { x: half, y: -tall },
        { x: half, y: tall },
        { x: -half, y: tall },
      ],
      size * 0.08,
      (word.width * word.width + 4 * tall * tall) / 12,
    );
    const dx = place.x - body.x;
    const dy = place.y - body.y;
    const far = Math.hypot(dx, dy) || 1;
    const kick = 420 + Math.random() * 520;
    Object.assign(piece, {
      x: place.x,
      y: place.y,
      angle: place.angle,
      vx: body.vx + (dx / far) * kick + squash.nx * 300,
      vy: body.vy + (dy / far) * kick + squash.ny * 300 - 160,
      spin: (Math.random() - 0.5) * 16,
      text: word.text,
      word,
    });
    return piece;
  });
  held = null;
  canvas.classList.remove("holding");
  strain = 0;
  Object.assign(squash, { amount: 0, speed: 0, goal: 0 });
  sound.rub(0, 0);
  sound.pop();
  nextTheme();
  mode = "popped";
  modeSince = now;
};

const regroup = () => {
  Object.assign(body, centre(), { vx: 0, vy: 0, angle: 0, spin: 0 });
  for (const piece of pieces) {
    piece.from = { x: piece.x, y: piece.y, angle: piece.angle };
  }
  mode = "regroup";
  modeSince = now;
};

// ---------------------------------------------------------------- one step of time

const tick = (dt) => {
  if (mode === "live") {
    if (held) pullPoint(body, held.local, held.x, held.y, HOLD_STIFFNESS, HOLD_DAMPING, dt);
    room.spinDrag = held ? HOLD_SPIN_DRAG : ROOM.spinDrag;
    const result = stepBody(body, dt, room);

    const speed = Math.hypot(body.vx, body.vy);
    if (speed > TOP_SPEED) {
      body.vx *= TOP_SPEED / speed;
      body.vy *= TOP_SPEED / speed;
    }

    if (result.hit && result.hit.speed > 210 && now - lastBounce > 0.11) {
      lastBounce = now;
      const strength = Math.min(1, result.hit.speed / 1900);
      nextTheme();
      sound.ding(strength, theme);
      if (!(held && squash.goal > 0)) {
        if (Math.abs(squash.amount) < 0.04 || strength > 0.25) {
          squash.nx = result.hit.nx;
          squash.ny = result.hit.ny;
        }
        squash.speed += Math.min(6, result.hit.speed * 0.0042);
      }
    }

    if (held) squeeze(result.touching);
    else squash.goal = 0;
    const change = springSquash(dt);

    if (held && squash.goal > 0) {
      sound.rub(Math.min(0.32, change * 0.22), squash.amount);
      strain = squash.amount > POP_DEPTH ? strain + dt : Math.max(0, strain - dt * 2);
      if (strain > POP_HOLD) pop();
    } else {
      sound.rub(0, 0);
      strain = 0;
    }
  } else if (mode === "popped") {
    for (const piece of pieces) {
      const result = stepBody(piece, dt, wordRoom);
      if (result.hit && result.hit.speed > 150) sound.tick(Math.min(1, result.hit.speed / 1500));
    }
  }
};

const settleModes = () => {
  const waited = now - modeSince;
  if (mode === "wait" && waited > (arrived ? 0.9 : ARRIVE + ARRIVE_PAUSE) && !calm.matches && !held) {
    mode = "live";
    arrived = true;
    modeSince = now;
  } else if (mode === "popped" && waited > POP_REST) {
    regroup();
  } else if (mode === "regroup" && waited > REGROUP) {
    pieces = [];
    mode = "wait";
    modeSince = now;
    sound.ding(0.35, theme + 2);
  }
};

// ---------------------------------------------------------------- drawing

const drawAt = (text, x, y, angle, drop = 0) => {
  const c = Math.cos(angle) * dpr;
  const s = Math.sin(angle) * dpr;
  ctx.setTransform(c, s, -s, c, x * dpr, y * dpr);
  ctx.fillText(text, 0, drop);
};

const turnToward = (from, to, share) => {
  const turn = ((((to - from + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return from + turn * share;
};

const draw = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  ctx.font = FONT.replace("100px", `${size}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  let regrouped = 1;
  if (mode === "popped" || mode === "regroup") {
    const share = mode === "regroup" ? Math.min(1, (now - modeSince) / REGROUP) : 0;
    const eased = share * share * (3 - 2 * share);
    regrouped = Math.max(0, (share - 0.72) / 0.28);
    ctx.globalAlpha = 1 - regrouped;
    for (const piece of pieces) {
      let { x, y, angle } = piece;
      if (mode === "regroup") {
        const home = placeOnTriangle(piece.word.at, LIFT * size);
        x = piece.from.x + (home.x - piece.from.x) * eased;
        y = piece.from.y + (home.y - piece.from.y) * eased;
        angle = turnToward(piece.from.angle, home.angle, eased);
      }
      drawAt(piece.text, x, y, angle, LIFT * size);
    }
    if (mode === "popped") return;
  }

  // When the page opens the triangle grows from a dot, a little past full
  // size and back, about the middle of its outline.
  let grow = 1;
  let fade = 1;
  if (!arrived && mode === "wait" && !calm.matches) {
    const t = Math.min(1, (now - modeSince) / ARRIVE);
    const back = 1.4;
    grow = 0.1 + 0.9 * (1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2);
    fade = Math.min(1, t * 5);
  }
  const middleX = body.x;
  const middleY = body.y - (tri.apothem - tri.radius) / 2;

  // Trembles as it nears popping.
  const shake = (strain / POP_HOLD) * 2.2;
  const jx = shake ? (Math.random() - 0.5) * shake : 0;
  const jy = shake ? (Math.random() - 0.5) * shake : 0;
  stretchSheet();
  ctx.globalAlpha = regrouped * fade;
  for (const glyph of glyphs) {
    // Each letter is pressed along with the sheet, so squeezed letters narrow
    // and the ones along the wall stretch.
    const rigid = placeOnTriangle(glyph.at, 0);
    const at = pressed(rigid.x, rigid.y);
    const c = Math.cos(rigid.angle) * dpr * grow;
    const sn = Math.sin(rigid.angle) * dpr * grow;
    ctx.setTransform(
      sheet.xx * c + sheet.xy * sn,
      sheet.xy * c + sheet.yy * sn,
      sheet.xy * c - sheet.xx * sn,
      sheet.yy * c - sheet.xy * sn,
      (middleX + (at.x - middleX) * grow + jx) * dpr,
      (middleY + (at.y - middleY) * grow + jy) * dpr,
    );
    ctx.fillText(glyph.ch, 0, 0);
  }
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- hands

const overTriangle = (x, y, slack) => {
  const local = toLocal(body, x, y);
  return distanceToPolygon(tri.verts, local.x, local.y) <= body.radius + slack;
};

const letGo = () => {
  if (!held) return;
  held = null;
  phone.releasedAt = performance.now();
  canvas.classList.remove("holding");
  // A squeezed triangle springs off the wall it was pressed against.
  if (squash.goal > 0.05) {
    const launch = 2100 * squash.amount * squash.amount;
    body.vx += squash.nx * launch;
    body.vy += squash.ny * launch;
  }
  squash.goal = 0;
};

canvas.addEventListener("pointerdown", (event) => {
  // A phone only lets sound start as a finger lifts; a mouse may start it on the press.
  if (event.pointerType !== "touch") sound.wake();
  if (mode === "popped") {
    if (now - modeSince > 0.45) regroup();
    return;
  }
  if (mode === "regroup") return;
  letGo(); // a second finger, or a press after a release that never arrived, takes over
  const slack = event.pointerType === "mouse" ? 4 : 16;
  if (!overTriangle(event.clientX, event.clientY, slack)) return;
  // A finger's press is left alone: cancelling it would cancel the tap, and a
  // tap is the only thing an iPhone accepts before it shares its motion or
  // plays sound. (The page cannot scroll or select anyway.)
  if (event.pointerType !== "touch") event.preventDefault();
  phone.touched = true;
  held = {
    id: event.pointerId,
    local: toLocal(body, event.clientX, event.clientY),
    x: event.clientX,
    y: event.clientY,
  };
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // the pointer is already gone; the drag simply ends on the next pointerup
  }
  canvas.classList.add("holding");
  if (mode === "wait") {
    mode = "live";
    arrived = true;
    modeSince = now;
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (held && event.pointerId === held.id) {
    // A mouse that reports no button down was released somewhere we could not see.
    if (event.pointerType === "mouse" && event.buttons === 0) return letGo();
    held.x = event.clientX;
    held.y = event.clientY;
  } else if (!held && event.pointerType === "mouse") {
    const over = mode !== "popped" && mode !== "regroup" && overTriangle(event.clientX, event.clientY, 4);
    canvas.classList.toggle("reachable", over);
  }
});

// ---------------------------------------------------------------- the phone

// On a phone the room's gravity is the real one. The motion sensor reports the
// push on the phone, gravity included, in the phone's own axes. The slow part
// of that reading says which way is down; the fast part is shaking.
const G = 9.81;
const phone = {
  // Browsers on iPhones and iPads report the pull on things inside the phone;
  // the rest report the opposite, the push holding the phone up. This starts
  // as a guess from the device and is then settled by the tilt angles, which
  // all browsers agree on.
  sign:
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      ? 1
      : -1,
  steady: null, // the slow part of the reading
  down: null, // which way is down according to the tilt angles
  at: 0,
  touched: false, // the visitor has touched the triangle
  releasedAt: 0,
  // for the ?debug readout
  asks: 0,
  answer: "not asked",
  motions: 0,
  tilts: 0,
  last: null,
};

const feelTilt = (event) => {
  phone.tilts += 1;
  if (event.beta === null || event.gamma === null) return;
  phone.down = downInPhone(event.beta, event.gamma);
};

const feelMotion = (event) => {
  const push = event.accelerationIncludingGravity;
  phone.motions += 1;
  phone.last = push;
  if (!push || push.x === null || push.y === null) return;
  if (!phone.steady) {
    // A real sensor reads about one gravity in total; one that reports nothing
    // (a desktop) must not switch gravity off.
    if (Math.abs(Math.hypot(push.x, push.y, push.z || 0) - G) > 5) return;
    phone.steady = { x: push.x, y: push.y };
  }
  const { steady } = phone;
  const elapsed = Math.min(0.1, Math.max(0, (event.timeStamp - phone.at) / 1000));
  phone.at = event.timeStamp;
  const share = 1 - Math.exp(-elapsed / STEADY);
  steady.x += (push.x - steady.x) * share;
  steady.y += (push.y - steady.y) * share;

  if (phone.down) {
    const agreement = steady.x * phone.down.x + steady.y * phone.down.y;
    if (Math.abs(agreement) > 4) phone.sign = Math.sign(agreement);
  }

  const scale = (phone.sign * ROOM.gravity) / G;
  const turn = (window.screen.orientation ? window.screen.orientation.angle : window.orientation) || 0;
  const pull = phoneToScreen(
    (steady.x + (push.x - steady.x) * SHAKE) * scale,
    (steady.y + (push.y - steady.y) * SHAKE) * scale,
    turn,
  );
  const wordy = WORD_ROOM.gravity / ROOM.gravity;
  room.gravityX = pull.x;
  room.gravity = pull.y;
  wordRoom.gravityX = pull.x * wordy;
  wordRoom.gravity = pull.y * wordy;
};

const listenToPhone = () => {
  for (const [name, feel] of [["devicemotion", feelMotion], ["deviceorientation", feelTilt]]) {
    window.removeEventListener(name, feel);
    window.addEventListener(name, feel);
  }
};

// An iPhone shares its motion only after being asked, on every visit, and it
// accepts the question only from a clean tap: never from a drag, and not from
// the moment a finger lifts. So the question waits until the visitor has
// touched the triangle, then goes out on the next tap anywhere. A visitor who
// only drags is shown a small "tap to tilt" button, whose tap does it.
const tiltButton = document.getElementById("tilt");
const mustAsk = () => {
  const Motion = window.DeviceMotionEvent;
  return Boolean(Motion && typeof Motion.requestPermission === "function");
};
let asking = false;
let answered = false;
const askPhone = () => {
  if (asking || answered || !mustAsk()) return;
  asking = true;
  phone.asks += 1;
  let request;
  try {
    request = window.DeviceMotionEvent.requestPermission();
  } catch (error) {
    request = Promise.reject(error);
  }
  request
    .then((answer) => {
      answered = true;
      phone.answer = answer;
      if (answer === "granted") listenToPhone();
    })
    .catch((error) => {
      phone.answer = `refused to ask (${(error && error.name) || error})`;
    })
    .finally(() => {
      asking = false;
    });
};
// Asked first, before anything else the tap sets off.
document.addEventListener(
  "click",
  (event) => {
    if (phone.touched || (tiltButton && tiltButton.contains(event.target))) askPhone();
  },
  true,
);
if (tiltButton) tiltButton.addEventListener("click", () => sound.wake());
for (const lift of ["pointerup", "touchend", "click"]) {
  canvas.addEventListener(lift, () => sound.wake());
}

// The button appears once a touch on the triangle has ended without the
// question being put, on phones that have to be asked and are not yet
// reporting motion. It goes as soon as there is an answer.
const touchScreen = window.matchMedia("(pointer: coarse)");
let tiltShown = false;
const showTilt = () => {
  const show =
    phone.touched &&
    !held &&
    !asking &&
    !answered &&
    !phone.steady &&
    mustAsk() &&
    touchScreen.matches &&
    performance.now() - phone.releasedAt > 450;
  if (!tiltButton || show === tiltShown) return;
  tiltShown = show;
  tiltButton.hidden = !show;
};

// The speaker button shows whether sound can be heard right now, not only
// whether it is wanted: before the first touch, and after another app has
// taken the phone's speaker, it shows off until a touch brings sound back.
const speaker = document.getElementById("sound");
let speakerOn = null;
const showSpeaker = () => {
  const on = sound.audible();
  if (!speaker || on === speakerOn) return;
  speakerOn = on;
  speaker.classList.toggle("on", on);
  speaker.setAttribute("aria-pressed", String(on));
};
if (speaker) speaker.addEventListener("click", () => {
  sound.toggle();
  showSpeaker();
});
listenToPhone();

for (const ending of ["pointerup", "pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(ending, (event) => held && event.pointerId === held.id && letGo());
}
window.addEventListener("blur", letGo);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("resize", layout);

// ---------------------------------------------------------------- go

let last = 0;
let owed = 0;
const frame = (time) => {
  const elapsed = Math.min(0.05, (time - last) / 1000);
  last = time;
  owed += elapsed;
  while (owed >= STEP) {
    now += STEP;
    tick(STEP);
    owed -= STEP;
  }
  settleModes();
  showSpeaker();
  showTilt();
  if (!calm.matches) creep = (creep + (elapsed * tri.perimeter) / LAP_SECONDS) % tri.perimeter;
  draw();
  requestAnimationFrame(frame);
};

const start = () => {
  applyTheme();
  layout();
  document.documentElement.classList.add("live");
  last = performance.now();
  requestAnimationFrame(frame);
};

// natemcguire.com/?debug shows what the phone is reporting, for chasing
// problems that only happen on a real phone.
if (new URLSearchParams(window.location.search).has("debug")) {
  const readout = document.createElement("pre");
  readout.style.cssText =
    "position:fixed;left:10px;top:calc(10px + env(safe-area-inset-top));margin:0;max-width:92vw;" +
    "font:11px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap;pointer-events:none;opacity:.85";
  document.body.append(readout);
  const fixed = (value) => (typeof value === "number" ? value.toFixed(1) : String(value));
  setInterval(() => {
    const r = phone.last;
    readout.textContent = [
      `motion asked ${phone.asks}x: ${phone.answer}, triangle touched: ${phone.touched}`,
      `motion events ${phone.motions}, tilt events ${phone.tilts}`,
      `reading ${r ? [r.x, r.y, r.z].map(fixed).join(" ") : "none"}, sign ${phone.sign}`,
      `gravity ${fixed(room.gravityX || 0)} ${fixed(room.gravity)}, mode ${mode}`,
      `sound ${sound.describe()}`,
    ].join("\n");
  }, 250);
}

const fontReady = document.fonts ? document.fonts.load(FONT) : Promise.resolve();
Promise.race([fontReady, new Promise((done) => setTimeout(done, 1500))]).then(start, start);
fontReady.then(() => laidOut && layout(), () => {}); // a late font changes the measurements

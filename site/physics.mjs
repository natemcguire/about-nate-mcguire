// Geometry of a rounded equilateral triangle and rigid-body physics inside a
// rectangular room. No DOM: everything here runs under Node for the tests.
//
// Coordinates are screen coordinates: x to the right, y down, angles clockwise.

const SQRT3 = Math.sqrt(3);
const THIRD_TURN = (2 * Math.PI) / 3;

// A rounded triangle is an inner triangle grown outward by a corner radius.
// `apothem` is the distance from the centre to the middle of a rounded side,
// `roundness` (0..1) is the corner radius as a share of the apothem: 0 is a
// sharp triangle, 1 is a circle.
export function makeTriangle(apothem, roundness) {
  const radius = apothem * roundness;
  const reach = 2 * (apothem - radius); // centre to an inner corner
  const side = reach * SQRT3;
  return {
    apothem,
    radius,
    side,
    perimeter: 3 * side + 2 * Math.PI * radius,
    // top, bottom right, bottom left
    verts: [
      { x: 0, y: -reach },
      { x: (reach * SQRT3) / 2, y: reach / 2 },
      { x: (-reach * SQRT3) / 2, y: reach / 2 },
    ],
  };
}

// Point on the outline at distance `s` along it, plus the direction of travel.
// The outline runs clockwise and starts at the foot of the left side, so it
// climbs to the top, comes down the right side and returns along the bottom.
// `lift` moves the point outward from the outline.
export function outlinePose(tri, s, lift = 0) {
  const { side, radius, perimeter, verts } = tri;
  const arc = radius * THIRD_TURN;
  const leg = side + arc;
  s = ((s % perimeter) + perimeter) % perimeter;
  const index = Math.min(2, Math.floor(s / leg));
  const along = s - index * leg;
  const heading = -Math.PI / 3 + index * THIRD_TURN; // direction of this side
  const from = verts[(index + 2) % 3];
  const to = verts[index];
  const out = radius + lift;
  if (along <= side) {
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    return {
      x: from.x + dx * along + Math.sin(heading) * out,
      y: from.y + dy * along - Math.cos(heading) * out,
      angle: heading,
    };
  }
  const angle = heading + (radius > 0 ? (along - side) / radius : 0);
  return {
    x: to.x + Math.sin(angle) * out,
    y: to.y - Math.cos(angle) * out,
    angle,
  };
}

// Distance from a point to a convex polygon; 0 when the point is inside.
export function distanceToPolygon(verts, px, py) {
  let inside = true;
  let best = Infinity;
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const qx = px - a.x;
    const qy = py - a.y;
    if (ex * qy - ey * qx < 0) inside = false;
    const t = Math.max(0, Math.min(1, (qx * ex + qy * ey) / (ex * ex + ey * ey || 1)));
    best = Math.min(best, Math.hypot(qx - ex * t, qy - ey * t));
  }
  return inside ? 0 : best;
}

// A rigid body is a convex polygon grown by `radius`, with unit mass.
// `gyration` is the squared radius of gyration (moment of inertia per mass).
export function makeBody(verts, radius, gyration) {
  return { verts, radius, gyration, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0 };
}

// Squared radius of gyration for a body whose weight sits on its outline.
export function outlineGyration(tri, lift = 0) {
  const samples = 96;
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const p = outlinePose(tri, (tri.perimeter * i) / samples, lift);
    sum += p.x * p.x + p.y * p.y;
  }
  return sum / samples;
}

export function toWorld(body, lx, ly) {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  return { x: body.x + c * lx - s * ly, y: body.y + s * lx + c * ly };
}

export function toLocal(body, wx, wy) {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  const dx = wx - body.x;
  const dy = wy - body.y;
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

// How far the body reaches from its centre in the direction (dx, dy).
export function reach(body, dx, dy) {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  let best = -Infinity;
  for (const v of body.verts) {
    best = Math.max(best, (c * v.x - s * v.y) * dx + (s * v.x + c * v.y) * dy);
  }
  return best + body.radius;
}

// Pull a point of the body (given in body coordinates) toward a target with a
// damped spring. This is how a held body follows the pointer: it swings from
// the point it was grabbed by.
export function pullPoint(body, local, targetX, targetY, stiffness, damping, dt) {
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  const rx = c * local.x - s * local.y;
  const ry = s * local.x + c * local.y;
  const pvx = body.vx - body.spin * ry;
  const pvy = body.vy + body.spin * rx;
  const fx = stiffness * (targetX - (body.x + rx)) - damping * pvx;
  const fy = stiffness * (targetY - (body.y + ry)) - damping * pvy;
  body.vx += fx * dt;
  body.vy += fy * dt;
  body.spin += ((rx * fy - ry * fx) / body.gyration) * dt;
}

const WALLS = [
  { name: "left", nx: 1, ny: 0 },
  { name: "right", nx: -1, ny: 0 },
  { name: "top", nx: 0, ny: 1 },
  { name: "bottom", nx: 0, ny: -1 },
];

function depthInWall(wall, x, y, radius, room) {
  if (wall.name === "left") return radius - x;
  if (wall.name === "right") return x + radius - room.width;
  if (wall.name === "top") return radius - y;
  return y + radius - room.height;
}

// Which way is down for a phone, as seen in the phone's own axes (x toward its
// right edge, y toward its top edge), from the tilt angles a browser reports
// in degrees: `beta` is 90 with the phone upright, `gamma` grows as its right
// edge drops. The length is the share of gravity that lies in the screen: 1
// upright, 0 flat on a table.
export function downInPhone(beta, gamma) {
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  return { x: Math.cos(b) * Math.sin(g), y: -Math.sin(b) };
}

// A direction in the phone's own axes as it appears on a screen whose content
// is turned `turn` degrees from the phone's natural upright (0, 90, 180, 270).
// Screen axes are x to the right and y down.
export function phoneToScreen(x, y, turn) {
  const t = (turn * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: x * c - y * s, y: -x * s - y * c };
}

// Advance a body by dt seconds inside `room`:
//   { width, height, gravity, gravityX, bounce, grip, drag, spinDrag, settle }
// `gravity` pulls down the screen and the optional `gravityX` across it.
// Returns the walls it touched and the hardest hit of the step.
//
// Every corner that ends the step inside a wall becomes a contact. The speed
// each contact should leave at is fixed from how fast it arrived, and the
// pushes are then solved together, so a side that lands flat bounces straight
// back up instead of being kicked into a spin by whichever corner came first.
export function stepBody(body, dt, room) {
  body.vx += (room.gravityX || 0) * dt;
  body.vy += room.gravity * dt;
  body.vx *= Math.exp(-room.drag * dt);
  body.vy *= Math.exp(-room.drag * dt);
  body.spin *= Math.exp(-room.spinDrag * dt);
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.angle += body.spin * dt;

  const result = { touching: {}, hit: null };
  const c = Math.cos(body.angle);
  const s = Math.sin(body.angle);
  const contacts = [];
  const deepest = {};
  for (const v of body.verts) {
    const wx = body.x + c * v.x - s * v.y;
    const wy = body.y + s * v.x + c * v.y;
    for (const wall of WALLS) {
      const depth = depthInWall(wall, wx, wy, body.radius, room);
      if (depth <= 0) continue;
      const { nx, ny } = wall;
      const rx = wx - nx * body.radius - body.x;
      const ry = wy - ny * body.radius - body.y;
      const approach = (body.vx - body.spin * ry) * nx + (body.vy + body.spin * rx) * ny;
      const lever = rx * ny - ry * nx;
      const sideLever = rx * nx + ry * ny; // lever of the direction along the wall
      contacts.push({
        nx,
        ny,
        rx,
        ry,
        lever,
        sideLever,
        leave: -approach > room.settle ? -approach * room.bounce : 0,
        push: 0,
        rub: 0,
      });
      result.touching[wall.name] = true;
      deepest[wall.name] = Math.max(deepest[wall.name] || 0, depth);
      if (approach < 0 && (!result.hit || -approach > result.hit.speed)) {
        result.hit = { speed: -approach, nx, ny, wall: wall.name };
      }
    }
  }

  for (let pass = 0; pass < 10 && contacts.length; pass += 1) {
    for (const k of contacts) {
      const { nx, ny, rx, ry } = k;
      const speed = (body.vx - body.spin * ry) * nx + (body.vy + body.spin * rx) * ny;
      const before = k.push;
      k.push = Math.max(0, before + (k.leave - speed) / (1 + (k.lever * k.lever) / body.gyration));
      const push = k.push - before;
      body.vx += push * nx;
      body.vy += push * ny;
      body.spin += (push * k.lever) / body.gyration;

      const tx = -ny;
      const ty = nx;
      const slide = (body.vx - body.spin * ry) * tx + (body.vy + body.spin * rx) * ty;
      const limit = room.grip * k.push;
      const rubBefore = k.rub;
      k.rub = Math.max(
        -limit,
        Math.min(limit, rubBefore - slide / (1 + (k.sideLever * k.sideLever) / body.gyration)),
      );
      const rub = k.rub - rubBefore;
      body.vx += rub * tx;
      body.vy += rub * ty;
      body.spin += (rub * k.sideLever) / body.gyration;
    }
  }

  for (const wall of WALLS) {
    if (!deepest[wall.name]) continue;
    body.x += wall.nx * deepest[wall.name];
    body.y += wall.ny * deepest[wall.name];
  }
  return result;
}

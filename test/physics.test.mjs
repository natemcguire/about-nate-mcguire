import test from "node:test";
import assert from "node:assert/strict";
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
} from "../site/physics.mjs";

const room = (extra = {}) => ({
  width: 1000,
  height: 700,
  gravity: 1300,
  bounce: 0.74,
  grip: 0.5,
  drag: 0.12,
  spinDrag: 0.5,
  settle: 70,
  ...extra,
});

const triangleBody = (tri, lift = 20) =>
  makeBody(tri.verts, tri.radius + lift, outlineGyration(tri, lift));

const run = (body, seconds, world, each) => {
  const dt = 1 / 240;
  for (let i = 0; i < seconds * 240; i += 1) {
    const result = stepBody(body, dt, world);
    if (each) each(result, i * dt);
  }
};

const insideRoom = (body, world, slack = 0.01) => {
  for (const [dx, dy, limit] of [
    [-1, 0, body.x],
    [1, 0, world.width - body.x],
    [0, -1, body.y],
    [0, 1, world.height - body.y],
  ]) {
    assert.ok(reach(body, dx, dy) <= limit + slack, `pokes through a wall (${dx}, ${dy})`);
  }
};

test("the outline is a closed loop whose length matches its perimeter", () => {
  const tri = makeTriangle(120, 0.42);
  const steps = 6000;
  let length = 0;
  let previous = outlinePose(tri, 0);
  for (let i = 1; i <= steps; i += 1) {
    const next = outlinePose(tri, (tri.perimeter * i) / steps);
    length += Math.hypot(next.x - previous.x, next.y - previous.y);
    previous = next;
  }
  assert.ok(Math.abs(length - tri.perimeter) < 0.05);
  const start = outlinePose(tri, 0);
  const end = outlinePose(tri, tri.perimeter);
  assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 1e-6);
});

test("every point of the outline sits exactly the corner radius from the inner triangle", () => {
  const tri = makeTriangle(120, 0.42);
  for (let i = 0; i < 300; i += 1) {
    const p = outlinePose(tri, (tri.perimeter * i) / 300);
    assert.ok(Math.abs(distanceToPolygon(tri.verts, p.x, p.y) - tri.radius) < 1e-6);
  }
});

test("the triangle points up, its flat sides are one apothem from the centre, and it runs clockwise", () => {
  const tri = makeTriangle(100, 0.4);
  let top = Infinity;
  let bottom = -Infinity;
  let turned = 0;
  let previous = outlinePose(tri, 0).angle;
  for (let i = 1; i <= 600; i += 1) {
    const p = outlinePose(tri, (tri.perimeter * i) / 600);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
    turned += p.angle - previous >= 0 ? p.angle - previous : p.angle - previous + 2 * Math.PI;
    previous = p.angle;
  }
  assert.ok(Math.abs(bottom - 100) < 1e-6, "flat bottom side");
  assert.ok(top < -100, "corner above the centre reaches further than a side");
  assert.ok(Math.abs(turned - 2 * Math.PI) < 1e-6, "one full clockwise turn");
});

test("roundness 1 is a circle", () => {
  const tri = makeTriangle(80, 1);
  for (let i = 0; i < 50; i += 1) {
    const p = outlinePose(tri, (tri.perimeter * i) / 50);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 80) < 1e-9);
  }
});

test("distance to a polygon is zero inside and grows outside", () => {
  const tri = makeTriangle(100, 0);
  assert.equal(distanceToPolygon(tri.verts, 0, 0), 0);
  assert.ok(Math.abs(distanceToPolygon(tri.verts, 0, 130) - 30) < 1e-9);
  assert.ok(Math.abs(distanceToPolygon(tri.verts, 0, -230) - 30) < 1e-9);
});

test("world and local coordinates round-trip through a rotated body", () => {
  const body = makeBody([], 0, 1);
  Object.assign(body, { x: 40, y: -12, angle: 1.1 });
  const world = toWorld(body, 7, -3);
  const local = toLocal(body, world.x, world.y);
  assert.ok(Math.abs(local.x - 7) < 1e-9 && Math.abs(local.y + 3) < 1e-9);
});

test("a dropped triangle bounces, loses height each time, and comes to rest on the floor", () => {
  const tri = makeTriangle(120, 0.42);
  const body = triangleBody(tri);
  const world = room();
  Object.assign(body, { x: 500, y: 200 });
  const floorHits = [];
  let highestAfterFirstHit = Infinity;
  run(body, 12, world, (result) => {
    if (result.hit && result.hit.wall === "bottom" && result.hit.speed > world.settle) {
      floorHits.push(result.hit.speed);
    }
    if (floorHits.length) highestAfterFirstHit = Math.min(highestAfterFirstHit, body.y);
    insideRoom(body, world);
  });
  assert.ok(floorHits.length >= 3, `expected several bounces, got ${floorHits.length}`);
  assert.ok(floorHits[1] < floorHits[0], "second bounce is softer than the first");
  assert.ok(highestAfterFirstHit > 200, "never bounces back above where it was dropped");
  assert.ok(Math.hypot(body.vx, body.vy) < 12, `still moving at ${Math.hypot(body.vx, body.vy)}`);
  assert.ok(Math.abs(body.spin) < 0.1, `still spinning at ${body.spin}`);
  // resting on a flat side: the lowest point of the body is on the floor
  assert.ok(Math.abs(body.y + reach(body, 0, 1) - world.height) < 0.5);
  const turn = ((body.angle % (Math.PI * 2 / 3)) + Math.PI * 2 / 3) % (Math.PI * 2 / 3);
  assert.ok(Math.min(turn, Math.PI * 2 / 3 - turn) < 0.03, "lying flat, not balanced on a corner");
});

test("a triangle thrown hard stays inside the room and never gains energy", () => {
  const tri = makeTriangle(120, 0.42);
  const world = room({ gravity: 0, drag: 0, spinDrag: 0 });
  for (const [vx, vy, spin] of [
    [3000, 1700, 9],
    [-5200, 300, -14],
    [40, -6000, 0],
  ]) {
    const body = triangleBody(tri);
    Object.assign(body, { x: 500, y: 350, vx, vy, spin, angle: 0.4 });
    const energy = () =>
      0.5 * (body.vx ** 2 + body.vy ** 2) + 0.5 * body.gyration * body.spin ** 2;
    let last = energy();
    run(body, 6, world, () => {
      insideRoom(body, world);
      const now = energy();
      assert.ok(now <= last * (1 + 1e-9), "energy went up");
      last = now;
    });
  }
});

test("a side that lands flat bounces straight back up without picking up spin", () => {
  const tri = makeTriangle(120, 0.42);
  const body = triangleBody(tri);
  const world = room({ gravity: 0, drag: 0, spinDrag: 0 });
  Object.assign(body, { x: 500, y: 400, vy: 600 });
  run(body, 0.4, world);
  assert.ok(Math.abs(body.vy + 600 * world.bounce) < 1, `left the floor at ${body.vy}`);
  assert.ok(Math.abs(body.spin) < 0.01 && Math.abs(body.vx) < 0.5);
});

test("a corner that lands while sliding sideways starts the triangle rolling that way", () => {
  const tri = makeTriangle(120, 0.42);
  const body = triangleBody(tri);
  const world = room({ gravity: 0, drag: 0, spinDrag: 0 });
  // turned upside down, so a corner leads; long enough to reach the floor, not the far wall
  Object.assign(body, { x: 300, y: 300, vx: 900, vy: 600, angle: Math.PI });
  run(body, 0.4, world);
  assert.ok(body.spin > 0.5, `expected clockwise spin, got ${body.spin}`);
  assert.ok(body.vx < 900 && body.vx > 0, "slowed sideways but still travelling");
  assert.ok(body.vy < 0, "bounced back up");
});

test("a held triangle follows the pointer and hangs below the point it is held by", () => {
  const tri = makeTriangle(120, 0.42);
  const body = triangleBody(tri);
  const world = room({ spinDrag: 5 });
  Object.assign(body, { x: 300, y: 300 });
  const grab = { x: tri.verts[1].x, y: tri.verts[1].y }; // the bottom right corner
  const dt = 1 / 240;
  for (let i = 0; i < 240 * 6; i += 1) {
    pullPoint(body, grab, 620, 260, 1500, 70, dt);
    stepBody(body, dt, world);
  }
  const held = toWorld(body, grab.x, grab.y);
  assert.ok(Math.hypot(held.x - 620, held.y - 260) < 3, "held point reaches the pointer");
  assert.ok(Math.abs(body.x - 620) < 3, "centre hangs directly below the pointer");
  assert.ok(body.y > 260 + 50, "centre is below the held corner");
});

test("pushing a held triangle into a wall leaves it flush against the wall", () => {
  const tri = makeTriangle(120, 0.42);
  const body = triangleBody(tri);
  const world = room({ spinDrag: 5 });
  Object.assign(body, { x: 500, y: 350 });
  const dt = 1 / 240;
  let touched = false;
  for (let i = 0; i < 240 * 4; i += 1) {
    pullPoint(body, { x: 0, y: 0 }, 1200, 350, 1500, 70, dt); // pointer is past the right wall
    touched = Boolean(stepBody(body, dt, world).touching.right) || touched;
    insideRoom(body, world);
  }
  assert.ok(touched);
  assert.ok(Math.abs(body.x + reach(body, 1, 0) - world.width) < 0.5);
});

test("with the room turned on its side the triangle falls to that wall and rests there", () => {
  const tri = makeTriangle(120, 0.42);
  const body = triangleBody(tri);
  const world = room({ gravity: 0, gravityX: -1300 }); // down is toward the left wall
  Object.assign(body, { x: 500, y: 350 });
  run(body, 12, world, () => insideRoom(body, world));
  assert.ok(Math.abs(body.x - reach(body, -1, 0)) < 0.5, "touching the left wall");
  assert.ok(Math.hypot(body.vx, body.vy) < 12 && Math.abs(body.spin) < 0.1, "at rest");
  // a quarter turn clockwise puts the side that started at the bottom against the left wall
  const third = (Math.PI * 2) / 3;
  const turn = (((body.angle - Math.PI / 2) % third) + third) % third;
  assert.ok(Math.min(turn, third - turn) < 0.03, "lying with a flat side on the wall");
});

test("a triangle resting on the floor slides downhill when the room tips past its grip", () => {
  const tri = makeTriangle(120, 0.42);
  const world = room({ grip: 0.5 });
  const restAt = (gravityX) => {
    const body = triangleBody(tri);
    Object.assign(body, { x: 500, y: 700 - 120 - 20 }); // sitting flat on the floor
    run(body, 1, world);
    world.gravityX = gravityX;
    run(body, 1.5, world);
    world.gravityX = 0;
    return body.x;
  };
  assert.ok(Math.abs(restAt(1300 * 0.2) - 500) < 2, "a gentle tip is held by friction");
  assert.ok(restAt(1300 * 1.2) > 600, "a steep tip sends it toward the low side");
});

const down = (beta, gamma, turn) => {
  const inPhone = downInPhone(beta, gamma);
  return phoneToScreen(inPhone.x, inPhone.y, turn);
};
const near = (point, x, y) => Math.abs(point.x - x) < 1e-9 && Math.abs(point.y - y) < 1e-9;

test("down on the screen is toward the ground however the phone is held", () => {
  assert.ok(near(down(90, 0, 0), 0, 1), "upright: the bottom of the screen");
  assert.ok(near(down(0, 0, 0), 0, 0), "flat on a table: nowhere in the screen");
  assert.ok(near(down(180, 0, 0), 0, 0), "face down: nowhere in the screen");
  const leaning = down(0, 30, 0);
  assert.ok(leaning.x > 0.49 && Math.abs(leaning.y) < 1e-9, "right edge lowered: toward the right");
  const tippedBack = down(45, 0, 0);
  assert.ok(tippedBack.y > 0.7 && tippedBack.y < 0.71, "leaning back: partly toward the bottom");
});

test("down stays toward the ground when the screen rotates with the phone", () => {
  // top edge pointing left, so the phone's right edge points at the sky
  assert.ok(near(down(0, -90, 90), 0, 1), "landscape, turned anticlockwise");
  // top edge pointing right, so the phone's right edge points at the ground
  assert.ok(near(down(0, 90, 270), 0, 1), "landscape, turned clockwise");
  assert.ok(near(down(-90, 0, 180), 0, 1), "upside down");
  // a screen locked to portrait while the phone lies on its side
  assert.ok(near(down(0, 90, 0), 1, 0), "locked portrait, lying on its right edge");
});

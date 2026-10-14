export const GRAVITY = 25;
export const JUMP_SPEED = 8;
export const EYE = 1.7;

// Axis-aligned box obstacles: {minX,maxX,minZ,maxZ}. Player is a circle of `radius`.
export function resolveCollisions(pos, boxes, radius, bounds) {
  pos.x = Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, pos.x));
  pos.z = Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, pos.z));
  for (const b of boxes) {
    const cx = Math.min(b.maxX, Math.max(b.minX, pos.x));
    const cz = Math.min(b.maxZ, Math.max(b.minZ, pos.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // centre inside box: push out along the shallowest axis
      const opts = [
        [pos.x - b.minX, -1, 0], [b.maxX - pos.x, 1, 0],
        [pos.z - b.minZ, 0, -1], [b.maxZ - pos.z, 0, 1],
      ].sort((p, q) => p[0] - q[0])[0];
      pos.x += opts[1] * (opts[0] + radius);
      pos.z += opts[2] * (opts[0] + radius);
    }
  }
  return pos;
}

// Vertical integration with a floor at y = EYE. Mutates state {y, vy, onGround}.
export function stepVertical(s, dt, jump) {
  if (jump && s.onGround) { s.vy = JUMP_SPEED; s.onGround = false; }
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;
  if (s.y <= EYE) { s.y = EYE; s.vy = 0; s.onGround = true; }
  return s;
}

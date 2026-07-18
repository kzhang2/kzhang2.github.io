export const EPS = 1e-9;

export function vec(x, y) {
  return { x, y };
}

export function add(a, b) {
  return vec(a.x + b.x, a.y + b.y);
}

export function sub(a, b) {
  return vec(a.x - b.x, a.y - b.y);
}

export function scale(a, s) {
  return vec(a.x * s, a.y * s);
}

export function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

export function rotatePoint(p, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vec(c * p.x - s * p.y, s * p.x + c * p.y);
}

export function rigid(angle = 0, tx = 0, ty = 0) {
  return { angle, tx, ty };
}

export function applyTransform(p, t) {
  const r = rotatePoint(p, t.angle);
  return vec(r.x + t.tx, r.y + t.ty);
}

export function composeTransforms(a, b) {
  const bt = applyTransform(vec(b.tx, b.ty), a);
  return rigid(a.angle + b.angle, bt.x, bt.y);
}

export function invertTransform(t) {
  const invAngle = -t.angle;
  const invT = rotatePoint(vec(-t.tx, -t.ty), invAngle);
  return rigid(invAngle, invT.x, invT.y);
}

export function transformPolygon(poly, t) {
  return poly.map(p => applyTransform(p, t));
}

export function translatePolygon(poly, dx, dy) {
  return poly.map(p => vec(p.x + dx, p.y + dy));
}

export function scalePolygon(poly, s) {
  return poly.map(p => scale(p, s));
}

export function polygonArea(poly) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    area += p.x * q.y - p.y * q.x;
  }
  return 0.5 * area;
}

export function polygonAbsArea(poly) {
  return Math.abs(polygonArea(poly));
}

function orientCCW(poly) {
  return polygonArea(poly) < 0 ? poly.slice().reverse() : poly.slice();
}

function lineIntersection(P, Q, A, B) {
  const r = sub(Q, P);
  const s = sub(B, A);
  const denom = cross(r, s);
  if (Math.abs(denom) < EPS) return P;
  const t = cross(sub(A, P), s) / denom;
  return add(P, scale(r, t));
}

function dedupePolygon(poly) {
  if (poly.length === 0) return poly;
  const out = [];
  for (const p of poly) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev.x - p.x, prev.y - p.y) > 1e-8) out.push(p);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-8) out.pop();
  }
  return out;
}

export function clipConvexPolygon(subject, clipper) {
  let output = orientCCW(subject);
  const clip = orientCCW(clipper);
  for (let i = 0; i < clip.length; i++) {
    const A = clip[i];
    const B = clip[(i + 1) % clip.length];
    const input = output.slice();
    output = [];
    if (!input.length) break;
    const inside = P => cross(sub(B, A), sub(P, A)) >= -EPS;
    for (let j = 0; j < input.length; j++) {
      const P = input[j];
      const Q = input[(j + 1) % input.length];
      const pIn = inside(P);
      const qIn = inside(Q);
      if (pIn && qIn) {
        output.push(Q);
      } else if (pIn && !qIn) {
        output.push(lineIntersection(P, Q, A, B));
      } else if (!pIn && qIn) {
        output.push(lineIntersection(P, Q, A, B));
        output.push(Q);
      }
    }
    output = dedupePolygon(output);
  }
  return output.length >= 3 && polygonAbsArea(output) > 1e-8 ? output : [];
}

export function pointInPolygon(pt, poly) {
  let sign = 0;
  const ccw = orientCCW(poly);
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % ccw.length];
    const d = cross(sub(b, a), sub(pt, a));
    if (Math.abs(d) <= 1e-8) continue;
    const s = Math.sign(d);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function buildSquareToRectUnit(aspect) {
  if (aspect < 1 - EPS) throw new Error(`Aspect must be at least 1, got ${aspect}`);
  const beta = Math.sqrt(Math.max(0, aspect * aspect - 1));
  const b1 = vec(1, 0);
  const b2 = vec(beta, 1);
  const r2 = b2;
  const r1 = sub(b1, scale(b2, beta / (beta * beta + 1)));
  const square = [vec(0, 0), vec(1, 0), vec(1, 1), vec(0, 1)];
  const orientedRect = [vec(0, 0), r2, add(r1, r2), r1];
  const toAxisAligned = rigid(-Math.atan2(r2.y, r2.x), 0, 1 / aspect);

  const pieces = [];
  const mMax = Math.ceil(aspect) + 2;
  for (let m = -mMax; m <= mMax; m++) {
    for (let n = -2; n <= 2; n++) {
      const shift = add(scale(b1, m), scale(b2, n));
      const shiftedRect = orientedRect.map(p => add(p, shift));
      const inter = clipConvexPolygon(square, shiftedRect);
      if (!inter.length) continue;
      pieces.push({
        poly: inter,
        transform: composeTransforms(
          toAxisAligned,
          rigid(0, -shift.x, -shift.y)
        ),
      });
    }
  }
  return { square, pieces };
}

function canonicalRectTransform(width, height) {
  if (width >= height - EPS) return rigid();
  return rigid(Math.PI / 2, width, 0);
}

function scaleTransform(t, factor) {
  return rigid(t.angle, t.tx * factor, t.ty * factor);
}

function buildSquareToRect(width, height) {
  const area = width * height;
  const side = Math.sqrt(area);
  const aspect = Math.max(width, height) / side;
  const orientation = canonicalRectTransform(width, height);
  const unit = buildSquareToRectUnit(aspect);
  return {
    squareSide: side,
    pieces: unit.pieces.map(piece => ({
      poly: scalePolygon(piece.poly, side),
      sourceTransform: rigid(),
      targetTransform: composeTransforms(
        orientation,
        scaleTransform(piece.transform, side)
      ),
    })),
  };
}

function buildRectToSquare(width, height) {
  const forward = buildSquareToRect(width, height);
  return {
    squareSide: forward.squareSide,
    pieces: forward.pieces.map(piece => ({
      poly: piece.poly,
      sourceTransform: piece.targetTransform,
      targetTransform: rigid(),
    })),
  };
}

function composeViaSquare(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const toSquare = buildRectToSquare(sourceWidth, sourceHeight);
  const fromSquare = buildSquareToRect(targetWidth, targetHeight);
  const pieces = [];
  for (const srcPiece of toSquare.pieces) {
    const srcSquarePoly = transformPolygon(srcPiece.poly, srcPiece.targetTransform);
    for (const dstPiece of fromSquare.pieces) {
      const dstSquarePoly = transformPolygon(dstPiece.poly, dstPiece.sourceTransform);
      const inter = clipConvexPolygon(srcSquarePoly, dstSquarePoly);
      if (!inter.length) continue;
      pieces.push({
        poly: inter,
        sourceTransform: srcPiece.sourceTransform,
        targetTransform: dstPiece.targetTransform,
      });
    }
  }
  return { squareSide: toSquare.squareSide, pieces };
}

export function buildRectToRectDissection(a, b, c, d) {
  if (!(a > 0 && b > 0 && c > 0 && d > 0)) {
    throw new Error('Rectangle side lengths must be positive');
  }
  if (Math.abs(a * b - c * d) > 1e-8) {
    throw new Error(`Rectangles must have equal area, got ${a * b} and ${c * d}`);
  }
  if (a + EPS < c || b > d + EPS) {
    throw new Error('Expected normalized dimensions with a >= c and b <= d');
  }

  const overlap = [vec(0, 0), vec(c, 0), vec(c, b), vec(0, b)];
  const sourceLeftover = { x: c, y: 0, width: a - c, height: b };
  const targetLeftover = { x: 0, y: b, width: c, height: d - b };

  if (sourceLeftover.width < 1e-8 || targetLeftover.height < 1e-8) {
    return {
      source: { width: a, height: b },
      target: { width: c, height: d },
      overlap,
      pieces: [],
      sourceLeftover,
      targetLeftover,
    };
  }

  const direct = composeViaSquare(
    sourceLeftover.width,
    sourceLeftover.height,
    targetLeftover.width,
    targetLeftover.height
  );

  const sourceOffset = rigid(0, sourceLeftover.x, sourceLeftover.y);
  const targetOffset = rigid(0, targetLeftover.x, targetLeftover.y);

  return {
    source: { width: a, height: b },
    target: { width: c, height: d },
    overlap,
    sourceLeftover,
    targetLeftover,
    squareSide: direct.squareSide,
    pieces: direct.pieces.map((piece, idx) => ({
      id: idx,
      poly: piece.poly,
      sourceTransform: composeTransforms(sourceOffset, piece.sourceTransform),
      targetTransform: composeTransforms(targetOffset, piece.targetTransform),
    })),
  };
}

export function transformedPieceArea(piece, which = 'source') {
  return polygonAbsArea(transformPolygon(piece.poly, piece[`${which}Transform`]));
}

export function boundingBox(poly) {
  const xs = poly.map(p => p.x);
  const ys = poly.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function rigidFromPolygons(sourcePoly, targetPoly) {
  if (sourcePoly.length < 2 || targetPoly.length < 2) {
    throw new Error('Need at least 2 vertices to fit a rigid transform');
  }
  const p0 = sourcePoly[0];
  const p1 = sourcePoly[1];
  const q0 = targetPoly[0];
  const q1 = targetPoly[1];
  const sourceAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const targetAngle = Math.atan2(q1.y - q0.y, q1.x - q0.x);
  const angle = targetAngle - sourceAngle;
  const rp0 = rotatePoint(p0, angle);
  return {
    angle,
    tx: q0.x - rp0.x,
    ty: q0.y - rp0.y,
  };
}

export function extrudePolygon(poly, depth) {
  const bottom = poly.map(p => ({ x: p.x, y: p.y, z: 0 }));
  const top = poly.map(p => ({ x: p.x, y: p.y, z: depth }));
  const faces = [];
  const n = poly.length;

  for (let i = 1; i < n - 1; i++) faces.push([0, i, i + 1]);
  for (let i = 1; i < n - 1; i++) faces.push([n, n + i + 1, n + i]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j]);
    faces.push([i, n + j, n + i]);
  }

  return { vertices: [...bottom, ...top], faces };
}

export function applyTransform3D(point, t) {
  const angle = t.angle || 0;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = c * point.x - s * point.y;
  const y = s * point.x + c * point.y;
  return {
    x: x + t.tx,
    y: y + t.ty,
    z: point.z + (t.tz || 0),
  };
}

export function transformVertices3D(vertices, t) {
  return vertices.map(v => applyTransform3D(v, t));
}

export function prismVolumeFromPiece(piece, depth) {
  return polygonAbsArea(piece.poly) * depth;
}

function legacyRemapTransform3D(t, swapXY) {
  if (!swapXY) {
    return {
      angle: t.angle || 0,
      tx: t.tx,
      ty: t.ty,
      tz: t.tz || 0,
    };
  }
  return {
    angle: -(t.angle || 0),
    tx: t.ty,
    ty: t.tx,
    tz: t.tz || 0,
  };
}

export function buildExtrudedRectToRectDissection(a, b, c, d, depth) {
  const swapXY = !(a >= c - EPS && b <= d + EPS);
  const base = swapXY
    ? buildRectToRectDissection(b, a, d, c)
    : buildRectToRectDissection(a, b, c, d);
  const remap2D = poly => swapXY ? poly.map(p => ({ x: p.y, y: p.x })) : poly;
  return {
    ...base,
    source: { width: a, height: b },
    target: { width: c, height: d },
    overlap: remap2D(base.overlap),
    sourceLeftover: swapXY
      ? { x: base.sourceLeftover.y, y: base.sourceLeftover.x, width: base.sourceLeftover.height, height: base.sourceLeftover.width }
      : base.sourceLeftover,
    targetLeftover: swapXY
      ? { x: base.targetLeftover.y, y: base.targetLeftover.x, width: base.targetLeftover.height, height: base.targetLeftover.width }
      : base.targetLeftover,
    depth,
    overlapPrism: extrudePolygon(remap2D(base.overlap), depth),
    pieces: base.pieces.map(piece => ({
      ...piece,
      poly: remap2D(piece.poly),
      prism: extrudePolygon(remap2D(piece.poly), depth),
      sourcePathHint3D: {
        ...legacyRemapTransform3D({ ...piece.sourceTransform, tz: 0 }, swapXY),
      },
      targetPathHint3D: {
        ...legacyRemapTransform3D({ ...piece.targetTransform, tz: 0 }, swapXY),
      },
      sourceFacePoly: remap2D(transformPolygon(piece.poly, piece.sourceTransform)),
      targetFacePoly: remap2D(transformPolygon(piece.poly, piece.targetTransform)),
    })).map(piece => ({
      ...piece,
      sourceTransform3D: {
        ...rigidFromPolygons(piece.poly, piece.sourceFacePoly),
        tz: 0,
      },
      targetTransform3D: {
        ...rigidFromPolygons(piece.poly, piece.targetFacePoly),
        tz: 0,
      },
    })),
  };
}

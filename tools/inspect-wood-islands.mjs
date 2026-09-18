// NODE_PATH=/tmp/byte-to-bite-inspect/node_modules node inspect-wood-islands.mjs [field.glb]
// Prints a complete JSON report; no changes to the GLB or game.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { NodeIO } = createRequire(import.meta.url)('@gltf-transform/core');
const document = await new NodeIO().read(process.argv[2] || fileURLToPath(new URL('./field.glb', import.meta.url)));
const node = document.getRoot().listNodes().find(n => n.getName() === 'FieldStructure');
assert.ok(node, 'Missing FieldStructure');
const primitive = node.getMesh().listPrimitives()[0];
assert.equal(primitive.getMaterial().getName(), 'WoodMat');
assert.equal(primitive.getMode(), 4, 'Expected triangles');
const position = primitive.getAttribute('POSITION'), indices = primitive.getIndices();
const vertexCount = position.getCount(), elementCount = indices ? indices.getCount() : vertexCount;
assert.equal(elementCount % 3, 0);
const triangleCount = elementCount / 3, epsilon = 1e-5;
const xyz = position.getArray(), matrix = node.getWorldMatrix();
assert.equal(position.getElementSize(), 3);
const vertexAt = i => indices ? indices.getScalar(i) : i;
const parents = Int32Array.from({ length: vertexCount }, (_, i) => i);
const rank = new Uint8Array(vertexCount), used = new Uint8Array(vertexCount);
function root(v) {
  while (parents[v] !== v) { parents[v] = parents[parents[v]]; v = parents[v]; }
  return v;
}
function join(a, b) {
  a = root(a); b = root(b); if (a === b) return;
  if (rank[a] < rank[b]) [a, b] = [b, a];
  parents[b] = a;
  if (rank[a] === rank[b]) rank[a]++;
}
for (let i = 0; i < elementCount; i++) used[vertexAt(i)] = 1;
// Same Euclidean epsilon and 27 neighboring spatial cells as the click
// debugger, including duplicate vertices on normal/UV seams.
const buckets = new Map();
for (let v = 0; v < vertexCount; v++) {
  if (!used[v]) continue;
  const x = xyz[v*3], y = xyz[v*3+1], z = xyz[v*3+2];
  const bx = Math.floor(x/epsilon), by = Math.floor(y/epsilon), bz = Math.floor(z/epsilon);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    for (const other of buckets.get(`${bx+dx},${by+dy},${bz+dz}`) || []) {
      if ((x-xyz[other*3])**2 + (y-xyz[other*3+1])**2 + (z-xyz[other*3+2])**2 <= epsilon**2) join(v, other);
    }
  }
  const cell = `${bx},${by},${bz}`;
  if (!buckets.has(cell)) buckets.set(cell, []);
  buckets.get(cell).push(v);
}
// Connect each triangle once; welded shared vertices connect its neighbors.
for (let t = 0; t < triangleCount; t++) {
  const a = vertexAt(t*3);
  join(a, vertexAt(t*3+1)); join(a, vertexAt(t*3+2));
}
const components = new Map();
// This linear bookkeeping pass counts faces after union-find settles. No
// repeated flood-fills or per-seed traversal of already visited triangles.
for (let t = 0; t < triangleCount; t++) {
  const r = root(vertexAt(t*3));
  if (!components.has(r)) components.set(r, { id: t, triangles: 0, min: [Infinity,Infinity,Infinity], max: [-Infinity,-Infinity,-Infinity] });
  components.get(r).triangles++;
}
// Tight world bounds use every original referenced vertex, not weld centers.
for (let v = 0; v < vertexCount; v++) {
  if (!used[v]) continue;
  const island = components.get(root(v));
  for (let a = 0; a < 3; a++) {
    const value = matrix[a]*xyz[v*3] + matrix[4+a]*xyz[v*3+1] + matrix[8+a]*xyz[v*3+2] + matrix[12+a];
    island.min[a] = Math.min(island.min[a], value);
    island.max[a] = Math.max(island.max[a], value);
  }
}
const known = [
  { name: 'known floor island', x: [-0.25,4.85], z: [9.146,11.75] },
  { name: 'already added panel', x: [-0.031,0.031], z: [6.344,9.010] }
];
const tolerance = 0.01;
const islands = [...components.values()].map(island => {
  const size = island.max.map((v,a) => v-island.min[a]);
  const match = known.find(k => Math.abs(island.min[0]-k.x[0]) <= tolerance && Math.abs(island.max[0]-k.x[1]) <= tolerance
    && Math.abs(island.min[2]-k.z[0]) <= tolerance && Math.abs(island.max[2]-k.z[1]) <= tolerance);
  return { ...island, size, excluded: match?.name || null,
    candidate: !match && Math.min(size[0],size[2]) < 0.15 && island.triangles > 50 && island.triangles < 3796 };
});
assert.equal(islands.reduce((sum,i) => sum+i.triangles, 0), triangleCount);
console.log(JSON.stringify({ node: 'FieldStructure', primitive: 0, material: 'WoodMat', epsilon,
  triangleCount, islandCount: islands.length, worldMatrix: matrix,
  filter: 'Horizontal thickness <0.15; 50 < triangles <3796; exclude known X/Z bounds within 0.01',
  candidates: islands.filter(i => i.candidate),
  excludedKnown: islands.filter(i => i.excluded),
  // Preserve larger thin islands too, so the optional count cutoff hides no data.
  largerThinIslands: islands.filter(i => !i.excluded && Math.min(i.size[0],i.size[2]) < 0.15 && i.triangles >= 3796),
  islands }, null, 2));

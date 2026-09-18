// NODE_PATH=/tmp/byte-to-bite-inspect/node_modules node inspect-field-primitives.mjs [field.glb]
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { NodeIO } = createRequire(import.meta.url)('@gltf-transform/core');
const path = process.argv[2] || fileURLToPath(new URL('./field.glb', import.meta.url));
const bytes = await readFile(path);
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Expected GLB');
assert.equal(bytes.readUInt32LE(4), 2, 'Expected glTF 2');
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'Expected JSON chunk');
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const document = await new NodeIO().read(path);
const node = document.getRoot().listNodes().find(node => node.getName() === 'FieldStructure');
assert.ok(node, 'Missing FieldStructure');
const matrix = node.getWorldMatrix();
const rawNode = json.nodes.find(node => node.name === 'FieldStructure');
const primitives = json.meshes[rawNode.mesh].primitives;
const loadedPrimitives = node.getMesh().listPrimitives();
assert.equal(primitives.length, loadedPrimitives.length);
function transformBounds(min, max) {
  const worldMin = [Infinity, Infinity, Infinity], worldMax = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner++) {
    const point = min.map((value, axis) => corner & (1 << axis) ? max[axis] : value);
    for (let axis = 0; axis < 3; axis++) {
      const value = matrix[axis] * point[0] + matrix[4 + axis] * point[1]
        + matrix[8 + axis] * point[2] + matrix[12 + axis];
      worldMin[axis] = Math.min(worldMin[axis], value);
      worldMax[axis] = Math.max(worldMax[axis], value);
    }
  }
  return { min: worldMin, max: worldMax, size: worldMax.map((value, axis) => value - worldMin[axis]) };
}
const results = primitives.map((primitive, index) => {
  const accessorIndex = primitive.attributes.POSITION;
  const accessor = json.accessors[accessorIndex];
  assert.ok(accessor.min && accessor.max, 'Missing POSITION accessor bounds');
  // Verify metadata against decoded positions, rather than trusting stale bounds.
  const positions = loadedPrimitives[index].getAttribute('POSITION');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], point = [];
  for (let i = 0; i < positions.getCount(); i++) {
    positions.getElement(i, point);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(min[axis] - accessor.min[axis]) < 1e-5);
    assert.ok(Math.abs(max[axis] - accessor.max[axis]) < 1e-5);
  }
  const world = transformBounds(accessor.min, accessor.max);
  const overlapsRegion = world.max[0] >= 1 && world.min[0] <= 5
    && world.max[2] >= 5 && world.min[2] <= 10;
  const wallLike = Math.min(world.size[0], world.size[2]) <= 0.5 && world.size[1] >= 0.75;
  const nearWallHeight = world.min[1] <= 0.5 && world.max[1] <= 2.5;
  return { primitive: index, positionAccessor: accessorIndex,
    materialIndex: primitive.material ?? null,
    materialName: json.materials?.[primitive.material]?.name ?? '(unnamed/default)',
    local: { min: accessor.min, max: accessor.max }, world,
    overlapsRegion, wallLike, candidate: overlapsRegion && wallLike && nearWallHeight };
});
console.log(JSON.stringify({ node: 'FieldStructure', meshIndex: rawNode.mesh,
  worldMatrix: matrix, filter: 'Overlaps X=1..5/Z=5..10; horizontal thickness <=0.5; height >=0.75; Y within -infinity..2.5 with base <=0.5',
  primitives: results, candidates: results.filter(result => result.candidate).map(result => result.primitive) }, null, 2));

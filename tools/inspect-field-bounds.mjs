// Standalone inspection only; no browser or game runtime dependencies added.
// npm install --prefix /tmp/byte-to-bite-inspect @gltf-transform/core
// NODE_PATH=/tmp/byte-to-bite-inspect/node_modules node inspect-field-bounds.mjs [field.glb]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const document = await new NodeIO().read(process.argv[2] || fileURLToPath(new URL('./field.glb', import.meta.url)));

// Include descendants, like Three.js Box3.setFromObject(), and apply each
// mesh node's full world matrix exactly once to its actual vertices.
function worldBounds(root) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  root.traverse(node => {
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      const positions = primitive.getAttribute('POSITION');
      if (!positions) continue;
      const point = [];
      for (let i = 0; i < positions.getCount(); i++) {
        positions.getElement(i, point);
        for (let axis = 0; axis < 3; axis++) {
          const value = matrix[axis] * point[0] + matrix[4 + axis] * point[1]
            + matrix[8 + axis] * point[2] + matrix[12 + axis];
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      }
    }
  });
  return Number.isFinite(min[0]) ? { min, max, size: max.map((v, i) => v - min[i]) } : null;
}
const rows = document.getRoot().listNodes().map((node, index) => ({ index, name: node.getName(), bounds: worldBounds(node) }));
console.log('index\tname\tmin[x,y,z]\tmax[x,y,z]\tsize[x,y,z]');
const format = values => values.map(value => value.toFixed(4)).join(', ');
for (const { index, name, bounds } of rows) {
  console.log(`${index}\t${name || '(unnamed)'}\t${bounds ? [bounds.min, bounds.max, bounds.size].map(format).join('\t') : '(no geometry)'}`);
}

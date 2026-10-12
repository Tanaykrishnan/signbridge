import { writeFile, mkdir } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createDemoRig, disposeRig } from '../src/lib/avatar-rig';

// GLTFExporter uses the browser FileReader API for Blob conversion.
class BlobReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
    });
  }
}
Object.defineProperty(globalThis, 'FileReader', { value: BlobReader, configurable: true });
async function main() {
  const { root, clips } = createDemoRig();
  const result = await new GLTFExporter().parseAsync(root, { binary: true, animations: clips });
  if (!(result instanceof ArrayBuffer)) throw new Error('Expected binary GLB');
  await mkdir('public/assets/avatar', { recursive: true });
  await writeFile('public/assets/avatar/demo-rig.glb', Buffer.from(result));
  disposeRig(root);
  console.log(`Exported original demonstration rig (${result.byteLength} bytes). Not ISL content.`);
}
void main();

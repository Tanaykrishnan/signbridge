import type { Manifest, Sign } from './schemas';
import { manifestSchema } from './schemas';
export class AnimationRegistry {
  readonly manifest: Manifest;
  constructor(value: unknown) {
    this.manifest = manifestSchema.parse(value);
    const ids = this.manifest.signs.map((s) => s.id);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate sign IDs in manifest');
  }
  get(id: string): Sign | undefined {
    return this.manifest.signs.find((s) => s.id === id);
  }
  resolve(ids: string[]) {
    return ids.map((id) => ({ id, sign: this.get(id), missing: !this.get(id)?.available }));
  }
  missingClips(names: string[]) {
    return this.manifest.signs.filter((s) => s.available && !names.includes(s.clip));
  }
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dataDirectory } from './store';
import type { ParaphraseResult } from './paraphrase-schema';
let writes = Promise.resolve();
function filename(userId: string) {
  if (!/^[a-f0-9-]{36}$/.test(userId)) throw new Error('Invalid workspace ID');
  return path.join(dataDirectory(), 'paraphrases', `${userId}.json`);
}
export async function paraphraseHistory(userId: string): Promise<ParaphraseResult[]> {
  try {
    return JSON.parse(await fs.readFile(filename(userId), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
export async function saveParaphrase(userId: string, result: ParaphraseResult) {
  const work = writes
    .catch(() => {})
    .then(async () => {
      const file = filename(userId);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const history = await paraphraseHistory(userId);
      await fs.writeFile(
        file + '.tmp',
        JSON.stringify([{ ...result, persistence: 'saved-local' }, ...history].slice(0, 50)),
      );
      await fs.rename(file + '.tmp', file);
    });
  writes = work;
  await work;
}

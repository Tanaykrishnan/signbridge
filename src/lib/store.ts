import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { catalog, assets } from './catalog';
import {
  phraseSchema,
  signSchema,
  type Phrase,
  type Sign,
  type HistoryItem,
  type Favorite,
} from './schemas';
export interface Store {
  mode: 'local-file' | 'postgresql';
  phrases(): Promise<Phrase[]>;
  signs(): Promise<Sign[]>;
  history(userId: string): Promise<HistoryItem[]>;
  addHistory(
    userId: string,
    text: string,
    phraseId: string | null,
    status: 'supported' | 'unsupported',
    outputMode?: 'isl' | 'asl-fingerspelling',
  ): Promise<HistoryItem>;
  deleteHistory(userId: string, id: string): Promise<boolean>;
  favorites(userId: string): Promise<Favorite[]>;
  addFavorite(userId: string, phraseId: string): Promise<Favorite>;
  deleteFavorite(userId: string, id: string): Promise<boolean>;
}
const fileSchema = z.object({
  version: z.literal(1),
  phrases: z.array(phraseSchema),
  signs: z.array(signSchema),
  history: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      sourceText: z.string(),
      phraseId: z.string().nullable(),
      status: z.enum(['supported', 'unsupported']),
      createdAt: z.string(),
      outputMode: z.enum(['isl', 'asl-fingerspelling']).default('isl'),
    }),
  ),
  favorites: z.array(
    z.object({ id: z.string(), userId: z.string(), phraseId: z.string(), createdAt: z.string() }),
  ),
});
type State = z.infer<typeof fileSchema>;
const globalStore = globalThis as unknown as {
  sbLock?: Promise<unknown>;
  sbPrisma?: import('@prisma/client').PrismaClient;
};
export function dataDirectory() {
  // Runtime-private storage must not be bundled into a deployment artifact.
  return path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || '.data');
}
export class LocalFileStore implements Store {
  mode = 'local-file' as const;
  constructor(private directory = dataDirectory()) {}
  private async run<T>(fn: (state: State) => T, write = false): Promise<T> {
    const op = (globalStore.sbLock ?? Promise.resolve()).then(async () => {
      await fs.mkdir(this.directory, { recursive: true });
      const filename = path.join(this.directory, 'signbridge.json');
      let state: State;
      try {
        state = fileSchema.parse(JSON.parse(await fs.readFile(filename, 'utf8')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        state = { version: 1, phrases: catalog, signs: assets.signs, history: [], favorites: [] };
      }
      const result = fn(state);
      if (write) {
        const temp = filename + '.' + randomUUID() + '.tmp';
        await fs.writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
        await fs.rename(temp, filename);
      }
      return result;
    });
    globalStore.sbLock = op.catch(() => undefined);
    return op;
  }
  phrases() {
    return this.run((s) => s.phrases);
  }
  signs() {
    return this.run((s) => s.signs);
  }
  syncCatalog() {
    return this.run((s) => {
      s.phrases = catalog;
      s.signs = assets.signs;
    }, true);
  }
  history(userId: string) {
    return this.run((s) =>
      s.history
        .filter((h) => h.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  addHistory(
    userId: string,
    sourceText: string,
    phraseId: string | null,
    status: 'supported' | 'unsupported',
    outputMode: 'isl' | 'asl-fingerspelling' = 'isl',
  ) {
    return this.run((s) => {
      const h = {
        id: randomUUID(),
        userId,
        sourceText,
        phraseId,
        status,
        outputMode,
        createdAt: new Date().toISOString(),
      };
      s.history.push(h);
      return h;
    }, true);
  }
  deleteHistory(userId: string, id: string) {
    return this.run((s) => {
      const old = s.history.length;
      s.history = s.history.filter((h) => !(h.id === id && h.userId === userId));
      return old !== s.history.length;
    }, true);
  }
  favorites(userId: string) {
    return this.run((s) =>
      s.favorites
        .filter((f) => f.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  addFavorite(userId: string, phraseId: string) {
    return this.run((s) => {
      const old = s.favorites.find((f) => f.userId === userId && f.phraseId === phraseId);
      if (old) return old;
      const f = { id: randomUUID(), userId, phraseId, createdAt: new Date().toISOString() };
      s.favorites.push(f);
      return f;
    }, true);
  }
  deleteFavorite(userId: string, id: string) {
    return this.run((s) => {
      const old = s.favorites.length;
      s.favorites = s.favorites.filter((f) => !(f.id === id && f.userId === userId));
      return old !== s.favorites.length;
    }, true);
  }
}
async function prisma() {
  if (!globalStore.sbPrisma) {
    const { PrismaClient } = await import('@prisma/client');
    globalStore.sbPrisma = new PrismaClient();
  }
  return globalStore.sbPrisma;
}
export class PostgresStore implements Store {
  mode = 'postgresql' as const;
  async phrases() {
    return (await (await prisma()).phraseEntry.findMany({ orderBy: { text: 'asc' } })).map((p) =>
      phraseSchema.parse(p.payload),
    );
  }
  async signs() {
    return (await (await prisma()).signAsset.findMany()).map((s) => signSchema.parse(s.payload));
  }
  async history(userId: string) {
    return (
      await (
        await prisma()
      ).translationHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    ).map((h) => ({
      ...h,
      status: h.status as 'supported' | 'unsupported',
      outputMode: h.outputMode as 'isl' | 'asl-fingerspelling',
      createdAt: h.createdAt.toISOString(),
    }));
  }
  async addHistory(
    userId: string,
    sourceText: string,
    phraseId: string | null,
    status: 'supported' | 'unsupported',
    outputMode: 'isl' | 'asl-fingerspelling' = 'isl',
  ) {
    const db = await prisma();
    await db.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
    const h = await db.translationHistory.create({
      data: { userId, sourceText, phraseId, status, outputMode },
    });
    return { ...h, status, outputMode, createdAt: h.createdAt.toISOString() };
  }
  async deleteHistory(userId: string, id: string) {
    return (
      (await (await prisma()).translationHistory.deleteMany({ where: { id, userId } })).count > 0
    );
  }
  async favorites(userId: string) {
    return (
      await (
        await prisma()
      ).favorite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    ).map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }));
  }
  async addFavorite(userId: string, phraseId: string) {
    const db = await prisma();
    await db.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
    const f = await db.favorite.upsert({
      where: { userId_phraseId: { userId, phraseId } },
      create: { userId, phraseId },
      update: {},
    });
    return { ...f, createdAt: f.createdAt.toISOString() };
  }
  async deleteFavorite(userId: string, id: string) {
    return (await (await prisma()).favorite.deleteMany({ where: { id, userId } })).count > 0;
  }
}
export function getStore(): Store {
  return process.env.DATABASE_URL ? new PostgresStore() : new LocalFileStore();
}

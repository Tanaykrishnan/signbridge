import { PrismaClient, Prisma } from '@prisma/client';
import { catalog, assets } from '../src/lib/catalog';
const db = new PrismaClient();
async function main() {
  for (const p of catalog)
    await db.phraseEntry.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        text: p.text,
        category: p.category,
        review: p.review,
        payload: p as unknown as Prisma.InputJsonValue,
      },
      update: {
        text: p.text,
        category: p.category,
        review: p.review,
        payload: p as unknown as Prisma.InputJsonValue,
      },
    });
  for (const s of assets.signs)
    await db.signAsset.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        clip: s.clip,
        review: s.review,
        available: s.available,
        payload: s as unknown as Prisma.InputJsonValue,
      },
      update: {
        clip: s.clip,
        review: s.review,
        available: s.available,
        payload: s as unknown as Prisma.InputJsonValue,
      },
    });
}
main()
  .then(() => console.log('Illustrative catalogue seeded. No verified ISL assets.'))
  .finally(() => db.$disconnect());

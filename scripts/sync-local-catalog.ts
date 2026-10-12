import { LocalFileStore } from '../src/lib/store';

if (process.env.DATABASE_URL) throw new Error('DATABASE_URL is set. Use db:seed for PostgreSQL.');
void new LocalFileStore()
  .syncCatalog()
  .then(() => console.log('Local phrase/sign catalog updated. Guest records preserved.'));

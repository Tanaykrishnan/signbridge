import { api } from '@/lib/api';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = (req: Request) => api(req, 'translate');

import { api } from '@/lib/api';
export const runtime = 'nodejs';
export const GET = (req: Request) => api(req, 'capabilities');

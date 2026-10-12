import { api } from '@/lib/api';
export const GET = (req: Request) => api(req, 'history');
export const POST = (req: Request) => api(req, 'history');

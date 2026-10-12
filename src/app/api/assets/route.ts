import { api } from '@/lib/api';
export const GET = (req: Request) => api(req, 'assets');

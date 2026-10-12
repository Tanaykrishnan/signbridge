import { api } from '@/lib/api';
export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  api(req, 'phrases', (await ctx.params).id);

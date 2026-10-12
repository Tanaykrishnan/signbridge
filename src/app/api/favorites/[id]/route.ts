import { api } from '@/lib/api';
export const DELETE = async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  api(req, 'favorites', (await ctx.params).id);

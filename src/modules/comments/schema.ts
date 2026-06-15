import { z } from "zod";

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type CommentInput = z.infer<typeof commentInputSchema>;

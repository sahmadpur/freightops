import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, user } from "@/db/schema";

export type CommentRow = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
};

/** All comments on one order, oldest first (chat order). */
export async function listOrderComments(orderId: string): Promise<CommentRow[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: comments.authorId,
      authorName: user.name,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(user, eq(comments.authorId, user.id))
    .where(eq(comments.orderId, orderId))
    .orderBy(asc(comments.createdAt));
  return rows;
}

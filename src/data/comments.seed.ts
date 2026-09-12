import { createInMemoryStore } from "./inMemoryStore";
import type { Comment } from "../models/comment";
import { postStore } from "./posts.seed";
import { userStore } from "./users.seed";

export const commentStore = createInMemoryStore<Comment>();

const COMMENT_COUNT = 200;

/**
 * Builds `COMMENT_COUNT` deterministic seed comments, distributing them round-robin across every
 * seeded post and user so each comment's `postId`/`userId` always references a real record.
 *
 * @returns The complete array of seed `Comment` records.
 */
function buildSeedComments(): Comment[] {
  const now = new Date().toISOString();
  const posts = postStore.list();
  const users = userStore.list();
  const comments: Comment[] = [];

  for (let i = 1; i <= COMMENT_COUNT; i++) {
    const post = posts[(i - 1) % posts.length];
    const author = users[(i - 1) % users.length];
    comments.push({
      id: i,
      postId: post.id,
      userId: author.id,
      body: `Seeded comment number ${i} on post "${post.title}".`,
      createdAt: now,
    });
  }

  return comments;
}

/**
 * Deterministically (re)populates the comment store — FR-002/FR-003. Must run after posts/users have
 * seeded (imported above) so every `postId`/`userId` reference resolves.
 */
export function seedComments(): void {
  commentStore.reset(buildSeedComments());
}

seedComments();

import { randomUUID } from "node:crypto";
import { createKeyedStore } from "./keyedStore";
import type { Post } from "../models/post";
import { userStore } from "./users.seed";

export const postStore = createKeyedStore<Post>();

const POST_COUNT = 100;

function buildSeedPosts(): Post[] {
  const now = new Date().toISOString();
  const users = userStore.list();
  const posts: Post[] = [];

  for (let i = 1; i <= POST_COUNT; i++) {
    const author = users[(i - 1) % users.length];
    posts.push({
      id: randomUUID(),
      userId: author.id,
      title: `Post ${i}`,
      body: `This is the body of seeded post number ${i}, written by user ${author.id}.`,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return posts;
}

/**
 * Deterministically (re)populates the post store — FR-002/FR-003. Must run after users have seeded
 * (imported above) so every `userId` reference resolves. Post ids are random UUIDs (research.md); the
 * seed is still deterministic in every other observable way (count, content, author distribution).
 */
export function seedPosts(): void {
  postStore.reset(buildSeedPosts());
}

seedPosts();

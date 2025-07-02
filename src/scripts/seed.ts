import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { saasAccounts, saasFollows, saasUsers } from '../db/schema';

const TOTAL_USERS = 20;
const FOLLOW_PROBABILITY = 0.3;

async function seed() {
  console.log('🧼 Clearing old data...');
  await db.delete(saasFollows);
  await db.delete(saasUsers);
  await db.delete(saasAccounts);

  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('12345678', 10);

  const accountsToInsert = [];
  const usersToInsert = [];

  for (let i = 0; i < TOTAL_USERS; i++) {
    const accountId = createId();
    const userId = createId();

    accountsToInsert.push({
      id: accountId,
      email: faker.internet.email(),
      emailVerified: true,
      passwordHash,
    });

    usersToInsert.push({
      id: userId,
      displayName: faker.person.fullName(),
      userName: faker.internet.userName().toLowerCase().slice(0, 15),
      avatarUrl: faker.image.avatar(),
      bio: faker.lorem.sentence(5),
      website: faker.internet.url(),
      accountId,
      followerCount: 0,
      followingCount: 0,
    });
  }

  await db.insert(saasAccounts).values(accountsToInsert);
  await db.insert(saasUsers).values(usersToInsert);
  console.log('👥 Users and accounts created');

  const followsToInsert = [];

  for (const follower of usersToInsert) {
    for (const following of usersToInsert) {
      if (follower.id !== following.id && Math.random() < FOLLOW_PROBABILITY) {
        followsToInsert.push({
          followerId: follower.id,
          followingId: following.id,
        });

        follower.followingCount++;
        following.followerCount++;
      }
    }
  }

  if (followsToInsert.length > 0) {
    await db.insert(saasFollows).values(followsToInsert);

    await Promise.all(
      usersToInsert.map((user) =>
        db
          .update(saasUsers)
          .set({
            followerCount: user.followerCount,
            followingCount: user.followingCount,
          })
          .where(eq(saasUsers.id, user.id)),
      ),
    );
  }

  console.log(`🔗 ${followsToInsert.length} follow relationships created`);
  console.log('✅ Seeding complete!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

const db = require('../src/db');
const AuthService = require('../src/services/authService');
const ReferralService = require('../src/services/referralService');

async function runTest() {
  console.log('--- Starting Node.js Business Logic Test ---');

  // Wipe and Re-init for clean test
  try {
    await db.run('DELETE FROM referrals');
    await db.run('DELETE FROM transactions');
    await db.run('DELETE FROM withdrawals');
    await db.run('DELETE FROM users');
  } catch (e) {
    // If table doesn't exist, init it
    await db.initDb();
  }

  // 1. Register User 1
  console.log('Registering User 1...');
  const u1 = await AuthService.register('User One', '711111111', 'u1@node.com', 'Nairobi', 'pass123');
  const user1_id = u1.user_id;
  await ReferralService.processNewActiveUser(user1_id);
  const user1 = await db.get('SELECT referral_code FROM users WHERE id = ?', [user1_id]);
  console.log('User 1 active. Code:', user1.referral_code);

  // 2. Register User 2 (referred by U1)
  console.log('Registering User 2 (referred by U1)...');
  const u2 = await AuthService.register('User Two', '722222222', 'u2@node.com', 'Mombasa', 'pass123', user1.referral_code);
  const user2_id = u2.user_id;
  await ReferralService.processNewActiveUser(user2_id);

  const user1_after_u2 = await db.get('SELECT balance FROM users WHERE id = ?', [user1_id]);
  console.log('User 1 Balance after U2 join:', user1_after_u2.balance, '(Expected 850)');

  // 3. Register User 3 (referred by U2)
  console.log('Registering User 3 (referred by U2)...');
  const user2 = await db.get('SELECT referral_code FROM users WHERE id = ?', [user2_id]);
  const u3 = await AuthService.register('User Three', '733333333', 'u3@node.com', 'Kisumu', 'pass123', user2.referral_code);
  const user3_id = u3.user_id;
  await ReferralService.processNewActiveUser(user3_id);

  const user1_after_u3 = await db.get('SELECT balance FROM users WHERE id = ?', [user1_id]);
  const user2_after_u3 = await db.get('SELECT balance FROM users WHERE id = ?', [user2_id]);

  console.log('User 1 Balance after U3 join:', user1_after_u3.balance, '(Expected 1000)');
  console.log('User 2 Balance after U3 join:', user2_after_u3.balance, '(Expected 850)');

  if (user1_after_u3.balance == 1000 && user2_after_u3.balance == 850) {
    console.log('PASSED: Referral chain and commissions working correctly!');
  } else {
    console.log('FAILED: Commission calculation mismatch');
    process.exit(1);
  }

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});

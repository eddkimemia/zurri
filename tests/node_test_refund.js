const db = require('../src/db');
const TransactionService = require('../src/services/transactionService');

async function testRefund() {
  console.log('--- Testing Refund Logic ---');

  // 1. Create a user with balance
  const phone = '999888777';
  await db.run('DELETE FROM users WHERE phone = ?', [phone]);
  const user_res = await db.run(
    'INSERT INTO users (name, phone, password_hash, status, balance, referral_code) VALUES (?, ?, ?, ?, ?, ?)',
    ['Refund User', phone, 'hash', 'active', 2000, 'REF_TEST']
  );
  const user_id = user_res.id;

  // 2. Mock withdrawal initiation
  const amount = 500;
  await db.transaction(async () => {
    await db.run('INSERT INTO withdrawals (user_id, amount, mpesa_phone, status) VALUES (?, ?, ?, ?)', [user_id, amount, phone, 'pending']);
    const wd = await db.get('SELECT id FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [user_id]);
    await TransactionService.log(user_id, 'withdrawal', -amount, 'Test Withdrawal');
    console.log('Withdrawal initiated. Balance:', (await db.get('SELECT balance FROM users WHERE id = ?', [user_id])).balance, '(Expected 1500)');

    // 3. Fail it
    await db.run('UPDATE withdrawals SET status = "failed" WHERE id = ?', [wd.id]);
    await TransactionService.log(user_id, 'refund', amount, 'Refund for failed test');
    console.log('Withdrawal failed. Balance:', (await db.get('SELECT balance FROM users WHERE id = ?', [user_id])).balance, '(Expected 2000)');
  });

  const final_balance = (await db.get('SELECT balance FROM users WHERE id = ?', [user_id])).balance;
  if (final_balance == 2000) {
    console.log('PASSED: Refund logic confirmed!');
  } else {
    console.log('FAILED: Refund mismatch');
    process.exit(1);
  }
  process.exit(0);
}

testRefund().catch(err => {
  console.error(err);
  process.exit(1);
});

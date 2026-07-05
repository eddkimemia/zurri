const axios = require('axios');
const db = require('../src/db');

async function testSecureMpesa() {
  console.log('--- Testing Secure M-Pesa Callbacks ---');
  await db.initDb();

  // 1. STK Push Simulation
  console.log('1. Simulating STK Initiation...');
  await db.run("DELETE FROM users WHERE phone = '755000000'");
  await db.run("INSERT INTO users (name, phone, referral_code, password_hash, status) VALUES ('Secure Test', '755000000', 'SECURE123', 'hash', 'pending_payment')");
  const user = await db.get("SELECT id FROM users WHERE phone = '755000000'");

  const requestId = 'stk_req_' + Date.now();
  await db.run("INSERT INTO mpesa_requests (request_id, user_id, type, amount) VALUES (?, ?, 'stk_push', 1000)", [requestId, user.id]);

  console.log('Simulating STK Success Callback for:', requestId);
  const stkPayload = {
    Body: { stkCallback: { CheckoutRequestID: requestId, ResultCode: 0, ResultDesc: "Success" } }
  };

  const res1 = await axios.post('http://localhost:3000/api/mpesa/stk-callback', stkPayload);
  console.log('Callback Response:', res1.data);

  const updatedUser = await db.get("SELECT status FROM users WHERE id = ?", [user.id]);
  console.log('User status:', updatedUser.status);
  if (updatedUser.status === 'active') console.log('STK SUCCESS'); else throw new Error('STK FAILED');

  // 2. B2C Simulation
  console.log('\n2. Simulating B2C Initiation...');
  await db.run("INSERT INTO withdrawals (user_id, amount, mpesa_phone, status) VALUES (?, 1000, '755000000', 'pending')", [user.id]);
  const wd = await db.get("SELECT id FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 1", [user.id]);

  const convId = 'b2c_conv_' + Date.now();
  await db.run("INSERT INTO mpesa_requests (request_id, withdrawal_id, type, amount) VALUES (?, ?, 'b2c', 1000)", [convId, wd.id]);

  console.log('Simulating B2C Success Callback for:', convId);
  const b2cPayload = {
    Result: { ConversationID: convId, ResultCode: 0, ResultDesc: "Success" }
  };

  const res2 = await axios.post('http://localhost:3000/api/mpesa/b2c-callback', b2cPayload);
  console.log('Callback Response:', res2.data);

  const updatedWd = await db.get("SELECT status FROM withdrawals WHERE id = ?", [wd.id]);
  console.log('Withdrawal status:', updatedWd.status);
  if (updatedWd.status === 'completed') console.log('B2C SUCCESS'); else throw new Error('B2C FAILED');

  process.exit(0);
}
testSecureMpesa().catch(err => { console.error(err); process.exit(1); });

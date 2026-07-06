const axios = require('axios');
const db = require('../src/db');

async function testMpesaFlow() {
  console.log('--- Testing M-Pesa Flow ---');

  // 1. Create a pending user
  await db.initDb();
  await db.run("DELETE FROM users WHERE phone = '712000000'");
  await db.run("INSERT INTO users (name, phone, email, password_hash, referral_code, status) VALUES ('Mpesa Test', '712000000', 'mpesa@test.com', 'hash', 'TEST_CODE', 'pending_payment')");
  const user = await db.get("SELECT id FROM users WHERE phone = '712000000'");
  console.log('Created pending user:', user.id);

  // 2. Simulate STK Callback
  console.log('Simulating STK Success Callback...');
  const stkCallbackPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: "123",
        CheckoutRequestID: "456",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [{ Name: "Amount", Value: 1000 }]
        }
      }
    }
  };

  try {
    const res = await axios.post(`http://localhost:3000/api/mpesa/stk-callback?userId=${user.id}`, stkCallbackPayload);
    console.log('STK Callback Response:', res.data);

    // Verify user is active
    const updatedUser = await db.get("SELECT status, balance FROM users WHERE id = ?", [user.id]);
    console.log('Updated user status:', updatedUser.status, 'Balance:', updatedUser.balance);
    if (updatedUser.status === 'active' && updatedUser.balance === 500) {
      console.log('SUCCESS: User activated and received welcome bonus.');
    } else {
      console.error('FAILURE: User status or balance incorrect.');
    }
  } catch (err) {
    console.error('STK Callback simulation failed:', err.message);
  }

  // 3. Create a withdrawal
  console.log('\nTesting B2C Callback...');
  await db.run("INSERT INTO withdrawals (user_id, amount, mpesa_phone, status) VALUES (?, 1000, '712000000', 'pending')", [user.id]);
  const withdrawal = await db.get("SELECT id FROM withdrawals WHERE user_id = ? AND status = 'pending'", [user.id]);
  console.log('Created withdrawal:', withdrawal.id);

  const b2cCallbackPayload = {
    Result: {
      ResultCode: 0,
      ResultDesc: "The service request is processed successfully.",
      OriginatorConversationID: "123",
      ConversationID: "456",
      TransactionID: "XYZ789"
    }
  };

  try {
    const res = await axios.post(`http://localhost:3000/api/mpesa/b2c-callback?withdrawalId=${withdrawal.id}`, b2cCallbackPayload);
    console.log('B2C Callback Response:', res.data);

    const updatedWd = await db.get("SELECT status FROM withdrawals WHERE id = ?", [withdrawal.id]);
    console.log('Updated withdrawal status:', updatedWd.status);
    if (updatedWd.status === 'completed') {
      console.log('SUCCESS: Withdrawal marked as completed.');
    } else {
      console.error('FAILURE: Withdrawal status incorrect.');
    }
  } catch (err) {
    console.error('B2C Callback simulation failed:', err.message);
  }

  process.exit(0);
}

testMpesaFlow();

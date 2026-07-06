const db = require('../db');

class TransactionService {
  static async log(user_id, type, amount, description) {
    const user = await db.get('SELECT balance FROM users WHERE id = ?', [user_id]);
    if (!user) throw new Error('User not found');

    const new_balance = parseFloat(user.balance) + parseFloat(amount);

    // Note: We remove the internal transaction here to allow this method
    // to be called from within other transactions (like ReferralService).
    // The caller should wrap in a transaction if atomicity is required
    // for this specific log call.
    const result = await db.run(
      'INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?)',
      [user_id, type, amount, new_balance, description]
    );

    await db.run('UPDATE users SET balance = ? WHERE id = ?', [new_balance, user_id]);

    return { balance_after: new_balance, transaction_id: result.id };
  }

  static async getHistory(user_id, limit = 20) {
    return await db.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [user_id, limit]
    );
  }
}

module.exports = TransactionService;

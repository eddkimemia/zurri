const db = require('../db');
const TransactionService = require('./transactionService');

class ReferralService {
  static async processNewActiveUser(user_id) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) throw new Error('User not found');
    if (user.status !== 'pending_payment') return;

    // 1. Activate User
    await db.run(
      "UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user_id]
    );

    // 2. Handle Commissions
    if (user.referred_by_id) {
      // Level 1: Direct Referrer (KES 350)
      await this.addCommission(user.referred_by_id, user_id, 1, 350, 'Direct Referral Commission');

      const referrer = await db.get('SELECT referred_by_id FROM users WHERE id = ?', [user.referred_by_id]);
      if (referrer && referrer.referred_by_id) {
        // Level 2: Indirect Referrer (KES 150)
        await this.addCommission(referrer.referred_by_id, user_id, 2, 150, 'Indirect Referral (Upline) Commission');
      }
    }
  }

  static async addCommission(referrer_id, referred_id, level, amount, desc) {
    // Record in referrals table
    await db.run(
      'INSERT INTO referrals (referrer_id, referred_id, level, commission_amount) VALUES (?, ?, ?, ?)',
      [referrer_id, referred_id, level, amount]
    );

    // Update total_earned
    await db.run(
      'UPDATE users SET total_earned = total_earned + ? WHERE id = ?',
      [amount, referrer_id]
    );

    // Log transaction (TransactionService handles balance update)
    await TransactionService.log(referrer_id, level === 1 ? 'direct_commission' : 'upline_override', amount, desc);
  }

  static async getReferrals(user_id) {
    return await db.query(
      `SELECT r.*, u.name, u.created_at
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = ?
       ORDER BY r.created_at DESC`,
      [user_id]
    );
  }
}

module.exports = ReferralService;

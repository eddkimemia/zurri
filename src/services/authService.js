const bcrypt = require('bcryptjs');
const db = require('../db');

class AuthService {
  static async register(name, phone, email, county, password, referral_code = null) {
    if (!name || !phone || !password) {
      return { success: false, message: 'Missing required fields' };
    }

    const existingUser = await db.get('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existingUser) {
      return { success: false, message: 'Phone number already registered' };
    }

    let referred_by_id = null;
    if (referral_code) {
      const referrer = await db.get('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
      if (referrer) {
        referred_by_id = referrer.id;
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const new_referral_code = this.generateReferralCode(name, phone);

    return await db.transaction(async () => {
      const result = await db.run(
        'INSERT INTO users (name, phone, email, county, password_hash, referral_code, referred_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, phone, email || null, county, password_hash, new_referral_code, referred_by_id]
      );

      const user_id = result.id;

      // Log welcome bonus transaction (schema defaults balance to 500, but we log the entry)
      await db.run(
        'INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, "welcome_bonus", 500.00, 500.00, "Welcome Bonus — New Member")',
        [user_id]
      );

      return { success: true, message: 'Registration successful', user_id };
    });
  }

  static async login(phone, password) {
    const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (user && (await bcrypt.compare(password, user.password_hash))) {
      return { success: true, user };
    }
    return { success: false, message: 'Invalid phone number or password' };
  }

  static generateReferralCode(name, phone) {
    const namePart = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
    const phonePart = phone.substring(phone.length - 4);
    const random = Math.floor(10 + Math.random() * 89);
    return `${namePart}${phonePart}${random}`;
  }
}

module.exports = AuthService;

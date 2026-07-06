require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const db = require('./src/db');
const AuthService = require('./src/services/authService');
const ReferralService = require('./src/services/referralService');
const TransactionService = require('./src/services/transactionService');
const MpesaService = require('./src/services/mpesaService');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'zuri-agency-dev-secret-998877',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  } // 24 hours
}));

// Serve static files from public directory only
app.use(express.static(path.join(__dirname, 'public')));

// Custom CSRF Middleware
const csrfProtection = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const clientToken = req.headers['x-csrf-token'];
    const sessionToken = req.session.csrf_token;

    if (!sessionToken || clientToken !== sessionToken) {
      return res.status(403).json({ success: false, message: 'Invalid CSRF token' });
    }
  }
  next();
};

const generateCsrfToken = (req) => {
  if (!req.session.csrf_token) {
    req.session.csrf_token = require('crypto').randomBytes(32).toString('hex');
  }
  return req.session.csrf_token;
};

// Auth Middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.user_id) {
    return next();
  }
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

const isAdmin = (req, res, next) => {
  if (req.session.is_admin) {
    return next();
  }
  res.status(403).json({ success: false, message: 'Forbidden' });
};

// Routes
app.get('/api/csrf-token', (req, res) => {
  if (req.session.user_id) {
    res.json({ success: true, csrf_token: generateCsrfToken(req) });
  } else {
    res.status(401).json({ success: false, message: 'Not logged in' });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, phone, email, county, password, referral_code } = req.body;
  try {
    const result = await AuthService.register(name, phone, email, county, password, referral_code);

    if (result.success) {
      // Auto-login
      const loginResult = await AuthService.login(phone, password);
      if (loginResult.success) {
        req.session.user_id = loginResult.user.id;
        req.session.user_phone = loginResult.user.phone;
        req.session.is_admin = (loginResult.user.phone === '700000000');
        generateCsrfToken(req);
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/transactions', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const transactions = await db.query(`
      SELECT t.*, u.name as user_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const result = await AuthService.login(phone, password);

    if (result.success) {
      req.session.user_id = result.user.id;
      req.session.user_phone = result.user.phone;
      req.session.is_admin = (result.user.phone === '700000000');
      generateCsrfToken(req);
      res.json({ success: true, user: result.user });
    } else {
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// User Routes
app.get('/api/user/stats', isAuthenticated, async (req, res) => {
  try {
    const user = await db.get(`
      SELECT u.*,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id) as total_team,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id AND r.level = 1) as direct_count,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id AND r.level = 2) as indirect_count,
      (SELECT COALESCE(SUM(commission_amount), 0) FROM referrals r WHERE r.referrer_id = u.id AND r.level = 1) as direct_earned,
      (SELECT COALESCE(SUM(commission_amount), 0) FROM referrals r WHERE r.referrer_id = u.id AND r.level = 2) as indirect_earned
      FROM users u WHERE u.id = ?
    `, [req.session.user_id]);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/user/referrals', isAuthenticated, async (req, res) => {
  try {
    const referrals = await ReferralService.getReferrals(req.session.user_id);
    res.json({ success: true, referrals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/user/transactions', isAuthenticated, async (req, res) => {
  try {
    const transactions = await TransactionService.getHistory(req.session.user_id);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/user/withdraw', isAuthenticated, csrfProtection, async (req, res) => {
  const { amount, note } = req.body;
  try {
    const user = await db.get('SELECT balance, phone FROM users WHERE id = ?', [req.session.user_id]);

    if (amount < 500) return res.json({ success: false, message: 'Minimum withdrawal is KES 500' });
    if (amount > user.balance) return res.json({ success: false, message: 'Insufficient balance' });

    await db.transaction(async () => {
      await db.run('UPDATE users SET balance = balance - ?, total_withdrawn = total_withdrawn + ? WHERE id = ?', [amount, amount, req.session.user_id]);
      await db.run('INSERT INTO withdrawals (user_id, amount, mpesa_phone, note) VALUES (?, ?, ?, ?)', [req.session.user_id, amount, user.phone, note || '']);
      await TransactionService.log(req.session.user_id, 'withdrawal', -amount, 'Withdrawal to M-Pesa');
    });
    res.json({ success: true, message: 'Withdrawal request submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/activate', isAuthenticated, csrfProtection, async (req, res) => {
  try {
    const user = await db.get('SELECT phone FROM users WHERE id = ?', [req.session.user_id]);
    const result = await MpesaService.stkPush(user.phone, 1000, req.session.user_id);

    if (result.success) {
      // Store request for callback validation
      await db.run(
        'INSERT INTO mpesa_requests (request_id, user_id, type, amount) VALUES (?, ?, "stk_push", 1000)',
        [result.CheckoutRequestID, req.session.user_id]
      );
      res.json({ success: true, message: 'STK Push sent. Please enter your M-Pesa PIN.' });
    } else {
      res.json({ success: false, message: result.message || 'Failed to initiate payment' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// M-Pesa Callbacks
app.post('/api/mpesa/stk-callback', async (req, res) => {
  const { Body } = req.body;
  const requestId = Body.stkCallback.CheckoutRequestID;

  console.log(`STK Callback for request ${requestId}:`, JSON.stringify(Body));

  try {
    const mpesaReq = await db.get('SELECT * FROM mpesa_requests WHERE request_id = ? AND type = "stk_push"', [requestId]);
    if (!mpesaReq) {
      console.error(`Unauthorized or unknown STK callback for request ${requestId}`);
      return res.status(404).json({ ResultCode: 1, ResultDesc: "Rejected" });
    }

    if (Body.stkCallback.ResultCode === 0) {
      await db.transaction(async () => {
        await ReferralService.processNewActiveUser(mpesaReq.user_id);
        await db.run('UPDATE mpesa_requests SET status = "completed" WHERE id = ?', [mpesaReq.id]);
      });
      console.log(`Account activated for user ${mpesaReq.user_id} via M-Pesa`);
    } else {
      await db.run('UPDATE mpesa_requests SET status = "failed" WHERE id = ?', [mpesaReq.id]);
    }
  } catch (err) {
    console.error(`Error processing STK callback:`, err.message);
  }

  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

app.post('/api/mpesa/b2c-callback', async (req, res) => {
  const { Result } = req.body;
  const requestId = Result.ConversationID;

  console.log(`B2C Callback for request ${requestId}:`, JSON.stringify(Result));

  try {
    const mpesaReq = await db.get('SELECT * FROM mpesa_requests WHERE request_id = ? AND type = "b2c"', [requestId]);
    if (!mpesaReq) {
      console.error(`Unauthorized or unknown B2C callback for request ${requestId}`);
      return res.status(404).json({ ResultCode: 1, ResultDesc: "Rejected" });
    }

    const status = (Result.ResultCode === 0) ? 'completed' : 'failed';

    const withdrawal = await db.get('SELECT * FROM withdrawals WHERE id = ?', [mpesaReq.withdrawal_id]);
    if (!withdrawal || withdrawal.status !== 'pending') return res.json({ ResultCode: 0, ResultDesc: "Success" });

    await db.transaction(async () => {
      await db.run("UPDATE withdrawals SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?", [status, mpesaReq.withdrawal_id]);
      await db.run('UPDATE mpesa_requests SET status = ? WHERE id = ?', [status, mpesaReq.id]);

      if (status === 'failed') {
        await TransactionService.log(withdrawal.user_id, 'refund', withdrawal.amount, `Refund for failed M-Pesa withdrawal #${mpesaReq.withdrawal_id}`);
      }
    });
  } catch (err) {
    console.error(`Error processing B2C callback:`, err.message);
  }

  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

app.post('/api/mpesa/b2c-timeout', (req, res) => {
  console.log('B2C Timeout:', req.body);
  res.json({ ResultCode: 0, ResultDesc: "Success" });
});

// Admin Routes
app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const total_users = (await db.get('SELECT COUNT(*) as count FROM users')).count;
    const total_revenue = (await db.get("SELECT COUNT(*) * 1000 as rev FROM users WHERE status != 'pending_payment'")).rev;
    const total_paid_out = (await db.get("SELECT SUM(amount) as sum FROM transactions WHERE type IN ('direct_commission', 'upline_override', 'welcome_bonus')")).sum || 0;
    const pending_withdrawals = (await db.get("SELECT SUM(amount) as sum FROM withdrawals WHERE status = 'pending'")).sum || 0;
    const platform_profit = total_revenue - total_paid_out;

    res.json({
      success: true,
      stats: { total_users, total_revenue, total_paid_out, pending_withdrawals, platform_profit }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await db.query(`
      SELECT u.*,
      (SELECT referral_code FROM users r WHERE r.id = u.referred_by_id) as referred,
      u.total_earned as earned
      FROM users u
    `);

    // Add UI properties
    const usersWithUI = users.map(u => ({
      ...u,
      initials: u.name.split(' ').map(n => n[0]).join('').toUpperCase(),
      color: 'bg-brand-100 text-brand-700'
    }));

    res.json({ success: true, users: usersWithUI });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/withdrawals', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const withdrawals = await db.query(`
      SELECT w.*, u.name
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.created_at DESC
    `);
    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/withdrawals', isAuthenticated, isAdmin, csrfProtection, async (req, res) => {
  const { id, status } = req.body;
  if (!['approved', 'failed'].includes(status)) return res.json({ success: false, message: 'Invalid status' });

  try {
    const withdrawal = await db.get('SELECT * FROM withdrawals WHERE id = ?', [id]);
    if (!withdrawal || withdrawal.status !== 'pending') return res.json({ success: false, message: 'Invalid withdrawal' });

    if (status === 'approved') {
      const result = await MpesaService.b2cRequest(withdrawal.mpesa_phone, withdrawal.amount, id);
      if (result.success) {
        // Store request for callback validation
        await db.run(
          'INSERT INTO mpesa_requests (request_id, withdrawal_id, type, amount) VALUES (?, ?, "b2c", ?)',
          [result.ConversationID, id, withdrawal.amount]
        );
        res.json({ success: true, message: 'B2C payment initiated via M-Pesa' });
      } else {
        res.json({ success: false, message: result.message || 'M-Pesa B2C failed' });
      }
    } else {
      // Manual fail
      await db.transaction(async () => {
        await db.run("UPDATE withdrawals SET status = 'failed', processed_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
        await TransactionService.log(withdrawal.user_id, 'refund', withdrawal.amount, `Refund for failed withdrawal #${id}`);
      });
      res.json({ success: true, message: 'Withdrawal rejected and refunded' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Catch-all to serve index.html for unknown routes (optional, but good for SPAs)
// app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Start Server
db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

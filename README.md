# ZuriAgency — Production-Ready Referral Platform

ZuriAgency is a high-performance, referral-based income platform tailored for the Kenyan market. It features a robust two-tier commission engine, a secure immutable ledger, and comprehensive administrative controls.

## 🚀 Tech Stack
- **Frontend:** HTML5, Tailwind CSS, Lucide Icons (Static)
- **Backend:** Node.js, Express.js
- **Database:** SQLite (Relational Ledger)
- **Security:** BCRYPT Hashing, CSRF Protection, XSS Sanitization

## 💰 Commission Structure
1. **Welcome Bonus:** KES 500 (Credited immediately upon registration)
2. **Direct Referral (Level 1):** KES 350
3. **Indirect Referral (Level 2):** KES 150

## 🛠️ Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Database:**
   The database is automatically initialized on the first server start using `schema.sqlite.sql`.

3. **Start the Server:**
   ```bash
   node server.js
   ```
   The application will be available at `http://localhost:8000`.

## 🧪 Testing & Verification

We provide automated Node.js scripts to verify the core business logic.

1. **Full Referral Flow Test:**
   Validates the two-tier commission calculation and user activation.
   ```bash
   node tests/node_verify_flow.js
   ```

2. **Withdrawal Refund Test:**
   Ensures that failing a withdrawal as an admin correctly refunds the user's balance.
   ```bash
   node tests/node_test_refund.js
   ```

## 🔐 Security Features
- **CSRF Protection:** State-changing requests (POST/PUT/DELETE) require a valid `X-CSRF-TOKEN` header, obtainable from `/api/csrf-token`.
- **XSS Protection:** All dynamic content in the dashboard is sanitized using a global `esc()` utility.
- **Session Management:** Secure Express sessions for authentication.
- **Accounting Integrity:** Balance updates are performed within ACID-compliant database transactions.

## 👥 Admin Access
- **Admin Phone:** `700000000`
- **Admin Password:** Seeded via script or manually in DB (Default for testing: `admin123`).
- **Dashboard:** Access via `/admin/dashboard.html` after logging in.

## 📁 Repository Structure
- `/src/db.js`: Database connection and schema management.
- `/src/services/`: Core business logic (Auth, Referrals, Transactions).
- `/tests/`: Automated verification scripts.
- `/server.js`: Express application and API route definitions.
- `index.html`, `auth.html`, `dashboard.html`: Frontend application layers.

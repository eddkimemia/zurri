# ZuriAgency — Refer. Earn. Grow.

ZuriAgency is a production-ready referral-based income platform tailored for the Kenyan market. It allows users to earn commissions by referring others to the platform through a transparent, two-level structure.

## 🚀 Key Features
- **Instant Payouts**: Direct integration with M-Pesa (simulated for sandbox).
- **Two-Level Commissions**: Earn KES 350 for direct referrals and KES 150 for indirect referrals.
- **Welcome Bonus**: New users receive KES 500 instantly upon joining.
- **Robust Ledger**: Every transaction is recorded in an immutable ledger.
- **Admin Dashboard**: Comprehensive management of users, stats, and withdrawal approvals.

## 🛠 Tech Stack
- **Frontend**: Tailwind CSS, Lucide Icons, Vanilla JS (Fetch API).
- **Backend**: PHP 8.3.
- **Database**: SQLite (Production-ready schema included for MySQL/MariaDB).

---

## 🧪 How to Test (Step-by-Step)

Follow these steps to verify the entire platform flow:

### 1. Start the Local Server
Run the following command in the repository root:
```bash
php -S localhost:8000
```
Then navigate to `http://localhost:8000` in your browser.

### 2. Seed the Admin Account
To access the admin panel, you need to seed the database:
```bash
php tests/seed_admin.php
```
**Admin Credentials**:
- **Phone**: `700000000`
- **Password**: `admin123`

### 3. User Registration (Referrer)
1. Go to the home page and click **"Join Now"**.
2. Switch to the **"Create Account"** tab.
3. Register a new user (e.g., "User One", Phone: `711111111`).
4. On the success screen, click **"I've Sent the Payment"** (Simulates KES 1,000 activation).
5. Click **"Go to Dashboard"**. You should see your **KES 500 Welcome Bonus**.
6. Copy your **Referral Code** from the sidebar or Profile section.

### 4. Direct Referral (Earn KES 350)
1. Open a private/incognito window or logout.
2. Register a second user (e.g., "User Two", Phone: `722222222`).
3. **Important**: Enter the Referral Code from User One during registration.
4. Activate User Two by clicking **"I've Sent the Payment"**.
5. Login back as **User One**. Your balance should now be **KES 850** (500 bonus + 350 direct).

### 5. Indirect Referral (Earn KES 150)
1. Register a third user (User Three) using User Two's referral code.
2. Activate User Three.
3. Login as **User One**. Your balance should now be **KES 1,000** (850 + 150 indirect).

### 6. Withdrawal & Admin Approval
1. While logged in as User One, go to the **"Withdraw"** tab.
2. Enter an amount (e.g., KES 600) and click **"Withdraw to M-Pesa"**.
3. Login as **Admin** (`700000000` / `admin123`).
4. Go to the **"Withdrawals"** tab.
5. Find the request and click the **Checkmark (Approve)** icon.

---

## 📂 Project Structure
- `api/`: Backend endpoints for user and admin actions.
- `src/`: Core logic (Auth, ReferralManager, TransactionManager).
- `tests/`: Automated test scripts and seeders.
- `zuriagency.db`: SQLite database file.
- `index.html`: Landing page.
- `auth.html`: Integrated Login/Registration page.
- `dashboard.html`: User panel.
- `admin/dashboard.html`: Administration panel.

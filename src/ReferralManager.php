<?php
require_once __DIR__ . '/Database.php';

class ReferralManager {
    private $db;
    const DIRECT_COMMISSION = 350.00;
    const INDIRECT_COMMISSION = 150.00;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }

    public function processNewActiveUser($new_user_id) {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$new_user_id]);
        $user = $stmt->fetch();

        if (!$user || $user['status'] === 'active') return;

        try {
            $this->db->beginTransaction();

            // 1. Activate user
            $stmt = $this->db->prepare("UPDATE users SET status = 'active' WHERE id = ?");
            $stmt->execute([$new_user_id]);

            // 2. Pay Direct Referrer
            if ($user['referred_by_id']) {
                $this->payCommission($user['referred_by_id'], $new_user_id, 1, self::DIRECT_COMMISSION);

                // 3. Pay Indirect Referrer (Upline)
                $stmt = $this->db->prepare("SELECT referred_by_id FROM users WHERE id = ?");
                $stmt->execute([$user['referred_by_id']]);
                $upline = $stmt->fetch();

                if ($upline && $upline['referred_by_id']) {
                    $this->payCommission($upline['referred_by_id'], $new_user_id, 2, self::INDIRECT_COMMISSION);
                }
            }

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function payCommission($referrer_id, $referred_id, $level, $amount) {
        // Update referrer balance
        $stmt = $this->db->prepare("UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE id = ?");
        $stmt->execute([$amount, $amount, $referrer_id]);

        // Record referral
        $stmt = $this->db->prepare("INSERT INTO referrals (referrer_id, referred_id, level, commission_amount) VALUES (?, ?, ?, ?)");
        $stmt->execute([$referrer_id, $referred_id, $level, $amount]);

        // Get new balance for ledger
        $stmt = $this->db->prepare("SELECT balance, name FROM users WHERE id = ?");
        $stmt->execute([$referrer_id]);
        $referrer = $stmt->fetch();

        $stmt = $this->db->prepare("SELECT name FROM users WHERE id = ?");
        $stmt->execute([$referred_id]);
        $referred = $stmt->fetch();

        $type = ($level === 1) ? 'direct_commission' : 'upline_override';
        $desc = ($level === 1) ? "Direct Commission — " . $referred['name'] : "Upline Override — via " . $referred['name'];

        // Log transaction
        $stmt = $this->db->prepare("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$referrer_id, $type, $amount, $referrer['balance'], $desc]);
    }
}

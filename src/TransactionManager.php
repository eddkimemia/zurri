<?php
require_once __DIR__ . '/Database.php';

class TransactionManager {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
    }

    public function log($user_id, $type, $amount, $description) {
        $stmt = $this->db->prepare("SELECT balance FROM users WHERE id = ?");
        $stmt->execute([$user_id]);
        $user = $stmt->fetch();

        $new_balance = $user['balance'] + $amount;

        $stmt = $this->db->prepare("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$user_id, $type, $amount, $new_balance, $description]);

        // Also update the user's actual balance
        $stmt = $this->db->prepare("UPDATE users SET balance = ? WHERE id = ?");
        $stmt->execute([$new_balance, $user_id]);

        return $new_balance;
    }

    public function getHistory($user_id, $limit = 20) {
        $stmt = $this->db->prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?");
        $stmt->execute([$user_id, $limit]);
        return $stmt->fetchAll();
    }
}

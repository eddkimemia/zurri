<?php
require_once __DIR__ . '/Database.php';

class Auth {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance()->getConnection();
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    public function register($name, $phone, $email, $county, $password, $referred_by_code = null) {
        // Basic validation
        if (empty($name) || empty($phone) || empty($password)) {
            return ['success' => false, 'message' => 'Missing required fields'];
        }

        // Check if user already exists
        $stmt = $this->db->prepare("SELECT id FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        if ($stmt->fetch()) {
            return ['success' => false, 'message' => 'Phone number already registered'];
        }

        // Handle referral
        $referred_by_id = null;
        if (!empty($referred_by_code)) {
            $stmt = $this->db->prepare("SELECT id FROM users WHERE referral_code = ?");
            $stmt->execute([$referred_by_code]);
            $referrer = $stmt->fetch();
            if ($referrer) {
                $referred_by_id = $referrer['id'];
            }
        }

        $password_hash = password_hash($password, PASSWORD_BCRYPT);
        $referral_code = $this->generateReferralCode($name, $phone);

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("INSERT INTO users (name, phone, email, county, password_hash, referral_code, referred_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$name, $phone, $email, $county, $password_hash, $referral_code, $referred_by_id]);
            $user_id = $this->db->lastInsertId();

            // Log welcome bonus transaction (starts with 500 in schema)
            $stmt = $this->db->prepare("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, 'welcome_bonus', 500.00, 500.00, 'Welcome Bonus — New Member')");
            $stmt->execute([$user_id]);

            $this->db->commit();
            return ['success' => true, 'message' => 'Registration successful', 'user_id' => $user_id];
        } catch (Exception $e) {
            $this->db->rollBack();
            return ['success' => false, 'message' => 'Registration failed: ' . $e->getMessage()];
        }
    }

    public function login($phone, $password) {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['name'];
            $_SESSION['is_admin'] = ($user['phone'] === '700000000'); // Hardcoded admin for demo
            $this->generateCsrfToken();
            return ['success' => true, 'user' => $user];
        }

        return ['success' => false, 'message' => 'Invalid phone number or password'];
    }

    public function logout() {
        session_destroy();
        return ['success' => true];
    }

    public function generateCsrfToken() {
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }

    public function verifyCsrfToken($token) {
        if (empty($_SESSION['csrf_token']) || empty($token)) {
            return false;
        }
        return hash_equals($_SESSION['csrf_token'], $token);
    }

    public function isLoggedIn() {
        return isset($_SESSION['user_id']);
    }

    public function getCurrentUser() {
        if (!isset($_SESSION['user_id'])) return null;
        $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        return $stmt->fetch();
    }

    private function generateReferralCode($name, $phone) {
        $name_part = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $name), 0, 4));
        $phone_part = substr($phone, -4);
        return $name_part . $phone_part . rand(10, 99);
    }
}

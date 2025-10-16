<?php
// --- Error policy: log to file, never echo to clients ---
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/php-error.log');

// --- DB CONFIG ---
// Remote (example):
/*
const DB_HOST = 'db.dw232.nameserver.sk';
const DB_NAME = 'pokracuj';
const DB_USER = 'pokracuj';
const DB_PASS = 'REPLACE_ME';
*/
// Local (XAMPP default):
const DB_HOST = '127.0.0.1';
const DB_NAME = 'pokracuj';
const DB_USER = 'root';
const DB_PASS = '';

// Referral percent (e.g., 1.0 == 1%)
const REFERRAL_RATE = 1.0;

// --- Session & headers ---
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => !empty($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}
header('Content-Type: application/json; charset=utf-8');

// --- PDO ---
function pdo(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
  $opt = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];
  $pdo = new PDO($dsn, DB_USER, DB_PASS, $opt);
  return $pdo;
}

// --- JSON helpers (wipe stray output) ---
function json_ok($data = null, int $code = 200): void {
  if (ob_get_length()) @ob_clean();
  http_response_code($code);
  echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
  exit;
}
function json_error(string $msg, int $code = 400, $extra = null): void {
  if (ob_get_length()) @ob_clean();
  http_response_code($code);
  $payload = ['ok' => false, 'error' => $msg];
  if ($extra !== null) $payload['data'] = $extra;
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

// --- Role normalization (for safety/tolerance) ---
function normalize_role($raw) {
  $s = strtolower((string)$raw);
  if ($s === '1' || $s === 'true') return 'admin';
  if (in_array($s, ['admin','administrator','superadmin','owner'], true)) return 'admin';
  return 'user';
}

// --- Auth helpers ---
function require_login(): void {
  if (!isset($_SESSION['user_id'])) json_error('Not authenticated', 401);
}
function require_login_json(): void { // alias used in balances
  require_login();
}
function require_admin(): void {
  if (!isset($_SESSION['user_id'])) json_error('Not authenticated', 401);
  if (normalize_role($_SESSION['role'] ?? 'user') !== 'admin') json_error('Forbidden', 403);
}
function current_user(): ?array {
  if (!isset($_SESSION['user_id'])) return null;
  return [
    'id'    => (int)$_SESSION['user_id'],
    'email' => $_SESSION['email'] ?? null,
    'role'  => normalize_role($_SESSION['role'] ?? 'user'),
  ];
}

// --- Utils ---
function read_json(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '[]', true);
  if (!is_array($data)) json_error('Invalid JSON', 400);
  return $data;
}
function ensure_balances_row(int $user_id): void {
  $db = pdo();
  $db->prepare("INSERT IGNORE INTO balances (user_id) VALUES (?)")->execute([$user_id]);
}

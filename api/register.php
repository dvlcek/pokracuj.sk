<?php
require __DIR__ . '/config.php';

$input = read_json();
$email = strtolower(trim($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');
$name = (string)($input['name'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Neplatný email');
if (strlen($password) < 8) json_error('Heslo musí mať aspoň 8 znakov');

$db = pdo();
$exists = $db->prepare("SELECT id FROM users WHERE email=?");
$exists->execute([$email]);
if ($exists->fetch()) json_error('Účet s týmto emailom už existuje');

$hash = password_hash($password, PASSWORD_DEFAULT);
$db->prepare("INSERT INTO users (email, password_hash, name) VALUES (?,?,?)")->execute([$email, $hash, $name]);
$user_id = (int)$db->lastInsertId();

ensure_balances_row($user_id);

// login immediately
$_SESSION['user_id'] = $user_id;
$_SESSION['email']   = $email;
$_SESSION['name']    = $name;
$_SESSION['role']    = 'user';

json_ok(['email' => $email, 'role' => 'user', 'name' => $name], 201);

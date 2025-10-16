<?php
require __DIR__ . '/config.php';
require_login();
require_admin();

$db = pdo();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $st = $db->query("
    SELECT u.id, u.email, u.role, IFNULL(b.main_cents,0) AS main_cents, IFNULL(b.bonus_cents,0) AS bonus_cents
    FROM users u
    LEFT JOIN balances b ON b.user_id = u.id
    ORDER BY u.email ASC
  ");
  $rows = $st->fetchAll();

  $data = array_map(function($r){
    return [
      'id'    => (int)$r['id'],
      'email' => $r['email'],
      'role'  => $r['role'],
      'main'  => ((int)$r['main_cents'])  / 100,
      'bonus' => ((int)$r['bonus_cents']) / 100,
    ];
  }, $rows);

  json_ok($data);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $in = read_json();
  $uid   = (int)($in['user_id'] ?? 0);
  $mainE = max(0, (float)($in['main']  ?? 0));
  $bonusE= max(0, (float)($in['bonus'] ?? 0));

  if ($uid <= 0) json_error('Invalid user_id');

  try {
    $db->beginTransaction();

    ensure_balances_row($uid);
    // read old values
    $st = $db->prepare("SELECT main_cents, bonus_cents FROM balances WHERE user_id=? FOR UPDATE");
    $st->execute([$uid]);
    $old = $st->fetch() ?: ['main_cents'=>0,'bonus_cents'=>0];

    $oldMainC = (int)$old['main_cents'];
    $newMainC = (int)round($mainE  * 100);
    $newBonusC= (int)round($bonusE * 100);

    // update user balances
    $upd = $db->prepare("UPDATE balances SET main_cents=?, bonus_cents=? WHERE user_id=?");
    $upd->execute([$newMainC, $newBonusC, $uid]);

    // If main increased, credit the referrer's bonus by REFERRAL_RATE * delta
    $deltaC = $newMainC - $oldMainC;
    if ($deltaC > 0 && REFERRAL_RATE > 0) {
      // Find referrer
      $st2 = $db->prepare("SELECT referrer_id FROM users WHERE id=?");
      $st2->execute([$uid]);
      $refId = (int)$st2->fetchColumn();

      if ($refId > 0) {
        ensure_balances_row($refId);

        // Compute referral credit
        $creditC = (int)round($deltaC * (REFERRAL_RATE / 10.0));
        if ($creditC > 0) {
          $upd2 = $db->prepare("UPDATE balances SET bonus_cents = bonus_cents + ? WHERE user_id=?");
          $upd2->execute([$creditC, $refId]);
        }
      }
    }

    $db->commit();
    json_ok(['updated' => true, 'referral_credit_applied' => ($deltaC > 0)]);
  } catch (Throwable $e) {
    if ($db->inTransaction()) $db->rollBack();
    json_error('DB error: ' . $e->getMessage(), 500);
  }
}

json_error('Method not allowed', 405);

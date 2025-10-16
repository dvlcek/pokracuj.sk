<?php
require __DIR__ . '/config.php';
require_login();

$db = pdo();
$userId = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/**
 * Pomocná funkcia: načítaj môj záznam a prípadne aj referrer email
 */
function load_me_with_ref(PDO $db, int $userId): array {
    $st = $db->prepare("
        SELECT u.id, u.email, u.referrer_id, r.email AS referrer_email
        FROM users u
        LEFT JOIN users r ON r.id = u.referrer_id
        WHERE u.id = ?
        LIMIT 1
    ");
    $st->execute([$userId]);
    $me = $st->fetch(PDO::FETCH_ASSOC);
    if (!$me) json_error('Používateľ neexistuje', 404);
    return $me;
}

switch ($method) {
    case 'GET': {
        $me = load_me_with_ref($db, $userId);
        if (empty($me['referrer_id'])) {
            json_ok([
                'has_referral' => false,
                'referrer'     => null
            ]);
        }
        json_ok([
            'has_referral' => true,
            'referrer'     => [
                'id'    => (int)$me['referrer_id'],
                'email' => $me['referrer_email'],
            ]
        ]);
        break;
    }

    case 'POST':
    case 'PUT':
    case 'PATCH': {
        $input = read_json();
        $refEmail = strtolower(trim($input['referral'] ?? ''));
        if (!$refEmail) json_error('Musíš zadať email odporúčajúceho');
        if (!filter_var($refEmail, FILTER_VALIDATE_EMAIL)) json_error('Neplatný email');

        // môj záznam
        $me = load_me_with_ref($db, $userId);

        // nájdi referrer účet
        $rf = $db->prepare("SELECT id, email FROM users WHERE email = ? LIMIT 1");
        $rf->execute([$refEmail]);
        $ref = $rf->fetch(PDO::FETCH_ASSOC);
        if (!$ref) json_error('Odporúčajúci neexistuje');

        // self-referral nie
        if ((int)$ref['id'] === $userId) json_error('Nemôžeš odporučiť sám seba');

        // jednoduchá ochrana proti kruhom: referrer ma nesmie mať ako referrer_id
        $st2 = $db->prepare("SELECT referrer_id FROM users WHERE id = ? LIMIT 1");
        $st2->execute([(int)$ref['id']]);
        $theirRef = (int)$st2->fetchColumn();
        if ($theirRef === $userId) json_error('Neplatná reťaz odporúčaní');

        // ak už je nastavený rovnaký, nič nemeň
        if ((int)$me['referrer_id'] === (int)$ref['id']) {
            json_ok([
                'message'   => 'Referral už bol nastavený na tento email',
                'referrer'  => $ref['email'],
                'updated'   => false
            ]);
        }

        // nastav / zmeň
        $upd = $db->prepare("UPDATE users SET referrer_id = ? WHERE id = ?");
        $upd->execute([(int)$ref['id'], $userId]);

        json_ok([
            'message'  => empty($me['referrer_id']) ? 'Referral bol úspešne pridaný' : 'Referral bol aktualizovaný',
            'referrer' => $ref['email'],
            'updated'  => true
        ], empty($me['referrer_id']) ? 201 : 200);

        break;
    }

    case 'DELETE': {
        // zruš referral
        $me = load_me_with_ref($db, $userId);
        if (empty($me['referrer_id'])) {
            json_ok(['message' => 'Žiadny referral nie je nastavený', 'removed' => false]);
        } else {
            $upd = $db->prepare("UPDATE users SET referrer_id = NULL WHERE id = ?");
            $upd->execute([$userId]);
            json_ok([
                'message' => 'Referral bol odstránený',
                'removed' => true
            ]);
        }
        break;
    }

    default:
        json_error('Nepodporovaná metóda', 405);
}

<?php
// Verbindung zur Datenbank. Die Zugangsdaten stehen in config.php.

if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    exit('config.php fehlt. Bitte config.example.php kopieren und ausfüllen.');
}
$config = require __DIR__ . '/config.php';

// Läuft die Seite lokal (XAMPP) oder auf IONOS?
$is_local = in_array($_SERVER['SERVER_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
$db = $is_local ? $config['db_local'] : $config['db_live'];

$dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $db['user'], $db['pass'], $options);
} catch (PDOException $e) {
    // Details nur ins Server-Log, nicht an Besucher
    error_log('Datenbankfehler: ' . $e->getMessage());
    http_response_code(500);
    exit('Die Datenbank ist gerade nicht erreichbar.');
}

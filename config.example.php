<?php
// Vorlage für config.php. Kopieren, in config.php umbenennen und echte Daten eintragen.

return [
    // Datenbank beim Testen mit XAMPP
    'db_local' => [
        'host' => '127.0.0.1',
        'port' => '3306',
        'name' => 'dbs15777005',
        'user' => 'root',
        'pass' => '',
    ],

    // Datenbank auf IONOS
    'db_live' => [
        'host' => 'DATENBANK-HOST',
        'port' => '3306',
        'name' => 'DATENBANK-NAME',
        'user' => 'DATENBANK-BENUTZER',
        'pass' => 'DATENBANK-PASSWORT',
    ],

    // Verschlüsseltes Admin-Passwort. Erzeugen mit:
    // php -r 'echo password_hash("DEIN-PASSWORT", PASSWORD_DEFAULT);'
    'admin_password_hash' => 'HASH-HIER-EINTRAGEN',
];

<?php
// admin.php - Passwortgeschütztes Admin-Panel zur Verwaltung der Neuigkeiten
session_start();
require_once 'db.php';

// Das verschlüsselte Passwort für den Zugang (entspricht: EliteBurgerAufDie1)
$password_hash = '$2y$12$5YEPKaMH6mOXD2DbcYBmheUftedxWai2vMmB5XqDc.3YvMt.FQ1KG';

// 1. Logout verarbeiten
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header('Location: admin.php');
    exit;
}

// 2. Login verarbeiten
$login_error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_password'])) {
    $password_input = $_POST['login_password'];
    if (password_verify($password_input, $password_hash)) {
        $_SESSION['admin_logged_in'] = true;
        header('Location: admin.php');
        exit;
    } else {
        $login_error = 'Ungültiges Passwort!';
    }
}

// Prüfen, ob der Benutzer eingeloggt ist
$is_logged_in = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;

// 3. Neue Neuigkeit hinzufügen
$action_status = '';
if ($is_logged_in && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_news'])) {
    $title = trim($_POST['title'] ?? '');
    $badge = trim($_POST['badge'] ?? '');
    $news_date = trim($_POST['news_date'] ?? '');
    $content = trim($_POST['content'] ?? '');

    if ($title !== '' && $badge !== '' && $news_date !== '' && $content !== '') {
        try {
            $stmt = $pdo->prepare('INSERT INTO news (title, badge, news_date, content) VALUES (?, ?, ?, ?)');
            $stmt->execute([$title, $badge, $news_date, $content]);
            header('Location: admin.php?status=success_add');
            exit;
        } catch (Exception $e) {
            $action_status = 'error_add';
        }
    } else {
        $action_status = 'empty_fields';
    }
}

// 4. Neuigkeit löschen
if ($is_logged_in && isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['id'])) {
    $id = (int)$_GET['id'];
    try {
        $stmt = $pdo->prepare('DELETE FROM news WHERE id = ?');
        $stmt->execute([$id]);
        header('Location: admin.php?status=success_delete');
        exit;
    } catch (Exception $e) {
        $action_status = 'error_delete';
    }
}

// Statusmeldungen auslesen
if (isset($_GET['status'])) {
    $action_status = $_GET['status'];
}

// News für die Liste abrufen
$news_list = [];
if ($is_logged_in) {
    try {
        $stmt = $pdo->query('SELECT id, title, badge, news_date, content FROM news ORDER BY created_at DESC');
        $news_list = $stmt->fetchAll();
    } catch (Exception $e) {
        // Fehler stumm übergehen
    }
}
?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Elite Burger — Admin-Bereich</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css?v=2">
    <style>
        /* Spezifische Overrides und Ergänzungen für den Admin-Bereich */
        body {
            padding: 40px 20px;
            display: block;
            min-height: 100vh;
        }

        .admin-container {
            max-width: 1100px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        /* Ambient Cursor Glow / Background Glow */
        .ambient-glow-admin {
            position: fixed;
            top: -150px;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, var(--accent-glow) 0%, rgba(13, 13, 13, 0) 70%);
            pointer-events: none;
            z-index: 0;
        }

        /* Header */
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-accent);
            padding-bottom: 24px;
            margin-bottom: 40px;
        }

        .admin-header__title {
            font-family: var(--font-heading);
            font-size: 2rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .admin-header__title span {
            color: var(--accent);
        }

        /* Buttons */
        .btn-admin {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.8rem 1.6rem;
            background: var(--accent);
            color: var(--bg-primary);
            font-family: var(--font-heading);
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            border-radius: 100px;
            border: none;
            cursor: pointer;
            transition: all var(--transition-fast);
            box-shadow: 0 0 20px var(--accent-glow);
        }

        .btn-admin:hover {
            transform: translateY(-2px);
            background: var(--accent-hover);
            box-shadow: 0 0 30px var(--accent-glow-strong);
        }

        .btn-admin--secondary {
            background: rgba(255, 255, 255, 0.02);
            color: var(--text-primary);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: none;
        }

        .btn-admin--secondary:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--text-secondary);
            box-shadow: none;
        }

        .btn-admin--danger {
            background: rgba(255, 69, 58, 0.1);
            color: #ff453a;
            border: 1px solid rgba(255, 69, 58, 0.2);
            padding: 0.4rem 1rem;
            font-size: 0.75rem;
            box-shadow: none;
        }

        .btn-admin--danger:hover {
            background: #ff453a;
            color: #ffffff;
            box-shadow: 0 0 15px rgba(255, 69, 58, 0.3);
        }

        /* Login */
        .login-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 80vh;
            position: relative;
            z-index: 1;
        }

        .login-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-accent);
            padding: 40px;
            border-radius: var(--radius-lg);
            width: 100%;
            max-width: 420px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
            text-align: center;
        }

        .login-card__logo {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            margin: 0 auto 24px auto;
            display: block;
        }

        .login-card h2 {
            font-family: var(--font-heading);
            font-size: 1.6rem;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .login-card p {
            color: var(--text-secondary);
            font-size: 0.9rem;
            margin-bottom: 24px;
        }

        /* Forms */
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-label {
            display: block;
            margin-bottom: 8px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
        }

        .form-control {
            width: 100%;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            padding: 12px 16px;
            border-radius: var(--radius-md);
            font-family: var(--font-body);
            font-size: 0.95rem;
            transition: all var(--transition-fast);
        }

        .form-control:focus {
            outline: none;
            border-color: var(--accent);
            background: rgba(255, 255, 255, 0.04);
            box-shadow: 0 0 15px var(--accent-glow);
        }

        textarea.form-control {
            resize: vertical;
            min-height: 120px;
        }

        /* Grid */
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 40px;
        }

        @media (min-width: 768px) {
            .dashboard-grid {
                grid-template-columns: 1fr 1.3fr;
            }
        }

        .admin-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-accent);
            border-radius: var(--radius-lg);
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            height: fit-content;
        }

        .admin-card h2 {
            font-size: 1.35rem;
            margin-bottom: 24px;
            font-family: var(--font-heading);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-left: 3px solid var(--accent);
            padding-left: 12px;
        }

        /* Alerts */
        .alert {
            padding: 16px;
            border-radius: var(--radius-md);
            margin-bottom: 24px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .alert--danger {
            background: rgba(255, 69, 58, 0.1);
            border: 1px solid rgba(255, 69, 58, 0.2);
            color: #ff453a;
        }

        .alert--success {
            background: rgba(48, 209, 88, 0.1);
            border: 1px solid rgba(48, 209, 88, 0.2);
            color: #30d158;
        }

        /* News Cards Admin */
        .news-list-admin {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .news-card-admin {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: var(--radius-md);
            position: relative;
            overflow: hidden;
            transition: all var(--transition-fast);
        }

        .news-card-admin:hover {
            border-color: rgba(255, 102, 0, 0.25);
            background: rgba(255, 255, 255, 0.03);
        }

        .news-card-admin::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, var(--accent), transparent);
            opacity: 0;
            transition: opacity var(--transition-fast);
        }

        .news-card-admin:hover::before {
            opacity: 1;
        }

        .news-card-admin__header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .news-card-admin__title {
            font-family: var(--font-heading);
            font-size: 1.1rem;
            color: var(--text-primary);
            margin: 0;
        }

        .news-card-admin__meta {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .news-card-admin__badge {
            font-family: var(--font-heading);
            font-size: 0.6rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            background: rgba(255, 102, 0, 0.1);
            color: var(--accent);
            border: 1px solid rgba(255, 102, 0, 0.2);
        }

        .news-card-admin__date {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .news-card-admin__text {
            font-size: 0.88rem;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .news-card-admin__actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.03);
            padding-top: 12px;
        }

        .news-empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-muted);
            border: 1px dashed rgba(255, 255, 255, 0.1);
            border-radius: var(--radius-md);
            font-size: 0.9rem;
        }

        .footer-link {
            text-align: center;
            margin-top: 40px;
        }

        .footer-link a {
            color: var(--text-secondary);
            font-size: 0.85rem;
            font-family: var(--font-heading);
            text-transform: uppercase;
            letter-spacing: 0.15em;
            transition: color var(--transition-fast);
        }

        .footer-link a:hover {
            color: var(--accent);
        }

        /* Custom Modal Styling */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(13, 13, 13, 0.8);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transition: opacity var(--transition-fast) ease;
        }

        .modal-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        .modal-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-accent);
            border-radius: var(--radius-lg);
            padding: 30px;
            width: 90%;
            max-width: 420px;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
            transform: scale(0.9);
            transition: transform var(--transition-fast) cubic-bezier(0.34, 1.56, 0.64, 1);
            text-align: center;
        }

        .modal-overlay.active .modal-card {
            transform: scale(1);
        }

        .modal-card h3 {
            font-family: var(--font-heading);
            font-size: 1.4rem;
            margin-bottom: 12px;
            color: var(--text-primary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .modal-card p {
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-bottom: 24px;
            line-height: 1.6;
        }

        .modal-card__actions {
            display: flex;
            justify-content: center;
            gap: 16px;
        }
    </style>
</head>
<body>
    <div class="ambient-glow-admin"></div>

    <?php if (!$is_logged_in): ?>
        <!-- LOGIN MASKE -->
        <div class="login-wrapper">
            <div class="login-card">
                <img src="images/Logo_transparent.png" alt="Elite Burger Logo" class="login-card__logo">
                <h2>Admin-Bereich</h2>
                <p>Neuigkeiten verwalten & veröffentlichen.</p>

                <?php if ($login_error): ?>
                    <div class="alert alert--danger"><?= htmlspecialchars($login_error) ?></div>
                <?php endif; ?>

                <form method="POST" action="admin.php">
                    <div class="form-group">
                        <label for="login_password" class="form-label">Passwort</label>
                        <input type="password" id="login_password" name="login_password" class="form-control" placeholder="••••••••" required autofocus>
                    </div>
                    <button type="submit" class="btn-admin" style="width: 100%; margin-top: 10px;">Einloggen</button>
                </form>
            </div>
        </div>
    <?php else: ?>
        <!-- ADMIN DASHBOARD -->
        <div class="admin-container">
            <header class="admin-header">
                <h1 class="admin-header__title">Elite Burger <span>Admin</span></h1>
                <a href="admin.php?action=logout" class="btn-admin btn-admin--secondary">Abmelden</a>
            </header>

            <?php if ($action_status === 'success_add'): ?>
                <div class="alert alert--success">Neuigkeit erfolgreich veröffentlicht!</div>
            <?php elseif ($action_status === 'success_delete'): ?>
                <div class="alert alert--success">Neuigkeit wurde gelöscht.</div>
            <?php elseif ($action_status === 'empty_fields'): ?>
                <div class="alert alert--danger">Bitte alle Felder vollständig ausfüllen.</div>
            <?php elseif ($action_status === 'error_add'): ?>
                <div class="alert alert--danger">Fehler beim Speichern der Neuigkeit.</div>
            <?php elseif ($action_status === 'error_delete'): ?>
                <div class="alert alert--danger">Fehler beim Löschen der Neuigkeit.</div>
            <?php endif; ?>

            <div class="dashboard-grid">
                <!-- FORMULAR -->
                <section class="admin-card">
                    <h2>Neuigkeit schreiben</h2>
                    <form method="POST" action="admin.php">
                        <input type="hidden" name="add_news" value="1">
                        
                        <div class="form-group">
                            <label for="title" class="form-label">Titel der News</label>
                            <input type="text" id="title" name="title" class="form-control" placeholder="z. B. Neueröffnung!" required>
                        </div>

                        <div class="form-group">
                            <label for="badge" class="form-label">Kategorie (Badge)</label>
                            <input type="text" id="badge" name="badge" class="form-control" placeholder="z. B. Info, Aktion, News" required>
                        </div>

                        <div class="form-group">
                            <label for="news_date" class="form-label">Datum</label>
                            <input type="text" id="news_date" name="news_date" class="form-control" value="<?= date('d.m.Y') ?>" required>
                        </div>

                        <div class="form-group">
                            <label for="content" class="form-label">Inhalt</label>
                            <textarea id="content" name="content" class="form-control" placeholder="Beschreibe hier die Neuigkeit..." required></textarea>
                        </div>

                        <button type="submit" class="btn-admin" style="width: 100%;">Veröffentlichen</button>
                    </form>
                </section>

                <!-- LISTE -->
                <section class="admin-card">
                    <h2>Aktuelle Neuigkeiten</h2>
                    <div class="news-list-admin">
                        <?php if (empty($news_list)): ?>
                            <div class="news-empty-state">
                                Keine Beiträge vorhanden. Nutzen Sie das Formular, um einen Eintrag zu verfassen.
                            </div>
                        <?php else: ?>
                            <?php foreach ($news_list as $item): ?>
                                <article class="news-card-admin">
                                    <div class="news-card-admin__header">
                                        <h3 class="news-card-admin__title"><?= htmlspecialchars($item['title']) ?></h3>
                                        <div class="news-card-admin__meta">
                                            <span class="news-card-admin__badge"><?= htmlspecialchars($item['badge']) ?></span>
                                            <time class="news-card-admin__date"><?= htmlspecialchars($item['news_date']) ?></time>
                                        </div>
                                    </div>
                                    <p class="news-card-admin__text"><?= nl2br(htmlspecialchars($item['content'])) ?></p>
                                    <div class="news-card-admin__actions">
                                        <a href="admin.php?action=delete&id=<?= $item['id'] ?>" class="btn-admin btn-admin--danger btn-delete-trigger">Löschen</a>
                                    </div>
                                </article>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </section>
            </div>
            
            <div class="footer-link">
                <a href="index.html">← Zurück zur Website</a>
            </div>
        </div>
    <?php endif; ?>

    <!-- CUSTOM DELETE CONFIRMATION MODAL -->
    <div id="deleteConfirmModal" class="modal-overlay">
        <div class="modal-card">
            <h3>Beitrag löschen?</h3>
            <p>Möchtest du diese Neuigkeit wirklich unwiderruflich aus der Datenbank löschen?</p>
            <div class="modal-card__actions">
                <button type="button" id="modalCancelBtn" class="btn-admin btn-admin--secondary">Abbrechen</button>
                <a href="#" id="modalConfirmBtn" class="btn-admin" style="background: #ff453a; color: #ffffff; box-shadow: 0 0 20px rgba(255, 69, 58, 0.25);">Löschen</a>
            </div>
        </div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const deleteTriggers = document.querySelectorAll('.btn-delete-trigger');
        const modal = document.getElementById('deleteConfirmModal');
        const cancelBtn = document.getElementById('modalCancelBtn');
        const confirmBtn = document.getElementById('modalConfirmBtn');

        if (deleteTriggers.length > 0 && modal && cancelBtn && confirmBtn) {
            deleteTriggers.forEach(trigger => {
                trigger.addEventListener('click', (e) => {
                    e.preventDefault();
                    const deleteUrl = trigger.getAttribute('href');
                    confirmBtn.setAttribute('href', deleteUrl);
                    modal.classList.add('active');
                });
            });

            // Cancel button closes the modal
            cancelBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });

            // Clicking on the overlay background closes the modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });

            // ESC key closes the modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    modal.classList.remove('active');
                }
            });
        }
    });
    </script>
</body>
</html>

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./database.sqlite');
const SECRET_KEY = 'super-secret-jwt-key-for-digital-vacation';

// Инициализация БД
db.serialize(() => {
    // Создаем таблицы, если их еще нет
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            manager_id INTEGER,
            FOREIGN KEY (manager_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // ПРОВЕРКА: Добавляем начальных пользователей только если таблица пуста
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (row && row.count === 0) {
            console.log('База данных пуста. Создаем тестовых пользователей...');
            const saltRounds = 10;
            const defaultPasswordHash = bcrypt.hashSync('12345', saltRounds);

            const stmt = db.prepare('INSERT INTO users (id, full_name, email, password, role, manager_id) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(1, 'Петров Алексей (Директор)', 'director@test.ru', defaultPasswordHash, 'director', null);
            stmt.run(2, 'Иванов Иван (Менеджер)', 'manager@test.ru', defaultPasswordHash, 'manager', 1);
            stmt.run(3, 'Сидоров Олег (Разработчик)', 'sidorov@test.ru', defaultPasswordHash, 'employee', 2);
            stmt.run(4, 'Кузнецова Анна (Тестировщик)', 'anna@test.ru', defaultPasswordHash, 'employee', 2);
            stmt.run(5, 'Белов Дмитрий (Дизайнер)', 'belov@test.ru', defaultPasswordHash, 'employee', 2);
            stmt.finalize();
        } else {
            console.log('Пользователи уже существуют в базе, пропускаем инициализацию.');
        }
    });
});

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Недействительный токен' });
        req.user = user;
        next();
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Авторизация
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Заполните все поля' });

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Неверный пароль' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        const { password: _, ...userWithoutPassword } = user;
        res.json({ token, user: userWithoutPassword });
    });
});

// Получение списка заявок
app.get('/api/requests', authenticateToken, (req, res) => {
    const requesterId = req.query.user_id || req.user.id;

    db.get('SELECT id, role FROM users WHERE id = ?', [requesterId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (req.user.role === 'employee' && Number(requesterId) !== req.user.id) {
             return res.status(403).json({ error: 'Нет прав доступа' });
        }

        let query = "";
        let params = [];

        if (user.role === 'director') {
            query = `SELECT r.*, u.full_name, u.manager_id FROM requests r JOIN users u ON r.user_id = u.id ORDER BY r.id DESC`;
        } else if (user.role === 'manager') {
            query = `SELECT r.*, u.full_name, u.manager_id FROM requests r JOIN users u ON r.user_id = u.id WHERE r.user_id = ? OR u.manager_id = ? ORDER BY r.id DESC`;
            params = [user.id, user.id];
        } else {
            query = `SELECT r.*, u.full_name, u.manager_id FROM requests r JOIN users u ON r.user_id = u.id WHERE r.user_id = ? ORDER BY r.id DESC`;
            params = [user.id];
        }

        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

// Создание заявки
app.post('/api/requests', authenticateToken, (req, res) => {
    const { user_id, start_date, end_date, force } = req.body;

    if (!start_date || !end_date) return res.status(400).json({ error: 'Укажите даты' });

    const checkQuery = `
        SELECT COUNT(*) as count FROM requests 
        WHERE status != 'rejected' AND NOT (end_date < ? OR start_date > ?)
    `;

    db.get(checkQuery, [start_date, end_date], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row.count > 0 && !force) {
            return res.json({ 
                warning: true, 
                message: 'Даты пересекаются с другими сотрудниками. Продолжить?' 
            });
        }

        db.run(
            'INSERT INTO requests (user_id, start_date, end_date, status) VALUES (?, ?, ?, ?)',
            [user_id, start_date, end_date, 'pending'],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, success: true });
            }
        );
    });
});

// Обновление статуса
app.put('/api/requests/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Некорректный статус' });

    db.run('UPDATE requests SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.listen(3001, () => {
    console.log('Сервер запущен. Теперь данные сохраняются при перезагрузке.');
});
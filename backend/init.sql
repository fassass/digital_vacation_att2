-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    manager_id INTEGER,
    FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Таблица заявок
CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Очистка данных
DELETE FROM requests;
DELETE FROM users;

-- Наполнение данными
INSERT INTO users (id, full_name, email, password, role, manager_id) 
VALUES (1, 'Петров Алексей (Директор)', 'director@test.ru', '12345', 'director', NULL);

INSERT INTO users (id, full_name, email, password, role, manager_id) 
VALUES (2, 'Иванов Иван (Менеджер)', 'manager@test.ru', '12345', 'manager', 1);

INSERT INTO users (id, full_name, email, password, role, manager_id) 
VALUES (3, 'Сидоров Олег (Разработчик)', 'sidorov@test.ru', '12345', 'employee', 2);

INSERT INTO users (id, full_name, email, password, role, manager_id) 
VALUES (4, 'Кузнецова Анна (Тестировщик)', 'anna@test.ru', '12345', 'employee', 2);

-- НОВЫЙ СОТРУДНИК
INSERT INTO users (id, full_name, email, password, role, manager_id) 
VALUES (5, 'Белов Дмитрий (Дизайнер)', 'belov@test.ru', '12345', 'employee', 2);
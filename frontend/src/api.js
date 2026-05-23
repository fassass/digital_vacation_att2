const API_URL = 'http://localhost:3001/api';

// Вспомогательная функция для генерации заголовков с токеном
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const api = {
    login: async (email, password) => {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Ошибка авторизации');
        }
        
        // Сохраняем токен и данные пользователя в localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        return data.user;
    },
    
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    getCurrentUser: () => {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    },

    getRequests: async (userId) => {
        const res = await fetch(`${API_URL}/requests?user_id=${userId}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Ошибка получения заявок');
        return res.json();
    },

    createRequest: async (data) => {
        const res = await fetch(`${API_URL}/requests`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Ошибка создания заявки');
        return result;
    },

    updateRequestStatus: async (id, status) => {
        const res = await fetch(`${API_URL}/requests/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error('Ошибка обновления статуса');
        return res.json();
    }
};
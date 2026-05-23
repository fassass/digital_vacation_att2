import { useState, useEffect } from "react";
import { api } from "./api";

const STATUSES = {
  pending: { label: "На согласовании", color: "text-amber-600" },
  approved: { label: "Одобрено", color: "text-emerald-600" },
  rejected: { label: "Отклонено", color: "text-red-600" },
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [requestError, setRequestError] = useState("");

  // Проверка сохраненной сессии при монтировании
  useEffect(() => {
    const user = api.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadRequests();
    }
  }, [currentUser]);

  const loadRequests = () => {
    api.getRequests(currentUser.id)
      .then(setRequests)
      .catch(() => handleLogout()); // Если токен протух - разлогиниваем
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const user = await api.login(email, password);
      setCurrentUser(user);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setEmail("");
    setPassword("");
    setRequests([]);
  };

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    setRequestError("");
    
    if (!startDate || !endDate) {
      return setRequestError("Пожалуйста, выберите даты");
    }

    try {
      const result = await api.createRequest({
        user_id: currentUser.id,
        start_date: startDate,
        end_date: endDate,
        force: force
      });

      if (result.warning) {
        const confirmSave = window.confirm(result.message);
        if (confirmSave) {
          handleSubmit(null, true);
        }
      } else {
        setStartDate("");
        setEndDate("");
        loadRequests();
      }
    } catch (err) {
      setRequestError(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateRequestStatus(id, status);
      loadRequests();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Вход в систему</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="Email" 
              className="w-full border p-2 rounded" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="Пароль" 
              className="w-full border p-2 rounded" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Войти</button>
          </form>
          <div className="mt-4 text-xs text-gray-400">
            Тест: director@test.ru, manager@test.ru, sidorov@test.ru (Пароль: 12345)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Digital Vacation</h1>
          <p className="text-gray-500">Вы вошли как: {currentUser.full_name}</p>
        </div>
        <button onClick={handleLogout} className="text-red-500 underline text-sm hover:text-red-700">Выйти</button>
      </div>

      {currentUser.role !== 'director' && (
        <div className="bg-white p-4 border rounded-lg shadow-sm mb-6">
          <h2 className="font-bold mb-3">Оформить отпуск</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex gap-4">
              <input type="date" className="border p-2 flex-1 rounded" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" className="border p-2 flex-1 rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Подать заявку</button>
            </div>
            {requestError && <p className="text-red-500 text-sm mt-1">{requestError}</p>}
          </form>
        </div>
      )}

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Сотрудник</th>
              <th className="p-3">Начало</th>
              <th className="p-3">Конец</th>
              <th className="p-3">Статус</th>
              <th className="p-3 text-right">Управление</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="p-3 font-medium">{r.full_name}</td>
                <td className="p-3">{r.start_date}</td>
                <td className="p-3">{r.end_date}</td>
                <td className={`p-3 font-bold ${STATUSES[r.status]?.color}`}>
                  {STATUSES[r.status]?.label}
                </td>
                <td className="p-3 text-right">
                  {r.manager_id === currentUser.id && r.status === 'pending' ? (
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => handleStatusChange(r.id, 'approved')} className="text-green-600 text-sm font-semibold hover:underline">Одобрить</button>
                      <button onClick={() => handleStatusChange(r.id, 'rejected')} className="text-red-600 text-sm font-semibold hover:underline">Отклонить</button>
                    </div>
                  ) : <span className="text-gray-400 text-xs">Нет действий</span>}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan="5" className="p-6 text-center text-gray-500">Заявок пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
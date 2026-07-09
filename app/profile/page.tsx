"use client";

import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [status, setStatus] = useState("loading");
  const [tariff, setTariff] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const fail = params.get("fail");

    if (success === "true") {
      // Активируем подписку в localStorage
      localStorage.setItem("subscription_active", "true");
      localStorage.setItem("subscription_tariff", "Pro");
      setStatus("active");
      setTariff("Pro");
      alert("✅ Оплата прошла успешно! Подписка активирована.");
    } else if (fail === "true") {
      setStatus("failed");
      alert("❌ Оплата не прошла. Попробуйте снова.");
    } else {
      // Проверяем текущий статус
      const active = localStorage.getItem("subscription_active") === "true";
      if (active) {
        setStatus("active");
        setTariff(localStorage.getItem("subscription_tariff") || "Pro");
      } else {
        setStatus("inactive");
      }
    }
  }, []);

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>👤 Профиль</h1>
      {status === "loading" && <p>Загрузка...</p>}
      {status === "active" && (
        <div className="card">
          <p><strong>Статус подписки:</strong> Активна ✅</p>
          <p><strong>Тариф:</strong> {tariff}</p>
          <p><strong>Действует до:</strong> Бессрочно (тестовый режим)</p>
          <button onClick={() => window.location.href = "/"}>Вернуться на главную</button>
        </div>
      )}
      {status === "inactive" && (
        <div className="card">
          <p><strong>Статус подписки:</strong> Неактивна</p>
          <p>У вас нет активной подписки. <a href="/">Перейти к тарифам</a></p>
        </div>
      )}
      {status === "failed" && (
        <div className="card">
          <p><strong>Оплата не прошла</strong></p>
          <p>Попробуйте снова или выберите другой способ оплаты.</p>
          <button onClick={() => window.location.href = "/"}>Вернуться на главную</button>
        </div>
      )}
    </main>
  );
}

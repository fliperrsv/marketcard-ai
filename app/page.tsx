"use client";

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const analysisCache = new Map();

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [tab, setTab] = useState("generator");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("деловой");
  const [brand, setBrand] = useState("");
  const [audience, setAudience] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [generationsLeft, setGenerationsLeft] = useState(3);
  const [showTariff, setShowTariff] = useState(false);
  const [history, setHistory] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("darkMode");
      if (savedTheme) setDarkMode(JSON.parse(savedTheme));
      const savedHistory = localStorage.getItem("seoHistory");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      const saved = localStorage.getItem("generationsLeft");
      if (saved !== null) setGenerationsLeft(parseInt(saved));
      const sub = localStorage.getItem("subscription_active") === "true";
      setIsSubscribed(sub);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  async function generateSEO() {
    if (!isDev && !isSubscribed && generationsLeft <= 0) {
      setShowTariff(true);
      return;
    }
    if (!description.trim()) { alert("Введите описание товара"); return; }

    setLoading(true);
    setResults([]);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, tone, brand, audience, competitors })
      });
      const data = await res.json();
      if (data.success) {
        setResults(data.data);
        setSelectedIndex(0);
        const newEntry = {
          id: Date.now(),
          date: new Date().toLocaleString(),
          brand,
          audience,
          cards: data.data
        };
        const newHistory = [newEntry, ...history].slice(0, 20);
        setHistory(newHistory);
        localStorage.setItem("seoHistory", JSON.stringify(newHistory));
        if (!isDev && !isSubscribed) {
          const newLeft = generationsLeft - 1;
          setGenerationsLeft(newLeft);
          localStorage.setItem("generationsLeft", String(newLeft));
        }
        setTimeout(() => analyzeCurrent(data.data[0]), 500);
      } else {
        alert("Ошибка: " + data.error);
      }
    } catch (e) { alert("Ошибка генерации"); }
    setLoading(false);
  }

  async function analyzeCurrent(card) {
    if (!card) return;
    const cacheKey = JSON.stringify(card);
    if (analysisCache.has(cacheKey)) {
      setAnalysisResult(analysisCache.get(cacheKey));
      return;
    }
    setAnalyzing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const res = await fetch("/api/analyze-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: JSON.stringify(card) })
      });
      const d = await res.json();
      if (d.success) {
        analysisCache.set(cacheKey, d.data);
        setAnalysisResult(d.data);
      }
    } catch (e) {}
    setAnalyzing(false);
  }

  async function improveSEO() {
    if (!results.length) return;
    const currentCard = results[selectedIndex];
    if (!currentCard) return;
    setLoading(true);
    try {
      const res = await fetch("/api/improve-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: currentCard,
          analysis: analysisResult,
          tone,
          brand,
          audience,
          competitors
        })
      });
      const d = await res.json();
      if (d.success) {
        const newResults = [...results];
        newResults[selectedIndex] = d.data;
        setResults(newResults);
        const updatedHistory = history.map(entry => {
          if (entry.id === history[0]?.id) {
            return { ...entry, cards: newResults };
          }
          return entry;
        });
        setHistory(updatedHistory);
        localStorage.setItem("seoHistory", JSON.stringify(updatedHistory));
        setTimeout(() => analyzeCurrent(d.data), 500);
      } else {
        alert("Ошибка: " + d.error);
      }
    } catch (e) { alert("Ошибка улучшения"); }
    setLoading(false);
  }

  function exportCSV() {
    if (!results.length) return;
    const card = results[selectedIndex];
    const rows = [
      ["Title", "Description", "Advantages", "Features", "Keywords"],
      [card.title, card.description, card.advantages.join("; "), card.features.join("; "), card.keywords.join("; ")]
    ];
    const csv = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "seo_card.csv";
    link.click();
  }

  async function exportPDF() {
    const element = document.getElementById("card-content");
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save("seo_card.pdf");
  }

  function loadHistoryEntry(entry) {
    setResults(entry.cards);
    setSelectedIndex(0);
    setTab("generator");
    setTimeout(() => analyzeCurrent(entry.cards[0]), 500);
  }

  async function handleSubscribe(tier) {
    const productId = tier === "pro"
      ? process.env.NEXT_PUBLIC_LAVA_PRO_PRODUCT_ID
      : process.env.NEXT_PUBLIC_LAVA_BUSINESS_PRODUCT_ID;
    try {
      const res = await fetch("/api/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          userId: "temp-user-id",
        }),
      });
      const data = await res.json();
      if (data.success && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert("Ошибка: " + data.error);
      }
    } catch (error) {
      alert("Ошибка при оформлении подписки");
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem", background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "2.5rem" }}>📝 MarketCard AI</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {isSubscribed && <span style={{ background: "#28a745", color: "#fff", padding: "0.2rem 0.8rem", borderRadius: "20px", fontSize: "0.8rem" }}>✅ Pro</span>}
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: "transparent", border: "1px solid var(--border)", padding: "0.5rem 1rem", borderRadius: 8, cursor: "pointer", color: "var(--text)" }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
      <p style={{ color: "var(--text)", opacity: 0.7 }}>Генерация, анализ и улучшение SEO-карточек</p>

      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0 2rem", borderBottom: "2px solid var(--border)" }}>
        <button onClick={() => setTab("generator")} style={{ padding: "0.8rem 1.5rem", border: "none", background: tab === "generator" ? "var(--primary)" : "transparent", color: tab === "generator" ? "#fff" : "var(--text)", borderRadius: "8px 8px 0 0", cursor: "pointer" }}>✨ Генератор</button>
        <button onClick={() => setTab("history")} style={{ padding: "0.8rem 1.5rem", border: "none", background: tab === "history" ? "var(--primary)" : "transparent", color: tab === "history" ? "#fff" : "var(--text)", borderRadius: "8px 8px 0 0", cursor: "pointer" }}>📚 История</button>
        <button onClick={() => setTab("tariffs")} style={{ padding: "0.8rem 1.5rem", border: "none", background: tab === "tariffs" ? "var(--primary)" : "transparent", color: tab === "tariffs" ? "#fff" : "var(--text)", borderRadius: "8px 8px 0 0", cursor: "pointer" }}>💎 Тарифы</button>
      </div>

      {tab === "generator" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание товара..." rows={3} style={{ width: "100%", padding: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Бренд (необязательно)" style={{ padding: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Целевая аудитория (необязательно)" style={{ padding: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
          <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Конкуренты (через запятую, необязательно)" style={{ padding: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ padding: "0.8rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}>
            <option value="деловой">Деловой</option>
            <option value="дружеский">Дружеский</option>
            <option value="креативный">Креативный</option>
            <option value="научный">Научный</option>
          </select>
          <button onClick={generateSEO} disabled={loading || !description.trim()} style={{ padding: "1rem", background: loading || !description.trim() ? "var(--border)" : "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontSize: "1.1rem", cursor: "pointer" }}>
            {loading ? "Генерация..." : "🚀 Сгенерировать 3 варианта"}
          </button>
          <div style={{ fontSize: "0.9rem", color: "var(--text)", opacity: 0.6, textAlign: "center" }}>
            Осталось генераций: <strong>{isSubscribed ? "∞ (подписка)" : generationsLeft}</strong> {isDev ? "(dev)" : ""}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card">
          <h2>📚 История</h2>
          {history.length === 0 ? <p>Нет сохранённых карточек</p> :
            <ul style={{ listStyle: "none", padding: 0 }}>
              {history.map((entry, idx) => (
                <li key={idx} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => loadHistoryEntry(entry)}>
                  <strong>{entry.date}</strong> – {entry.brand || "Без бренда"} (вариантов: {entry.cards.length})
                </li>
              ))}
            </ul>
          }
        </div>
      )}

      {tab === "tariffs" && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "1rem" }}>Выберите свой тариф</h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "2rem",
            maxWidth: "800px",
            margin: "0 auto",
          }}>
            <div className="card" style={{ textAlign: "center", transition: "transform 0.3s, box-shadow 0.3s", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <h3 style={{ fontSize: "1.5rem" }}>Pro</h3>
              <p style={{ fontSize: "2.5rem", fontWeight: 700 }}>490 ₽</p>
              <p style={{ opacity: 0.7 }}>/ месяц</p>
              <ul style={{ textAlign: "left", margin: "1.5rem 0", padding: 0, listStyle: "none" }}>
                <li>✅ Безлимитные генерации</li>
                <li>✅ SEO-анализ</li>
                <li>✅ Улучшение карточек</li>
                <li>✅ История генераций</li>
                <li>✅ Экспорт PDF/CSV</li>
              </ul>
              <button onClick={() => handleSubscribe("pro")} style={{ width: "100%", padding: "1rem", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "1.1rem", cursor: "pointer", transition: "transform 0.2s" }}>Оформить Pro</button>
            </div>
            <div className="card" style={{ textAlign: "center", transform: "scale(1.02)", border: "2px solid #fbbf24", boxShadow: "0 20px 60px rgba(251,191,36,0.15)", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>
              <span style={{ background: "#fbbf24", color: "#000", padding: "0.2rem 1rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Популярный</span>
              <h3 style={{ fontSize: "1.5rem", marginTop: "0.5rem" }}>Business</h3>
              <p style={{ fontSize: "2.5rem", fontWeight: 700 }}>1 990 ₽</p>
              <p style={{ opacity: 0.7 }}>/ месяц</p>
              <ul style={{ textAlign: "left", margin: "1.5rem 0", padding: 0, listStyle: "none" }}>
                <li>✅ Всё из Pro</li>
                <li>✅ До 5 пользователей</li>
                <li>✅ Приоритетная поддержка</li>
                <li>✅ API доступ</li>
                <li>✅ Белые этикетки (брендирование)</li>
              </ul>
              <button onClick={() => handleSubscribe("business")} style={{ width: "100%", padding: "1rem", background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)", border: "none", borderRadius: "12px", color: "#000", fontSize: "1.1rem", fontWeight: 600, cursor: "pointer", transition: "transform 0.2s" }}>Оформить Business</button>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="card fade-in" style={{ marginTop: "2rem" }}>
          <h2>✅ Сгенерировано 3 варианта</h2>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {results.map((card, idx) => (
              <button key={idx} onClick={() => { setSelectedIndex(idx); setTimeout(() => analyzeCurrent(card), 500); }} style={{ padding: "0.3rem 0.8rem", background: selectedIndex === idx ? "var(--primary)" : "transparent", color: selectedIndex === idx ? "#fff" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
                Вариант {idx+1}
              </button>
            ))}
          </div>
          <div id="card-content" className="card" style={{ background: "var(--card-bg)", padding: "1rem" }}>
            <h3>{results[selectedIndex].title}</h3>
            <p><strong>Описание:</strong> {results[selectedIndex].description}</p>
            <div><strong>Преимущества:</strong></div>
            <ul style={{ paddingLeft: "1.5rem" }}>
              {results[selectedIndex].advantages?.map((a,i) => <li key={i}>{a}</li>)}
            </ul>
            <div><strong>Характеристики:</strong></div>
            <ul style={{ paddingLeft: "1.5rem" }}>
              {results[selectedIndex].features?.map((f,i) => <li key={i}>{f}</li>)}
            </ul>
            <div><strong>Ключевые слова:</strong> {results[selectedIndex].keywords?.join(", ")}</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <button onClick={improveSEO} disabled={loading} style={{ padding: "0.5rem 1rem", background: "#fd7e14", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>🔁 Улучшить с учётом SEO</button>
            <button onClick={exportCSV} style={{ padding: "0.5rem 1rem", background: "#28a745", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>📊 CSV</button>
            <button onClick={exportPDF} style={{ padding: "0.5rem 1rem", background: "#dc3545", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>📄 PDF</button>
            <button onClick={() => { const t = `Заголовок: ${results[selectedIndex].title}\nОписание: ${results[selectedIndex].description}\nПреимущества: ${results[selectedIndex].advantages?.join(", ")}\nХарактеристики: ${results[selectedIndex].features?.join(", ")}\nКлючевые слова: ${results[selectedIndex].keywords?.join(", ")}`; navigator.clipboard.writeText(t); alert("Скопировано!"); }} style={{ padding: "0.5rem 1rem", background: "#6c5ce7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>📋 Копировать</button>
          </div>
          {analysisResult && (
            <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--card-bg)", borderRadius: 8 }}>
              <h4>📊 SEO-анализ</h4>
              <p><strong>Оценка:</strong> {analysisResult.score}%</p>
              <div><strong>Сильные стороны:</strong></div>
              <ul style={{ paddingLeft: "1.5rem" }}>
                {analysisResult.strengths?.map((s,i) => <li key={i}>{s}</li>)}
              </ul>
              <div><strong>Что улучшить:</strong></div>
              <ul style={{ paddingLeft: "1.5rem" }}>
                {analysisResult.weaknesses?.map((w,i) => <li key={i}>{w}</li>)}
              </ul>
              <div><strong>Рекомендации:</strong></div>
              <ul style={{ paddingLeft: "1.5rem" }}>
                {analysisResult.recommendations?.map((r,i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {analyzing && <p style={{ color: "var(--text)", opacity: 0.6 }}>🔄 Анализируем...</p>}
        </div>
      )}

      {showTariff && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ background: "var(--card-bg)", padding: "2rem", maxWidth: 400, width: "90%", textAlign: "center" }}>
            <h2>🚀 Бесплатные генерации закончились</h2>
            <p>Подключи тариф Pro или Business</p>
            <button onClick={() => setShowTariff(false)} style={{ padding: "0.8rem 2rem", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Закрыть</button>
          </div>
        </div>
      )}
    </main>
  );
}

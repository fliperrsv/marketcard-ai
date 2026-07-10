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
  const [openFaq, setOpenFaq] = useState(null);
  const isDev = process.env.NODE_ENV === "development";

  const faqs = [
    { q: "Сколько бесплатных генераций доступно?", a: "В бесплатном тарифе вам доступно 3 генерации по 1 варианту каждая. После этого можно оформить подписку Pro или Business для безлимита." },
    { q: "Что входит в подписку Pro?", a: "Pro даёт безлимитные генерации по 3 варианта за раз, улучшение карточек по SEO-анализу, историю генераций и экспорт в PDF/CSV." },
    { q: "Можно ли отменить подписку?", a: "Да, отмена подписки происходит через личный кабинет Lava.top. После отмены доступ к платным функциям сохраняется до конца оплаченного периода." },
    { q: "Как работает улучшение карточек?", a: "После генерации вы получаете SEO-анализ с оценкой и рекомендациями. Нажав «Улучшить», AI перепишет карточку с учётом этих рекомендаций, повышая её качество." },
    { q: "Подходит ли сервис для маркетплейсов?", a: "Да, карточки оптимизированы под требования маркетплейсов: заголовки, описания, характеристики и ключевые слова соответствуют стандартам Ozon, Wildberries и Яндекс.Маркет." },
    { q: "Что делать, если сгенерировалась некачественная карточка?", a: "Вы всегда можете отредактировать карточку вручную, нажав «Редактировать», или повторно нажать «Улучшить с учётом SEO» для доработки." }
  ];

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
      const variants = isSubscribed ? 3 : 1;
      const res = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, tone, brand, audience, competitors, variants })
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
    if (!isSubscribed) {
      alert("Функция улучшения доступна только по подписке Pro или Business");
      return;
    }
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
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem", background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* Hero-секция */}
      <div style={{ textAlign: "center", padding: "3rem 0 2rem" }}>
        <h1 className="gradient-text" style={{ fontSize: "3.5rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
          MarketCard AI
        </h1>
        <p style={{ fontSize: "1.25rem", opacity: 0.7, maxWidth: "600px", margin: "0 auto" }}>
          Генерация, анализ и улучшение SEO-карточек за секунды
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", alignItems: "center", marginTop: "1rem" }}>
          {isSubscribed && <span style={{ background: "#28a745", color: "#fff", padding: "0.2rem 0.8rem", borderRadius: "20px", fontSize: "0.8rem" }}>✅ Pro</span>}
          <button onClick={() => setDarkMode(!darkMode)} className="btn-secondary" style={{ padding: "0.4rem 0.8rem", borderRadius: "30px" }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", borderBottom: "2px solid var(--border)", paddingBottom: "0.5rem" }}>
        <button onClick={() => setTab("generator")} style={{ padding: "0.8rem 1.5rem", border: "none", background: tab === "generator" ? "var(--primary)" : "transparent", color: tab === "generator" ? "#fff" : "var(--text)", borderRadius: "12px 12px 0 0", cursor: "pointer", fontWeight: 500, transition: "background 0.2s" }}>
          ✨ Генератор
        </button>
        <button onClick={() => setTab("history")} style={{ padding: "0.8rem 1.5rem", border: "none", background: tab === "history" ? "var(--primary)" : "transparent", color: tab === "history" ? "#fff" : "var(--text)", borderRadius: "12px 12px 0 0", cursor: "pointer", fontWeight: 500, transition: "background 0.2s" }}>
          📚 История
        </button>
        <button onClick={() => setTab("tariffs")} style={{ padding: "0.8rem 1.5rem", border: "none", background: tab === "tariffs" ? "var(--primary)" : "transparent", color: tab === "tariffs" ? "#fff" : "var(--text)", borderRadius: "12px 12px 0 0", cursor: "pointer", fontWeight: 500, transition: "background 0.2s" }}>
          💎 Тарифы
        </button>
      </div>

      {tab === "generator" && (
        <>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", backdropFilter: "blur(16px)" }}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Опишите товар или услугу..." rows={3} style={{ width: "100%", padding: "0.8rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)", fontSize: "1rem" }} />
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Бренд (необязательно)" style={{ padding: "0.8rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)" }} />
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Целевая аудитория (необязательно)" style={{ padding: "0.8rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)" }} />
            <input value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="Конкуренты (через запятую, необязательно)" style={{ padding: "0.8rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)" }} />
            <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ padding: "0.8rem", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text)" }}>
              <option value="деловой">Деловой</option>
              <option value="дружеский">Дружеский</option>
              <option value="креативный">Креативный</option>
              <option value="научный">Научный</option>
            </select>
            <button onClick={generateSEO} disabled={loading || !description.trim()} className="btn-primary" style={{ padding: "1rem", fontSize: "1.1rem", width: "100%" }}>
              {loading ? "Генерация..." : isSubscribed ? "🚀 Сгенерировать 3 варианта" : "🚀 Сгенерировать 1 вариант"}
            </button>
            <div style={{ fontSize: "0.9rem", opacity: 0.6, textAlign: "center" }}>
              {isSubscribed ? "∞ (подписка)" : `Осталось генераций: ${generationsLeft} из 3`}
              {!isSubscribed && generationsLeft === 0 && (
                <span style={{ display: "block", color: "#e74c3c", marginTop: "0.3rem" }}>Закончились — оформите подписку</span>
              )}
            </div>
          </div>

          {/* Как это работает */}
          <div style={{ marginTop: "3rem" }}>
            <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "2rem" }}>Как это работает</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem" }}>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📝</div>
                <h3>1. Опишите товар</h3>
                <p style={{ opacity: 0.7 }}>Введите краткое описание, бренд и аудиторию</p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>⚡</div>
                <h3>2. Сгенерируйте карточку</h3>
                <p style={{ opacity: 0.7 }}>AI создаст SEO-заголовок, описание, преимущества и характеристики</p>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📊</div>
                <h3>3. Анализируйте и улучшайте</h3>
                <p style={{ opacity: 0.7 }}>Получите SEO-анализ и улучшите карточку по рекомендациям</p>
              </div>
            </div>
          </div>

          {/* Что вы получаете */}
          <div style={{ marginTop: "3rem" }}>
            <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "2rem" }}>Что вы получаете</h2>
            <div className="card" style={{ maxWidth: "600px", margin: "0 auto" }}>
              <ul style={{ listStyle: "none", padding: 0 }}>
                <li style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>✅ Готовый заголовок (50–70 символов)</li>
                <li style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>✅ SEO-описание (до 500 символов)</li>
                <li style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>✅ 8–10 преимуществ с цифрами и фактами</li>
                <li style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>✅ 12–14 технических характеристик</li>
                <li style={{ padding: "0.5rem 0" }}>✅ 14–16 ключевых слов для поискового продвижения</li>
              </ul>
            </div>
          </div>

          {/* FAQ */}
          <div style={{ marginTop: "3rem" }}>
            <h2 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "2rem" }}>❓ Часто задаваемые вопросы</h2>
            <div style={{ maxWidth: "700px", margin: "0 auto" }}>
              {faqs.map((faq, idx) => (
                <div key={idx} className="card" style={{ marginBottom: "0.8rem", cursor: "pointer" }} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "1.1rem", margin: 0 }}>{faq.q}</h3>
                    <span>{openFaq === idx ? "▲" : "▼"}</span>
                  </div>
                  {openFaq === idx && <p style={{ marginTop: "0.8rem", opacity: 0.8 }}>{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem", maxWidth: "900px", margin: "0 auto" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "1.5rem" }}>Free</h3>
              <p style={{ fontSize: "2rem", fontWeight: 700 }}>0 ₽</p>
              <p style={{ opacity: 0.7 }}>навсегда</p>
              <ul style={{ textAlign: "left", margin: "1.5rem 0", padding: 0, listStyle: "none" }}>
                <li>✅ 1 вариант за раз</li>
                <li>✅ 3 генерации</li>
                <li>✅ SEO-анализ</li>
                <li>❌ Улучшение карточек</li>
                <li>❌ Экспорт PDF/CSV</li>
                <li>❌ История генераций</li>
              </ul>
              <button style={{ width: "100%", padding: "1rem", background: "#ccc", border: "none", borderRadius: "12px", color: "#666", fontSize: "1.1rem", cursor: "default" }}>Текущий тариф</button>
            </div>

            <div className="card" style={{ textAlign: "center", transform: "scale(1.02)", border: "2px solid #fbbf24", boxShadow: "0 20px 60px rgba(251,191,36,0.15)" }}>
              <span style={{ background: "#fbbf24", color: "#000", padding: "0.2rem 1rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase" }}>Популярный</span>
              <h3 style={{ fontSize: "1.5rem", marginTop: "0.5rem" }}>Pro</h3>
              <p style={{ fontSize: "2.5rem", fontWeight: 700 }}>490 ₽</p>
              <p style={{ opacity: 0.7 }}>/ месяц</p>
              <ul style={{ textAlign: "left", margin: "1.5rem 0", padding: 0, listStyle: "none" }}>
                <li>✅ 3 варианта за раз</li>
                <li>✅ Безлимитные генерации</li>
                <li>✅ SEO-анализ</li>
                <li>✅ Улучшение карточек</li>
                <li>✅ История генераций</li>
                <li>✅ Экспорт PDF/CSV</li>
              </ul>
              <iframe title="lava.top" style={{ border: "none", width: "350px", height: "60px" }} src="https://widget.lava.top/15b7c604-d062-437a-8c4b-5dbf049bd2a7"></iframe>
            </div>

            <div className="card" style={{ textAlign: "center", border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "1.5rem" }}>Business</h3>
              <p style={{ fontSize: "2.5rem", fontWeight: 700 }}>1 990 ₽</p>
              <p style={{ opacity: 0.7 }}>/ месяц</p>
              <ul style={{ textAlign: "left", margin: "1.5rem 0", padding: 0, listStyle: "none" }}>
                <li>✅ Всё из Pro</li>
                <li>✅ До 5 пользователей</li>
                <li>✅ Приоритетная поддержка</li>
                <li>✅ API доступ</li>
                <li>✅ Белые этикетки (брендирование)</li>
              </ul>
              <iframe title="lava.top" style={{ border: "none", width: "350px", height: "60px" }} src="https://widget.lava.top/ID_ДЛЯ_BUSINESS"></iframe>
            </div>
          </div>
          <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.9rem", opacity: 0.6 }}>
            Бесплатно — 1 вариант, 3 генерации. Подписка — безлимит и 3 варианта за раз.
          </p>
        </div>
      )}

      {/* Результаты генерации */}
      {results.length > 0 && (
        <div className="card fade-in" style={{ marginTop: "2rem" }}>
          <h2>✅ Сгенерировано {isSubscribed ? "3 варианта" : "1 вариант"}</h2>
          {isSubscribed && (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              {results.map((card, idx) => (
                <button key={idx} onClick={() => { setSelectedIndex(idx); setTimeout(() => analyzeCurrent(card), 500); }} style={{ padding: "0.3rem 0.8rem", background: selectedIndex === idx ? "var(--primary)" : "transparent", color: selectedIndex === idx ? "#fff" : "var(--text)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
                  Вариант {idx+1}
                </button>
              ))}
            </div>
          )}
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
            <button onClick={improveSEO} disabled={loading || !isSubscribed} style={{ padding: "0.5rem 1rem", background: isSubscribed ? "#fd7e14" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: isSubscribed ? "pointer" : "not-allowed" }}>
              🔁 Улучшить с учётом SEO
              {!isSubscribed && " (только Pro/Business)"}
            </button>
            <button onClick={exportCSV} className="btn-secondary" style={{ padding: "0.5rem 1rem" }}>📊 CSV</button>
            <button onClick={exportPDF} className="btn-secondary" style={{ padding: "0.5rem 1rem" }}>📄 PDF</button>
            <button onClick={() => { const t = `Заголовок: ${results[selectedIndex].title}\nОписание: ${results[selectedIndex].description}\nПреимущества: ${results[selectedIndex].advantages?.join(", ")}\nХарактеристики: ${results[selectedIndex].features?.join(", ")}\nКлючевые слова: ${results[selectedIndex].keywords?.join(", ")}`; navigator.clipboard.writeText(t); alert("Скопировано!"); }} className="btn-secondary" style={{ padding: "0.5rem 1rem" }}>📋 Копировать</button>
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
          {analyzing && <p style={{ opacity: 0.6 }}>🔄 Анализируем...</p>}
        </div>
      )}

      {showTariff && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ background: "var(--card-bg)", padding: "2rem", maxWidth: 400, width: "90%", textAlign: "center" }}>
            <h2>🚀 Бесплатные генерации закончились</h2>
            <p>Подключи тариф Pro или Business для безлимита</p>
            <button onClick={() => setShowTariff(false)} className="btn-primary" style={{ marginTop: "1rem" }}>Закрыть</button>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const FREE_LIMIT = 3;

const LAVA_PRO_URL = "https://app.lava.top/products/5ae7412f-b9bb-4dbd-a9c4-03d6fabd98be/1efab6cb-d47f-4011-a7a5-53d37b80173c?currency=RUB&success_url=https://marketcard-ai-chi.vercel.app/success?plan=pro";
const LAVA_BUSINESS_URL = "https://app.lava.top/products/5ae7412f-b9bb-4dbd-a9c4-03d6fabd98be/49d184d9-89ef-403c-882a-ee05c593884f?currency=RUB&success_url=https://marketcard-ai-chi.vercel.app/success?plan=business";

export default function Home() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [theme, setTheme] = useState<"wb" | "ozon" | "light">("wb");
  const [generationsLeft, setGenerationsLeft] = useState(FREE_LIMIT);
  const [showPlans, setShowPlans] = useState(false);
  const [multiVariant, setMultiVariant] = useState(false);
  const [seoReport, setSeoReport] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const themeClass = theme === "light" ? "theme-light" : theme === "ozon" ? "theme-ozon" : "theme-wb";

  useEffect(() => {
    const saved = localStorage.getItem("marketcard_generations");
    if (saved) setGenerationsLeft(parseInt(saved));
    const savedTheme = localStorage.getItem("marketcard_theme");
    if (savedTheme) setTheme(savedTheme as any);
  }, []);

  const saveGenerations = (count: number) => {
    setGenerationsLeft(count);
    localStorage.setItem("marketcard_generations", count.toString());
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const analyzeSEO = (card: any) => {
    const titleLen = card.title?.length || 0;
    const descLen = card.description?.length || 0;
    const specsCnt = Object.keys(card.specifications || {}).length;
    const kwCnt = card.keywords?.length || 0;
    const titleOk = titleLen >= 50 && titleLen <= 100;
    const descOk = descLen >= 100;
    const specsOk = specsCnt >= 8;
    const kwOk = kwCnt >= 5;
    const score = [titleOk, descOk, specsOk, kwOk].filter(Boolean).length;
    const grade = score >= 4 ? "A" : score >= 2 ? "B" : "C";
    setSeoReport({ titleLength: titleLen, titleOk, descLength: descLen, descOk, specsCount: specsCnt, specsOk, kwCount: kwCnt, kwOk, grade });
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    if (description.trim().toLowerCase() === "reset123") {
      saveGenerations(FREE_LIMIT);
      setDescription("");
      notify("🔄 Лимит сброшен! Доступно " + FREE_LIMIT + " генераций.");
      return;
    }
    if (generationsLeft <= 0) {
      setShowConfetti(true);
      setShowPlans(true);
      return;
    }
    setLoading(true);
    setVariants([]); setShowVariants(false); setResult(null); setSeoReport(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, marketplace: theme === "light" ? "wb" : theme, multi_variant: multiVariant }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        const cards = data.map((item: any, idx: number) => ({ ...item, id: Date.now() + idx }));
        setVariants(cards);
        setShowVariants(true);
        notify(`✅ Сгенерировано ${cards.length} варианта!`);
      } else {
        setResult(data);
        analyzeSEO(data);
        saveGenerations(generationsLeft - 1);
        notify("✅ Карточка создана! Осталось: " + (generationsLeft - 1));
      }
    } catch { notify("❌ Ошибка генерации"); }
    finally { setLoading(false); }
  };

  const selectVariant = (card: any) => {
    setResult(card);
    analyzeSEO(card);
    setShowVariants(false);
    saveGenerations(generationsLeft - 1);
    notify("✅ Вариант выбран и сохранён");
  };

  const handleImprove = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: `Улучши карточку: ${result.title}` }),
      });
      const data = await res.json();
      setResult(data);
      analyzeSEO(data);
      saveGenerations(generationsLeft - 1);
      notify("✅ Карточка улучшена! Осталось: " + (generationsLeft - 1));
    } catch { notify("❌ Ошибка улучшения"); }
    finally { setLoading(false); }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `${result.title}\n\n${result.description}\n\nХарактеристики:\n${Object.entries(result.specifications || {}).map(([k,v]) => `${k}: ${v}`).join("\n")}\n\nКлючевые слова: ${result.keywords?.join(", ")}`;
    navigator.clipboard.writeText(text);
    notify("📋 Скопировано в буфер обмена!");
  };

  const exportCSV = () => {
    if (!result) return;
    const rows = [
      ["Характеристика", "Значение"],
      ["Название", result.title],
      ["Описание", result.description],
      ...Object.entries(result.specifications || {}).map(([k, v]) => [k, v]),
      ["Ключевые слова", result.keywords?.join(", ")],
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marketcard.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("📥 CSV скачан!");
  };

  return (
    <>
      <main className={`min-h-screen relative transition-colors duration-500 ${themeClass}`}>
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 glow rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 glow rounded-full blur-3xl" />
        </div>

        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-xl text-white px-6 py-3 rounded-full text-sm shadow-xl border border-white/20">
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div translate="no" className="text-sm text-gray-400 mb-2">MarketCard AI — Генератор карточек</div>
            <h1 translate="no" className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white to-amber-400 bg-clip-text text-transparent mb-4">MarketCard</h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">Генератор карточек с выбором лучшего варианта</p>
          </motion.div>

          <div className="flex gap-2 mb-6 justify-center">
            {[{ key: "wb", label: "🟣 Неон" }, { key: "ozon", label: "🟡 Премиум" }, { key: "light", label: "⚪ Светлая" }].map((t) => (
              <button key={t.key} onClick={() => setTheme(t.key as any)} className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${theme === t.key ? "bg-white/20 text-white shadow-lg" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}>{t.label}</button>
            ))}
            <button onClick={() => setShowPlans(true)} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2 rounded-full text-sm font-medium animate-pulse">💎 Тарифы</button>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card">
                <h3 className="text-sm font-medium mb-3 text-gray-300">Опишите товар</h3>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Введите описание товара..."
                  rows={5}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500 transition"
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">Бесплатных генераций: {generationsLeft}</span>
                    <label className="flex items-center gap-1 text-xs text-gray-400">
                      <input type="checkbox" checked={multiVariant} onChange={e => setMultiVariant(e.target.checked)} className="w-3 h-3 rounded accent-purple-500" />
                      Несколько вариантов
                    </label>
                  </div>
                  <button onClick={handleGenerate} disabled={!description.trim() || loading} className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 disabled:opacity-50 transition">
                    {loading ? "⏳ Генерируем..." : "🚀 Сгенерировать"}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              {showVariants && variants.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-4">
                  <h3 className="text-sm font-medium mb-3 text-gray-300">Выберите лучший вариант:</h3>
                  <div className="grid gap-3">
                    {variants.map((v, i) => (
                      <div key={v.id || i} onClick={() => selectVariant(v)} className="bg-white/5 hover:bg-white/10 rounded-xl p-4 cursor-pointer transition-all">
                        <p className="text-sm font-semibold text-white">Вариант {i+1}</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{v.title || 'Без названия'}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {result ? (
                <motion.div key={result.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card space-y-5">
                  <div className="flex flex-wrap gap-1">
                    {result.keywords?.slice(0, 6).map((kw: string) => (
                      <span key={kw} className="bg-purple-500/10 text-purple-400 text-xs px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                  <h3 className="text-2xl font-bold text-orange-400">{result.title}</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{result.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(result.specifications || {}).map(([key, value]) => (
                      <div key={key} className="bg-black/20 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{key}</p>
                        <p className="text-sm font-medium">{value as string}</p>
                      </div>
                    ))}
                  </div>

                  {seoReport && (
                    <div className="bg-black/20 rounded-2xl p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-gray-300">📊 SEO-анализ</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between text-gray-400"><span>Название ({seoReport.titleLength}/50-100)</span><span className={seoReport.titleOk ? "text-green-400" : "text-red-400"}>{seoReport.titleOk ? "✅" : "❌"}</span></div>
                        <div className="flex justify-between text-gray-400"><span>Описание ({seoReport.descLength}/100+)</span><span className={seoReport.descOk ? "text-green-400" : "text-red-400"}>{seoReport.descOk ? "✅" : "❌"}</span></div>
                        <div className="flex justify-between text-gray-400"><span>Характеристики ({seoReport.specsCount}/8+)</span><span className={seoReport.specsOk ? "text-green-400" : "text-red-400"}>{seoReport.specsOk ? "✅" : "❌"}</span></div>
                        <div className="flex justify-between text-gray-400"><span>Ключевые слова ({seoReport.kwCount}/5+)</span><span className={seoReport.kwOk ? "text-green-400" : "text-red-400"}>{seoReport.kwOk ? "✅" : "❌"}</span></div>
                      </div>
                      <p className="text-xs text-gray-500">Оценка: {seoReport.grade}</p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={copyToClipboard} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-colors">📋 Копировать</button>
                    <button onClick={exportCSV} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2.5 rounded-xl text-sm transition-colors">📥 CSV</button>
                    <button onClick={handleImprove} className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-2.5 rounded-xl text-sm transition-colors">✨ Улучшить</button>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card flex items-center justify-center" style={{ minHeight: "300px" }}>
                  <div className="text-center text-gray-500">
                    <div className="text-5xl mb-4">🛍️</div>
                    <h3 className="text-lg mb-1">Здесь появится карточка</h3>
                    <p className="text-sm">Опишите товар и нажмите «Сгенерировать»</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Модалка "Бесплатные генерации закончились" */}
      {showConfetti && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowConfetti(false)}>
          <div className="bg-gray-900 border border-gray-600 rounded-3xl p-8 text-center shadow-2xl" style={{ color: 'white' }} onClick={e => e.stopPropagation()}>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'white' }}>Бесплатные генерации закончились!</h2>
            <p className="text-gray-300 mb-4" style={{ color: '#d1d5db' }}>Переходите на Pro для безлимитного доступа</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowConfetti(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl">Позже</button>
              <button onClick={() => { setShowConfetti(false); setShowPlans(true); }} className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold">Смотреть тарифы</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модалка тарифов – НОВЫЙ ДИЗАЙН */}
      {showPlans && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowPlans(false)}>
          <div className="bg-gray-900 border border-gray-600 rounded-3xl p-6 max-w-2xl w-full shadow-2xl" style={{ color: 'white' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold" style={{ color: 'white' }}>Тарифы MarketCard</h2>
              <button onClick={() => setShowPlans(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Бесплатный */}
              <div className="relative bg-gray-800/50 border border-gray-700 rounded-2xl p-5 text-center">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'white' }}>Free</h3>
                <div className="text-3xl font-bold mb-4" style={{ color: 'white' }}>0 ₽</div>
                <ul className="space-y-2 mb-6 text-sm text-left" style={{ color: '#d1d5db' }}>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> 3 генерации в месяц</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Базовое качество</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Ручной ввод</li>
                </ul>
                <button
                  onClick={() => { setShowPlans(false); notify("✅ Вы уже на бесплатном тарифе."); }}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ backgroundColor: '#374151', color: 'white' }}
                >
                  Текущий тариф
                </button>
              </div>

              {/* Pro */}
              <div className="relative bg-gray-800/50 border border-purple-500/50 rounded-2xl p-5 text-center" style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-bold px-4 py-1 rounded-full">Популярный</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'white' }}>Pro</h3>
                <div className="text-3xl font-bold mb-4" style={{ color: 'white' }}>990 ₽/мес</div>
                <ul className="space-y-2 mb-6 text-sm text-left" style={{ color: '#d1d5db' }}>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> 50 генераций в месяц</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> AI-оптимизация</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Экспорт CSV</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Шаблоны</li>
                </ul>
                <button
                  onClick={() => window.open(LAVA_PRO_URL, "_blank")}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ backgroundColor: '#8b5cf6', color: 'white' }}
                >
                  Попробовать
                </button>
              </div>

              {/* Business */}
              <div className="relative bg-gray-800/50 border border-gray-700 rounded-2xl p-5 text-center">
                <h3 className="text-lg font-bold mb-2" style={{ color: 'white' }}>Business</h3>
                <div className="text-3xl font-bold mb-4" style={{ color: 'white' }}>2 990 ₽/мес</div>
                <ul className="space-y-2 mb-6 text-sm text-left" style={{ color: '#d1d5db' }}>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Безлимит генераций</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Автопубликация</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Приоритетная поддержка</li>
                  <li className="flex items-start gap-2"><span className="text-green-400 mt-0.5">✓</span> Командный доступ</li>
                </ul>
                <button
                  onClick={() => window.open(LAVA_BUSINESS_URL, "_blank")}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ backgroundColor: '#f59e0b', color: 'white' }}
                >
                  Попробовать
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

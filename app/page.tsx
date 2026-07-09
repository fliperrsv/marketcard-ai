'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [tab, setTab] = useState('generator');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState('деловой');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [generationsLeft, setGenerationsLeft] = useState(3);
  const [showTariff, setShowTariff] = useState(false);

  // Для SEO-анализа
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Режим редактирования
  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [editedAdv, setEditedAdv] = useState('');
  const [editedFeatures, setEditedFeatures] = useState('');
  const [editedKeywords, setEditedKeywords] = useState('');

  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDev) {
        localStorage.setItem('generationsLeft', '10');
        setGenerationsLeft(10);
      } else {
        const saved = localStorage.getItem('generationsLeft');
        if (saved !== null) setGenerationsLeft(parseInt(saved));
      }
    }
  }, [isDev]);

  async function generateSEO() {
    if (!isDev && generationsLeft <= 0) {
      setShowTariff(true);
      return;
    }
    if (!description.trim()) {
      alert('Введите описание товара');
      return;
    }

    setLoading(true);
    setAnalysis(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, tone })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        // Заполняем поля редактирования
        setEditedTitle(data.data.title || '');
        setEditedDesc(data.data.description || '');
        setEditedAdv((data.data.advantages || []).join('\n'));
        setEditedFeatures((data.data.features || []).join('\n'));
        setEditedKeywords((data.data.keywords || []).join(', '));
        // Анализируем сразу
        await analyzeCurrent(data.data);
        if (!isDev) {
          const newLeft = generationsLeft - 1;
          setGenerationsLeft(newLeft);
          localStorage.setItem('generationsLeft', String(newLeft));
        }
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (e) {
      alert('Ошибка генерации');
    }
    setLoading(false);
  }

  async function analyzeCurrent(data) {
    if (!data) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: JSON.stringify(data) })
      });
      const d = await res.json();
      if (d.success) setAnalysis(d.data);
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  }

  async function improveSEO() {
    // Собираем текущий объект из редактируемых полей
    const current = {
      title: editedTitle,
      description: editedDesc,
      advantages: editedAdv.split('\n').filter(s => s.trim()),
      features: editedFeatures.split('\n').filter(s => s.trim()),
      keywords: editedKeywords.split(',').map(s => s.trim()).filter(s => s)
    };
    if (!current.title && !current.description) {
      alert('Нет данных для улучшения');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/improve-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: current, analysis, tone })
      });
      const d = await res.json();
      if (d.success) {
        setResult(d.data);
        setEditedTitle(d.data.title || '');
        setEditedDesc(d.data.description || '');
        setEditedAdv((d.data.advantages || []).join('\n'));
        setEditedFeatures((d.data.features || []).join('\n'));
        setEditedKeywords((d.data.keywords || []).join(', '));
        await analyzeCurrent(d.data);
      } else {
        alert('Ошибка: ' + d.error);
      }
    } catch (e) {
      alert('Ошибка улучшения');
    }
    setLoading(false);
  }

  function startEditing() {
    setEditing(true);
  }

  function applyEdits() {
    const updated = {
      title: editedTitle,
      description: editedDesc,
      advantages: editedAdv.split('\n').filter(s => s.trim()),
      features: editedFeatures.split('\n').filter(s => s.trim()),
      keywords: editedKeywords.split(',').map(s => s.trim()).filter(s => s)
    };
    setResult(updated);
    setEditing(false);
    analyzeCurrent(updated);
  }

  function cancelEditing() {
    setEditing(false);
    if (result) {
      setEditedTitle(result.title || '');
      setEditedDesc(result.description || '');
      setEditedAdv((result.advantages || []).join('\n'));
      setEditedFeatures((result.features || []).join('\n'));
      setEditedKeywords((result.keywords || []).join(', '));
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '2.5rem' }}>📝 MarketCard AI</h1>
      <p style={{ color: '#666' }}>Создай SEO-карточку, получи анализ и улучшай</p>

      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0 2rem', borderBottom: '2px solid #eee' }}>
        <button onClick={() => setTab('generator')} style={{ padding: '0.8rem 1.5rem', border: 'none', background: tab === 'generator' ? '#0070f3' : 'transparent', color: tab === 'generator' ? '#fff' : '#333', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>✨ Генератор</button>
        <button onClick={() => setTab('analyzer')} style={{ padding: '0.8rem 1.5rem', border: 'none', background: tab === 'analyzer' ? '#0070f3' : 'transparent', color: tab === 'analyzer' ? '#fff' : '#333', borderRadius: '8px 8px 0 0', cursor: 'pointer' }}>🔍 SEO-анализ</button>
      </div>

      {tab === 'generator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Например: Смартфон Tecno с батареей 4500 мАч..." rows={4} style={{ width: '100%', padding: '0.8rem', borderRadius: 8, border: '1px solid #ddd' }} />
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ padding: '0.8rem', borderRadius: 8, border: '1px solid #ddd' }}>
            <option value="деловой">Деловой</option>
            <option value="дружеский">Дружеский</option>
            <option value="креативный">Креативный</option>
            <option value="научный">Научный</option>
          </select>
          <button onClick={generateSEO} disabled={loading || !description.trim()} style={{ padding: '1rem', background: loading || !description.trim() ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1.1rem', cursor: 'pointer' }}>
            {loading ? 'Генерация...' : '🚀 Сгенерировать SEO-карточку'}
          </button>
          <div style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
            Осталось генераций: <strong>{generationsLeft}</strong> {isDev ? '(∞ dev)' : ''}
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: 12, border: '1px solid #e9ecef' }}>
          <h2>✅ SEO-карточка</h2>
          {!editing ? (
            <div>
              <div><strong>Заголовок:</strong> {result.title}</div>
              <div><strong>Описание:</strong> {result.description}</div>
              <div><strong>Преимущества:</strong> <ul>{result.advantages?.map((a,i) => <li key={i}>{a}</li>)}</ul></div>
              <div><strong>Характеристики:</strong> <ul>{result.features?.map((f,i) => <li key={i}>{f}</li>)}</ul></div>
              <div><strong>Ключевые слова:</strong> {result.keywords?.join(', ')}</div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={startEditing} style={{ padding: '0.5rem 1rem', background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>✏️ Редактировать</button>
                <button onClick={improveSEO} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#fd7e14', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔁 Улучшить с учётом SEO</button>
                <button onClick={() => { const t = `Заголовок: ${result.title}\nОписание: ${result.description}\nПреимущества: ${result.advantages?.join(', ')}\nХарактеристики: ${result.features?.join(', ')}\nКлючевые слова: ${result.keywords?.join(', ')}`; navigator.clipboard.writeText(t); alert('Скопировано!'); }} style={{ padding: '0.5rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>📋 Копировать</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label>Заголовок</label>
              <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
              <label>Описание</label>
              <textarea value={editedDesc} onChange={(e) => setEditedDesc(e.target.value)} rows={3} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
              <label>Преимущества (каждое с новой строки)</label>
              <textarea value={editedAdv} onChange={(e) => setEditedAdv(e.target.value)} rows={5} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
              <label>Характеристики (каждое с новой строки)</label>
              <textarea value={editedFeatures} onChange={(e) => setEditedFeatures(e.target.value)} rows={5} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
              <label>Ключевые слова (через запятую)</label>
              <input value={editedKeywords} onChange={(e) => setEditedKeywords(e.target.value)} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={applyEdits} style={{ padding: '0.5rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>💾 Применить</button>
                <button onClick={cancelEditing} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>❌ Отменить</button>
              </div>
            </div>
          )}

          {/* SEO-анализ */}
          {analysis && (
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#eef2f7', borderRadius: 8 }}>
              <h3>📊 SEO-анализ</h3>
              <div><strong>Оценка:</strong> {analysis.score}%</div>
              <div><strong>Сильные стороны:</strong> <ul>{analysis.strengths?.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
              <div><strong>Что улучшить:</strong> <ul>{analysis.weaknesses?.map((w,i) => <li key={i}>{w}</li>)}</ul></div>
              <div><strong>Рекомендации:</strong> <ul>{analysis.recommendations?.map((r,i) => <li key={i}>{r}</li>)}</ul></div>
            </div>
          )}
          {analyzing && <p>🔄 Анализ...</p>}
        </div>
      )}

      {showTariff && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: 16, maxWidth: 400, width: '90%', textAlign: 'center' }}>
            <h2>🚀 Бесплатные генерации закончились</h2>
            <p>Подключи тариф Pro и получай безлимитные генерации + SEO-анализ</p>
            <button onClick={() => setShowTariff(false)} style={{ padding: '0.8rem 2rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Подключить тариф</button>
          </div>
        </div>
      )}
    </main>
  );
}

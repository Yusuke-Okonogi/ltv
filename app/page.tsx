"use client";

import React, { useState, useMemo, useEffect } from 'react';

// --- 5. システム基盤 (IndexedDB: RakutenLTV_System_v4) ---
const DB_NAME = "RakutenLTV_System_v4";
const STORE_ORDERS = "orders";
const STORE_ITEMS = "item_master";

type ViewState = 'SUMMARY' | 'UPLOAD' | 'GOLDEN' | 'ITEMS' | 'RFM1' | 'ITEM_MASTER';

export default function RakutenLTVSystem() {
  const [view, setView] = useState<ViewState>('UPLOAD');
  const [rawData, setRawData] = useState<any[]>([]);
  const [itemMaster, setItemMaster] = useState<any[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<{name: string, users: any[]} | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");

  const loadAllData = async () => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) db.createObjectStore(STORE_ORDERS, { keyPath: "uniqueKey" });
      if (!db.objectStoreNames.contains(STORE_ITEMS)) db.createObjectStore(STORE_ITEMS, { keyPath: "itemCode" });
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction([STORE_ORDERS, STORE_ITEMS], "readonly");
      tx.objectStore(STORE_ORDERS).getAll().onsuccess = (res: any) => setRawData(res.target.result || []);
      tx.objectStore(STORE_ITEMS).getAll().onsuccess = (res: any) => setItemMaster(res.target.result || []);
    };
  };

  const updateItemName = async (itemCode: string, newName: string) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_ITEMS, "readwrite");
      tx.objectStore(STORE_ITEMS).put({ itemCode, displayName: newName });
      tx.oncomplete = () => loadAllData();
    };
  };

  const resetDB = () => {
    if (!confirm("⚠️ データを完全に消去します。よろしいですか？")) return;
    indexedDB.deleteDatabase(DB_NAME);
    window.location.reload();
  };

  useEffect(() => { loadAllData(); }, []);

  // --- 2. 分析ロジック (FIX済み仕様 + ゴールデンルート商品追跡) ---
  const analytics = useMemo(() => {
    if (rawData.length === 0) return null;
    const itemMap = new Map(itemMaster.map(m => [m.itemCode, m.displayName]));
    const sortedRaw = [...rawData].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
    const dateRange = `${sortedRaw[0].orderDate.replace(/-/g, '/')} ～ ${sortedRaw[sortedRaw.length - 1].orderDate.replace(/-/g, '/')}`;

    const uMap = new Map();
    const monthMap = new Map();
    const yearsSet = new Set<string>();
    const itemStatsMap = new Map();

    rawData.forEach(d => {
      const uKey = d.email || (d.lastName + d.firstName);
      if (!uMap.has(uKey)) uMap.set(uKey, { uKey, email: d.email, name: `${d.lastName}${d.firstName}`, orders: new Map() });
      const u = uMap.get(uKey);
      if (!u.orders.has(d.orderId)) u.orders.set(d.orderId, { orderId: d.orderId, date: d.orderDate, total: 0, items: [] });
      const o = u.orders.get(d.orderId);
      o.total += d.price;
      o.items.push(d.itemCode);

      yearsSet.add(d.orderDate.substring(0, 4));
      const mKey = d.orderDate.substring(0, 7).replace(/-/g, '/');
      if (!monthMap.has(mKey)) monthMap.set(mKey, { sales: 0, users: new Set() });
      monthMap.get(mKey).sales += d.price;
      monthMap.get(mKey).users.add(uKey);

      if (!itemStatsMap.has(d.itemCode)) itemStatsMap.set(d.itemCode, { code: d.itemCode, name: itemMap.get(d.itemCode) || d.itemName, count: 0, sales: 0, buyers: new Set() });
      const ista = itemStatsMap.get(d.itemCode);
      ista.count++; ista.sales += d.price; ista.buyers.add(uKey);
    });

    const yearsList = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    if (!selectedYear && yearsList.length > 0) setSelectedYear(yearsList[0]);

    const uList = Array.from(uMap.values()).map(u => {
      const orders = Array.from(u.orders.values()).sort((a:any, b:any) => a.date.localeCompare(b.date));
      const lastDate = new Date((orders[orders.length-1] as any).date.replace(/\//g, '-'));
      const diff = (new Date(2026, 0, 12).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      let rIdx = 5; if (diff <= 1) rIdx = 0; else if (diff <= 3) rIdx = 1; else if (diff <= 5) rIdx = 2; else if (diff <= 12) rIdx = 3; else if (diff <= 17) rIdx = 4;
      const cnt = orders.length;
      let fIdx = 5; if (cnt >= 6) fIdx = 0; else if (cnt === 5) fIdx = 1; else if (cnt === 4) fIdx = 2; else if (cnt === 3) fIdx = 3; else if (cnt === 2) fIdx = 4;
      return { ...u, rIdx, fIdx, count: cnt, orders, ltv: orders.reduce((s:number, o:any) => s + o.total, 0) };
    });

    // ゴールデンルート分析：商品遷移別の最終LTV集計
    const routeMap = new Map();
    uList.forEach(u => {
      const path = u.orders.slice(0, 10).map((o: any) => itemMap.get(o.items[0]) || o.items[0]);
      const pathKey = path.join(' → ');
      if (!routeMap.has(pathKey)) routeMap.set(pathKey, { path, count: 0, totalLtv: 0 });
      const r = routeMap.get(pathKey);
      r.count++;
      r.totalLtv += u.ltv;
    });
    const goldenRoutes = Array.from(routeMap.values())
      .map(r => ({ ...r, avgLtv: Math.round(r.totalLtv / r.count) }))
      .sort((a, b) => b.avgLtv - a.avgLtv)
      .slice(0, 15);

    const itemRankList = Array.from(itemStatsMap.values()).map(ista => {
      const buyersArr = Array.from(ista.buyers).map(k => uMap.get(k));
      const repeaters = buyersArr.filter(u => u.orders.size > 1).length;
      return { ...ista, repeatRate: ((repeaters / ista.buyers.size) * 100).toFixed(1), avgLtv: Math.round(ista.sales / ista.buyers.size) };
    }).sort((a,b) => b.count - a.count);

    return { 
      uList, dateRange, yearsList, itemRankList, goldenRoutes,
      totalSales: uList.reduce((s, u) => s + u.ltv, 0),
      avgLtv: Math.round(uList.reduce((s, u) => s + u.ltv, 0) / uList.length),
      repeatRateTotal: ((uList.filter(u => u.count > 1).length / uList.length) * 100).toFixed(1),
      monthlyStats: Array.from(monthMap.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([month, data]) => {
        const buyers = Array.from(data.users).map(k => uMap.get(k));
        const repeaters = buyers.filter(b => b.orders.size > 1).length;
        return { month, sales: data.sales, userCount: data.users.size, repeatRate: parseFloat(((repeaters / data.users.size) * 100).toFixed(1)), avgLtv: Math.round(data.sales / data.users.size) };
      })
    };
  }, [rawData, itemMaster, selectedYear]);

  const NavBtn = ({ id, label, icon, activeColor }: any) => (
    <button onClick={() => setView(id)} style={{ width: '100%', padding: '12px', marginBottom: '4px', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', backgroundColor: view === id ? '#f1f5f9' : 'transparent', color: view === id ? activeColor : '#475569', fontWeight: view === id ? 'bold' : 'normal', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>{icon}</span>{label}</button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      {/* 1. サイドメニュー (FIX済み) */}
      <aside style={{ width: '260px', backgroundColor: '#fff', borderRight: '1px solid #e2e8f0', position: 'fixed', height: '100vh', zIndex: 10 }}>
        <div style={{ padding: '20px', fontWeight: 'bold', color: '#bf0000', fontSize: '1.2rem' }}>楽天LTV分析</div>
        <div style={{ padding: '0 15px' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '15px 0 5px 5px', fontWeight: 'bold' }}>カテゴリ1：データ読み込み</div>
          <NavBtn id="UPLOAD" label="受注CSV読み込み" icon="📥" activeColor="#10b981" />
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '20px 0 5px 5px', fontWeight: 'bold' }}>カテゴリ2：分析系</div>
          <NavBtn id="SUMMARY" label="全体サマリ (月別推移)" icon="📊" activeColor="#3b82f6" />
          <NavBtn id="GOLDEN" label="ゴールデンルート" icon="✨" activeColor="#f59e0b" />
          <NavBtn id="ITEMS" label="商品ランキング" icon="📦" activeColor="#6366f1" />
          <NavBtn id="RFM1" label="RFM分布図" icon="🧱" activeColor="#ef4444" />
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '20px 0 5px 5px', fontWeight: 'bold' }}>カテゴリ3：保守</div>
          <NavBtn id="ITEM_MASTER" label="商品名メンテ" icon="📝" activeColor="#475569" />
          <button onClick={resetDB} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', backgroundColor: 'transparent', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}><span>🧱</span>DB初期化</button>
        </div>
      </aside>

      <main style={{ marginLeft: '260px', flex: 1 }}>
        <header style={{ height: '50px', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', padding: '0 20px', color: '#fff', fontSize: '0.85rem' }}>
          <span>📅 対象期間: {analytics?.dateRange || "未読込"}</span>
          <span style={{ marginLeft: 'auto' }}>データ件数: {rawData.length.toLocaleString()} / 100,000</span>
        </header>

        <div style={{ padding: '30px' }}>
          {view === 'SUMMARY' && analytics && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
                {[ {l: "累計売上", v: `¥${analytics.totalSales.toLocaleString()}`}, {l: "総顧客数", v: `${analytics.uList.length}名`}, {l: "リピート率", v: `${analytics.repeatRateTotal}%`}, {l: "平均LTV", v: `¥${analytics.avgLtv.toLocaleString()}`} ].map((c, i) => (
                  <div key={i} style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.l}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginTop: '5px' }}>{c.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>📊 全体サマリ (月別推移)</h2>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  {analytics.yearsList.map(y => (
                    <button key={y} onClick={() => setSelectedYear(y)} style={{ padding: '8px 20px', borderRadius: '25px', border: '1px solid #e2e8f0', cursor: 'pointer', background: selectedYear === y ? '#3b82f6' : '#fff', color: selectedYear === y ? '#fff' : '#475569' }}>{y}年</button>
                  ))}
                </div>
                {/* 2軸グラフエリア */}
                <div style={{ position: 'relative', height: '320px', background: '#f8fafc', borderRadius: '12px', padding: '40px 60px', marginBottom: '40px' }}>
                  {(() => {
                    const filtered = analytics.monthlyStats.filter(s => s.month.startsWith(selectedYear));
                    const maxS = Math.max(...filtered.map(m => m.sales), 1000);
                    return (
                      <div style={{ position: 'relative', height: '100%', width: '100%', borderBottom: '2px solid #e2e8f0' }}>
                        {[0, 0.25, 0.5, 0.75, 1].map(t => (
                          <div key={t} style={{ position: 'absolute', bottom: `${t * 100}%`, width: '100%', borderBottom: '1px dashed #e2e8f0' }}>
                            <span style={{ position: 'absolute', left: '-55px', fontSize: '0.65rem', color: '#3b82f6' }}>¥{Math.round(maxS * t).toLocaleString()}</span>
                            <span style={{ position: 'absolute', right: '-55px', fontSize: '0.65rem', color: '#f59e0b' }}>{t * 100}%</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end' }}>
                          {filtered.map((s, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                              <div style={{ width: '60%', background: '#3b82f6', height: `${(s.sales/maxS)*100}%`, opacity: 0.7 }}></div>
                              <div style={{ position: 'absolute', bottom: '-25px', fontSize: '0.7rem' }}>{s.month.split('/')[1]}月</div>
                            </div>
                          ))}
                          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1000 100" preserveAspectRatio="none">
                            <polyline fill="none" stroke="#f59e0b" strokeWidth="3" vectorEffect="non-scaling-stroke" points={filtered.map((s, i) => `${(i * (1000 / filtered.length)) + (1000 / filtered.length / 2)},${100 - s.repeatRate}`).join(' ')} />
                          </svg>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* 復元：月別データテーブル (画像赤枠部分) */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead><tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}><th style={{ padding: '12px' }}>対象月</th><th>売上金額</th><th>購入者数</th><th>リピート率</th><th>平均LTV</th></tr></thead>
                  <tbody>
                    {analytics.monthlyStats.filter(s => s.month.startsWith(selectedYear)).reverse().map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{s.month}</td>
                        <td>¥{s.sales.toLocaleString()}</td>
                        <td>{s.userCount}名</td>
                        <td style={{ color: '#3b82f6', fontWeight: 'bold' }}>{s.repeatRate.toFixed(1)}%</td>
                        <td>¥{s.avgLtv.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'GOLDEN' && analytics && (
            <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ marginBottom: '20px' }}>✨ ゴールデンルート：商品遷移別の最終LTVランキング</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead><tr style={{ background: '#f8fafc' }}><th style={{ padding: '12px', border: '1px solid #e2e8f0' }}>順位</th><th style={{ border: '1px solid #e2e8f0' }}>商品購入ルート (1回目 → 10回目)</th><th style={{ border: '1px solid #e2e8f0' }}>人数</th><th style={{ border: '1px solid #e2e8f0', background: '#ecfdf5' }}>最終平均LTV</th></tr></thead>
                  <tbody>
                    {analytics.goldenRoutes.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                        <td style={{ padding: '15px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {r.path.map((p: string, pi: number) => (
                              <span key={pi} style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ padding: '4px 8px', background: '#f1f5f9', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{p}</span>
                                {pi < r.path.length - 1 && <span style={{ margin: '0 5px' }}>→</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{r.count}名</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#10b981', background: '#ecfdf5' }}>¥{r.avgLtv.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'ITEMS' && analytics && (
            <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ marginBottom: '20px' }}>📦 商品ランキング</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}><th style={{ padding: '12px' }}>商品名</th><th>購入件数</th><th>総売上</th><th>リピート率</th><th>平均LTV</th></tr></thead>
                <tbody>
                  {analytics.itemRankList.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td><span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{item.count.toLocaleString()}</span></td>
                      <td>¥{item.sales.toLocaleString()}</td>
                      <td>{item.repeatRate}%</td>
                      <td>¥{item.avgLtv.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'RFM1' && analytics && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ marginBottom: '15px' }}>🧱 RFM分布図</h2>
              <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                <thead><tr><th style={{ border: '1px solid #e2e8f0', background: '#f8fafc', padding: '10px' }}>R \ F</th>{["6回+", "5回", "4回", "3回", "2回", "1回"].map(f => <th key={f} style={{ border: '1px solid #e2e8f0' }}>{f}</th>)}</tr></thead>
                <tbody>
                  {["1ヶ月内", "2-3ヶ月", "4-5ヶ月", "6-12ヶ月", "13-17ヶ月", "18ヶ月+"].map((rLab, ri) => (
                    <tr key={ri}>
                      <td style={{ border: '1px solid #e2e8f0', background: '#eff6ff', padding: '10px', fontWeight: 'bold' }}>{rLab}</td>
                      {[0,1,2,3,4,5].map(fi => {
                        const users = analytics.uList.filter(u => u.rIdx === ri && u.fIdx === fi);
                        return <td key={fi} style={{ border: '1px solid #e2e8f0', textAlign: 'center', padding: '15px' }}>
                          {users.length > 0 ? <span onClick={() => setSelectedSegment({ name: `${rLab} × F${6-fi}`, users })} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>{users.length}名</span> : "0"}
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedSegment && (
                <div style={{ marginTop: '20px', padding: '20px', border: '2px solid #2563eb', borderRadius: '12px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><strong>👥 {selectedSegment.name} 顧客リスト</strong><button onClick={() => setSelectedSegment(null)}>閉じる</button></div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}><th style={{ width: '200px', padding: '8px' }}>氏名</th><th style={{ padding: '8px' }}>メールアドレス (縦選択コピー用)</th></tr></thead>
                      <tbody>{selectedSegment.users.map((u, i) => <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '8px' }}>{u.name} 様</td><td style={{ padding: '8px', color: '#2563eb', fontFamily: 'monospace' }}>{u.email}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'UPLOAD' && (
            <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '20px' }}>受注CSVデータの取り込み</h3>
              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '12px', borderRadius: '8px', color: '#9a3412', marginBottom: '20px', fontWeight: 'bold' }}>⚠️ 制限事項：最大 100,000 件 まで</div>
              <div style={{ border: '2px dashed #cbd5e1', padding: '60px', borderRadius: '15px', color: '#64748b', background: '#fcfcfc' }}>CSVファイルをここにドラッグ＆ドロップ</div>
            </div>
          )}

          {view === 'ITEM_MASTER' && (
            <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ marginBottom: '20px' }}>📝 商品名メンテナンス</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}><th style={{ padding: '10px' }}>コード</th><th>表示名</th><th>操作</th></tr></thead>
                <tbody>
                  {analytics?.itemRankList.map((item) => (
                    <tr key={item.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{item.code}</td>
                      <td><input defaultValue={item.name} id={`name-${item.code}`} style={{ width: '90%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} /></td>
                      <td><button onClick={() => { const val = (document.getElementById(`name-${item.code}`) as any).value; updateItemName(item.code, val); alert("保存完了"); }} style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>保存</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
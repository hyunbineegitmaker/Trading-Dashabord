// Iain Trading System v1.0
import { useState, useEffect, useCallback } from “react”;

const ACCOUNT_SIZE = 1000;
const BASE_RISK_PCT = 1.5;

const SECTORS = [
{ name: “Technology”, etf: “XLK”, tickers: [“AAPL”,“MSFT”,“NVDA”,“AVGO”,“AMD”,“CRM”,“NOW”,“SNOW”,“NET”,“DDOG”] },
{ name: “Financials”, etf: “XLF”, tickers: [“JPM”,“GS”,“MS”,“V”,“MA”,“PYPL”,“COIN”,“SQ”,“HOOD”,“AFRM”] },
{ name: “Energy”, etf: “XLE”, tickers: [“XOM”,“CVX”,“OXY”,“DVN”,“MPC”,“VLO”,“FANG”,“HAL”,“SLB”,“BKR”] },
{ name: “Healthcare”, etf: “XLV”, tickers: [“UNH”,“LLY”,“JNJ”,“ABBV”,“MRK”,“AMGN”,“ISRG”,“DXCM”,“MRNA”,“TDOC”] },
{ name: “Cybersecurity”, etf: “HACK”, tickers: [“CRWD”,“PANW”,“FTNT”,“S”,“OKTA”,“ZS”,“TENB”,“SAIL”,“QLYS”,“CYBR”] },
{ name: “Software”, etf: “IGV”, tickers: [“MSFT”,“ADBE”,“ORCL”,“SHOP”,“HUBS”,“TWLO”,“BILL”,“GTLB”,“MDB”,“CFLT”] },
{ name: “Semiconductors”, etf: “SOXX”, tickers: [“NVDA”,“AMD”,“AVGO”,“QCOM”,“MU”,“AMAT”,“LRCX”,“KLAC”,“SWKS”,“MRVL”] },
{ name: “Consumer Disc”, etf: “XLY”, tickers: [“AMZN”,“TSLA”,“HD”,“MCD”,“NKE”,“LULU”,“DECK”,“ONON”,“CROX”,“RH”] },
];

const MARKET_ETFS = [“SPY”,“QQQ”,“IWM”,“DIA”];

function formatNum(n, decimals = 2) {
if (n == null || isNaN(n)) return “–”;
return Number(n).toFixed(decimals);
}

function formatPct(n) {
if (n == null || isNaN(n)) return “–”;
const sign = n >= 0 ? “+” : “”;
return `${sign}${Number(n).toFixed(2)}%`;
}

function calcRSI(closes, period = 14) {
if (closes.length < period + 1) return null;
let gains = 0, losses = 0;
for (let i = 1; i <= period; i++) {
const diff = closes[i] - closes[i - 1];
if (diff >= 0) gains += diff; else losses -= diff;
}
let avgGain = gains / period, avgLoss = losses / period;
for (let i = period + 1; i < closes.length; i++) {
const diff = closes[i] - closes[i - 1];
avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
}
if (avgLoss === 0) return 100;
return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcEMA(closes, period) {
if (closes.length < period) return null;
const k = 2 / (period + 1);
let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
return ema;
}

function calcTEMA(closes, period) {
if (closes.length < period * 3) return null;
const k = 2 / (period + 1);
function ema(data, p) {
let e = data.slice(0, p).reduce((a, b) => a + b, 0) / p;
for (let i = p; i < data.length; i++) e = data[i] * k + e * (1 - k);
return e;
}
const e1 = ema(closes, period);
const e2 = ema(closes.map((*, i) => i >= period - 1 ? closes[i] : null).filter(Boolean), period);
const e3 = ema(closes.map((*, i) => i >= period * 2 - 2 ? closes[i] : null).filter(Boolean), period);
return 3 * e1 - 3 * e2 + e3;
}

function analyzeStock(ticker, data) {
const closes = data.map(d => d.close);
const highs = data.map(d => d.high);
const lows = data.map(d => d.low);
const volumes = data.map(d => d.volume);

if (closes.length < 55) return null;

const price = closes[closes.length - 1];
const prevClose = closes[closes.length - 2];
const prevHigh = highs[highs.length - 2];

const ema9 = calcEMA(closes, 9);
const ema21 = calcEMA(closes, 21);
const ema50 = calcEMA(closes, 50);
const tema9 = calcTEMA(closes, 9);
const rsi = calcRSI(closes);

const high52 = Math.max(…highs.slice(-252));
const low52 = Math.min(…lows.slice(-252));
const adr = closes.slice(-20).reduce((sum, c, i, arr) => {
if (i === 0) return 0;
return sum + Math.abs(c - arr[i - 1]) / arr[i - 1] * 100;
}, 0) / 19;

const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
const todayVol = volumes[volumes.length - 1];
const volRatio = todayVol / avgVol20;

// Stage analysis
const stage2 = ema9 > ema21 && ema21 > ema50 && price > ema50;
const stage4 = ema9 < ema21 && ema21 < ema50 && price < ema50;

// Setup tags
const tags = [];
const pdh = price > prevHigh;
if (pdh) tags.push(“PDH”);

const nearATH = price >= high52 * 0.97;
const atATH = price >= high52 * 0.995;
if (atATH) tags.push(“ATH”);
else if (nearATH) tags.push(“nrATH”);

// VCP: volatility contraction (range narrowing)
const ranges = closes.slice(-10).map((c, i, arr) => i === 0 ? 0 : Math.abs(c - arr[i-1]));
const recentRange = ranges.slice(-3).reduce((a, b) => a + b, 0) / 3;
const priorRange = ranges.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
const vcp = recentRange < priorRange * 0.6 && stage2;
if (vcp) tags.push(“VCP”);

// UC: undercut and reclaim
const recentLow = Math.min(…lows.slice(-5));
const priorLow = Math.min(…lows.slice(-15, -5));
const uc = recentLow < priorLow && price > priorLow;
if (uc) tags.push(“UC”);

// EMA bounces
const ema21Bounce = Math.abs(price - ema21) / ema21 < 0.02 && price > ema21;
const ema50Bounce = Math.abs(price - ema50) / ema50 < 0.03 && price > ema50;
if (ema21Bounce) tags.push(“21e”);
if (ema50Bounce) tags.push(“50e”);

// RS (relative strength - simplified)
const rs = closes[closes.length - 1] / closes[closes.length - 20] - 1;
if (rs > 0.05) tags.push(“RS+”);

// MTF
const weeklyHigh = Math.max(…highs.slice(-5));
const priorWeekHigh = Math.max(…highs.slice(-10, -5));
if (weeklyHigh > priorWeekHigh) tags.push(“WK”);

// Engine + Trigger check
const engines = tags.filter(t => [“UC”,“VCP”,“21e”,“50e”,“WK”].includes(t));
const triggers = tags.filter(t => [“PDH”,“GAP”].includes(t));
const hasSignal = (engines.length >= 1 && triggers.length >= 1) || (vcp && pdh);

if (!hasSignal || !stage2) return null;

// Stop and targets
const stopDist = Math.max(price * 0.005, price - Math.min(…lows.slice(-5)));
const stopPrice = price - stopDist;
const alertPrice = price;
const risk = ACCOUNT_SIZE * (BASE_RISK_PCT / 100);
const shares = Math.floor(risk / stopDist);
const target2R = alertPrice + stopDist * 2;
const target5R = alertPrice + stopDist * 5;

// Warnings
if (adr > 8) tags.push(”!ATR”);
const stopPct = (stopDist / price) * 100;
if (stopPct > 5) tags.push(”!EXT”);

return {
ticker,
price,
change: ((price - prevClose) / prevClose) * 100,
ema9, ema21, ema50,
rsi,
adr: formatNum(adr),
stage2, stage4,
tags,
alertPrice: formatNum(alertPrice),
stopPrice: formatNum(stopPrice),
target2R: formatNum(target2R),
target5R: formatNum(target5R),
shares,
risk: formatNum(risk),
volRatio: formatNum(volRatio, 1),
high52: formatNum(high52),
score: engines.length * 2 + triggers.length + (rs > 0.1 ? 1 : 0) + (nearATH ? 1 : 0),
};
}

async function fetchYahoo(ticker) {
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
const json = await res.json();
const parsed = JSON.parse(json.contents);
const result = parsed?.chart?.result?.[0];
if (!result) return null;
const timestamps = result.timestamp;
const q = result.indicators.quote[0];
return timestamps.map((t, i) => ({
date: new Date(t * 1000),
open: q.open[i],
high: q.high[i],
low: q.low[i],
close: q.close[i],
volume: q.volume[i],
})).filter(d => d.close != null);
}

// ─── UI Components ───────────────────────────────────────────────────────────

function StatBox({ label, value, color }) {
return (
<div style={{
background: “#0d1117”,
border: “1px solid #1e2a3a”,
borderRadius: 8,
padding: “12px 16px”,
minWidth: 120,
flex: 1,
}}>
<div style={{ fontSize: 11, color: “#4a6080”, letterSpacing: 2, textTransform: “uppercase”, marginBottom: 6 }}>{label}</div>
<div style={{ fontSize: 20, fontWeight: 700, color: color || “#e2e8f0”, fontFamily: “‘JetBrains Mono’, monospace” }}>{value || “–”}</div>
</div>
);
}

function Tag({ label }) {
const colors = {
PDH: “#22c55e”, ATH: “#f59e0b”, nrATH: “#f59e0b”,
VCP: “#3b82f6”, UC: “#8b5cf6”, “21e”: “#06b6d4”,
“50e”: “#0ea5e9”, “RS+”: “#10b981”, WK: “#a855f7”,
MTF: “#ec4899”, “!ATR”: “#ef4444”, “!EXT”: “#f97316”, “!OPT”: “#ef4444”,
GAP: “#84cc16”,
};
return (
<span style={{
background: (colors[label] || “#334155”) + “22”,
color: colors[label] || “#94a3b8”,
border: `1px solid ${(colors[label] || "#334155")}44`,
borderRadius: 4,
padding: “2px 6px”,
fontSize: 10,
fontWeight: 700,
letterSpacing: 0.5,
}}>{label}</span>
);
}

function SignalRow({ pick, rank }) {
const changeColor = pick.change >= 0 ? “#22c55e” : “#ef4444”;
return (
<div style={{
display: “grid”,
gridTemplateColumns: “32px 70px 90px 1fr 90px 90px 90px 90px 60px”,
gap: 8,
alignItems: “center”,
padding: “10px 16px”,
borderBottom: “1px solid #0d1117”,
background: rank % 2 === 0 ? “#0a0f16” : “#080c12”,
transition: “background 0.15s”,
}}
onMouseEnter={e => e.currentTarget.style.background = “#111827”}
onMouseLeave={e => e.currentTarget.style.background = rank % 2 === 0 ? “#0a0f16” : “#080c12”}
>
<div style={{ color: “#4a6080”, fontSize: 12, fontFamily: “monospace” }}>{rank}</div>
<div style={{ fontWeight: 800, color: “#f1f5f9”, fontSize: 14, fontFamily: “‘JetBrains Mono’, monospace” }}>{pick.ticker}</div>
<div style={{ color: changeColor, fontSize: 13, fontFamily: “monospace” }}>
${pick.price?.toFixed(2)} <span style={{ fontSize: 11 }}>{formatPct(pick.change)}</span>
</div>
<div style={{ display: “flex”, gap: 4, flexWrap: “wrap” }}>
{pick.tags.map(t => <Tag key={t} label={t} />)}
</div>
<div style={{ color: “#64748b”, fontSize: 12, fontFamily: “monospace” }}>A: ${pick.alertPrice}</div>
<div style={{ color: “#ef4444”, fontSize: 12, fontFamily: “monospace” }}>S: ${pick.stopPrice}</div>
<div style={{ color: “#22c55e”, fontSize: 12, fontFamily: “monospace” }}>2R: ${pick.target2R}</div>
<div style={{ color: “#10b981”, fontSize: 12, fontFamily: “monospace” }}>5R: ${pick.target5R}</div>
<div style={{ color: “#94a3b8”, fontSize: 12, fontFamily: “monospace” }}>{pick.shares}sh</div>
</div>
);
}

function SectorRow({ sector, score, status }) {
const statusColor = status === “HOT” ? “#22c55e” : status === “WARM” ? “#f59e0b” : “#ef4444”;
const barWidth = (score / 4) * 100;
return (
<div style={{
display: “flex”, alignItems: “center”, gap: 12,
padding: “8px 16px”, borderBottom: “1px solid #0d1117”,
}}>
<div style={{ width: 140, color: “#e2e8f0”, fontSize: 13 }}>{sector}</div>
<div style={{ flex: 1, background: “#0d1117”, borderRadius: 4, height: 6, overflow: “hidden” }}>
<div style={{ width: `${barWidth}%`, background: statusColor, height: “100%”, borderRadius: 4, transition: “width 0.5s” }} />
</div>
<div style={{ width: 40, color: “#64748b”, fontSize: 12, fontFamily: “monospace”, textAlign: “right” }}>{score.toFixed(1)}</div>
<div style={{
width: 48, textAlign: “center”, fontSize: 11, fontWeight: 700,
color: statusColor, background: statusColor + “22”,
borderRadius: 4, padding: “2px 6px”,
}}>{status}</div>
</div>
);
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function TradingDashboard() {
const [scanning, setScanning] = useState(false);
const [progress, setProgress] = useState({ current: 0, total: 0, ticker: “” });
const [signals, setSignals] = useState([]);
const [sectorScores, setSectorScores] = useState([]);
const [marketData, setMarketData] = useState({});
const [posture, setPosture] = useState(null);
const [lastScan, setLastScan] = useState(null);
const [error, setError] = useState(null);
const [activeTab, setActiveTab] = useState(“signals”);

// Position sizer state
const [sizeEntry, setSizeEntry] = useState(””);
const [sizeStop, setSizeStop] = useState(””);
const [sizeRisk, setSizeRisk] = useState(BASE_RISK_PCT);

const runScan = useCallback(async () => {
setScanning(true);
setError(null);
setSignals([]);
setSectorScores([]);

```
try {
  // Fetch market ETFs
  const marketResults = {};
  for (const etf of MARKET_ETFS) {
    const data = await fetchYahoo(etf);
    if (data) marketResults[etf] = data;
  }
  setMarketData(marketResults);

  // Determine market posture
  const spyData = marketResults["SPY"];
  if (spyData) {
    const closes = spyData.map(d => d.close);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);
    const price = closes[closes.length - 1];
    if (ema9 > ema21 && ema21 > ema50 && price > ema50) setPosture("BULLISH");
    else if (price < ema50 && ema9 < ema50) setPosture("BEARISH");
    else setPosture("CAUTION");
  }

  // Scan all sectors
  const allTickers = [...new Set(SECTORS.flatMap(s => s.tickers))];
  setProgress({ current: 0, total: allTickers.length, ticker: "" });

  const sectorScoreMap = {};
  const allSignals = [];

  for (const sector of SECTORS) {
    let sectorScore = 0;
    let count = 0;
    for (const ticker of sector.tickers) {
      setProgress(p => ({ ...p, current: p.current + 1, ticker }));
      try {
        const data = await fetchYahoo(ticker);
        if (!data) continue;
        const closes = data.map(d => d.close);
        const ema9 = calcEMA(closes, 9);
        const ema21 = calcEMA(closes, 21);
        const ema50 = calcEMA(closes, 50);
        const price = closes[closes.length - 1];
        let score = 0;
        if (price > ema9) score++;
        if (price > ema21) score++;
        if (price > ema50) score++;
        if (ema9 > ema21) score++;
        sectorScore += score;
        count++;
        const signal = analyzeStock(ticker, data);
        if (signal) allSignals.push({ ...signal, sector: sector.name });
      } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    sectorScoreMap[sector.name] = count > 0 ? sectorScore / count : 0;
  }

  const sortedSectors = Object.entries(sectorScoreMap)
    .map(([name, score]) => ({
      name, score,
      status: score >= 3 ? "HOT" : score >= 2 ? "WARM" : "COLD"
    }))
    .sort((a, b) => b.score - a.score);

  setSectorScores(sortedSectors);
  setSignals(allSignals.sort((a, b) => b.score - a.score));
  setLastScan(new Date());
} catch (err) {
  setError("Scan failed: " + err.message);
} finally {
  setScanning(false);
  setProgress({ current: 0, total: 0, ticker: "" });
}
```

}, []);

// Position sizer calc
const entryNum = parseFloat(sizeEntry);
const stopNum = parseFloat(sizeStop);
const riskDollar = ACCOUNT_SIZE * (parseFloat(sizeRisk) / 100);
const stopDist = entryNum - stopNum;
const calcShares = stopDist > 0 ? Math.floor(riskDollar / stopDist) : 0;
const positionCost = calcShares * entryNum;
const pct30 = ACCOUNT_SIZE * 0.3;
const cappedShares = positionCost > pct30 ? Math.floor(pct30 / entryNum) : calcShares;
const target2R = entryNum + stopDist * 2;
const target5R = entryNum + stopDist * 5;

const postureColor = posture === “BULLISH” ? “#22c55e” : posture === “BEARISH” ? “#ef4444” : “#f59e0b”;
const spyPrice = marketData[“SPY”]?.slice(-1)[0]?.close;
const spyChange = spyPrice && marketData[“SPY”]?.length > 1
? ((spyPrice - marketData[“SPY”].slice(-2)[0].close) / marketData[“SPY”].slice(-2)[0].close) * 100
: null;

const tabs = [“signals”, “sectors”, “sizer”];

return (
<div style={{
minHeight: “100vh”,
background: “#080c12”,
color: “#e2e8f0”,
fontFamily: “‘Inter’, ‘SF Pro Display’, system-ui, sans-serif”,
}}>
{/* Header */}
<div style={{
background: “linear-gradient(135deg, #0d1117 0%, #0a1628 100%)”,
borderBottom: “1px solid #1e2a3a”,
padding: “16px 24px”,
display: “flex”, alignItems: “center”, justifyContent: “space-between”,
position: “sticky”, top: 0, zIndex: 100,
backdropFilter: “blur(12px)”,
}}>
<div style={{ display: “flex”, alignItems: “center”, gap: 12 }}>
<div style={{
width: 36, height: 36, borderRadius: 8,
background: “linear-gradient(135deg, #3b82f6, #8b5cf6)”,
display: “flex”, alignItems: “center”, justifyContent: “center”,
fontSize: 16, fontWeight: 900,
}}>I</div>
<div>
<div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Iain’s Trading System</div>
<div style={{ fontSize: 11, color: “#4a6080”, letterSpacing: 1 }}>
{lastScan ? `Last scan: ${lastScan.toLocaleTimeString()}` : “No scan yet”}
</div>
</div>
</div>

```
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {scanning && (
        <div style={{ fontSize: 12, color: "#4a6080" }}>
          Scanning {progress.ticker}... ({progress.current}/{progress.total})
        </div>
      )}
      <button
        onClick={runScan}
        disabled={scanning}
        style={{
          background: scanning ? "#1e2a3a" : "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: scanning ? "#4a6080" : "#fff",
          border: "none", borderRadius: 8,
          padding: "10px 20px", fontSize: 13, fontWeight: 700,
          cursor: scanning ? "not-allowed" : "pointer",
          letterSpacing: 0.5,
          transition: "all 0.2s",
        }}
      >
        {scanning ? "⏳ Scanning..." : "▶ Full Daily Scan"}
      </button>
    </div>
  </div>

  {/* Stats Row */}
  <div style={{ padding: "16px 24px", display: "flex", gap: 12, flexWrap: "wrap" }}>
    <StatBox label="Posture" value={posture} color={postureColor} />
    <StatBox label="SPY" value={spyPrice ? `$${formatNum(spyPrice)}` : "--"} color={spyChange >= 0 ? "#22c55e" : "#ef4444"} />
    <StatBox label="SPY Chg" value={formatPct(spyChange)} color={spyChange >= 0 ? "#22c55e" : "#ef4444"} />
    <StatBox label="Signals" value={signals.length} color="#3b82f6" />
    <StatBox label="Account" value={`$${ACCOUNT_SIZE.toLocaleString()}`} color="#f59e0b" />
    <StatBox label="Risk/Trade" value={`$${formatNum(ACCOUNT_SIZE * BASE_RISK_PCT / 100)}`} color="#8b5cf6" />
  </div>

  {error && (
    <div style={{ margin: "0 24px", padding: 12, background: "#ef444422", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
      {error}
    </div>
  )}

  {/* Tabs */}
  <div style={{ padding: "0 24px", display: "flex", gap: 4, borderBottom: "1px solid #1e2a3a" }}>
    {tabs.map(tab => (
      <button key={tab} onClick={() => setActiveTab(tab)} style={{
        background: activeTab === tab ? "#1e2a3a" : "transparent",
        color: activeTab === tab ? "#e2e8f0" : "#4a6080",
        border: "none", borderRadius: "8px 8px 0 0",
        padding: "10px 20px", fontSize: 13, fontWeight: 600,
        cursor: "pointer", letterSpacing: 0.5, textTransform: "capitalize",
        borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
      }}>
        {tab === "signals" ? `📊 Signals (${signals.length})` : tab === "sectors" ? "🔥 Sectors" : "🧮 Sizer"}
      </button>
    ))}
  </div>

  {/* Content */}
  <div style={{ padding: "0 0 40px" }}>

    {/* SIGNALS TAB */}
    {activeTab === "signals" && (
      <div>
        {signals.length === 0 && !scanning ? (
          <div style={{ textAlign: "center", padding: 60, color: "#4a6080" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No signals yet</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Click Full Daily Scan to scan the market</div>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "32px 70px 90px 1fr 90px 90px 90px 90px 60px",
              gap: 8, padding: "10px 16px",
              borderBottom: "1px solid #1e2a3a",
              background: "#0d1117",
            }}>
              {["#","Ticker","Price","Setup","Alert","Stop","2R","5R","Shares"].map(h => (
                <div key={h} style={{ fontSize: 10, color: "#4a6080", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{h}</div>
              ))}
            </div>
            {signals.map((s, i) => <SignalRow key={s.ticker} pick={s} rank={i + 1} />)}
          </div>
        )}
      </div>
    )}

    {/* SECTORS TAB */}
    {activeTab === "sectors" && (
      <div style={{ paddingTop: 8 }}>
        {sectorScores.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#4a6080" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔥</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No sector data yet</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Run a scan to see sector rotation rankings</div>
          </div>
        ) : (
          <div>
            <div style={{ padding: "12px 16px", display: "flex", gap: 16, borderBottom: "1px solid #1e2a3a" }}>
              {["HOT 🔥 (3-4)", "WARM ⚡ (2-3)", "COLD ❄️ (0-2)"].map((label, i) => (
                <div key={i} style={{ fontSize: 12, color: ["#22c55e","#f59e0b","#ef4444"][i], fontWeight: 600 }}>{label}</div>
              ))}
            </div>
            {sectorScores.map(s => <SectorRow key={s.name} sector={s.name} score={s.score} status={s.status} />)}
          </div>
        )}
      </div>
    )}

    {/* POSITION SIZER TAB */}
    {activeTab === "sizer" && (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#e2e8f0" }}>Position Size Calculator</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Entry Price ($)", value: sizeEntry, set: setSizeEntry, placeholder: "e.g. 75.50" },
            { label: "Stop Price ($)", value: sizeStop, set: setSizeStop, placeholder: "e.g. 72.00" },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <div style={{ fontSize: 12, color: "#4a6080", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
              <input
                type="number" value={value} onChange={e => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: "100%", background: "#0d1117", border: "1px solid #1e2a3a",
                  borderRadius: 8, padding: "10px 14px", color: "#e2e8f0",
                  fontSize: 15, fontFamily: "monospace", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}

          <div>
            <div style={{ fontSize: 12, color: "#4a6080", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Risk % (1–3%)</div>
            <input
              type="range" min={1} max={3} step={0.5} value={sizeRisk}
              onChange={e => setSizeRisk(e.target.value)}
              style={{ width: "100%", accentColor: "#3b82f6" }}
            />
            <div style={{ fontSize: 13, color: "#3b82f6", fontFamily: "monospace", marginTop: 4 }}>
              {sizeRisk}% = ${formatNum(riskDollar)} risk
            </div>
          </div>
        </div>

        {entryNum > 0 && stopNum > 0 && stopDist > 0 && (
          <div style={{
            marginTop: 24, background: "#0d1117", border: "1px solid #1e2a3a",
            borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12,
          }}>
            {[
              { label: "Shares to Buy", value: cappedShares, color: "#3b82f6" },
              { label: "Position Cost", value: `$${formatNum(cappedShares * entryNum)}`, color: "#f59e0b" },
              { label: "Stop Distance", value: `$${formatNum(stopDist)} (${formatNum(stopDist/entryNum*100)}%)`, color: "#ef4444" },
              { label: "2R Target", value: `$${formatNum(target2R)}`, color: "#22c55e" },
              { label: "5R Target", value: `$${formatNum(target5R)}`, color: "#10b981" },
              { label: "Max Risk", value: `$${formatNum(riskDollar)}`, color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
              </div>
            ))}
            {positionCost > pct30 && (
              <div style={{ fontSize: 12, color: "#f97316", background: "#f9730322", padding: "8px 12px", borderRadius: 6 }}>
                ⚠️ Position capped at 30% of account (${formatNum(pct30)})
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>

  {/* Footer */}
  <div style={{
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "#0d1117", borderTop: "1px solid #1e2a3a",
    padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
  }}>
    <div style={{ fontSize: 11, color: "#4a6080" }}>
      {scanning
        ? `⏳ Scanning ${progress.current}/${progress.total} — ${progress.ticker}`
        : signals.length > 0
        ? `✅ ${signals.length} signals found · ${sectorScores.filter(s => s.status === "HOT").length} hot sectors`
        : "Ready — click Full Daily Scan"}
    </div>
    <div style={{ fontSize: 11, color: "#1e2a3a" }}>Iain's System v1.0 · $1K Account</div>
  </div>
</div>
```

);
}

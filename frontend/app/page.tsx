"use client";

import { useEffect, useState, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://algo-trading-simulator-88ie.onrender.com";

interface CryptoTicker {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}

interface Trade {
  id: number;
  asset: string;
  action: string;
  amount: number;
  price: number;
  total: number;
}

interface TradingSession {
  id: number;
  name: string;
  balance: number;
  created_at: string;
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("Connecting...");
  const [tickers, setTickers] = useState<CryptoTicker[]>([]);
  const [loading, setLoading] = useState(true);

  // User & Sessions State
  const [user, setUser] = useState<{ id: number; email: string } | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [currentSession, setCurrentSession] = useState<TradingSession | null>(null);

  // Session Specific States
  const [balance, setBalance] = useState<number>(100000);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [botStatus, setBotStatus] = useState<string>("STOPPED");
  const [selectedCoin, setSelectedCoin] = useState<string>("bitcoin");
  const [tradeAmount, setTradeAmount] = useState<string>("1");
  const [chartData, setChartData] = useState<any[]>([]);

  // Bot & Strategy Config State
  const [botAsset, setBotAsset] = useState<string>("bitcoin");
  const [botQty, setBotQty] = useState<string>("0.05");
  const [botInterval, setBotInterval] = useState<string>("5");
  const [botStrategy, setBotStrategy] = useState<string>("AGGRESSIVE_BUY");
  const [botLogs, setBotLogs] = useState<string[]>([]);
  
  // AI Academy Modal State
  const [aiTactics, setAiTactics] = useState<any>(null);
  const [showTacticsModal, setShowTacticsModal] = useState(false);

  // Custom Cursor
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });

  // REFS for loop access
  const tickersRef = useRef(tickers);
  tickersRef.current = tickers;

  const botAssetRef = useRef(botAsset);
  botAssetRef.current = botAsset;

  const botQtyRef = useRef(botQty);
  botQtyRef.current = botQty;

  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const botStrategyRef = useRef(botStrategy);
  botStrategyRef.current = botStrategy;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Fetch initial market data
  useEffect(() => {
    fetch(`${API_BASE}/portfolio`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.message || "Running"))
      .catch(() => setBackendStatus("Backend Offline"));

    fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,cardano&order=market_cap_desc"
    )
      .then((res) => res.json())
      .then((data) => {
        setTickers(data);
        if (data.length > 0) {
          setSelectedCoin(data[0].id);
          setBotAsset(data[0].id);
          const p = data[0].current_price;
          setChartData([
            { time: "10m ago", price: p * 0.99 },
            { time: "8m ago", price: p * 0.995 },
            { time: "6m ago", price: p * 0.988 },
            { time: "4m ago", price: p * 1.002 },
            { time: "2m ago", price: p * 0.998 },
            { time: "Now", price: p },
          ]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Chart update on selection
  useEffect(() => {
    const coin = tickers.find((c) => c.id === selectedCoin);
    if (coin) {
      const p = coin.current_price;
      setChartData([
        { time: "10m ago", price: p * 0.99 },
        { time: "8m ago", price: p * 0.995 },
        { time: "6m ago", price: p * 0.988 },
        { time: "4m ago", price: p * 1.002 },
        { time: "2m ago", price: p * 0.998 },
        { time: "Now", price: p },
      ]);
    }
  }, [selectedCoin, tickers]);

  // Auth Handler with error handling
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPass }),
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.detail || "Authentication failed");
        return;
      }
      const data = await res.json();
      setUser(data);
      fetchSessions(data.user_id);
    } catch {
      alert("Unable to connect to backend server for authentication.");
    }
  };

  const fetchSessions = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${userId}`);
      const data = await res.json();
      setSessions(data);
      if (data.length > 0) {
        setCurrentSession(data[0]);
        setBalance(data[0].balance);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    const name = `Session ${sessions.length + 1} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    try {
      const res = await fetch(`${API_BASE}/api/sessions/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, session_name: name }),
      });
      const newSess = await res.json();
      setSessions((prev) => [newSess, ...prev]);
      setCurrentSession(newSess);
      setBalance(100000);
      setTrades([]);
    } catch {
      alert("Failed to create new session on server.");
    }
  };

  // Fetch AI Beginner Academy & Tactics
  const loadAiTactics = async () => {
    const coin = tickers.find((c) => c.id === selectedCoin);
    if (!coin) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai-advisor?asset=${coin.name}&price=${coin.current_price}&change_24h=${coin.price_change_percentage_24h}`);
      const data = await res.json();
      setAiTactics(data);
      setShowTacticsModal(true);
    } catch {
      setAiTactics({
        asset: coin.name,
        price: `$${coin.current_price.toLocaleString()}`,
        trend_summary: `${coin.name} 24h Change: ${coin.price_change_percentage_24h.toFixed(2)}%`,
        beginner_explanation: "Trading is about analyzing risk. When prices drop, smart beginners accumulate steadily using DCA (Dollar-Cost Averaging) rather than panic selling.",
        recommended_tactics: [
          { name: "Dollar-Cost Averaging", explanation: "Spread your purchases over time to avoid buying at the absolute peak.", action: "Recommended for beginners" },
          { name: "Buy the Dip", explanation: "Take advantage of red markets to accumulate assets at a discount.", action: "Use during pullbacks" }
        ]
      });
      setShowTacticsModal(true);
    }
  };

  // SMART BOT EXECUTION LOOP WITH RATIONALE NOTES
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (botStatus === "RUNNING") {
      const intervalSec = parseInt(botInterval) || 5;
      const strategyName = botStrategyRef.current;
      const logMsg = `[Bot Started] Strategy: ${strategyName} on ${botAssetRef.current} every ${intervalSec}s`;
      setBotLogs((prev) => [logMsg, ...prev.slice(0, 15)]);

      intervalId = setInterval(() => {
        const currentTickers = tickersRef.current;
        const targetId = botAssetRef.current;
        const coin = currentTickers.find((c) => c.id === targetId);

        if (!coin) {
          setBotLogs((prev) => [`[Error] Asset '${targetId}' not found in live feed.`, ...prev.slice(0, 15)]);
          return;
        }

        const amt = parseFloat(botQtyRef.current);
        if (isNaN(amt) || amt <= 0) return;

        const totalCost = amt * coin.current_price;
        const currentStrategy = botStrategyRef.current;
        let actionType = "BUY (BOT)";
        let reasoningNote = "";

        if (currentStrategy === "AGGRESSIVE_BUY") {
          actionType = "BUY (AGGRESSIVE)";
          reasoningNote = `Note: Aggressive mode active. Buying continuously despite market moves (${coin.price_change_percentage_24h.toFixed(2)}%).`;
        } else if (currentStrategy === "BUY_THE_DIP") {
          if (coin.price_change_percentage_24h < 0) {
            actionType = "BUY (DIP ACCUMULATION)";
            reasoningNote = `Note: Red market detected (${coin.price_change_percentage_24h.toFixed(2)}%). Buying the dip at a discount!`;
          } else {
            actionType = "HOLD / WAIT";
            reasoningNote = `Note: Market is green. Dip-buyer is waiting for a red candle.`;
          }
        } else {
          const isBullish = coin.price_change_percentage_24h >= 0;
          actionType = isBullish ? "BUY (TREND)" : "SELL (RISK OFF)";
          reasoningNote = isBullish 
            ? `Note: Bullish trend (+${coin.price_change_percentage_24h.toFixed(2)}%). Executing buy order.` 
            : `Note: Bearish trend (${coin.price_change_percentage_24h.toFixed(2)}%). Protecting capital by selling/holding.`;
        }

        if (actionType.includes("BUY")) {
          if (balanceRef.current < totalCost) {
            setBotLogs((prev) => [`[Paused] Insufficient portfolio cash ($${balanceRef.current.toFixed(2)}) for buy order.`, ...prev.slice(0, 15)]);
            return;
          }
          setBalance((prev) => prev - totalCost);
        } else if (actionType.includes("SELL")) {
          setBalance((prev) => prev + totalCost);
        } else {
          setBotLogs((prev) => [`[Holding] ${reasoningNote}`, ...prev.slice(0, 15)]);
          return;
        }

        const smartTrade: Trade = {
          id: Date.now(),
          asset: coin.name,
          action: actionType,
          amount: amt,
          price: coin.current_price,
          total: totalCost,
        };

        setTrades((prev) => [smartTrade, ...prev]);
        setBotLogs((prev) => [`[Executed] ${actionType} ${amt} ${coin.name} @ $${coin.current_price.toLocaleString()} | ${reasoningNote}`, ...prev.slice(0, 15)]);
      }, intervalSec * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [botStatus, botInterval, botStrategy]);

  const handleTrade = (action: "BUY" | "SELL") => {
    const coin = tickers.find((c) => c.id === selectedCoin);
    if (!coin) return;
    const amt = parseFloat(tradeAmount);
    if (isNaN(amt) || amt <= 0) return;

    const totalCost = amt * coin.current_price;

    if (action === "BUY") {
      if (balance < totalCost) {
        alert("Insufficient portfolio balance!");
        return;
      }
      setBalance((prev) => prev - totalCost);
    } else {
      setBalance((prev) => prev + totalCost);
    }

    const newTrade: Trade = {
      id: Date.now(),
      asset: coin.name,
      action: action,
      amount: amt,
      price: coin.current_price,
      total: totalCost,
    };

    setTrades((prev) => [newTrade, ...prev]);
  };

  const currentCoinObj = tickers.find((c) => c.id === selectedCoin);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 space-y-6 relative select-none">
      {/* Custom Pointer Follower */}
      <div 
        className="fixed pointer-events-none z-50 h-6 w-6 rounded-full border-2 border-emerald-400 bg-emerald-500/20 backdrop-blur-sm transition-transform duration-75 ease-out hidden md:block"
        style={{ transform: `translate(${cursorPos.x - 12}px, ${cursorPos.y - 12}px)` }}
      />

      {/* LOGIN / SIGNUP MODAL */}
      {!user && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleAuth} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-white">Welcome Trader</h2>
              <p className="text-slate-400 text-xs">Sign in or create an account to store and browse past sessions securely</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email Address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="trader@domain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <input
                type="password"
                required
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-all hover:scale-105 cursor-pointer">
              Secure Sign In / Sign Up
            </button>
          </form>
        </div>
      )}

      {/* TOP NAVBAR */}
      <nav className="border border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 rounded-xl flex justify-between items-center w-full">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 text-slate-950 font-black px-3 py-1 rounded text-lg">ATS</div>
          <span className="text-xl font-bold tracking-tight">Algo Trading Simulator</span>
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <div className="flex items-center space-x-2 text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">User:</span>
              <span className="text-emerald-400 font-medium">{user.email}</span>
            </div>
          )}
          <button
            onClick={loadAiTactics}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:scale-105 cursor-pointer"
          >
            🧠 AI Tactics & Academy
          </button>
        </div>
      </nav>

      {/* SESSIONS & HISTORY CONTROL BAR */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex justify-between items-center overflow-x-auto gap-4">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Session:</span>
          <select
            value={currentSession?.id || ""}
            onChange={(e) => {
              const selected = sessions.find((s) => s.id === parseInt(e.target.value));
              if (selected) {
                setCurrentSession(selected);
                setBalance(selected.balance);
              }
            }}
            className="bg-slate-950 border border-slate-800 text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg focus:outline-none cursor-pointer"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (${s.balance.toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={createNewSession}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all hover:scale-105 cursor-pointer"
        >
          + Create New Session
        </button>
      </div>

      {/* STATS & SMART BOT CONTROL GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium">Session Cash Balance</h3>
          <p className="text-2xl font-bold text-white mt-1">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-emerald-400 font-semibold mt-2 inline-block">
            {currentSession ? currentSession.name : "Active Session"}
          </span>
        </div>

        {/* Smart Bot Switcher Card */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-sm font-medium">Smart Algorithmic Bot</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${botStatus === "RUNNING" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
              <p className="text-xl font-bold text-white">{botStatus}</p>
            </div>
          </div>
          <button
            onClick={() => setBotStatus((prev) => (prev === "STOPPED" ? "RUNNING" : "STOPPED"))}
            className={`mt-4 w-full py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
              botStatus === "RUNNING"
                ? "bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {botStatus === "RUNNING" ? "Stop Smart Bot" : "Start Smart Bot"}
          </button>
        </div>

        {/* Smart Strategy Settings */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between space-y-2">
          <div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Strategy Mode</h3>
            <select
              value={botStrategy}
              onChange={(e) => setBotStrategy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer mb-2"
            >
              <option value="AGGRESSIVE_BUY">Aggressive Buyer (Always Buy)</option>
              <option value="BUY_THE_DIP">Buy the Dip (Accumulate Red Markets)</option>
              <option value="TREND_FOLLOWING">Smart Trend Following (Bull/Bear)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
              <input
                type="number"
                step="any"
                value={botQty}
                onChange={(e) => setBotQty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Interval (s)</label>
              <input
                type="number"
                value={botInterval}
                onChange={(e) => setBotInterval(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium">Trades Executed</h3>
          <p className="text-2xl font-bold text-white mt-1">{trades.length}</p>
          <span className="text-xs text-slate-400 font-semibold mt-2 inline-block">Session Log</span>
        </div>
      </div>

      {/* CHART & ORDER SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="bg-slate-900/80 border border-slate-800 p-6 shadow-lg rounded-xl flex flex-col justify-between lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                {currentCoinObj ? `${currentCoinObj.name} Price Trend` : "Price Chart"}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {currentCoinObj ? `$${currentCoinObj.current_price.toLocaleString()} USD` : ""}
              </p>
            </div>
            <div className="text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-400 font-mono">
              LIVE FEED
            </div>
          </div>
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Simulator */}
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-4">Order Simulator</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Selected Asset</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {tickers.map((coin) => (
                    <option key={coin.id} value={coin.id}>
                      {coin.name} ({coin.symbol.toUpperCase()}) - ${coin.current_price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => handleTrade("BUY")} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer">
              Buy / Long
            </button>
            <button onClick={() => handleTrade("SELL")} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer">
              Sell / Short
            </button>
          </div>
        </div>
      </div>

      {/* LIVE BOT CONSOLE LOG PANEL */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-lg w-full font-mono text-xs space-y-2">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-300 flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${botStatus === "RUNNING" ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`}></span>
            <span>Smart Bot Activity Console & Strategy Rationale</span>
          </span>
          <span className="text-[10px] text-slate-500">Live decision breakdown</span>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg h-36 overflow-y-auto space-y-1 text-slate-400">
          {botLogs.length === 0 ? (
            <p className="text-slate-600">Bot is currently stopped. Select your strategy mode above and click "Start Smart Bot".</p>
          ) : (
            botLogs.map((log, idx) => (
              <div key={idx} className={log.includes("Executed") ? "text-emerald-400 font-semibold" : log.includes("Error") ? "text-rose-400" : ""}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* BEGINNER AI TACTICS MODAL */}
      {showTacticsModal && aiTactics && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowTacticsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm cursor-pointer"
            >
              ✕ Close
            </button>
            <div className="space-y-1">
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full font-semibold">
                AI TRADING ACADEMY
              </span>
              <h3 className="text-xl font-bold text-white mt-2">
                Tactics & Strategy for {aiTactics.asset} ({aiTactics.price})
              </h3>
              <p className="text-xs text-slate-400">{aiTactics.trend_summary}</p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-emerald-400 block mb-1">💡 Beginner Concept:</span>
              {aiTactics.beginner_explanation}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Recommended Trading Tactics:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiTactics.recommended_tactics.map((tac: any, i: number) => (
                  <div key={i} className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1">
                    <h5 className="text-xs font-bold text-emerald-400">{tac.name}</h5>
                    <p className="text-[11px] text-slate-300">{tac.explanation}</p>
                    <span className="text-[10px] text-indigo-400 font-semibold block pt-1">{tac.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
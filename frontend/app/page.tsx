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
  trades: Trade[];
  created_at: string;
}

export default function Home() {
  const [backendReady, setBackendReady] = useState(false);
  const [wakingMessage, setWakingMessage] = useState("Waking up secure SQLite database server...");
  const [tickers, setTickers] = useState<CryptoTicker[]>([]);
  const [loading, setLoading] = useState(true);

  // User & Sessions State
  const [user, setUser] = useState<{ id: number; email: string } | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  
  const [sessions, setSessions] = useState<TradingSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Active Session Specific States
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

  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Wake up backend server on mount
  useEffect(() => {
    const wakeBackend = async () => {
      let attempts = 0;
      while (attempts < 15) {
        try {
          const res = await fetch(`${API_BASE}/portfolio`);
          if (res.ok) {
            setBackendReady(true);
            break;
          }
        } catch {
          attempts++;
          setWakingMessage(`Waking up database server (Attempt ${attempts}/15)... Please wait.`);
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      setBackendReady(true);
    };

    wakeBackend();

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

  // Auth Handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPass) return;
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
      fetchSessionsFromDb(data.user_id);
    } catch {
      alert("Unable to connect to database backend.");
    }
  };

  const fetchSessionsFromDb = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${userId}`);
      const data = await res.json();
      setSessions(data);
      if (data.length > 0) {
        setCurrentSessionId(data[0].id);
        setBalance(data[0].balance);
        setTrades(data[0].trades || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    const sessionName = `Session ${sessions.length + 1} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    
    try {
      const res = await fetch(`${API_BASE}/api/sessions/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, session_name: sessionName }),
      });
      const newSess: TradingSession = await res.json();
      setSessions((prev) => [newSess, ...prev]);
      setCurrentSessionId(newSess.id);
      setBalance(newSess.balance);
      setTrades([]);
      setBotStatus("STOPPED");
    } catch {
      alert("Failed to create new session on database.");
    }
  };

  const handleSessionSwitch = (sessionId: number) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setCurrentSessionId(target.id);
      setBalance(target.balance);
      setTrades(target.trades || []);
      setBotStatus("STOPPED");
    }
  };

  const executeAndRecordTrade = async (action: string, coinName: string, amount: number, price: number, total: number) => {
    const newTrade: Trade = {
      id: Date.now(),
      asset: coinName,
      action: action,
      amount: amount,
      price: price,
      total: total,
    };

    if (action.includes("BUY")) {
      setBalance((prev) => prev - total);
    } else if (action.includes("SELL")) {
      setBalance((prev) => prev + total);
    }

    setTrades((prev) => [newTrade, ...prev]);

    if (currentSessionId !== null) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, balance: action.includes("BUY") ? s.balance - total : s.balance + total, trades: [newTrade, ...s.trades] }
            : s
        )
      );
    }

    if (currentSessionIdRef.current) {
      try {
        await fetch(`${API_BASE}/api/trades/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: currentSessionIdRef.current,
            asset: coinName,
            action: action,
            amount: amount,
            price: price,
            total: total,
          }),
        });
      } catch (e) {
        console.log("Failed to sync trade to database");
      }
    }
  };

  const handleTrade = (action: "BUY" | "SELL") => {
    const coin = tickers.find((c) => c.id === selectedCoin);
    if (!coin) return;
    const amt = parseFloat(tradeAmount);
    if (isNaN(amt) || amt <= 0) return;

    const totalCost = amt * coin.current_price;
    if (action === "BUY" && balance < totalCost) {
      alert("Insufficient portfolio balance!");
      return;
    }

    executeAndRecordTrade(action, coin.name, amt, coin.current_price, totalCost);
  };

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
          { name: "Dollar-Cost Averaging", explanation: "Spread your purchases over time to avoid buying at the peak.", action: "Recommended for beginners" },
          { name: "Buy the Dip", explanation: "Take advantage of red markets to accumulate assets at a discount.", action: "Use during pullbacks" }
        ]
      });
      setShowTacticsModal(true);
    }
  };

  // SMART BOT EXECUTION LOOP
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (botStatus === "RUNNING") {
      const intervalSec = parseInt(botInterval) || 5;
      const strategyName = botStrategyRef.current;
      const logMsg = `⚡ [Bot Active] Strategy: ${strategyName} on ${botAssetRef.current} [Interval: ${intervalSec}s]`;
      setBotLogs((prev) => [logMsg, ...prev.slice(0, 15)]);

      intervalId = setInterval(() => {
        const currentTickers = tickersRef.current;
        const targetId = botAssetRef.current;
        const coin = currentTickers.find((c) => c.id === targetId);

        if (!coin) {
          setBotLogs((prev) => [`❌ [Error] Asset '${targetId}' not found in live feed.`, ...prev.slice(0, 15)]);
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
          reasoningNote = `Aggressive accumulation executed. Market move: ${coin.price_change_percentage_24h.toFixed(2)}%.`;
        } else if (currentStrategy === "BUY_THE_DIP") {
          if (coin.price_change_percentage_24h < 0) {
            actionType = "BUY (DIP ACCUMULATION)";
            reasoningNote = `Dip captured at discount! 24h change: ${coin.price_change_percentage_24h.toFixed(2)}%.`;
          } else {
            actionType = "HOLD / WAIT";
            reasoningNote = `Market is green (+${coin.price_change_percentage_24h.toFixed(2)}%). Waiting for dip pullbacks.`;
          }
        } else {
          const isBullish = coin.price_change_percentage_24h >= 0;
          actionType = isBullish ? "BUY (TREND)" : "SELL (RISK OFF)";
          reasoningNote = isBullish 
            ? `Bullish trend momentum detected (+${coin.price_change_percentage_24h.toFixed(2)}%).` 
            : `Bearish trend detected (${coin.price_change_percentage_24h.toFixed(2)}%). Hedging risk.`;
        }

        if (actionType.includes("HOLD")) {
          setBotLogs((prev) => [`🛡️ [Holding] ${reasoningNote}`, ...prev.slice(0, 15)]);
          return;
        }

        if (actionType.includes("BUY") && balanceRef.current < totalCost) {
          setBotLogs((prev) => [`⚠️ [Paused] Insufficient cash ($${balanceRef.current.toFixed(2)}) for automated order.`, ...prev.slice(0, 15)]);
          return;
        }

        executeAndRecordTrade(actionType, coin.name, amt, coin.current_price, totalCost);
        setBotLogs((prev) => [`🤖 [Executed] ${actionType} ${amt} ${coin.name} @ $${coin.current_price.toLocaleString()} | ${reasoningNote}`, ...prev.slice(0, 15)]);
      }, intervalSec * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [botStatus, botInterval, botStrategy]);

  const currentCoinObj = tickers.find((c) => c.id === selectedCoin);
  const activeSessionObj = sessions.find((s) => s.id === currentSessionId);

  // Calculate Bot & Portfolio Profit / Loss
  const initialCapital = 100000;
  const netProfitLoss = balance - initialCapital;
  const netProfitLossPercent = (netProfitLoss / initialCapital) * 100;
  const isProfitable = netProfitLoss >= 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 space-y-6 relative select-none overflow-x-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Custom Pointer Follower */}
      <div 
        className="fixed pointer-events-none z-50 h-6 w-6 rounded-full border-2 border-emerald-400 bg-emerald-500/20 backdrop-blur-sm transition-transform duration-75 ease-out hidden md:block shadow-[0_0_15px_#10b981]"
        style={{ transform: `translate(${cursorPos.x - 12}px, ${cursorPos.y - 12}px)` }}
      />

      {/* BACKEND WAKING UP LOADER MODAL */}
      {!backendReady && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
            <div className="relative inline-block">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-emerald-400 border-r-transparent mx-auto" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-wide">Initializing Terminal</h2>
              <p className="text-slate-400 text-xs font-mono">{wakingMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN / SIGNUP MODAL */}
      {backendReady && !user && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
          <form onSubmit={handleAuth} className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl max-w-md w-full space-y-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            <div className="text-center space-y-1.5">
              <div className="inline-block bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black px-3 py-1 rounded-full text-xs mb-1">
                SECURE ACCESS
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Welcome Trader</h2>
              <p className="text-slate-400 text-xs">Sign in or register to sync your sessions with SQLite Database</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="trader@domain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Password</label>
                <input
                  type="password"
                  required
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-lg shadow-emerald-900/40">
              Secure Sign In / Register
            </button>
          </form>
        </div>
      )}

      {/* TOP NAVBAR */}
      <nav className="border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 py-4 rounded-2xl flex justify-between items-center w-full shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-emerald-600 to-emerald-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-lg shadow-lg shadow-emerald-900/30">ATS</div>
          <div>
            <span className="text-lg font-black tracking-tight text-white block">Algo Trading Simulator</span>
            <span className="text-[10px] text-emerald-400 font-mono tracking-widest block uppercase">Live Autonomous Engine</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {user && (
            <div className="hidden sm:flex items-center space-x-2 text-xs bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-slate-400">User:</span>
              <span className="text-emerald-400 font-mono font-medium">{user.email}</span>
            </div>
          )}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all hover:scale-105 cursor-pointer border border-slate-700/60 shadow-md"
          >
            📂 View History
          </button>
          <button
            onClick={loadAiTactics}
            className="bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all hover:scale-105 cursor-pointer shadow-lg shadow-indigo-900/30"
          >
            🧠 AI Tactics
          </button>
        </div>
      </nav>

      {/* SESSIONS & HISTORY CONTROL BAR */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex justify-between items-center overflow-x-auto gap-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-center space-x-3 min-w-max">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Session:</span>
          <select
            value={currentSessionId || ""}
            onChange={(e) => handleSessionSwitch(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 text-xs font-semibold text-emerald-400 px-4 py-2 rounded-xl focus:outline-none cursor-pointer shadow-inner"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (${s.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}) - {s.trades?.length || 0} trades
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={createNewSession}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-emerald-900/30 min-w-max"
        >
          + Create New Session
        </button>
      </div>

      {/* STATS & SMART BOT CONTROL GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
        {/* Cash Balance & PnL Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Portfolio Equity</h3>
            <p className="text-2xl font-black text-white mt-1.5 font-mono">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center">
            <span className="text-xs text-slate-400">Net Profit / Loss:</span>
            <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg ${isProfitable ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
              {isProfitable ? "+" : ""}${netProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfitable ? "+" : ""}{netProfitLossPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Smart Bot Switcher Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Autonomous Bot Engine</h3>
            <div className="flex items-center space-x-2.5 mt-2">
              <span className={`h-3 w-3 rounded-full ${botStatus === "RUNNING" ? "bg-emerald-400 animate-ping shadow-[0_0_10px_#10b981]" : "bg-rose-500"}`}></span>
              <p className="text-xl font-black tracking-wide text-white">{botStatus}</p>
            </div>
          </div>
          <button
            onClick={() => setBotStatus((prev) => (prev === "STOPPED" ? "RUNNING" : "STOPPED"))}
            className={`mt-4 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-lg ${
              botStatus === "RUNNING"
                ? "bg-rose-600/20 text-rose-400 border border-rose-500/40 hover:bg-rose-600/30 shadow-rose-950/50"
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/40"
            }`}
          >
            {botStatus === "RUNNING" ? "🛑 Stop Bot Engine" : "⚡ Start Bot Engine"}
          </button>
        </div>

        {/* Smart Strategy Settings */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">Strategy Algorithm</h3>
            <select
              value={botStrategy}
              onChange={(e) => setBotStrategy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-emerald-400 font-bold focus:outline-none cursor-pointer shadow-inner"
            >
              <option value="AGGRESSIVE_BUY">Aggressive Buyer (Always Buy)</option>
              <option value="BUY_THE_DIP">Buy the Dip (Accumulate Red)</option>
              <option value="TREND_FOLLOWING">Smart Trend Following</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Order Qty</label>
              <input
                type="number"
                step="any"
                value={botQty}
                onChange={(e) => setBotQty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Interval (s)</label>
              <input
                type="number"
                value={botInterval}
                onChange={(e) => setBotInterval(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Trades Counter Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Execution Metrics</h3>
            <p className="text-3xl font-black text-white mt-1.5 font-mono">{trades.length}</p>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold mt-3 block bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-center">
            Active Session Logged
          </span>
        </div>
      </div>

      {/* CHART & ORDER SIMULATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 shadow-xl backdrop-blur-xl rounded-2xl flex flex-col justify-between lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                {currentCoinObj ? `${currentCoinObj.name} Market Feed` : "Price Chart"}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {currentCoinObj ? `$${currentCoinObj.current_price.toLocaleString()} USD` : ""}
              </p>
            </div>
            <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-400 font-mono font-bold flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE FEED</span>
            </div>
          </div>
          <div className="h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" domain={["auto", "auto"]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px", fontSize: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.8)" }} />
                <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Simulator */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Manual Order Execution</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Select Asset</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer shadow-inner"
                >
                  {tickers.map((coin) => (
                    <option key={coin.id} value={coin.id}>
                      {coin.name} ({coin.symbol.toUpperCase()}) - ${coin.current_price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Order Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono focus:outline-none shadow-inner"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => handleTrade("BUY")} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-emerald-900/40">
              Buy / Long 📈
            </button>
            <button onClick={() => handleTrade("SELL")} className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-rose-900/40">
              Sell / Short 📉
            </button>
          </div>
        </div>
      </div>

      {/* LIVE BOT CONSOLE LOG PANEL */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl w-full font-mono text-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
          <span className="font-bold text-slate-200 flex items-center space-x-2">
            <span className={`h-2.5 w-2.5 rounded-full ${botStatus === "RUNNING" ? "bg-emerald-400 animate-ping" : "bg-slate-600"}`} />
            <span>Autonomous Bot Activity Console & Strategy Rationale</span>
          </span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            Real-time Logic Stream
          </span>
        </div>
        <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl h-40 overflow-y-auto space-y-1.5 text-slate-400 shadow-inner">
          {botLogs.length === 0 ? (
            <p className="text-slate-600 italic">Bot is currently standing by. Select your algorithm above and activate the bot engine.</p>
          ) : (
            botLogs.map((log, idx) => (
              <div key={idx} className={log.includes("Executed") || log.includes("Active") ? "text-emerald-400 font-semibold" : log.includes("Error") ? "text-rose-400" : ""}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* MARKET WATCH TABLE */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl w-full">
        <h2 className="text-lg font-bold text-white mb-4">Market Watch</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Fetching cryptocurrency feeds...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Asset</th>
                  <th className="py-3 px-4 font-bold">Symbol</th>
                  <th className="py-3 px-4 font-bold">Price (USD)</th>
                  <th className="py-3 px-4 font-bold">24h Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {tickers.map((coin) => {
                  const isPositive = coin.price_change_percentage_24h >= 0;
                  return (
                    <tr
                      key={coin.id}
                      onClick={() => setSelectedCoin(coin.id)}
                      className={`cursor-pointer transition-all ${selectedCoin === coin.id ? "bg-slate-800/60 border-l-4 border-emerald-400" : "hover:bg-slate-800/30"}`}
                    >
                      <td className="py-3.5 px-4 font-bold text-white">{coin.name}</td>
                      <td className="py-3.5 px-4 text-slate-400 uppercase font-mono">{coin.symbol}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">${coin.current_price.toLocaleString()}</td>
                      <td className={`py-3.5 px-4 font-bold font-mono ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {isPositive ? "+" : ""}{coin.price_change_percentage_24h.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TRADE HISTORY TABLE */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-xl w-full">
        <h2 className="text-lg font-bold text-white mb-4">Active Session Trade History</h2>
        {trades.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No trades logged yet in this session.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold">Type</th>
                  <th className="py-2.5 px-3 font-bold">Asset</th>
                  <th className="py-2.5 px-3 font-bold">Quantity</th>
                  <th className="py-2.5 px-3 font-bold">Price</th>
                  <th className="py-2.5 px-3 font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono text-xs">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className={`py-3 px-3 font-black ${t.action.includes("BUY") ? "text-emerald-400" : "text-rose-400"}`}>{t.action}</td>
                    <td className="py-3 px-3 text-white font-sans font-medium">{t.asset}</td>
                    <td className="py-3 px-3">{t.amount}</td>
                    <td className="py-3 px-3">${t.price.toLocaleString()}</td>
                    <td className="py-3 px-3 text-emerald-300">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAST SESSIONS HISTORY INSPECTOR MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-3xl w-full space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
            >
              ✕ Close
            </button>
            <div className="space-y-1.5">
              <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-bold">
                DATABASE ARCHIVE
              </span>
              <h3 className="text-2xl font-black text-white tracking-tight mt-1">Archived Sessions Inspector</h3>
              <p className="text-xs text-slate-400">Review final equity balances and complete trade logs stored in SQLite database.</p>
            </div>

            <div className="space-y-4 mt-4">
              {sessions.map((sess) => (
                <div key={sess.id} className="bg-slate-950 border border-slate-800/80 p-5 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{sess.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">Timestamp: {sess.created_at}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Final Balance:</span>
                      <p className="text-sm font-mono font-black text-emerald-400">${sess.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {(!sess.trades || sess.trades.length === 0) ? (
                    <p className="text-xs text-slate-500 italic">No trades recorded in this session.</p>
                  ) : (
                    <div className="text-xs space-y-1.5">
                      <span className="text-slate-400 font-bold block">Trades Executed ({sess.trades.length}):</span>
                      <div className="max-h-32 overflow-y-auto space-y-1 font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800/50">
                        {sess.trades.map((tr) => (
                          <div key={tr.id} className="flex justify-between text-[11px] text-slate-300 py-0.5">
                            <span className={tr.action.includes("BUY") ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{tr.action}</span>
                            <span>{tr.amount} {tr.asset}</span>
                            <span>${tr.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BEGINNER AI TACTICS MODAL */}
      {showTacticsModal && aiTactics && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-2xl w-full space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowTacticsModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
            >
              ✕ Close
            </button>
            <div className="space-y-1.5">
              <span className="text-xs bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-3 py-1 rounded-full font-bold">
                AI TRADING ACADEMY
              </span>
              <h3 className="text-2xl font-black text-white tracking-tight mt-1">
                Strategy Guide for {aiTactics.asset} ({aiTactics.price})
              </h3>
              <p className="text-xs text-slate-400">{aiTactics.trend_summary}</p>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-2xl text-xs text-slate-300 leading-relaxed shadow-inner">
              <span className="font-bold text-emerald-400 block mb-1.5 text-sm">💡 Core Beginner Concept:</span>
              {aiTactics.beginner_explanation}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">Recommended Market Tactics:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiTactics.recommended_tactics.map((tac: any, i: number) => (
                  <div key={i} className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-1.5 shadow-sm">
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
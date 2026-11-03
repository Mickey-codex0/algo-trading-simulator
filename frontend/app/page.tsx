"use client";

import { useEffect, useState } from "react";
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

interface ChartDataPoint {
  time: string;
  price: number;
}

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("Connecting...");
  const [tickers, setTickers] = useState<CryptoTicker[]>([]);
  const [loading, setLoading] = useState(true);

  const [balance, setBalance] = useState<number>(100000);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [botStatus, setBotStatus] = useState<string>("STOPPED");
  const [selectedCoin, setSelectedCoin] = useState<string>("bitcoin");
  const [tradeAmount, setTradeAmount] = useState<string>("1");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const [botAsset, setBotAsset] = useState<string>("Bitcoin");
  const [botQty, setBotQty] = useState<string>("0.05");
  const [botInterval, setBotInterval] = useState<string>("10");

  const fetchPortfolio = () => {
    fetch(`${API_BASE}/portfolio`)
      .then((res) => res.json())
      .then((data) => {
        if (data.balance !== undefined) setBalance(data.balance);
        if (data.trades) setTrades(data.trades);
        if (data.bot_status) setBotStatus(data.bot_status);
        if (data.bot_config) {
          setBotAsset(data.bot_config.target_asset);
          setBotQty(data.bot_config.quantity.toString());
          setBotInterval(data.bot_config.frequency_seconds.toString());
        }
      })
      .catch((err) => console.error("Error fetching portfolio:", err));
  };

  useEffect(() => {
    fetch(`${API_BASE}/portfolio`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.message || "Running"))
      .catch(() => setBackendStatus("Backend Offline"));

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);

    fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,cardano&order=market_cap_desc"
    )
      .then((res) => res.json())
      .then((data) => {
        setTickers(data);
        if (data.length > 0) {
          setSelectedCoin(data[0].id);
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
      .catch((err) => {
        console.error("Error fetching prices:", err);
        setLoading(false);
      });

    return () => clearInterval(interval);
  }, []);

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

  const handleTrade = async (action: "BUY" | "SELL") => {
    const coin = tickers.find((c) => c.id === selectedCoin);
    if (!coin) return;
    const amt = parseFloat(tradeAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      const res = await fetch(`${API_BASE}/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: coin.name,
          action: action,
          amount: amt,
          price: coin.current_price,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.portfolio) {
        setBalance(data.portfolio.balance);
        setTrades(data.portfolio.trades);
      }
    } catch (err) {
      console.error("Trade failed:", err);
    }
  };

  const toggleBot = async () => {
    try {
      const res = await fetch(`${API_BASE}/bot/toggle`, { method: "POST" });
      const data = await res.json();
      if (data.bot_status) setBotStatus(data.bot_status);
    } catch (err) {
      console.error("Bot toggle failed:", err);
    }
  };

  const saveBotConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/bot/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_asset: botAsset,
          quantity: parseFloat(botQty),
          frequency_seconds: parseInt(botInterval),
        }),
      });
      const data = await res.json();
      alert(data.message || "Config saved");
    } catch (err) {
      console.error("Failed to save bot configuration:", err);
    }
  };

  const currentCoinObj = tickers.find((c) => c.id === selectedCoin);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 space-y-6">
      {/* Top Navbar */}
      <nav className="border border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 rounded-xl flex justify-between items-center w-full">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500 text-slate-950 font-black px-3 py-1 rounded text-lg">ATS</div>
          <span className="text-xl font-bold tracking-tight">Algo Trading Simulator</span>
        </div>
        <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${backendStatus?.includes("Running") ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
          <span className="text-slate-300 font-medium">{backendStatus || "Connecting..."}</span>
        </div>
      </nav>

      {/* Stats & Bot Config Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium">Portfolio Cash Balance</h3>
          <p className="text-2xl font-bold text-white mt-1">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-emerald-400 font-semibold mt-2 inline-block">Synced with Python Backend</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-sm font-medium">Algorithmic Trading Bot</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`h-2.5 w-2.5 rounded-full ${botStatus === "RUNNING" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`}></span>
              <p className="text-xl font-bold text-white">{botStatus}</p>
            </div>
          </div>
          <button
            onClick={toggleBot}
            className={`mt-4 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              botStatus === "RUNNING"
                ? "bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {botStatus === "RUNNING" ? "Stop Automated Bot" : "Start Automated Bot"}
          </button>
        </div>

        {/* Bot Strategy Settings Panel */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-slate-400 text-sm font-medium mb-2">Bot Strategy Settings</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Target Asset</label>
                <select
                  value={botAsset}
                  onChange={(e) => setBotAsset(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {tickers.map((coin) => (
                    <option key={coin.id} value={coin.name}>
                      {coin.name}
                    </option>
                  ))}
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Interval (s)</label>
                  <input
                    type="number"
                    value={botInterval}
                    onChange={(e) => setBotInterval(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={saveBotConfig}
            className="mt-3 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 rounded-lg text-xs font-semibold transition-colors"
          >
            Save Parameters
          </button>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-slate-400 text-sm font-medium">Total Trades Executed</h3>
          <p className="text-2xl font-bold text-white mt-1">{trades.length}</p>
          <span className="text-xs text-slate-400 font-semibold mt-2 inline-block">Backend logged</span>
        </div>
      </div>

      {/* Chart & Order Simulator Row */}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => handleTrade("BUY")} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg">
              Buy / Long
            </button>
            <button onClick={() => handleTrade("SELL")} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-lg">
              Sell / Short
            </button>
          </div>
        </div>
      </div>

      {/* Market Watch Table */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-lg w-full">
        <h2 className="text-lg font-semibold mb-4">Market Watch</h2>
        {loading ? (
          <p className="text-slate-400 text-sm">Loading market prices...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-sm">
                  <th className="py-3 px-4 font-medium">Asset</th>
                  <th className="py-3 px-4 font-medium">Symbol</th>
                  <th className="py-3 px-4 font-medium">Price (USD)</th>
                  <th className="py-3 px-4 font-medium">24h Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {tickers.map((coin) => {
                  const isPositive = coin.price_change_percentage_24h >= 0;
                  return (
                    <tr
                      key={coin.id}
                      onClick={() => setSelectedCoin(coin.id)}
                      className={`cursor-pointer transition-colors ${selectedCoin === coin.id ? "bg-slate-800/80 border-l-2 border-emerald-400" : "hover:bg-slate-800/40"}`}
                    >
                      <td className="py-3 px-4 font-semibold text-white">{coin.name}</td>
                      <td className="py-3 px-4 text-slate-400 uppercase font-mono">{coin.symbol}</td>
                      <td className="py-3 px-4 font-mono font-medium">${coin.current_price.toLocaleString()}</td>
                      <td className={`py-3 px-4 font-semibold font-mono ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
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

      {/* Trade History */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl shadow-lg w-full">
        <h2 className="text-lg font-semibold mb-4">Python Backend Trade History</h2>
        {trades.length === 0 ? (
          <p className="text-slate-500 text-sm">No trades logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Asset</th>
                  <th className="py-2 px-3 font-medium">Quantity</th>
                  <th className="py-2 px-3 font-medium">Price</th>
                  <th className="py-2 px-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className={`py-2 px-3 font-bold ${t.action.includes("BUY") ? "text-emerald-400" : "text-rose-400"}`}>{t.action}</td>
                    <td className="py-2 px-3 text-white font-sans">{t.asset}</td>
                    <td className="py-2 px-3">{t.amount}</td>
                    <td className="py-2 px-3">${t.price.toLocaleString()}</td>
                    <td className="py-2 px-3">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
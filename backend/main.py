import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Enable CORS for Next.js frontend (including your live Vercel deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://algo-trading-simulator-seven.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-Memory State Authority
portfolio = {
    "balance": 100000.0,
    "trades": []
}

bot_status = "STOPPED"

# Configurable Bot Strategy Parameters
bot_config = {
    "target_asset": "Bitcoin",
    "quantity": 0.05,
    "frequency_seconds": 10
}

class TradeRequest(BaseModel):
    asset: str
    action: str
    amount: float
    price: float

class BotConfigModel(BaseModel):
    target_asset: str
    quantity: float
    frequency_seconds: int

@app.get("/")
def read_root():
    return {"message": "Algorithmic Trading Simulator Backend is Running!"}

@app.get("/portfolio")
def get_portfolio():
    return {
        "balance": portfolio["balance"],
        "trades": portfolio["trades"],
        "bot_status": bot_status,
        "bot_config": bot_config
    }

@app.post("/trade")
def execute_trade(trade: TradeRequest):
    total_cost = trade.amount * trade.price
    
    if trade.action == "BUY" and portfolio["balance"] < total_cost:
        return {"error": "Insufficient portfolio cash balance!"}
    
    if trade.action == "BUY":
        portfolio["balance"] -= total_cost
    else:  # SELL / SHORT
        portfolio["balance"] += total_cost

    new_trade = {
        "id": len(portfolio["trades"]) + 1,
        "asset": trade.asset,
        "action": trade.action,
        "amount": trade.amount,
        "price": trade.price,
        "total": total_cost
    }
    
    portfolio["trades"].insert(0, new_trade)
    return {"message": "Trade executed successfully", "portfolio": portfolio}

@app.post("/bot/config")
def update_bot_config(config: BotConfigModel):
    global bot_config
    bot_config["target_asset"] = config.target_asset
    bot_config["quantity"] = config.quantity
    bot_config["frequency_seconds"] = config.frequency_seconds
    return {"message": "Bot configuration updated", "config": bot_config}

async def autonomous_trading_loop():
    global bot_status
    while bot_status == "RUNNING":
        asset = bot_config["target_asset"]
        qty = bot_config["quantity"]
        interval = bot_config["frequency_seconds"]
        
        simulated_price = 78000.0 if asset == "Bitcoin" else (2200.0 if asset == "Ethereum" else 100.0)
        total_cost = qty * simulated_price
        
        if portfolio["balance"] >= total_cost:
            portfolio["balance"] -= total_cost
            new_trade = {
                "id": len(portfolio["trades"]) + 1,
                "asset": asset,
                "action": "BUY (BOT)",
                "amount": qty,
                "price": simulated_price,
                "total": total_cost
            }
            portfolio["trades"].insert(0, new_trade)
            
        await asyncio.sleep(interval)

@app.post("/bot/toggle")
def toggle_bot(background_tasks: BackgroundTasks):
    global bot_status
    if bot_status == "STOPPED":
        bot_status = "RUNNING"
        background_tasks.add_task(autonomous_trading_loop)
    else:
        bot_status = "STOPPED"
    return {"bot_status": bot_status}
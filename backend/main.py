from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import datetime
import hashlib

DATABASE_URL = "sqlite:///./trading_simulator.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def hash_password(password: str) -> str:
    salt = "algo_trading_simulator_salt_2026"
    return hashlib.sha256((password + salt).encode()).hexdigest()

class UserModel(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)

class TradingSessionModel(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    balance = Column(Float, default=100000.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TradeModel(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    asset = Column(String)
    action = Column(String)
    amount = Column(Float)
    price = Column(Float)
    total = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class AuthReq(BaseModel):
    email: str
    password: str

class StartSessionReq(BaseModel):
    user_id: int
    session_name: str

class SaveTradeReq(BaseModel):
    session_id: int
    asset: str
    action: str
    amount: float
    price: float
    total: float

@app.get("/portfolio")
def health_check():
    return {"message": "Backend Running with SQLite DB"}

@app.post("/api/auth/login")
def login(req: AuthReq, db: Session = Depends(get_db)):
    hashed_pwd = hash_password(req.password)
    user = db.query(UserModel).filter(UserModel.email == req.email).first()
    
    if user:
        if user.password != hashed_pwd:
            raise HTTPException(status_code=400, detail="Incorrect password.")
    else:
        user = UserModel(email=req.email, password=hashed_pwd)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        init_session = TradingSessionModel(user_id=user.id, name="Session 1 (Default)")
        db.add(init_session)
        db.commit()
        
    return {"user_id": user.id, "email": user.email}

@app.get("/api/sessions/{user_id}")
def get_user_sessions(user_id: int, db: Session = Depends(get_db)):
    sessions = db.query(TradingSessionModel).filter(TradingSessionModel.user_id == user_id).all()
    result = []
    for s in sorted(sessions, key=lambda x: x.created_at, reverse=True):
        trades = db.query(TradeModel).filter(TradeModel.session_id == s.id).all()
        result.append({
            "id": s.id,
            "name": s.name,
            "balance": s.balance,
            "created_at": s.created_at.strftime("%H:%M:%S"),
            "trades": [
                {
                    "id": t.id,
                    "asset": t.asset,
                    "action": t.action,
                    "amount": t.amount,
                    "price": t.price,
                    "total": t.total
                } for t in trades
            ]
        })
    return result

@app.post("/api/sessions/new")
def create_new_session(req: StartSessionReq, db: Session = Depends(get_db)):
    new_sess = TradingSessionModel(user_id=req.user_id, name=req.session_name, balance=100000.0)
    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)
    return {
        "id": new_sess.id,
        "name": new_sess.name,
        "balance": new_sess.balance,
        "created_at": new_sess.created_at.strftime("%H:%M:%S"),
        "trades": []
    }

@app.post("/api/trades/save")
def save_trade(req: SaveTradeReq, db: Session = Depends(get_db)):
    trade = TradeModel(
        session_id=req.session_id,
        asset=req.asset,
        action=req.action,
        amount=req.amount,
        price=req.price,
        total=req.total
    )
    db.add(trade)
    
    session = db.query(TradingSessionModel).filter(TradingSessionModel.id == req.session_id).first()
    if session:
        if "BUY" in req.action:
            session.balance -= req.total
        elif "SELL" in req.action:
            session.balance += req.total

    db.commit()
    db.refresh(trade)
    return {"status": "success", "trade_id": trade.id, "new_balance": session.balance if session else 0}

@app.get("/api/ai-advisor")
def get_ai_tactics(asset: str, price: float, change_24h: float):
    trend = "Bullish (Upward Trend)" if change_24h >= 0 else "Bearish (Downward Trend)"
    return {
        "asset": asset,
        "price": f"${price:,.2f}",
        "trend_summary": f"{asset} is currently in a {trend} market with a 24h move of {change_24h:.2f}%.",
        "beginner_explanation": "Welcome to trading! Think of crypto assets like digital stocks. When prices go up (+), buyers drive demand. When prices fall (-), sellers take profits.",
        "recommended_tactics": [
            {"name": "Dollar-Cost Averaging (DCA)", "explanation": "Spread your purchases over time to avoid buying at the absolute peak.", "action": "Great for steady learning."},
            {"name": "Buy the Dip", "explanation": "When an asset drops during a red market, buying at a lower price gives better upside potential.", "action": "Use during market pullbacks."}
        ]
    }
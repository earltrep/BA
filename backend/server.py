from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json
import uuid
import random
import asyncio
import logging
from collections import defaultdict

import requests
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional

import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("budgetly")

# ---------------------------------------------------------------------------
# Currency
# ---------------------------------------------------------------------------
CURRENCIES = {
    "USD": {"symbol": "$", "rate": 1.0, "name": "US Dollar"},
    "EUR": {"symbol": "\u20ac", "rate": 0.92, "name": "Euro"},
    "GBP": {"symbol": "\u00a3", "rate": 0.79, "name": "British Pound"},
    "INR": {"symbol": "\u20b9", "rate": 83.2, "name": "Indian Rupee"},
    "CAD": {"symbol": "C$", "rate": 1.36, "name": "Canadian Dollar"},
    "AUD": {"symbol": "A$", "rate": 1.52, "name": "Australian Dollar"},
    "JPY": {"symbol": "\u00a5", "rate": 157.0, "name": "Japanese Yen"},
    "CNY": {"symbol": "\u00a5", "rate": 7.24, "name": "Chinese Yuan"},
    "CHF": {"symbol": "Fr", "rate": 0.88, "name": "Swiss Franc"},
    "SGD": {"symbol": "S$", "rate": 1.35, "name": "Singapore Dollar"},
    "AED": {"symbol": "\u062f.\u0625", "rate": 3.67, "name": "UAE Dirham"},
    "BRL": {"symbol": "R$", "rate": 5.0, "name": "Brazilian Real"},
    "ZAR": {"symbol": "R", "rate": 18.5, "name": "South African Rand"},
    "MXN": {"symbol": "Mex$", "rate": 17.0, "name": "Mexican Peso"},
    "NZD": {"symbol": "NZ$", "rate": 1.65, "name": "New Zealand Dollar"},
}


LIVE_RATES: dict = {}
RATES_UPDATED = None


def get_rate(cur: str) -> float:
    if cur in LIVE_RATES:
        return LIVE_RATES[cur]
    return CURRENCIES.get(cur, CURRENCIES["USD"])["rate"]


async def refresh_rates():
    global LIVE_RATES, RATES_UPDATED

    def _fetch():
        r = requests.get("https://open.er-api.com/v6/latest/USD", timeout=12)
        return r.json()

    try:
        data = await asyncio.get_event_loop().run_in_executor(None, _fetch)
        if data.get("result") == "success":
            rates = data.get("rates", {})
            LIVE_RATES = {c: rates[c] for c in CURRENCIES if c in rates}
            RATES_UPDATED = data.get("time_last_update_utc")
            logger.info("FX rates refreshed")
    except Exception as e:
        logger.warning(f"FX refresh failed: {e}")


def currencies_payload() -> dict:
    return {
        c: {"symbol": meta["symbol"], "name": meta["name"], "rate": round(get_rate(c), 6)}
        for c, meta in CURRENCIES.items()
    }


def convert(amount: float, frm: str, to: str) -> float:
    frm = frm if frm in CURRENCIES else "USD"
    to = to if to in CURRENCIES else "USD"
    usd = amount / get_rate(frm)
    return round(usd * get_rate(to), 2)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SettingsIn(BaseModel):
    name: Optional[str] = None
    base_currency: Optional[str] = None


class AccountIn(BaseModel):
    name: str
    type: str = "checking"  # checking, savings, credit, cash, investment
    balance: float = 0.0
    currency: str = "USD"
    color: str = "#0f172a"


class CategoryIn(BaseModel):
    name: str
    type: str = "expense"  # income, expense
    bucket: str = "needs"  # needs, wants, savings, income
    budget: float = 0.0
    color: str = "#64748b"


class TransactionIn(BaseModel):
    date: str
    description: str
    amount: float
    currency: str = "USD"
    type: str = "expense"  # income, expense
    kind: str = "variable"  # variable, recurring
    category_id: Optional[str] = None
    account_id: Optional[str] = None


class SinkingFundIn(BaseModel):
    name: str
    target: float
    saved: float = 0.0
    color: str = "#0ea5e9"
    due_date: Optional[str] = None


class DebtIn(BaseModel):
    name: str
    balance: float
    apr: float = 0.0
    min_payment: float = 0.0


class PayoffIn(BaseModel):
    strategy: str = "snowball"  # snowball, avalanche
    extra: float = 0.0


class NetWorthIn(BaseModel):
    name: str
    type: str = "asset"  # asset, liability
    amount: float = 0.0


class NoSpendIn(BaseModel):
    date: str
    status: str = "success"  # success, fail
    note: str = ""


class AIRequest(BaseModel):
    message: str


class BulkTxnIn(BaseModel):
    transactions: List[TransactionIn]


# ---------------------------------------------------------------------------
# Generic CRUD helpers
# ---------------------------------------------------------------------------
async def list_docs(coll: str, uid: str, extra: dict = None):
    q = {"user_id": uid}
    if extra:
        q.update(extra)
    return await db[coll].find(q, {"_id": 0}).to_list(5000)


async def insert_doc(coll: str, uid: str, data: dict) -> dict:
    doc = {"id": str(uuid.uuid4()), "user_id": uid, "created_at": datetime.now(timezone.utc).isoformat(), **data}
    await db[coll].insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_doc(coll: str, uid: str, doc_id: str, data: dict) -> dict:
    res = await db[coll].find_one_and_update(
        {"id": doc_id, "user_id": uid}, {"$set": data}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    res.pop("_id", None)
    return res


async def delete_doc(coll: str, uid: str, doc_id: str):
    res = await db[coll].delete_one({"id": doc_id, "user_id": uid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    user = {
        "id": uid,
        "name": body.name,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    await db.settings.insert_one({"user_id": uid, "name": body.name, "base_currency": "USD"})
    token = create_token(uid, email)
    return {"token": token, "user": {"id": uid, "name": body.name, "email": email}}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], email)
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": email}}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/logout")
async def logout(user=Depends(current_user)):
    return {"ok": True}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@api.get("/settings")
async def get_settings(user=Depends(current_user)):
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s:
        s = {"user_id": user["id"], "name": user["name"], "base_currency": "USD"}
        await db.settings.insert_one(dict(s))
    s["currencies"] = currencies_payload()
    s["rates_updated"] = RATES_UPDATED
    return s


@api.put("/settings")
async def put_settings(body: SettingsIn, user=Depends(current_user)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"user_id": user["id"]}, {"$set": data}, upsert=True)
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    return s


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
@api.get("/accounts")
async def get_accounts(user=Depends(current_user)):
    return await list_docs("accounts", user["id"])


@api.post("/accounts")
async def create_account(body: AccountIn, user=Depends(current_user)):
    return await insert_doc("accounts", user["id"], body.model_dump())


@api.put("/accounts/{doc_id}")
async def edit_account(doc_id: str, body: AccountIn, user=Depends(current_user)):
    return await update_doc("accounts", user["id"], doc_id, body.model_dump())


@api.delete("/accounts/{doc_id}")
async def remove_account(doc_id: str, user=Depends(current_user)):
    return await delete_doc("accounts", user["id"], doc_id)


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
@api.get("/categories")
async def get_categories(user=Depends(current_user)):
    return await list_docs("categories", user["id"])


@api.post("/categories")
async def create_category(body: CategoryIn, user=Depends(current_user)):
    return await insert_doc("categories", user["id"], body.model_dump())


@api.put("/categories/{doc_id}")
async def edit_category(doc_id: str, body: CategoryIn, user=Depends(current_user)):
    return await update_doc("categories", user["id"], doc_id, body.model_dump())


@api.delete("/categories/{doc_id}")
async def remove_category(doc_id: str, user=Depends(current_user)):
    return await delete_doc("categories", user["id"], doc_id)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
@api.get("/transactions")
async def get_transactions(
    user=Depends(current_user), month: Optional[str] = None, kind: Optional[str] = None, type: Optional[str] = None
):
    extra = {}
    if kind:
        extra["kind"] = kind
    if type:
        extra["type"] = type
    docs = await list_docs("transactions", user["id"], extra)
    if month:
        docs = [d for d in docs if d.get("date", "").startswith(month)]
    docs.sort(key=lambda d: d.get("date", ""), reverse=True)
    return docs


@api.post("/transactions")
async def create_transaction(body: TransactionIn, user=Depends(current_user)):
    return await insert_doc("transactions", user["id"], body.model_dump())


@api.put("/transactions/{doc_id}")
async def edit_transaction(doc_id: str, body: TransactionIn, user=Depends(current_user)):
    return await update_doc("transactions", user["id"], doc_id, body.model_dump())


@api.delete("/transactions/{doc_id}")
async def remove_transaction(doc_id: str, user=Depends(current_user)):
    return await delete_doc("transactions", user["id"], doc_id)


# ---------------------------------------------------------------------------
# Sinking funds
# ---------------------------------------------------------------------------
@api.get("/sinking-funds")
async def get_funds(user=Depends(current_user)):
    return await list_docs("sinking_funds", user["id"])


@api.post("/sinking-funds")
async def create_fund(body: SinkingFundIn, user=Depends(current_user)):
    return await insert_doc("sinking_funds", user["id"], body.model_dump())


@api.put("/sinking-funds/{doc_id}")
async def edit_fund(doc_id: str, body: SinkingFundIn, user=Depends(current_user)):
    return await update_doc("sinking_funds", user["id"], doc_id, body.model_dump())


@api.delete("/sinking-funds/{doc_id}")
async def remove_fund(doc_id: str, user=Depends(current_user)):
    return await delete_doc("sinking_funds", user["id"], doc_id)


# ---------------------------------------------------------------------------
# Debts + payoff calculator
# ---------------------------------------------------------------------------
@api.get("/debts")
async def get_debts(user=Depends(current_user)):
    return await list_docs("debts", user["id"])


@api.post("/debts")
async def create_debt(body: DebtIn, user=Depends(current_user)):
    return await insert_doc("debts", user["id"], body.model_dump())


@api.put("/debts/{doc_id}")
async def edit_debt(doc_id: str, body: DebtIn, user=Depends(current_user)):
    return await update_doc("debts", user["id"], doc_id, body.model_dump())


@api.delete("/debts/{doc_id}")
async def remove_debt(doc_id: str, user=Depends(current_user)):
    return await delete_doc("debts", user["id"], doc_id)


@api.post("/debts/payoff")
async def payoff(body: PayoffIn, user=Depends(current_user)):
    debts = await list_docs("debts", user["id"])
    working = [
        {"name": d["name"], "balance": float(d["balance"]), "apr": float(d.get("apr", 0)), "min": float(d.get("min_payment", 0))}
        for d in debts
        if float(d["balance"]) > 0
    ]
    if not working:
        return {"months": 0, "total_interest": 0, "total_paid": 0, "schedule": [], "payoff_order": []}

    if body.strategy == "avalanche":
        working.sort(key=lambda x: x["apr"], reverse=True)
    else:
        working.sort(key=lambda x: x["balance"])

    total_min = sum(d["min"] for d in working)
    budget = total_min + max(0.0, body.extra)
    total_interest = 0.0
    total_paid = 0.0
    month = 0
    schedule = []
    payoff_order = []

    while any(d["balance"] > 0 for d in working) and month < 600:
        month += 1
        avail = budget
        # accrue interest
        for d in working:
            if d["balance"] > 0:
                interest = d["balance"] * (d["apr"] / 100.0) / 12.0
                d["balance"] += interest
                total_interest += interest
        # pay minimums
        for d in working:
            if d["balance"] > 0:
                pay = min(d["min"], d["balance"], avail)
                d["balance"] -= pay
                avail -= pay
                total_paid += pay
        # snowball/avalanche extra to first unpaid (already ordered)
        for d in working:
            if d["balance"] > 0 and avail > 0:
                pay = min(avail, d["balance"])
                d["balance"] -= pay
                avail -= pay
                total_paid += pay
        for d in working:
            if d["balance"] <= 0.01 and d["name"] not in payoff_order:
                payoff_order.append(d["name"])
        remaining = round(sum(max(0, d["balance"]) for d in working), 2)
        if month <= 120:
            schedule.append({"month": month, "remaining": remaining})

    return {
        "months": month,
        "years": round(month / 12.0, 1),
        "total_interest": round(total_interest, 2),
        "total_paid": round(total_paid, 2),
        "schedule": schedule,
        "payoff_order": payoff_order,
    }


# ---------------------------------------------------------------------------
# Net worth
# ---------------------------------------------------------------------------
@api.get("/networth")
async def get_networth(user=Depends(current_user)):
    return await list_docs("networth", user["id"])


@api.post("/networth")
async def create_networth(body: NetWorthIn, user=Depends(current_user)):
    return await insert_doc("networth", user["id"], body.model_dump())


@api.put("/networth/{doc_id}")
async def edit_networth(doc_id: str, body: NetWorthIn, user=Depends(current_user)):
    return await update_doc("networth", user["id"], doc_id, body.model_dump())


@api.delete("/networth/{doc_id}")
async def remove_networth(doc_id: str, user=Depends(current_user)):
    return await delete_doc("networth", user["id"], doc_id)


# ---------------------------------------------------------------------------
# No-spend challenge
# ---------------------------------------------------------------------------
@api.get("/no-spend")
async def get_nospend(user=Depends(current_user)):
    return await list_docs("no_spend", user["id"])


@api.post("/no-spend")
async def create_nospend(body: NoSpendIn, user=Depends(current_user)):
    existing = await db.no_spend.find_one({"user_id": user["id"], "date": body.date})
    if existing:
        return await update_doc("no_spend", user["id"], existing["id"], body.model_dump())
    return await insert_doc("no_spend", user["id"], body.model_dump())


@api.delete("/no-spend/{doc_id}")
async def remove_nospend(doc_id: str, user=Depends(current_user)):
    return await delete_doc("no_spend", user["id"], doc_id)


# ---------------------------------------------------------------------------
# Dashboard aggregation
# ---------------------------------------------------------------------------
async def build_summary(uid: str) -> dict:
    s = await db.settings.find_one({"user_id": uid}, {"_id": 0}) or {"base_currency": "USD"}
    base = s.get("base_currency", "USD")
    txns = await list_docs("transactions", uid)
    cats = {c["id"]: c for c in await list_docs("categories", uid)}
    accounts = await list_docs("accounts", uid)
    funds = await list_docs("sinking_funds", uid)
    debts = await list_docs("debts", uid)
    nw = await list_docs("networth", uid)

    year = datetime.now(timezone.utc).year
    months = [f"{year}-{m:02d}" for m in range(1, 13)]
    monthly = {m: {"income": 0.0, "expense": 0.0} for m in months}
    by_category = {}
    buckets = {"needs": 0.0, "wants": 0.0, "savings": 0.0}
    total_income = 0.0
    total_expense = 0.0

    for t in txns:
        amt = convert(float(t["amount"]), t.get("currency", "USD"), base)
        mk = t.get("date", "")[:7]
        if t["type"] == "income":
            total_income += amt
            if mk in monthly:
                monthly[mk]["income"] += amt
        else:
            total_expense += amt
            if mk in monthly:
                monthly[mk]["expense"] += amt
            cat = cats.get(t.get("category_id"))
            cname = cat["name"] if cat else "Uncategorized"
            by_category[cname] = by_category.get(cname, 0.0) + amt
            bucket = cat["bucket"] if cat and cat.get("bucket") in buckets else "needs"
            buckets[bucket] += amt

    account_total = sum(convert(float(a["balance"]), a.get("currency", "USD"), base) for a in accounts)
    savings_total = sum(float(f.get("saved", 0)) for f in funds)
    savings_target = sum(float(f.get("target", 0)) for f in funds)
    debt_total = sum(float(d.get("balance", 0)) for d in debts)
    assets = sum(float(n["amount"]) for n in nw if n["type"] == "asset")
    liabilities = sum(float(n["amount"]) for n in nw if n["type"] == "liability")
    net_worth = assets + account_total + savings_total - liabilities - debt_total

    return {
        "base_currency": base,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net": round(total_income - total_expense, 2),
        "savings_rate": round((total_income - total_expense) / total_income * 100, 1) if total_income else 0,
        "monthly": [{"month": m, "label": datetime.strptime(m, "%Y-%m").strftime("%b"), **monthly[m]} for m in months],
        "by_category": sorted(
            [{"name": k, "value": round(v, 2)} for k, v in by_category.items()], key=lambda x: x["value"], reverse=True
        ),
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "account_total": round(account_total, 2),
        "accounts": accounts,
        "savings_total": round(savings_total, 2),
        "savings_target": round(savings_target, 2),
        "debt_total": round(debt_total, 2),
        "net_worth": round(net_worth, 2),
        "assets": round(assets + account_total + savings_total, 2),
        "liabilities": round(liabilities + debt_total, 2),
        "txn_count": len(txns),
    }


@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    return await build_summary(user["id"])


# ---------------------------------------------------------------------------
# Live exchange rates
# ---------------------------------------------------------------------------
@api.get("/rates")
async def get_rates(user=Depends(current_user)):
    return {"rates": currencies_payload(), "updated": RATES_UPDATED, "live": bool(LIVE_RATES)}


@api.post("/rates/refresh")
async def refresh_rates_ep(user=Depends(current_user)):
    await refresh_rates()
    return {"rates": currencies_payload(), "updated": RATES_UPDATED, "live": bool(LIVE_RATES)}


# ---------------------------------------------------------------------------
# Bulk import (CSV)
# ---------------------------------------------------------------------------
@api.post("/transactions/bulk")
async def bulk_transactions(body: BulkTxnIn, user=Depends(current_user)):
    docs = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            **t.model_dump(),
        }
        for t in body.transactions
    ]
    if docs:
        await db.transactions.insert_many(docs)
    return {"inserted": len(docs)}


# ---------------------------------------------------------------------------
# Paycheck planner
# ---------------------------------------------------------------------------
@api.get("/paycheck")
async def paycheck(user=Depends(current_user)):
    uid = user["id"]
    s = await db.settings.find_one({"user_id": uid}, {"_id": 0}) or {"base_currency": "USD"}
    base = s.get("base_currency", "USD")
    txns = await list_docs("transactions", uid)
    cats = {c["id"]: c for c in await list_docs("categories", uid)}

    month_income = defaultdict(float)
    month_bills = defaultdict(float)
    month_savings = defaultdict(float)
    incomes = []
    for t in txns:
        amt = convert(float(t["amount"]), t.get("currency", "USD"), base)
        mk = t.get("date", "")[:7]
        if t["type"] == "income":
            month_income[mk] += amt
            incomes.append((t, amt, mk))
        else:
            cat = cats.get(t.get("category_id"))
            bucket = cat["bucket"] if cat else "needs"
            if bucket == "savings":
                month_savings[mk] += amt
            elif t.get("kind") == "recurring" or bucket == "needs":
                month_bills[mk] += amt

    paychecks = []
    for t, amt, mk in incomes:
        inc = month_income[mk] or amt
        share = amt / inc if inc else 1.0
        bills = round(month_bills[mk] * share, 2)
        savings = round(month_savings[mk] * share, 2)
        spending = round(max(amt - bills - savings, 0), 2)
        paychecks.append({
            "id": t["id"], "date": t["date"], "description": t["description"],
            "amount": round(amt, 2), "bills": bills, "savings": savings, "spending": spending,
        })
    paychecks.sort(key=lambda x: x["date"], reverse=True)
    return {
        "base_currency": base,
        "paychecks": paychecks,
        "totals": {
            "amount": round(sum(p["amount"] for p in paychecks), 2),
            "bills": round(sum(p["bills"] for p in paychecks), 2),
            "savings": round(sum(p["savings"] for p in paychecks), 2),
            "spending": round(sum(p["spending"] for p in paychecks), 2),
        },
    }


# ---------------------------------------------------------------------------
# Expense explorer / breakdown
# ---------------------------------------------------------------------------
@api.get("/expenses/breakdown")
async def expense_breakdown(user=Depends(current_user)):
    uid = user["id"]
    s = await db.settings.find_one({"user_id": uid}, {"_id": 0}) or {"base_currency": "USD"}
    base = s.get("base_currency", "USD")
    txns = await list_docs("transactions", uid)
    cats = {c["id"]: c for c in await list_docs("categories", uid)}
    year = datetime.now(timezone.utc).year
    months = [f"{year}-{m:02d}" for m in range(1, 13)]

    data = {}
    for t in txns:
        if t["type"] != "expense":
            continue
        amt = convert(float(t["amount"]), t.get("currency", "USD"), base)
        cat = cats.get(t.get("category_id"))
        name = cat["name"] if cat else "Uncategorized"
        color = cat["color"] if cat else "#94a3b8"
        mk = t.get("date", "")[:7]
        d = data.setdefault(name, {"name": name, "color": color, "total": 0.0, "monthly": {m: 0.0 for m in months}})
        d["total"] += amt
        if mk in d["monthly"]:
            d["monthly"][mk] += amt

    cats_list = sorted(data.values(), key=lambda x: x["total"], reverse=True)
    for c in cats_list:
        c["total"] = round(c["total"], 2)
        c["monthly"] = [
            {"month": m, "label": datetime.strptime(m, "%Y-%m").strftime("%b"), "value": round(c["monthly"][m], 2)}
            for m in months
        ]
    return {
        "base_currency": base,
        "categories": cats_list,
        "months": [datetime.strptime(m, "%Y-%m").strftime("%b") for m in months],
        "total": round(sum(c["total"] for c in cats_list), 2),
    }


# ---------------------------------------------------------------------------
# AI insights (streaming)
# ---------------------------------------------------------------------------
@api.get("/ai/history")
async def ai_history(user=Depends(current_user)):
    msgs = await db.ai_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return msgs


@api.post("/ai/insights")
async def ai_insights(body: AIRequest, user=Depends(current_user)):
    uid = user["id"]
    summary = await build_summary(uid)
    await insert_doc("ai_messages", uid, {"role": "user", "content": body.message})

    system = (
        "You are Budgetly AI, a warm, encouraging personal finance coach. "
        "You analyze the user's real budget data and give specific, actionable money advice. "
        "Be concise, use short paragraphs and bullet points. Reference concrete numbers from their data. "
        "Never give legally binding financial/tax advice; add a light reminder to consult a professional for big decisions."
    )
    context_text = (
        f"Here is my current financial snapshot (all values in {summary['base_currency']}):\n"
        f"{json.dumps(summary, default=str)}\n\n"
        f"My question: {body.message}"
    )

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"insights-{uid}", system_message=system).with_model(
        "anthropic", "claude-sonnet-5-5"
    )

    async def gen():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=context_text)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield ev.content
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.exception("AI stream error")
            yield f"\n\n[Sorry, I ran into an error: {e}]"
        finally:
            if full:
                await insert_doc("ai_messages", uid, {"role": "assistant", "content": full})

    return StreamingResponse(
        gen(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------
async def seed_demo(uid: str):
    if await db.transactions.find_one({"user_id": uid}):
        return
    rnd = random.Random(42)
    year = datetime.now(timezone.utc).year
    cur_month = datetime.now(timezone.utc).month

    accounts = [
        {"name": "Everyday Checking", "type": "checking", "balance": 4820.50, "currency": "USD", "color": "#0f172a"},
        {"name": "High-Yield Savings", "type": "savings", "balance": 15230.00, "currency": "USD", "color": "#0ea5e9"},
        {"name": "Travel Card", "type": "credit", "balance": -1240.75, "currency": "EUR", "color": "#f59e0b"},
        {"name": "Brokerage", "type": "investment", "balance": 28750.00, "currency": "USD", "color": "#10b981"},
    ]
    acc_ids = {}
    for a in accounts:
        d = await insert_doc("accounts", uid, a)
        acc_ids[a["name"]] = d["id"]

    categories = [
        {"name": "Salary", "type": "income", "bucket": "income", "budget": 5200, "color": "#10b981"},
        {"name": "Freelance", "type": "income", "bucket": "income", "budget": 600, "color": "#22c55e"},
        {"name": "Rent", "type": "expense", "bucket": "needs", "budget": 1600, "color": "#ef4444"},
        {"name": "Groceries", "type": "expense", "bucket": "needs", "budget": 550, "color": "#f97316"},
        {"name": "Utilities", "type": "expense", "bucket": "needs", "budget": 220, "color": "#eab308"},
        {"name": "Transport", "type": "expense", "bucket": "needs", "budget": 180, "color": "#84cc16"},
        {"name": "Insurance", "type": "expense", "bucket": "needs", "budget": 150, "color": "#06b6d4"},
        {"name": "Dining Out", "type": "expense", "bucket": "wants", "budget": 300, "color": "#8b5cf6"},
        {"name": "Entertainment", "type": "expense", "bucket": "wants", "budget": 120, "color": "#ec4899"},
        {"name": "Shopping", "type": "expense", "bucket": "wants", "budget": 200, "color": "#f43f5e"},
        {"name": "Subscriptions", "type": "expense", "bucket": "wants", "budget": 60, "color": "#a855f7"},
        {"name": "Savings Transfer", "type": "expense", "bucket": "savings", "budget": 700, "color": "#0ea5e9"},
    ]
    cat_ids = {}
    for c in categories:
        d = await insert_doc("categories", uid, c)
        cat_ids[c["name"]] = d["id"]

    recurring = [
        ("Salary", "income", "Monthly Salary", 5200, 1, "Everyday Checking"),
        ("Freelance", "income", "Design retainer", 600, 15, "Everyday Checking"),
        ("Rent", "expense", "Apartment rent", 1600, 2, "Everyday Checking"),
        ("Utilities", "expense", "Electricity & water", 210, 5, "Everyday Checking"),
        ("Insurance", "expense", "Health insurance", 150, 8, "Everyday Checking"),
        ("Subscriptions", "expense", "Streaming + cloud", 55, 10, "Everyday Checking"),
        ("Savings Transfer", "expense", "Auto-save to savings", 700, 3, "High-Yield Savings"),
    ]
    variable_cats = [
        ("Groceries", 40, 140, "Everyday Checking", 4),
        ("Dining Out", 18, 75, "Travel Card", 4),
        ("Transport", 10, 45, "Everyday Checking", 3),
        ("Entertainment", 15, 60, "Travel Card", 2),
        ("Shopping", 25, 160, "Travel Card", 2),
    ]

    for m in range(1, cur_month + 1):
        for cname, ttype, desc, amount, day, acc in recurring:
            await insert_doc(
                "transactions",
                uid,
                {
                    "date": f"{year}-{m:02d}-{day:02d}",
                    "description": desc,
                    "amount": amount + (rnd.randint(-20, 20) if ttype == "expense" else 0),
                    "currency": "USD",
                    "type": ttype,
                    "kind": "recurring",
                    "category_id": cat_ids[cname],
                    "account_id": acc_ids[acc],
                },
            )
        for cname, lo, hi, acc, times in variable_cats:
            for _ in range(times):
                day = rnd.randint(1, 27)
                cur = "EUR" if acc == "Travel Card" else "USD"
                await insert_doc(
                    "transactions",
                    uid,
                    {
                        "date": f"{year}-{m:02d}-{day:02d}",
                        "description": f"{cname} purchase",
                        "amount": rnd.randint(lo, hi),
                        "currency": cur,
                        "type": "expense",
                        "kind": "variable",
                        "category_id": cat_ids[cname],
                        "account_id": acc_ids[acc],
                    },
                )

    for f in [
        {"name": "Emergency Fund", "target": 10000, "saved": 6500, "color": "#0ea5e9"},
        {"name": "Japan Trip", "target": 4000, "saved": 1450, "color": "#f59e0b"},
        {"name": "New Laptop", "target": 2200, "saved": 900, "color": "#8b5cf6"},
        {"name": "Car Maintenance", "target": 1500, "saved": 1200, "color": "#10b981"},
    ]:
        await insert_doc("sinking_funds", uid, f)

    for d in [
        {"name": "Student Loan", "balance": 12400, "apr": 4.5, "min_payment": 220},
        {"name": "Credit Card", "balance": 3200, "apr": 19.99, "min_payment": 110},
        {"name": "Car Loan", "balance": 8600, "apr": 6.2, "min_payment": 265},
    ]:
        await insert_doc("debts", uid, d)

    for n in [
        {"name": "Home Equity", "type": "asset", "amount": 85000},
        {"name": "401(k)", "type": "asset", "amount": 42000},
        {"name": "Mortgage", "type": "liability", "amount": 210000},
    ]:
        await insert_doc("networth", uid, n)

    today = date(year, cur_month, 1)
    for i in range(20):
        d = today + timedelta(days=i)
        if d.month != cur_month:
            break
        await insert_doc(
            "no_spend",
            uid,
            {"date": d.isoformat(), "status": "success" if rnd.random() > 0.3 else "fail", "note": ""},
        )


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "demo@budgetly.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "demo1234")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one(
            {
                "id": uid,
                "name": "Alex Demo",
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        await db.settings.insert_one({"user_id": uid, "name": "Alex Demo", "base_currency": "USD"})
        await seed_demo(uid)
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one(
                {"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}}
            )
        await seed_demo(existing["id"])
    await refresh_rates()
    logger.info("Startup complete")


@api.get("/")
async def root():
    return {"message": "Budgetly API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()

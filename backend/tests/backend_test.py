"""Budgetly backend API tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
API = BASE_URL.rstrip("/") + "/api"

DEMO_EMAIL = "demo@budgetly.app"
DEMO_PASS = "demo1234"


@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="session")
def demo_client(demo_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"})
    return s


# ---- Auth ----
class TestAuth:
    def test_login_demo(self, demo_token):
        assert isinstance(demo_token, str) and len(demo_token) > 20

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_me(self, demo_client):
        r = demo_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_register_and_login(self):
        email = f"test_{uuid.uuid4().hex[:10]}@test.app"
        r = requests.post(f"{API}/auth/register", json={"name": "T", "email": email, "password": "pass1234"}, timeout=20)
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r2.status_code == 200
        # duplicate
        r3 = requests.post(f"{API}/auth/register", json={"name": "T", "email": email, "password": "pass1234"}, timeout=20)
        assert r3.status_code == 400


# ---- Dashboard ----
class TestDashboard:
    def test_dashboard(self, demo_client):
        r = demo_client.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_income", "total_expense", "net", "monthly", "buckets", "account_total", "net_worth", "by_category"]:
            assert k in d
        assert len(d["monthly"]) == 12
        assert d["total_income"] > 0
        assert d["total_expense"] > 0


# ---- Settings ----
class TestSettings:
    def test_get_settings(self, demo_client):
        r = demo_client.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert "base_currency" in s and "currencies" in s
        assert "USD" in s["currencies"]

    def test_update_settings(self, demo_client):
        r = demo_client.put(f"{API}/settings", json={"base_currency": "EUR"})
        assert r.status_code == 200
        assert r.json()["base_currency"] == "EUR"
        # restore
        demo_client.put(f"{API}/settings", json={"base_currency": "USD"})


# ---- Generic CRUD helper ----
def _crud_check(client, path, create_body, update_body, update_field, update_value):
    r = client.get(f"{API}/{path}")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    r = client.post(f"{API}/{path}", json=create_body)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert "id" in doc
    doc_id = doc["id"]

    r = client.put(f"{API}/{path}/{doc_id}", json=update_body)
    assert r.status_code == 200
    assert r.json()[update_field] == update_value

    # verify persistence
    r = client.get(f"{API}/{path}")
    assert any(d["id"] == doc_id and d[update_field] == update_value for d in r.json())

    r = client.delete(f"{API}/{path}/{doc_id}")
    assert r.status_code == 200
    r = client.delete(f"{API}/{path}/{doc_id}")
    assert r.status_code == 404


class TestAccounts:
    def test_crud(self, demo_client):
        _crud_check(
            demo_client,
            "accounts",
            {"name": "TEST_acc", "type": "checking", "balance": 100, "currency": "USD", "color": "#000"},
            {"name": "TEST_acc2", "type": "savings", "balance": 200, "currency": "EUR", "color": "#111"},
            "name",
            "TEST_acc2",
        )


class TestCategories:
    def test_crud(self, demo_client):
        _crud_check(
            demo_client,
            "categories",
            {"name": "TEST_cat", "type": "expense", "bucket": "wants", "budget": 50, "color": "#000"},
            {"name": "TEST_cat2", "type": "expense", "bucket": "needs", "budget": 100, "color": "#111"},
            "bucket",
            "needs",
        )


class TestTransactions:
    def test_crud_and_filters(self, demo_client):
        body = {"date": "2026-01-15", "description": "TEST_tx", "amount": 42, "currency": "USD", "type": "expense", "kind": "variable"}
        r = demo_client.post(f"{API}/transactions", json=body)
        assert r.status_code == 200
        tid = r.json()["id"]

        # month filter
        r = demo_client.get(f"{API}/transactions?month=2026-01")
        assert r.status_code == 200
        assert any(t["id"] == tid for t in r.json())

        # kind filter
        r = demo_client.get(f"{API}/transactions?kind=variable")
        assert all(t["kind"] == "variable" for t in r.json())

        r = demo_client.get(f"{API}/transactions?kind=recurring")
        assert all(t["kind"] == "recurring" for t in r.json())

        # update
        body["amount"] = 99
        r = demo_client.put(f"{API}/transactions/{tid}", json=body)
        assert r.status_code == 200
        assert r.json()["amount"] == 99

        r = demo_client.delete(f"{API}/transactions/{tid}")
        assert r.status_code == 200

    def test_seeded_count(self, demo_client):
        r = demo_client.get(f"{API}/transactions")
        assert len(r.json()) > 50  # ~220 seeded


class TestSinkingFunds:
    def test_crud(self, demo_client):
        _crud_check(
            demo_client,
            "sinking-funds",
            {"name": "TEST_fund", "target": 1000, "saved": 100, "color": "#000"},
            {"name": "TEST_fund2", "target": 2000, "saved": 200, "color": "#000"},
            "target",
            2000,
        )


class TestDebts:
    def test_crud(self, demo_client):
        _crud_check(
            demo_client,
            "debts",
            {"name": "TEST_debt", "balance": 500, "apr": 10, "min_payment": 25},
            {"name": "TEST_debt2", "balance": 400, "apr": 12, "min_payment": 30},
            "balance",
            400,
        )

    def test_payoff_snowball(self, demo_client):
        r = demo_client.post(f"{API}/debts/payoff", json={"strategy": "snowball", "extra": 200})
        assert r.status_code == 200
        d = r.json()
        for k in ["months", "total_interest", "schedule", "payoff_order"]:
            assert k in d
        assert d["months"] > 0
        assert len(d["payoff_order"]) >= 1

    def test_payoff_avalanche(self, demo_client):
        r = demo_client.post(f"{API}/debts/payoff", json={"strategy": "avalanche", "extra": 100})
        assert r.status_code == 200
        assert r.json()["months"] > 0


class TestNetWorth:
    def test_crud(self, demo_client):
        _crud_check(
            demo_client,
            "networth",
            {"name": "TEST_nw", "type": "asset", "amount": 5000},
            {"name": "TEST_nw2", "type": "liability", "amount": 1000},
            "type",
            "liability",
        )


class TestNoSpend:
    def test_upsert_and_delete(self, demo_client):
        d = "2026-02-10"
        r = demo_client.post(f"{API}/no-spend", json={"date": d, "status": "success", "note": ""})
        assert r.status_code == 200
        did = r.json()["id"]

        r = demo_client.post(f"{API}/no-spend", json={"date": d, "status": "fail", "note": ""})
        assert r.status_code == 200
        assert r.json()["status"] == "fail"

        r = demo_client.delete(f"{API}/no-spend/{did}")
        assert r.status_code == 200


class TestAI:
    def test_history(self, demo_client):
        r = demo_client.get(f"{API}/ai/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_insights_stream(self, demo_client):
        r = demo_client.post(
            f"{API}/ai/insights",
            json={"message": "In one short sentence, what's my biggest spending category?"},
            stream=True,
            timeout=60,
        )
        assert r.status_code == 200
        chunks = []
        for c in r.iter_content(chunk_size=None, decode_unicode=True):
            if c:
                chunks.append(c)
            if sum(len(x) for x in chunks) > 20:
                break
        r.close()
        text = "".join(chunks)
        assert len(text) > 0


# ---- Live Exchange Rates ----
class TestRates:
    def test_get_rates(self, demo_client):
        r = demo_client.get(f"{API}/rates")
        assert r.status_code == 200
        data = r.json()
        assert "rates" in data and "live" in data
        assert "USD" in data["rates"] and data["rates"]["USD"]["rate"] == 1.0
        assert "EUR" in data["rates"]

    def test_refresh_rates(self, demo_client):
        r = demo_client.post(f"{API}/rates/refresh")
        assert r.status_code == 200
        data = r.json()
        assert "rates" in data
        # If live, EUR should NOT be the static 0.92
        if data.get("live"):
            eur = data["rates"]["EUR"]["rate"]
            # Should be around 0.85-0.95 but not exactly 0.92 (static)
            assert eur != 0.92, "EUR rate still matches static 0.92 fallback"
            assert 0.5 < eur < 2.0

    def test_settings_includes_rates_updated(self, demo_client):
        r = demo_client.get(f"{API}/settings")
        assert r.status_code == 200
        data = r.json()
        assert "currencies" in data
        assert "rates_updated" in data


# ---- Bulk transactions / CSV import ----
class TestBulkTxn:
    def test_bulk_insert_and_cleanup(self, demo_client):
        payload = {
            "transactions": [
                {"date": "2026-01-05", "description": "TEST_BULK_1", "amount": 50.0, "currency": "USD", "type": "expense", "kind": "variable"},
                {"date": "2026-01-06", "description": "TEST_BULK_2", "amount": 1200.0, "currency": "USD", "type": "income", "kind": "recurring"},
                {"date": "2026-01-07", "description": "TEST_BULK_3", "amount": 12.5, "currency": "EUR", "type": "expense", "kind": "variable"},
            ]
        }
        r = demo_client.post(f"{API}/transactions/bulk", json=payload)
        assert r.status_code == 200
        assert r.json()["inserted"] == 3

        # verify present
        r = demo_client.get(f"{API}/transactions?month=2026-01")
        rows = r.json()
        descs = [t["description"] for t in rows]
        assert "TEST_BULK_1" in descs and "TEST_BULK_2" in descs and "TEST_BULK_3" in descs

        # cleanup
        for t in rows:
            if t["description"].startswith("TEST_BULK_"):
                demo_client.delete(f"{API}/transactions/{t['id']}")

    def test_bulk_empty(self, demo_client):
        r = demo_client.post(f"{API}/transactions/bulk", json={"transactions": []})
        assert r.status_code == 200
        assert r.json()["inserted"] == 0


# ---- Paycheck Planner ----
class TestPaycheck:
    def test_paycheck(self, demo_client):
        r = demo_client.get(f"{API}/paycheck")
        assert r.status_code == 200
        data = r.json()
        assert "paychecks" in data and "totals" in data
        assert isinstance(data["paychecks"], list)
        assert len(data["paychecks"]) > 0
        for p in data["paychecks"]:
            for k in ("date", "amount", "bills", "savings", "spending"):
                assert k in p
            # Bills + savings + spending should roughly equal amount (within 1.0 for rounding)
            total = p["bills"] + p["savings"] + p["spending"]
            assert abs(total - p["amount"]) < 1.5, f"Allocation mismatch: {p}"
        totals = data["totals"]
        for k in ("amount", "bills", "savings", "spending"):
            assert k in totals


# ---- Expense Explorer ----
class TestExpenseBreakdown:
    def test_breakdown(self, demo_client):
        r = demo_client.get(f"{API}/expenses/breakdown")
        assert r.status_code == 200
        data = r.json()
        assert "categories" in data and "months" in data and "total" in data
        assert len(data["months"]) == 12
        assert len(data["categories"]) > 0
        for c in data["categories"]:
            assert "name" in c and "total" in c and "monthly" in c
            assert len(c["monthly"]) == 12


# ---- Round 3: Budget Alerts, Autopilot, Goals Plan, Compare ----
class TestAlerts:
    def test_alerts(self, demo_client):
        r = demo_client.get(f"{API}/alerts")
        assert r.status_code == 200
        d = r.json()
        assert "alerts" in d and "month" in d and "base_currency" in d
        for a in d["alerts"]:
            assert a["level"] in ("warning", "over")
            assert a["pct"] >= 80
            assert "spent" in a and "budget" in a and "name" in a


class TestAutopilot:
    def test_autopilot_run_idempotent(self, demo_client):
        r = demo_client.post(f"{API}/autopilot/run")
        assert r.status_code == 200
        d = r.json()
        assert "inserted" in d and "month" in d
        # run again - should be 0
        r2 = demo_client.post(f"{API}/autopilot/run")
        assert r2.status_code == 200
        assert r2.json()["inserted"] == 0

    def test_cron_no_token(self):
        r = requests.post(f"{API}/cron/autopilot", timeout=20)
        assert r.status_code == 401

    def test_cron_bad_token(self):
        r = requests.post(f"{API}/cron/autopilot", headers={"Authorization": "Bearer wrong"}, timeout=20)
        assert r.status_code == 401

    def test_cron_good_token(self):
        secret = open("/app/backend/.env").read().split('WEBHOOK_CRON_SECRET=')[1].split('\n')[0].strip().strip('"')
        r = requests.post(f"{API}/cron/autopilot", headers={"Authorization": f"Bearer {secret}"}, timeout=20)
        assert r.status_code in (200, 202), r.text
        assert r.json().get("queued") is True

    def test_settings_autopilot_toggle(self, demo_client):
        r = demo_client.put(f"{API}/settings", json={"autopilot": True})
        assert r.status_code == 200
        assert r.json().get("autopilot") is True
        r = demo_client.put(f"{API}/settings", json={"autopilot": False})
        assert r.json().get("autopilot") is False


class TestGoalsPlan:
    def test_plan(self, demo_client):
        r = demo_client.get(f"{API}/goals/plan")
        assert r.status_code == 200
        d = r.json()
        for k in ("avg_monthly_income", "total_monthly", "pct_income", "plan", "base_currency"):
            assert k in d
        for p in d["plan"]:
            for k in ("id", "name", "remaining", "months_left", "monthly"):
                assert k in p


class TestCompare:
    def test_compare(self, demo_client):
        r = demo_client.get(f"{API}/compare")
        assert r.status_code == 200
        d = r.json()
        for k in ("current_year", "previous_year", "rows", "totals"):
            assert k in d
        assert len(d["rows"]) == 12
        assert "current" in d["totals"] and "previous" in d["totals"]
        # Prior year (2025) must have some data seeded
        assert d["totals"]["previous"]["income"] > 0, "Previous year not seeded"
        assert d["totals"]["previous"]["expense"] > 0


class TestCurrentYearRegression:
    def test_dashboard_ytd_not_doubled(self, demo_client):
        r = demo_client.get(f"{API}/dashboard")
        assert r.status_code == 200
        inc = r.json()["total_income"]
        # Should be ~58000 current year only, not doubled ~116800
        assert inc < 90000, f"YTD income looks doubled: {inc}"
        assert inc > 20000, f"YTD income too low: {inc}"

    def test_paycheck_current_year(self, demo_client):
        r = demo_client.get(f"{API}/paycheck")
        assert r.status_code == 200
        cur_year = str(__import__("datetime").datetime.now().year)
        for p in r.json()["paychecks"]:
            assert p["date"].startswith(cur_year), f"Paycheck not current year: {p['date']}"

    def test_expense_breakdown_current_year(self, demo_client):
        r = demo_client.get(f"{API}/expenses/breakdown")
        assert r.status_code == 200
        d = r.json()
        # breakdown total should be reasonable (not doubled)
        assert d["total"] > 0

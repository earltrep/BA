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

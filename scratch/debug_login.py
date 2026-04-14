import requests
import sys

def test_login():
    url = "http://localhost:4000/api/auth/login"
    payload = {
        "email": "admin@example.com",
        "password": "AdminPassword2026!"
    }
    try:
        print(f"Testing login at {url}...")
        resp = requests.post(url, json=payload, timeout=5)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()

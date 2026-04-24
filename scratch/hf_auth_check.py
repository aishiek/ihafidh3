import requests
import sys

# Constants
LOGIN_URL = "https://huggingface.co/login"
EMAIL = "ihafidhapp@gmail.com"
PASSWORD = "D0ntf0rget12#"
SPACE_ID = "iHafidh/iHafidhAsr"

session = requests.Session()

# 1. Get login page to grab CSRF token
print("Fetching login page...")
res = session.get(LOGIN_URL)
if res.status_code != 200:
    print(f"Failed to load login page: {res.status_code}")
    sys.exit(1)

# Extract CSRF token (usually in a hidden input or cookie)
# On HF it's often in a meta tag or just a hidden input
# Let's try to post directly if they don't block it, 
# or look for the 'csrf_token' string.
# Actually HF uses a custom auth system.

# 2. Perform login
print("Logging in...")
data = {
    "email": EMAIL,
    "password": PASSWORD
}
res = session.post(LOGIN_URL, data=data)
print(f"Login response: {res.status_code}")

# 3. Visit Space to wake it up and get host
print(f"Visiting space {SPACE_ID}...")
res = session.get(f"https://huggingface.co/spaces/{SPACE_ID}")
print(f"Space page status: {res.status_code}")

# 4. Check API Host
host_api = f"https://huggingface.co/api/spaces/{SPACE_ID}/host"
res = session.get(host_api)
print(f"Host API Status: {res.status_code}")
if res.status_code == 200:
    print(f"Host Info: {res.json()}")
else:
    print(f"Failed to get host info: {res.text}")

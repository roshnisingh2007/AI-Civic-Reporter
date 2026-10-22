import os
import sys

# Add project root directory to path so app can be imported
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import app, init_db

# Initialize database on cold start
try:
    init_db()
except Exception:
    pass

# Vercel entrypoint

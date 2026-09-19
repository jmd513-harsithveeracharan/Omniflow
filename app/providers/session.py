"""
app/providers/session.py
------------------------
Shared HTTP session pool with retry configuration for LLM providers.
"""

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

_SESSION = requests.Session()
_retries = Retry(
    total=2,
    backoff_factor=0.5,
    status_forcelist=[500, 502, 503, 504],
    raise_on_status=False,
)
_adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=_retries)
_SESSION.mount("https://", _adapter)
_SESSION.mount("http://", _adapter)


"""Root CLI convenience runner for OmniFlow.
Allows running 'python test_trio.py' directly from the root workspace directory.
"""
from __future__ import annotations

import sys
import os

root_dir = os.path.dirname(os.path.abspath(__file__))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from omniflow.test_trio import main

if __name__ == "__main__":
    main()


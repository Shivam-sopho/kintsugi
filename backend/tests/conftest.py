import os

# Tests always run offline and fast.
os.environ.setdefault("MOCK_MODE", "true")
os.environ.setdefault("STORE", "memory")
os.environ.setdefault("DEMO_STEP_DELAY", "0")

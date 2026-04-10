"""Shared Flask extensions — imported by app.py and route modules."""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(get_remote_address, default_limits=["200 per hour"])

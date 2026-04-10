import json
import urllib.request
from config import MORADA_API_KEY

def send_confirmation(phone, name, session_date, session_time, room_url):
    if not MORADA_API_KEY:
        print(f"[morada] Not configured, skipping confirmation to {phone}")
        return False
    # TODO: Replace with actual Morada API endpoint and template when available
    print(f"[morada] Would send confirmation to {phone}: {name}, {session_date} {session_time}, {room_url}")
    return True

def send_cancellation(phone, name, session_date, session_time):
    if not MORADA_API_KEY:
        print(f"[morada] Not configured, skipping cancellation to {phone}")
        return False
    print(f"[morada] Would send cancellation to {phone}: {name}, {session_date} {session_time}")
    return True

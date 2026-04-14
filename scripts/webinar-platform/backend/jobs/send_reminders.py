#!/usr/bin/env python3
"""Send email reminders for upcoming webinar sessions."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timedelta, timezone
import config  # noqa: F401
import supabase_client as db
from services.email_service import send_reminder

BRT = timezone(timedelta(hours=-3))

def main():
    now = datetime.now(BRT)
    sent_count = 0

    window_24h_start = now + timedelta(hours=23)
    window_24h_end = now + timedelta(hours=25)
    window_1h_start = now + timedelta(minutes=30)
    window_1h_end = now + timedelta(minutes=90)

    sessions = db.select("webinar_sessions", filters={"status": "eq.scheduled"})

    for session in (sessions or []):
        starts = datetime.fromisoformat(session["starts_at"])
        session_date = starts.strftime("%d/%m/%Y")
        session_time = starts.strftime("%H:%M")

        regs = db.select("webinar_registrations", filters={
            "session_id": f"eq.{session['id']}",
            "cancelled_at": "is.null",
        })

        for reg in (regs or []):
            room_url = f"/webinar/sala/{session['id']}?token={reg['access_token']}"

            # 24h reminder
            if window_24h_start <= starts <= window_24h_end and not reg.get("reminder_24h_sent_at"):
                if send_reminder(reg["email"], reg["name"], session_date, session_time, room_url, 24):
                    db.update("webinar_registrations",
                              {"id": f"eq.{reg['id']}"},
                              {"reminder_24h_sent_at": now.isoformat()})
                    sent_count += 1

            # 1h reminder
            if window_1h_start <= starts <= window_1h_end and not reg.get("reminder_1h_sent_at"):
                if send_reminder(reg["email"], reg["name"], session_date, session_time, room_url, 1):
                    db.update("webinar_registrations",
                              {"id": f"eq.{reg['id']}"},
                              {"reminder_1h_sent_at": now.isoformat()})
                    sent_count += 1

    print(f"[reminders] Sent {sent_count} reminders")

if __name__ == "__main__":
    main()

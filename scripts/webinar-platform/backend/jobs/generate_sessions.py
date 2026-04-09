#!/usr/bin/env python3
"""Generate webinar sessions for the next 14 days from active slots."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import date, timedelta, datetime, timezone
import config  # noqa: F401 - triggers .env loading
import supabase_client as db
from services.google_calendar import create_session_event

BRT = timezone(timedelta(hours=-3))

def main():
    today = date.today()
    slots = db.select("webinar_slots", filters={"is_active": "eq.true"})
    if not slots:
        print("[generate] No active slots")
        return

    created = 0
    for day_offset in range(14):
        target_date = today + timedelta(days=day_offset)
        weekday = target_date.weekday()
        js_weekday = (weekday + 1) % 7  # Convert Monday=0 to Sunday=0

        for slot in slots:
            if slot["day_of_week"] != js_weekday:
                continue

            existing = db.select("webinar_sessions", filters={
                "slot_id": f"eq.{slot['id']}",
                "date": f"eq.{target_date.isoformat()}",
            })
            if existing:
                continue

            time_str = slot["time"]
            hour, minute = int(time_str[:2]), int(time_str[3:5])
            starts = datetime(target_date.year, target_date.month, target_date.day,
                              hour, minute, tzinfo=BRT)
            ends = starts + timedelta(minutes=slot["duration_minutes"])

            try:
                event_id, meet_link = create_session_event(
                    title="Apresentação Seazone",
                    starts_at=starts.isoformat(),
                    ends_at=ends.isoformat(),
                    presenter_email=slot["presenter_email"],
                )
            except Exception as e:
                print(f"[generate] Calendar error for {target_date} {time_str}: {e}")
                event_id, meet_link = None, None

            db.insert("webinar_sessions", {
                "slot_id": slot["id"],
                "date": target_date.isoformat(),
                "starts_at": starts.isoformat(),
                "ends_at": ends.isoformat(),
                "google_meet_link": meet_link,
                "calendar_event_id": event_id,
                "status": "scheduled",
            })
            created += 1
            print(f"[generate] Created: {target_date} {time_str}")

    print(f"[generate] Done. Created {created} sessions.")

if __name__ == "__main__":
    main()

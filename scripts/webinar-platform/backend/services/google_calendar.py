import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from config import GOOGLE_CALENDAR_CREDENTIALS, GOOGLE_CALENDAR_ID

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_service(calendar_id=None):
    if not GOOGLE_CALENDAR_CREDENTIALS:
        return None, None
    subject = calendar_id or GOOGLE_CALENDAR_ID
    creds_json = json.loads(GOOGLE_CALENDAR_CREDENTIALS)
    creds = Credentials.from_service_account_info(creds_json, scopes=SCOPES)
    creds = creds.with_subject(subject)
    return build("calendar", "v3", credentials=creds), subject


def create_session_event(title, starts_at, ends_at, presenter_email, calendar_id=None):
    service, cal_id = _get_service(calendar_id)
    if not service:
        print("[gcal] Not configured, skipping event creation")
        return None, None
    event = service.events().insert(
        calendarId=cal_id,
        conferenceDataVersion=1,
        body={
            "summary": title,
            "start": {"dateTime": starts_at, "timeZone": "America/Sao_Paulo"},
            "end": {"dateTime": ends_at, "timeZone": "America/Sao_Paulo"},
            "attendees": [{"email": presenter_email}],
            "guestsCanSeeOtherGuests": False,
            "conferenceData": {
                "createRequest": {
                    "requestId": f"webinar-{starts_at}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                },
            },
        },
    ).execute()
    return event["id"], event.get("hangoutLink", "")


def add_attendee(event_id, email, calendar_id=None):
    service, cal_id = _get_service(calendar_id)
    if not service or not event_id:
        return
    event = service.events().get(calendarId=cal_id, eventId=event_id).execute()
    attendees = event.get("attendees", [])
    if not any(a["email"] == email for a in attendees):
        attendees.append({"email": email})
        service.events().patch(
            calendarId=cal_id, eventId=event_id,
            body={"attendees": attendees, "guestsCanSeeOtherGuests": False},
        ).execute()


def remove_attendee(event_id, email, calendar_id=None):
    service, cal_id = _get_service(calendar_id)
    if not service or not event_id:
        return
    event = service.events().get(calendarId=cal_id, eventId=event_id).execute()
    attendees = [a for a in event.get("attendees", []) if a["email"] != email]
    service.events().patch(
        calendarId=cal_id, eventId=event_id, body={"attendees": attendees},
    ).execute()


def delete_event(event_id, calendar_id=None):
    service, cal_id = _get_service(calendar_id)
    if not service or not event_id:
        return
    service.events().delete(calendarId=cal_id, eventId=event_id).execute()

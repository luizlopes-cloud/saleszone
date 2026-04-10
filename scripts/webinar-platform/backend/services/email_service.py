import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

def send_email(to_email, subject, html_body):
    if not SMTP_HOST:
        print(f"[email] SMTP not configured, skipping: {subject} -> {to_email}")
        return False
    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[email] Error sending to {to_email}: {e}")
        return False

def send_reminder(to_email, name, session_date, session_time, room_url, hours_before):
    if hours_before == 24:
        subject = f"Sua apresentação Seazone é amanhã às {session_time}"
    else:
        subject = f"Falta 1 hora! Apresentação Seazone às {session_time}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Olá, {name}!</h2>
        <p>{'Amanhã' if hours_before == 24 else 'Em 1 hora'} você tem uma apresentação Seazone agendada.</p>
        <p><strong>Data:</strong> {session_date}<br><strong>Horário:</strong> {session_time}</p>
        <p><a href="{room_url}" style="display:inline-block; padding:12px 24px; background:#111; color:#fff; text-decoration:none; border-radius:8px;">Acessar sala de espera</a></p>
    </div>
    """
    return send_email(to_email, subject, html)

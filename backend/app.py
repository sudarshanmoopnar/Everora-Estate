import os
import re
import resend

import psycopg
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


# Load environment variables from the local .env file.
load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
EMAIL_FROM = os.getenv(
    "EMAIL_FROM",
    "Everora Estate <onboarding@resend.dev>",
)


# --------------------------------------------------
# Email notification
# --------------------------------------------------

def send_enquiry_notification(name, email, event, guests, message):
    if not RESEND_API_KEY or not MAIL_USERNAME:
        raise RuntimeError(
            "Email notification configuration is missing."
        )

    resend.api_key = RESEND_API_KEY

    email_content = f"""A new enquiry has been submitted on Everora Estate.

Name: {name}
Email: {email}
Event: {event}
Guests: {guests}

Message:
{message}
"""

    result = resend.Emails.send({
        "from": EMAIL_FROM,
        "to": [MAIL_USERNAME],
        "subject": f"New Everora Estate Enquiry — {event}",
        "text": email_content,
        "reply_to": email,
    })

    app.logger.info(
        "Enquiry notification sent through Resend: %s",
        result["id"],
    )


# --------------------------------------------------
# Flask application and security configuration
# --------------------------------------------------

app = Flask(__name__)

app.config["MAX_CONTENT_LENGTH"] = 16 * 1024  # 16 KB

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)

CORS(
    app,
    resources={
        r"/api/enquiries": {
            "origins": [
                "http://127.0.0.1:5500",
                "http://localhost:5500",
                "https://everora-estate.pages.dev",
            ]
        }
    },
)



# --------------------------------------------------
# Database connection helper
# --------------------------------------------------

def get_database_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=5,
    )


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "success",
        "message": "Everora Estate backend is running!",
    }), 200


# --------------------------------------------------
# Development-only database check
# --------------------------------------------------

@app.route("/api/db-check", methods=["GET"])
def database_check():
    if not app.debug:
        return jsonify({
            "status": "error",
            "message": "This endpoint is unavailable.",
        }), 404

    try:
        with get_database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()

        return jsonify({
            "status": "success",
            "database": "connected",
        }), 200

    except psycopg.Error:
        app.logger.exception("Database connection check failed")

        return jsonify({
            "status": "error",
            "database": "unavailable",
        }), 503


# --------------------------------------------------
# Create enquiry
# --------------------------------------------------

@app.route("/api/enquiries", methods=["POST"])
@limiter.limit("5 per minute")
def create_enquiry():

    # Require JSON requests.
    if not request.is_json:
        return jsonify({
            "status": "error",
            "message": "Please submit the enquiry as JSON.",
        }), 415

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "status": "error",
            "message": "Invalid request data.",
        }), 400

    name = data.get("name")
    email = data.get("email")
    event = data.get("event")
    guests = data.get("guests")
    message = data.get("message", "")

    # Validate required fields.
    if not all(
        isinstance(value, str)
        for value in (name, email, event)
    ):
        return jsonify({
            "status": "error",
            "message": "Name, email, and event are required.",
        }), 400

    name = name.strip()
    email = email.strip()
    event = event.strip()

    # Validate name.
    if not name or len(name) > 100:
        return jsonify({
            "status": "error",
            "message": "Please enter a valid name.",
        }), 400

    # Validate email.
    if (
        len(email) > 254
        or not re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            email,
        )
    ):
        return jsonify({
            "status": "error",
            "message": "Please enter a valid email address.",
        }), 400

    # Restrict event types to supported choices.
    allowed_events = {
        "Wedding",
        "Engagement",
        "Private event",
        "Other celebration",
    }

    if event not in allowed_events:
        return jsonify({
            "status": "error",
            "message": "Please select a valid event type.",
        }), 400

    # Validate guest count.
    if guests in ("", None):
        guests = None

    elif (
        isinstance(guests, bool)
        or not isinstance(guests, int)
        or not 1 <= guests <= 100000
    ):
        return jsonify({
            "status": "error",
            "message": "Guest count must be between 1 and 100000.",
        }), 400

    # Validate message.
    if not isinstance(message, str) or len(message) > 3000:
        return jsonify({
            "status": "error",
            "message": "The message must be 3000 characters or fewer.",
        }), 400

    message = message.strip()

    # Save the enquiry first.
    try:
        with get_database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO enquiries
                        (name, email, event, guests, message)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (
                        name,
                        email,
                        event,
                        guests,
                        message,
                    ),
                )

                enquiry_id = cursor.fetchone()[0]

    except psycopg.Error:
        app.logger.exception("Failed to save an enquiry")

        return jsonify({
            "status": "error",
            "message": (
                "We could not save your enquiry. "
                "Please try again later."
            ),
        }), 500
    # Send the email after the database transaction completes.
    # An email failure must not undo an already-saved enquiry.
    try:
        send_enquiry_notification(
            name,
            email,
            event,
            guests,
            message,
        )

    except Exception as error:
        app.logger.exception(
            "Enquiry saved, but email notification failed: %s",
            error,
        )

    return jsonify({
        "status": "success",
        "message": "Your enquiry has been received.",
        "enquiry_id": enquiry_id,
    }), 201


# --------------------------------------------------
# # --------------------------------------------------
# Start the server
# --------------------------------------------------

#python
if __name__ == "__main__":
    from waitress import serve

    port = int(os.environ.get("PORT", 5000))

    serve(app, host="0.0.0.0", port=port)

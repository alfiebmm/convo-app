#!/usr/bin/env python3
import hashlib
import hmac
import http.server
import json
import os
import re
import socketserver
import sys
import time

SECRET = os.environ.get("CONVO_WEBHOOK_SECRET")
PORT = int(os.environ.get("PORT", "3000"))
TOLERANCE_SECONDS = 300

if not SECRET:
    print("Set CONVO_WEBHOOK_SECRET before starting the server.", file=sys.stderr)
    sys.exit(1)


def parse_signature_header(header):
    if not header:
        return None

    fields = {}
    for part in header.split(","):
        pieces = part.split("=")
        if len(pieces) != 2:
            return None
        fields[pieces[0]] = pieces[1]

    timestamp_raw = fields.get("t")
    signature = fields.get("v1")
    if not timestamp_raw or not re.fullmatch(r"\d+", timestamp_raw):
        return None
    if not signature or not re.fullmatch(r"[a-f0-9]{64}", signature):
        return None

    return int(timestamp_raw), signature


def sign_body(timestamp, body):
    signed_payload = f"{timestamp}.".encode("utf-8") + body
    return hmac.new(
        SECRET.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()


def verify_signature(header, body):
    parsed = parse_signature_header(header)
    if not parsed:
        return False

    timestamp, signature = parsed
    now = int(time.time())
    if abs(now - timestamp) > TOLERANCE_SECONDS:
        return False

    expected = sign_body(timestamp, body)
    return hmac.compare_digest(signature, expected)


class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(content_length)
        signature = self.headers.get("x-convo-signature")

        if not verify_signature(signature, body):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Invalid signature")
            return

        payload = json.loads(body.decode("utf-8"))
        print("Verified Convo webhook:", payload.get("event"))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

    def do_GET(self):
        self.send_response(405)
        self.end_headers()
        self.wfile.write(b"Method not allowed")


class WebhookHTTPServer(http.server.HTTPServer):
    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        self.server_name = self.server_address[0]
        self.server_port = self.server_address[1]


if __name__ == "__main__":
    server = WebhookHTTPServer(("127.0.0.1", PORT), WebhookHandler)
    print(f"Listening for Convo webhooks on http://localhost:{PORT}")
    server.serve_forever()

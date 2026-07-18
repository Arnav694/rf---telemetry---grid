import base64
import json
import os
import ssl
from typing import Any

import paho.mqtt.client as mqtt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv


load_dotenv()

MQTT_HOST = os.getenv("MQTT_HOST")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "rf-telemetry/+")
CA_CERT_PATH = os.getenv("CA_CERT_PATH")

AES_KEY_HEX = os.getenv("AES_KEY_HEX", "")
AES_KEY = bytes.fromhex(AES_KEY_HEX)


def decrypt_payload(envelope: dict[str, Any]) -> dict[str, Any]:
    nonce = base64.b64decode(envelope["nonce"])
    ciphertext = base64.b64decode(envelope["ciphertext"])
    tag = base64.b64decode(envelope["tag"])

    aesgcm = AESGCM(AES_KEY)

    plaintext = aesgcm.decrypt(
        nonce,
        ciphertext + tag,
        None,
    )

    return json.loads(plaintext.decode("utf-8"))


def process_message(topic: str, raw_payload: bytes) -> None:
    try:
        message = json.loads(raw_payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"\n[INVALID MESSAGE] Topic: {topic}")
        print(f"Reason: {error}")
        return

    try:
        if message.get("payload_type") == "encrypted_telemetry":
            telemetry = decrypt_payload(message)
            message_type = "DECRYPTED"
        else:
            # Supports existing team nodes that currently publish plaintext JSON.
            telemetry = message
            message_type = "PLAINTEXT"

        print(f"\n[{message_type}] Topic: {topic}")
        print(json.dumps(telemetry, indent=2))

    except Exception as error:
        print(f"\n[PROCESSING FAILED] Topic: {topic}")
        print(f"Reason: {error}")


def on_connect(
    client: mqtt.Client,
    userdata: Any,
    flags: mqtt.ConnectFlags,
    reason_code: mqtt.ReasonCode,
    properties: mqtt.Properties | None,
) -> None:
    if reason_code == 0:
        print("Connected to the team MQTT broker.")
        print(f"Subscribing to: {MQTT_TOPIC}")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"MQTT connection failed: {reason_code}")


def on_message(
    client: mqtt.Client,
    userdata: Any,
    message: mqtt.MQTTMessage,
) -> None:
    process_message(message.topic, message.payload)


def validate_configuration() -> None:
    required_values = {
        "MQTT_HOST": MQTT_HOST,
        "MQTT_USERNAME": MQTT_USERNAME,
        "MQTT_PASSWORD": MQTT_PASSWORD,
        "CA_CERT_PATH": CA_CERT_PATH,
        "AES_KEY_HEX": AES_KEY_HEX,
    }

    missing = [
        name
        for name, value in required_values.items()
        if not value
    ]

    if missing:
        raise ValueError(
            f"Missing values in .env: {', '.join(missing)}"
        )

    if len(AES_KEY) not in (16, 24, 32):
        raise ValueError(
            "AES_KEY_HEX must represent a 16, 24, or 32-byte AES key."
        )

    if not os.path.isfile(CA_CERT_PATH):
        raise FileNotFoundError(
            f"CA certificate not found: {CA_CERT_PATH}"
        )


def main() -> None:
    validate_configuration()

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id="telemetry-dashboard-backend",
    )

    client.username_pw_set(
        MQTT_USERNAME,
        MQTT_PASSWORD,
    )

    client.tls_set(
        ca_certs=CA_CERT_PATH,
        cert_reqs=ssl.CERT_REQUIRED,
        tls_version=ssl.PROTOCOL_TLS_CLIENT,
    )

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"Connecting to {MQTT_HOST}:{MQTT_PORT}...")

    client.connect(
        MQTT_HOST,
        MQTT_PORT,
        keepalive=60,
    )

    client.loop_forever()


if __name__ == "__main__":
    main()
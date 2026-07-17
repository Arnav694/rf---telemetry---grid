import asyncio
import base64
import json
import os
import ssl
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import paho.mqtt.client as mqtt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


# =========================================================
# Configuration
# =========================================================

load_dotenv()

MQTT_HOST = os.getenv("MQTT_HOST")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "rf-telemetry/+")
CA_CERT_PATH = os.getenv("CA_CERT_PATH")

AES_KEY_HEX = os.getenv("AES_KEY_HEX", "")
AES_KEY = bytes.fromhex(AES_KEY_HEX)


# =========================================================
# Shared application state
# =========================================================

state_lock = threading.Lock()

latest_nodes: dict[str, dict[str, Any]] = {}

# Keeps the latest 300 readings for each node in memory.
node_history: dict[str, deque[dict[str, Any]]] = defaultdict(
    lambda: deque(maxlen=300)
)

websocket_clients: set[WebSocket] = set()

server_event_loop: asyncio.AbstractEventLoop | None = None
mqtt_client: mqtt.Client | None = None


# =========================================================
# Utility functions
# =========================================================

def get_first(
    data: dict[str, Any],
    *keys: str,
    default: Any = None,
) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]

    return default


def to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
            f"Missing .env values: {', '.join(missing)}"
        )

    if len(AES_KEY) not in (16, 24, 32):
        raise ValueError(
            "AES_KEY_HEX must represent a 16, 24, or 32-byte AES key."
        )

    if not os.path.isfile(CA_CERT_PATH):
        raise FileNotFoundError(
            f"CA certificate not found: {CA_CERT_PATH}"
        )


# =========================================================
# AES-GCM decryption
# =========================================================

def decrypt_payload(
    envelope: dict[str, Any],
) -> dict[str, Any]:
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


# =========================================================
# Team payload normalization
# =========================================================

def normalize_telemetry(
    data: dict[str, Any],
    topic: str,
    encrypted: bool,
    outer_envelope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    topic_node_id = topic.split("/")[-1]

    node_id = str(
        get_first(
            data,
            "node_id",
            "node",
            "id",
            default=topic_node_id,
        )
    )

    temperature = to_float(
        get_first(
            data,
            "temp",
            "temperature",
            "Temp",
        )
    )

    humidity = to_float(
        get_first(
            data,
            "humidity",
            "Humidity",
            "hum",
        )
    )

    rf_noise_value = get_first(
        data,
        "rf_noise",
        "RF",
        default=[],
    )

    if isinstance(rf_noise_value, list):
        rf_noise = [
            to_int(value) or 0
            for value in rf_noise_value
        ]
    else:
        rf_noise = []

    score_value = get_first(
        data,
        "score",
        "congestion_score",
        "rf_score",
    )

    score = to_float(score_value)

    if score is None and rf_noise:
        score = sum(rf_noise) / len(rf_noise)

    loudest_channel = to_int(
        get_first(
            data,
            "loudest_ch",
            "loudest_channel",
        )
    )

    loudest_hits = to_int(
        get_first(
            data,
            "loudest_hits",
            "peak_hits",
        )
    )

    if rf_noise:
        derived_channel = max(
            range(len(rf_noise)),
            key=rf_noise.__getitem__,
        )

        if loudest_channel is None:
            loudest_channel = derived_channel

        if loudest_hits is None:
            loudest_hits = rf_noise[derived_channel]

    received_at = utc_now_iso()

    normalized = {
        "node_id": node_id,
        "topic": topic,
        "temperature": temperature,
        "humidity": humidity,
        "congestion_score": score,
        "loudest_channel": loudest_channel,
        "loudest_hits": loudest_hits,
        "rf_noise": rf_noise,
        "schema_version": get_first(
            data,
            "schema_version",
            default=1,
        ),
        "source_timestamp": get_first(
            data,
            "timestamp",
            "uptime_ms",
        ),
        "received_at": received_at,
        "last_seen_epoch": time.time(),
        "online": True,
        "encrypted": encrypted,
        "algorithm": (
            outer_envelope.get("algorithm")
            if outer_envelope
            else None
        ),
        "sensor_ok": get_first(
            data,
            "sensor_ok",
            "Tstatus",
        ),
        "radio_ok": get_first(
            data,
            "radio_ok",
            "Rstatus",
        ),
        "city": get_first(
            data,
            "city",
            "location",
        ),
        "latitude": to_float(
            get_first(data, "lat", "latitude")
        ),
        "longitude": to_float(
            get_first(data, "lon", "longitude")
        ),
    }

    return normalized


# =========================================================
# WebSocket broadcasting
# =========================================================

def get_nodes_snapshot() -> list[dict[str, Any]]:
    with state_lock:
        snapshot = [
            node.copy()
            for node in latest_nodes.values()
        ]

    return sorted(
        snapshot,
        key=lambda node: node["node_id"],
    )


async def broadcast_nodes() -> None:
    if not websocket_clients:
        return

    message = {
        "type": "nodes_snapshot",
        "nodes": get_nodes_snapshot(),
    }

    disconnected: list[WebSocket] = []

    for websocket in list(websocket_clients):
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.append(websocket)

    for websocket in disconnected:
        websocket_clients.discard(websocket)


# =========================================================
# MQTT callbacks
# =========================================================

def on_mqtt_connect(
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
        print(
            f"MQTT connection failed: {reason_code}"
        )


def on_mqtt_disconnect(
    client: mqtt.Client,
    userdata: Any,
    disconnect_flags: mqtt.DisconnectFlags,
    reason_code: mqtt.ReasonCode,
    properties: mqtt.Properties | None,
) -> None:
    print(
        f"Disconnected from MQTT: {reason_code}"
    )


def on_mqtt_message(
    client: mqtt.Client,
    userdata: Any,
    message: mqtt.MQTTMessage,
) -> None:
    topic = message.topic

    try:
        outer_message = json.loads(
            message.payload.decode("utf-8")
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        print(f"[INVALID JSON] {topic}: {error}")
        return

    encrypted = (
        outer_message.get("payload_type")
        == "encrypted_telemetry"
    )

    try:
        if encrypted:
            telemetry = decrypt_payload(
                outer_message
            )
        else:
            telemetry = outer_message

        normalized = normalize_telemetry(
            telemetry,
            topic,
            encrypted,
            outer_message if encrypted else None,
        )

        node_id = normalized["node_id"]

        with state_lock:
            latest_nodes[node_id] = normalized
            node_history[node_id].append(
                normalized.copy()
            )

        message_type = (
            "DECRYPTED"
            if encrypted
            else "PLAINTEXT"
        )

        print(
            f"[{message_type}] "
            f"{node_id}: "
            f"{normalized['temperature']}°C, "
            f"{normalized['humidity']}%, "
            f"score={normalized['congestion_score']}"
        )

        if (
            server_event_loop is not None
            and server_event_loop.is_running()
        ):
            asyncio.run_coroutine_threadsafe(
                broadcast_nodes(),
                server_event_loop,
            )

    except Exception as error:
        print(
            f"[PROCESSING FAILED] {topic}: {error}"
        )


def create_mqtt_client() -> mqtt.Client:
    client_id = (
        "telemetry-api-"
        + uuid4().hex[:8]
    )

    client = mqtt.Client(
        callback_api_version=(
            mqtt.CallbackAPIVersion.VERSION2
        ),
        client_id=client_id,
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

    client.on_connect = on_mqtt_connect
    client.on_disconnect = on_mqtt_disconnect
    client.on_message = on_mqtt_message

    return client


# =========================================================
# FastAPI lifecycle
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mqtt_client
    global server_event_loop

    validate_configuration()

    server_event_loop = asyncio.get_running_loop()

    mqtt_client = create_mqtt_client()

    print(
        f"Connecting to MQTT broker "
        f"{MQTT_HOST}:{MQTT_PORT}..."
    )

    mqtt_client.connect_async(
        MQTT_HOST,
        MQTT_PORT,
        keepalive=60,
    )

    mqtt_client.loop_start()

    yield

    if mqtt_client is not None:
        mqtt_client.disconnect()
        mqtt_client.loop_stop()


# =========================================================
# FastAPI application
# =========================================================

app = FastAPI(
    title="RF Telemetry Grid API",
    version="1.0.0",
    lifespan=lifespan,
)

# Development configuration.
# We will restrict this before public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REST endpoints
# =========================================================

@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "RF Telemetry Grid API",
        "status": "running",
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    mqtt_connected = (
        mqtt_client is not None
        and mqtt_client.is_connected()
    )

    return {
        "api": "online",
        "mqtt_connected": mqtt_connected,
        "subscribed_topic": MQTT_TOPIC,
        "node_count": len(get_nodes_snapshot()),
    }


@app.get("/api/nodes")
def get_nodes() -> dict[str, Any]:
    nodes = get_nodes_snapshot()

    return {
        "count": len(nodes),
        "nodes": nodes,
    }


@app.get("/api/nodes/{node_id}")
def get_node(node_id: str) -> dict[str, Any]:
    with state_lock:
        node = latest_nodes.get(node_id)

    if node is None:
        raise HTTPException(
            status_code=404,
            detail="Node not found",
        )

    return node


@app.get("/api/nodes/{node_id}/history")
def get_node_history(
    node_id: str,
    limit: int = 100,
) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 300))

    with state_lock:
        readings = list(
            node_history.get(node_id, [])
        )

    if not readings:
        raise HTTPException(
            status_code=404,
            detail="No history found for this node",
        )

    readings = readings[-safe_limit:]

    return {
        "node_id": node_id,
        "count": len(readings),
        "readings": readings,
    }


# =========================================================
# WebSocket endpoint
# =========================================================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
) -> None:
    await websocket.accept()

    websocket_clients.add(websocket)

    await websocket.send_json(
        {
            "type": "nodes_snapshot",
            "nodes": get_nodes_snapshot(),
        }
    )

    try:
        while True:
            # Keeps the socket open and detects disconnects.
            await websocket.receive_text()

    except WebSocketDisconnect:
        websocket_clients.discard(websocket)

    except Exception:
        websocket_clients.discard(websocket)
/*
  ESP32 RF Spectrum Node — Secure MQTT-only version (HiveMQ Cloud)

  No local dashboard in this version -- pure "sense, encrypt, publish"
  node. This satisfies the Core Mission's telemetry requirement on its
  own; pair it with one of the earlier dashboard sketches if you also
  need the Group Mission's local web view running at the same time.

  *** REQUIRES CREDENTIALS YOU HAVEN'T CREATED YET ***
  This is a private HiveMQ Cloud cluster, not the public test broker
  used earlier. It requires a username + password to connect, and only
  accepts TLS connections (no plain port). Before this will work:
    1. Open your HiveMQ Cloud console
    2. Find Access Management (or similarly named) for this cluster
    3. Create a new set of MQTT credentials
    4. Fill them into mqtt_username / mqtt_password below

  Wiring:
    NRF24L01  CE=GPIO4  CSN=GPIO5  SCK=GPIO18  MOSI=GPIO23  MISO=GPIO19
    NRF24L01 VCC -> 3.3V ONLY (5V will kill the chip)
    DHT11     DATA=GPIO15  VCC->3.3V/5V (breakout board)  GND->GND

  Libraries needed (Arduino Library Manager):
    - PubSubClient       (by Nick O'Leary)
    - RF24                (by TMRh20)
    - DHT sensor library  (by Adafruit) -- also installs "Adafruit Unified Sensor"
      as a dependency, accept that prompt if it appears
  WiFiClientSecure and mbedtls (AES) are built into the ESP32 core.
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <mbedtls/aes.h>
#include <SPI.h>
#include <RF24.h>
#include <DHT.h>

// ---- WiFi ----
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ---- MQTT (private HiveMQ Cloud cluster -- TLS + auth required) ----
const char* mqtt_server   = "9fa5d7e2411f4135a2b5e478fe4d2850.s1.eu.hivemq.cloud";
const int   mqtt_port     = 8883; // TLS only -- this broker has no plain port
const char* mqtt_username = "YOUR_HIVEMQ_USERNAME"; // create in HiveMQ Cloud console
const char* mqtt_password = "YOUR_HIVEMQ_PASSWORD"; // create in HiveMQ Cloud console
// Since this whole broker is private to your team already, the topic
// just needs a unique NODE name -- give each teammate a different one
// (node1, node2, priya, arjun, whatever) so the dashboard can tell
// nodes apart. Don't let two people use the same name.
const char* mqtt_topic    = "rf-telemetry/node1";

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

unsigned long lastPublish = 0;
const unsigned long publishInterval = 10000; // publish every 10s

// ---- AES-128 key ----
// PLACEHOLDER for testing. Replace with the real shared key your
// coordinators give out -- every node needs the same key.
uint8_t aesKey[16] = {
  0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,
  0x08,0x09,0x0A,0x0B,0x0C,0x0D,0x0E,0x0F
};

// ---- NRF24L01 spectrum scan ----
RF24 radio(4, 5); // CE, CSN

const int NUM_CHANNELS = 126;
const int SAMPLES_PER_CHANNEL = 20;
uint16_t channelHits[NUM_CHANNELS];

float latestScore       = 0;
int   latestLoudestCh   = -1;
int   latestLoudestHits = 0;

void setupRF24() {
  bool ok = radio.begin();
  Serial.print("radio.begin() returned: ");
  Serial.println(ok ? "OK" : "FAILED");
  Serial.print("Chip connected check: ");
  Serial.println(radio.isChipConnected() ? "YES" : "NO - check wiring/power");

  radio.setAutoAck(false);
  radio.stopListening();
  radio.setChannel(0);
}

float scanSpectrum() {
  memset(channelHits, 0, sizeof(channelHits));

  for (int ch = 0; ch < NUM_CHANNELS; ch++) {
    radio.setChannel(ch);
    for (int s = 0; s < SAMPLES_PER_CHANNEL; s++) {
      radio.startListening();
      delayMicroseconds(128);
      radio.stopListening();
      if (radio.testCarrier()) {
        channelHits[ch]++;
      }
    }
  }

  long totalHits = 0;
  for (int ch = 0; ch < NUM_CHANNELS; ch++) totalHits += channelHits[ch];
  long totalSamples = (long)NUM_CHANNELS * SAMPLES_PER_CHANNEL;
  return (totalHits * 100.0) / totalSamples;
}

void updateLoudest() {
  int maxHits = -1;
  int maxCh = -1;
  for (int ch = 0; ch < NUM_CHANNELS; ch++) {
    if (channelHits[ch] > maxHits) {
      maxHits = channelHits[ch];
      maxCh = ch;
    }
  }
  latestLoudestCh = maxCh;
  latestLoudestHits = maxHits;
}

// ---- DHT11 environmental sensor ----
#define DHTPIN 15
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// DHT11 occasionally returns a bad read (NaN) -- fall back to the last
// known-good value instead of publishing garbage when that happens.
float lastGoodTemp     = 25.0;
float lastGoodHumidity = 50.0;

float readTemperature() {
  float t = dht.readTemperature();
  if (isnan(t)) {
    Serial.println("DHT11 temperature read failed -- using last good value");
    return lastGoodTemp;
  }
  lastGoodTemp = t;
  return t;
}

float readHumidity() {
  float h = dht.readHumidity();
  if (isnan(h)) {
    Serial.println("DHT11 humidity read failed -- using last good value");
    return lastGoodHumidity;
  }
  lastGoodHumidity = h;
  return h;
}

// ---- AES helpers ----
size_t pkcs7Pad(uint8_t* out, const uint8_t* in, size_t inLen) {
  size_t padLen = 16 - (inLen % 16);
  memcpy(out, in, inLen);
  for (size_t i = 0; i < padLen; i++) out[inLen + i] = (uint8_t)padLen;
  return inLen + padLen;
}

void toHex(const uint8_t* buf, size_t len, String &out) {
  char b[3];
  for (size_t i = 0; i < len; i++) { sprintf(b, "%02x", buf[i]); out += b; }
}

String aesEncryptToHex(const String& plaintext) {
  uint8_t padded[256];
  size_t paddedLen = pkcs7Pad(padded, (const uint8_t*)plaintext.c_str(), plaintext.length());

  uint8_t iv[16];
  for (int i = 0; i < 16; i++) iv[i] = (uint8_t)random(0, 256);
  uint8_t ivWork[16];
  memcpy(ivWork, iv, 16);

  uint8_t cipher[256];
  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, aesKey, 128);
  mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, paddedLen, ivWork, padded, cipher);
  mbedtls_aes_free(&aes);

  String hexOut = "";
  toHex(iv, 16, hexOut);
  toHex(cipher, paddedLen, hexOut);
  return hexOut;
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to HiveMQ Cloud...");
    String clientId = "esp32-rf-node-" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println(" connected.");
    } else {
      Serial.print(" failed, rc="); Serial.print(mqttClient.state());
      Serial.println(" -- if this persists, double-check username/password. Retrying in 2s");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  setupRF24();
  dht.begin();

  // Skips validating the broker's TLS certificate chain -- acceptable
  // for a student project talking to a known, trusted broker you set up
  // yourself. Production systems would pin the actual CA certificate
  // instead of skipping validation.
  espClient.setInsecure();

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setBufferSize(256);
}

void loop() {
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastPublish > publishInterval) {
    lastPublish = now;

    latestScore = scanSpectrum();
    updateLoudest();

    String json = "{";
    json += "\"temp\":" + String(readTemperature(), 1) + ",";
    json += "\"hum\":" + String(readHumidity(), 1) + ",";
    json += "\"score\":" + String(latestScore, 2) + ",";
    json += "\"loudestCh\":" + String(latestLoudestCh) + ",";
    json += "\"loudestFreq\":" + String(2400 + latestLoudestCh) + ",";
    json += "\"loudestHits\":" + String(latestLoudestHits);
    json += "}";

    String encryptedHex = aesEncryptToHex(json);
    mqttClient.publish(mqtt_topic, encryptedHex.c_str());

    Serial.println("Plaintext:  " + json);
    Serial.println("Published:  " + encryptedHex);
  }
}

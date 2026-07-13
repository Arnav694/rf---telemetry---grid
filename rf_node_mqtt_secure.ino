#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <RF24.h>

const char* ssid = "Airtel_ravi_5130_EXT";
const char* password = "air58823";

const char* mqtt_server = "955582be306a4529b8874ee52640cc86.s1.eu.hivemq.cloud"; // from your HiveMQ console
const int mqtt_port = 8883;
const char* mqtt_user = "STP THING"; // from Access Management, not your friend's
const char* mqtt_pass = "GROUP3STPTHING";

const char* node_id = "esp32-02"; // change per device later
const char* topic = "rf-telemetry/esp32-02";

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ---- NRF24L01 passive spectrum scan ----
// Wiring: CE=GPIO4 CSN=GPIO5 SCK=GPIO18 MOSI=GPIO23 MISO=GPIO19, VCC->3.3V ONLY
RF24 radio(4, 5); // CE, CSN

const int NUM_CHANNELS = 126;       // channels 0-125 => 2400-2525 MHz
const int SAMPLES_PER_CHANNEL = 20; // reps per channel per sweep
uint16_t channelHits[NUM_CHANNELS];

int latestLoudestCh   = -1;
int latestLoudestHits = 0;

void setupRF24() {
  bool ok = radio.begin();
  Serial.print("radio.begin() returned: ");
  Serial.println(ok ? "OK" : "FAILED");
  Serial.print("Chip connected check: ");
  Serial.println(radio.isChipConnected() ? "YES" : "NO - check wiring/power");

  radio.setAutoAck(false); // passive scanning only, no packets exchanged
  radio.stopListening();
  radio.setChannel(0);
}

// One full sweep across all 126 channels. Blocking, roughly 300-450ms.
// Fills channelHits[] and returns the overall congestion score, 0-100.
float scanSpectrum() {
  memset(channelHits, 0, sizeof(channelHits));

  for (int ch = 0; ch < NUM_CHANNELS; ch++) {
    radio.setChannel(ch);
    for (int s = 0; s < SAMPLES_PER_CHANNEL; s++) {
      radio.startListening();
      delayMicroseconds(128); // datasheet settling time before CD is valid
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

// Single linear scan through channelHits[] to find the channel with the
// highest tick count -- same logic as spectrum_analyzer_2.ino's
// printLoudestChannel(), just storing into variables instead of printing.
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

void connectWiFi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void connectMQTT() {
  espClient.setInsecure(); // skip cert validation for now — fine for testing
  client.setServer(mqtt_server, mqtt_port);
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32Client-" + String(node_id);
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  connectWiFi();
  setupRF24();
}

void loop() {
  if (!client.connected()) connectMQTT();
  client.loop();

  float score = scanSpectrum();
  updateLoudest();

  StaticJsonDocument<128> doc;
  doc["node_id"] = node_id;
  doc["temp"] = 5000;
  doc["humidity"] = 0.0004;
  doc["score"] = score;
  doc["loudest_ch"] = latestLoudestCh;
  doc["loudest_hits"] = latestLoudestHits;
  doc["timestamp"] = millis();

  char buffer[128];
  serializeJson(doc, buffer);
  client.publish(topic, buffer);

  Serial.println(buffer);
  delay(5000); // publish every 5s
}

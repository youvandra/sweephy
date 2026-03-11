#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>   // ← ST7789
#include <mbedtls/md.h>
#include <Preferences.h>
#include <WebServer.h>
#include "qrcode.h" // Local QRCode library

// =====================
// Configuration
// =====================
String ssid = "";
String password = "";

Preferences preferences;
WebServer server(80);

String deviceIdStr = "";
String deviceSecretStr = "";
const char* apiUrlIntent = "https://prgynxjzvglwbbtidyhi.supabase.co/functions/v1/process-intent";
const char* apiUrlStatus = "https://prgynxjzvglwbbtidyhi.supabase.co/functions/v1/get-status";
const char* apiUrlPrice  = "https://prgynxjzvglwbbtidyhi.supabase.co/functions/v1/get-price";

// TFT SPI Pins
#define TFT_CS   15
#define TFT_DC   2
#define TFT_RST  4
#define TFT_MOSI 23
#define TFT_SCK  18
#define TFT_MISO 19

#define BTN_PIN  21

// Helper macro: RGB888 → RGB565
#define RGB565(r,g,b) ( ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3) )

#define C_BLACK       RGB565(  0,   0,   0)   // Pure black background
#define C_WHITE       RGB565(241, 247, 246)   // #F1F7F6 — near-white (replaces pure white)
#define C_PRIMARY     RGB565(  0, 223, 129)   // #00DF81 — Sweephy primary mint green
#define C_MID_GREEN   RGB565( 44, 194, 149)   // #2CC295 — secondary mid green
#define C_DEEP_GREEN  RGB565(  9,  85,  68)   // #095544 — deep accent green
#define C_DARK_BG     RGB565(  3,  34,  33)   // #032221 — dark panel background
#define C_DARKEST_BG  RGB565(  2,  27,  26)   // #00DF81 — deepest near-black green
#define C_GREY        RGB565(112, 125, 125)   // #707D7D — muted grey
#define C_SOFT_MINT   RGB565(170, 203, 196)   // #AACBC4 — soft mint tint
#define C_RED         RGB565(220,  60,  60)   // Error red (kept functional, no brand equiv)
#define C_YELLOW      RGB565(255, 210,  60)   // Warning yellow (kept functional)

// Semantic aliases — maps old generic names to Sweephy brand roles
#define C_DARKGREY    C_GREY          // chart border, minor UI
#define C_LIGHTGREY   C_SOFT_MINT     // pair label, subtle text
#define C_GREEN       C_PRIMARY       // success state, positive price
#define C_CYAN        C_MID_GREEN     // chart line, highlight
#define C_BLUE        C_DEEP_GREEN    // action bar background

// =====================
// Display Init (ST7789)
// =====================
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);

// =====================
// Layout Constants (Landscape 320x240)
// =====================
#define SCR_W  320
#define SCR_H  240

// STATE_READY
#define PAIR_Y       8
#define PRICE_Y      28   // size=4 → 32px tall → bottom=60
#define PCT_Y        66   // size=2 → 16px tall → bottom=82
#define CHART_Y      90
#define CHART_H      100  // bottom=190
#define BAR_Y        198
#define BAR_H        42

// STATE_CONFIRM_SWAP
#define CONF_TITLE_Y 30
#define CONF_PRICE_Y 75
#define CONF_BAR_X   20
#define CONF_BAR_Y   130
#define CONF_BAR_W   (SCR_W - 40)
#define CONF_BAR_H   22
#define CONF_HINT_Y  175

// =====================
// State
// =====================
enum DeviceState {
  STATE_BOOT,
  STATE_PROVISIONING, // New state
  STATE_CONNECTING,
  STATE_UNPAIRED,
  STATE_READY,
  STATE_CONFIRM_SWAP,
  STATE_SWAPPING,
  STATE_SWAP_SUCCESS,
  STATE_SWAP_FAIL,
  STATE_ERROR
};

DeviceState currentState = STATE_BOOT;
bool    isPaired    = false;
String  pairingCode = "";
String  lastPriceStr = "0.0000";
String  swapResultAmount = ""; // Dedicated for swap result
String  errorMsg    = "";
String  statusMessage = "Please Wait"; // Dynamic status for SWAPPING state

#define MAX_HISTORY 30
float priceHistory[MAX_HISTORY];
int   historyCount = 0;
float currentPrice = 0.0f;
float prevPrice    = 0.0f;

int           lastBtnState     = HIGH;
unsigned long btnPressStartTime = 0;
bool          isBtnPressed      = false;
const unsigned long LONG_PRESS_TIME  = 1000;

unsigned long lastHeartbeatTime = 0;
const unsigned long heartbeatInterval = 5000;

unsigned long lastPriceTime = 0;
const unsigned long priceInterval = 15000;

unsigned long stateStartTime = 0;
const unsigned long STATE_TIMEOUT = 3000;

// =====================
// UI Helpers
// =====================
void drawCenteredText(const String& text, int y, int size, uint16_t color, uint16_t bg = C_BLACK) {
  tft.setTextSize(size);
  tft.setTextColor(color, bg);
  int16_t x1, y1;
  uint16_t w, h;
  tft.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  int cx = (SCR_W - (int)w) / 2;
  if (cx < 0) cx = 0;
  tft.setCursor(cx, y);
  tft.print(text);
}

void drawChart(int x, int y, int w, int h) {
  if (historyCount < 2) return;

  float minVal = priceHistory[0], maxVal = priceHistory[0];
  for (int i = 1; i < historyCount; i++) {
    if (priceHistory[i] < minVal) minVal = priceHistory[i];
    if (priceHistory[i] > maxVal) maxVal = priceHistory[i];
  }

  float range = maxVal - minVal;
  if (range < 0.000001f) range = 0.000001f;
  minVal -= range * 0.1f;
  maxVal += range * 0.1f;
  range = maxVal - minVal;

  tft.drawRect(x, y, w, h, C_DARKGREY);
  tft.fillRect(x + 1, y + 1, w - 2, h - 2, C_BLACK);

  float stepX = (float)(w - 2) / (MAX_HISTORY - 1);

  for (int i = 0; i < historyCount - 1; i++) {
    int x1 = x + 1 + (int)(i       * stepX);
    int x2 = x + 1 + (int)((i + 1) * stepX);
    int y1 = y + h - 1 - (int)((priceHistory[i]     - minVal) / range * (h - 2));
    int y2 = y + h - 1 - (int)((priceHistory[i + 1] - minVal) / range * (h - 2));

    y1 = constrain(y1, y, y + h - 1);
    y2 = constrain(y2, y, y + h - 1);

    tft.drawLine(x1, y1, x2, y2, C_CYAN);
  }
}

void drawQRCode(const char* data) {
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(3)];
  qrcode_initText(&qrcode, qrcodeData, 3, 0, data);

  int scale = 5; // Adjust scale to fit 240px height (29*5 = 145px)
  int startX = (SCR_W - (qrcode.size * scale)) / 2;
  int startY = (SCR_H - (qrcode.size * scale)) / 2 + 10; // Shift down a bit

  // Draw white background
  tft.fillRect(startX - 5, startY - 5, (qrcode.size * scale) + 10, (qrcode.size * scale) + 10, C_WHITE);

  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        tft.fillRect(startX + (x * scale), startY + (y * scale), scale, scale, C_BLACK);
      }
    }
  }
}

void updateDisplay() {
  // ── Full-screen states (return early, no black fill first) ──────
  switch (currentState) {
    case STATE_SWAP_SUCCESS:
      tft.fillScreen(C_RED);
      drawCenteredText("SUCCESS!",       40,  4, C_BLACK, C_RED);
      drawCenteredText("You received:", 90, 2, C_BLACK, C_RED);
      drawCenteredText(swapResultAmount + " USDC", 120, 3, C_BLACK, C_RED); 
      drawCenteredText("Swap Completed", 180, 2, C_BLACK, C_RED);
      return;

    case STATE_SWAP_FAIL:
      tft.fillScreen(C_PRIMARY);
      drawCenteredText("FAILED",   75,  4, C_BLACK, C_GREEN);
      drawCenteredText(errorMsg,   125, 2, C_BLACK, C_GREEN);
      return;

    case STATE_ERROR:
      tft.fillScreen(C_PRIMARY);
      drawCenteredText("ERROR",  75,  4, C_BLACK, C_GREEN);
      drawCenteredText(errorMsg, 125, 2, C_BLACK, C_GREEN);
      return;

    case STATE_PROVISIONING:
      tft.fillScreen(C_BLACK);
      drawCenteredText("SETUP MODE", 15, 2, C_PRIMARY);
      tft.setTextSize(1);
      tft.setTextColor(C_WHITE, C_BLACK);
      
      // Draw QR Code
      {
        QRCode qrcode;
        uint8_t qrcodeData[qrcode_getBufferSize(3)];
        qrcode_initText(&qrcode, qrcodeData, 3, 0, "WIFI:T:WPA;S:Sweephy-Setup;P:12345678;;");
        
        int scale = 4; 
        int startX = (SCR_W - (qrcode.size * scale)) / 2;
        int startY = 70;
        
        tft.fillRect(startX - 5, startY - 5, (qrcode.size * scale) + 10, (qrcode.size * scale) + 10, C_WHITE);
        
        for (uint8_t y = 0; y < qrcode.size; y++) {
            for (uint8_t x = 0; x < qrcode.size; x++) {
                if (qrcode_getModule(&qrcode, x, y)) {
                    tft.fillRect(startX + (x * scale), startY + (y * scale), scale, scale, C_BLACK);
                }
            }
        }
      }
      
      drawCenteredText("192.168.4.1", 210, 2, C_YELLOW);
      return;

    case STATE_SWAPPING:
      tft.fillScreen(C_BLACK);
      drawCenteredText("SWAPPING...", 95,  3, C_RED);
      drawCenteredText(statusMessage,  140, 2, C_WHITE);
      return;

    default:
      break;
  }

  // ── Black background for remaining states ───────────────────────
  tft.fillScreen(C_BLACK);

  // WiFi indicator top-left
  tft.setTextSize(1);
  tft.setTextColor(C_DARKGREY, C_BLACK);
  tft.setCursor(4, 1);
  tft.print(WiFi.status() == WL_CONNECTED ? "WIFI:ON" : "WIFI:OFF");

  switch (currentState) {

    case STATE_CONNECTING:
      drawCenteredText("CONNECTING", 95,  2, C_WHITE);
      drawCenteredText("WIFI...",    125, 2, C_YELLOW);
      break;

    case STATE_UNPAIRED:
      drawCenteredText("DEVICE NOT PAIRED", 55, 2, C_RED);
      if (pairingCode.length() > 0) {
        drawCenteredText("PAIRING CODE:", 90,  2, C_WHITE);
        drawCenteredText(pairingCode,     118, 4, C_PRIMARY);
      } else {
        drawCenteredText("CONTACT SUPPORT", 110, 2, C_WHITE);
      }
      break;

    case STATE_READY:
      drawCenteredText("HBAR / USDC", PAIR_Y, 2, C_LIGHTGREY);
      drawCenteredText("$" + lastPriceStr, PRICE_Y, 4, C_WHITE);

      {
        float change = 0.0f;
        if (historyCount >= 2) {
          float oldest = priceHistory[0];
          float current = priceHistory[historyCount - 1];
          
          if (oldest > 0.0f) {
            change = ((current - oldest) / oldest) * 100.0f;
          }
        }
        String pctStr = (change >= 0 ? "+" : "") + String(change, 2) + "%";
        drawCenteredText(pctStr, PCT_Y, 2, change >= 0 ? C_RED : C_PRIMARY);
      }

      drawChart(10, CHART_Y, SCR_W - 20, CHART_H);

      tft.fillRect(0, BAR_Y, SCR_W, BAR_H, C_RED);
      drawCenteredText("HOLD TO SWAP", BAR_Y + 12, 2, C_WHITE, C_RED);
      break;

    case STATE_CONFIRM_SWAP:
      drawCenteredText("CONFIRM SWAP?",   CONF_TITLE_Y, 3, C_RED);
      drawCenteredText("$" + lastPriceStr, CONF_PRICE_Y, 3, C_WHITE);
      tft.drawRect(CONF_BAR_X, CONF_BAR_Y, CONF_BAR_W, CONF_BAR_H, C_WHITE);
      drawCenteredText("RELEASE TO CANCEL", CONF_HINT_Y, 2, C_PRIMARY);
      break;

    default:
      break;
  }
}

// =====================
// HMAC Helper
// =====================
String generateHMAC(const String& payload, const char* key) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  String sig = "";
  for (int i = 0; i < 32; i++) {
    if (hmacResult[i] < 16) sig += "0";
    sig += String(hmacResult[i], HEX);
  }
  return sig;
}

// =====================
// Network Logic
// =====================
void fetchStatus() {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<256> doc;
  doc["device_id"] = deviceIdStr;
  doc["signature"] = generateHMAC(deviceIdStr, deviceSecretStr.c_str());
  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(5000);

  HTTPClient http;
  http.begin(client, apiUrlStatus);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(body);
  if (code > 0) {
    StaticJsonDocument<1024> resp;
    if (!deserializeJson(resp, http.getString())) {
      if (resp.containsKey("is_paired"))    isPaired = resp["is_paired"];
      if (resp.containsKey("pairing_code")) {
        const char* c = resp["pairing_code"];
        if (c) pairingCode = String(c);
      }
      if (!isPaired) {
        currentState = STATE_UNPAIRED;
      } else if (currentState == STATE_UNPAIRED || currentState == STATE_CONNECTING) {
        currentState = STATE_READY;
        fetchPrice();
      }
    }
  }
  http.end();
}

void fetchPrice() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(5000);

  HTTPClient http;
  http.begin(client, apiUrlPrice);

  if (http.GET() > 0) {
    StaticJsonDocument<512> resp;
    if (!deserializeJson(resp, http.getString())) {
      if (resp.containsKey("price")) {
        String p = String((const char*)resp["price"]);
        if (p.length() > 0 && p != "null") {
          prevPrice    = currentPrice;
          lastPriceStr = p;
          currentPrice = p.toFloat();

          if (historyCount < MAX_HISTORY) {
            priceHistory[historyCount++] = currentPrice;
          } else {
            for (int i = 0; i < MAX_HISTORY - 1; i++)
              priceHistory[i] = priceHistory[i + 1];
            priceHistory[MAX_HISTORY - 1] = currentPrice;
          }
        }
      }
    }
  }
  http.end();
}

void updateStatus(String msg) {
  statusMessage = msg;
  // Clear previous text area (y=140, h=16)
  tft.fillRect(0, 140, SCR_W, 20, C_BLACK);
  drawCenteredText(statusMessage, 140, 2, C_WHITE);
}

bool fetchLatestIntent(String &intentStatus, String &txId, String &note, String &amountReceived) {
  intentStatus = "";
  txId = "";
  note = "";
  amountReceived = "";

  if (WiFi.status() != WL_CONNECTED) return false;

  StaticJsonDocument<256> doc;
  doc["device_id"] = deviceIdStr;
  doc["signature"] = generateHMAC(deviceIdStr, deviceSecretStr.c_str());
  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(15000);

  HTTPClient http;
  http.begin(client, apiUrlStatus);
  http.addHeader("Content-Type", "application/json");

  const int code = http.POST(body);
  if (code <= 0) {
    http.end();
    return false;
  }

  const String respBody = http.getString();
  http.end();

  StaticJsonDocument<4096> resp;
  if (deserializeJson(resp, respBody)) return false;

  if (!resp.containsKey("intent") || resp["intent"].isNull()) return true;

  JsonObject intent = resp["intent"].as<JsonObject>();
  if (intent.containsKey("status") && !intent["status"].isNull()) intentStatus = String((const char*)intent["status"]);
  if (intent.containsKey("tx_id") && !intent["tx_id"].isNull()) txId = String((const char*)intent["tx_id"]);
  if (intent.containsKey("note") && !intent["note"].isNull()) note = String((const char*)intent["note"]);
  if (intent.containsKey("amount_received") && !intent["amount_received"].isNull()) {
    if (intent["amount_received"].is<const char*>()) {
      amountReceived = String((const char*)intent["amount_received"]);
    } else if (intent["amount_received"].is<double>()) {
      amountReceived = String(intent["amount_received"].as<double>(), 6);
    } else if (intent["amount_received"].is<long long>()) {
      amountReceived = String((long long)intent["amount_received"].as<long long>());
    }
  }

  return true;
}

void performSwap() {
    // 1. Show Loading Screen IMMEDIATELY
    currentState = STATE_SWAPPING;
    statusMessage = "Connecting...";
    updateDisplay();
    delay(100); 
    
    // Construct Payload
    StaticJsonDocument<256> payloadDoc;
    payloadDoc["action"] = "swap";
    payloadDoc["pair"] = "HBAR/USDC";
    payloadDoc["timestamp"] = millis();

    String payload;
    serializeJson(payloadDoc, payload);

    String signature = generateHMAC(payload, deviceSecretStr.c_str());

    StaticJsonDocument<1024> requestDoc;
    requestDoc["device_id"] = deviceIdStr;
    requestDoc["payload"] = payload;
    requestDoc["signature"] = signature;

    String requestBody;
    serializeJson(requestDoc, requestBody);

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(15000); 
    
    HTTPClient http;
    http.begin(client, apiUrlIntent);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Accept", "application/json");
    
    // Send Request
    updateStatus("Sending Request...");
    int httpResponseCode = http.POST(requestBody);
    
    Serial.print("HTTP Code: "); Serial.println(httpResponseCode);

    if (httpResponseCode == 200) {
      const String respBody = http.getString();
      String intentId = "";
      StaticJsonDocument<1024> resp;
      if (!deserializeJson(resp, respBody)) {
        if (resp.containsKey("intent_id")) {
          intentId = String((const char*)resp["intent_id"]);
        }
      }

      updateStatus("Ready for swap..");
      unsigned long pollStart = millis();
      bool gotFinal = false;
      String lastStatus = "";
      while (millis() - pollStart < 240000) {
        String s, tx, note, amt;
        if (fetchLatestIntent(s, tx, note, amt)) {
          if (s.length() > 0 && s != lastStatus) lastStatus = s;

          if (s == "pending") {
            updateStatus("Ready for swap..");
          } else if (s == "processing") {
            const bool transferOk = (note.indexOf("Transfer OK") >= 0) || (note.indexOf("Transfer Verified") >= 0) ||
              (note.indexOf("Recovered") >= 0);
            updateStatus(transferOk ? "Execute swap... (1/2)" : "Execute swap... (0/2)");
          }

          if (s == "completed") {
            currentState = STATE_SWAP_SUCCESS;
            errorMsg = "";
            swapResultAmount = amt.length() ? amt : "OK";
            gotFinal = true;
            break;
          }

          if (s == "failed") {
            currentState = STATE_SWAP_FAIL;
            errorMsg = note.length() ? note : "FAILED";
            if (errorMsg.length() > 18) errorMsg = errorMsg.substring(0, 18) + "..";
            gotFinal = true;
            break;
          }
        }
        delay(1200);
      }

      if (!gotFinal) {
        currentState = STATE_SWAP_FAIL;
        errorMsg = intentId.length() ? "TIMEOUT" : "NO RESULT";
      }
    } else {
      String response = http.getString();
      currentState = STATE_SWAP_FAIL;
      StaticJsonDocument<512> errDoc;
      DeserializationError error = deserializeJson(errDoc, response);
      if (!error && errDoc.containsKey("error")) {
        errorMsg = String((const char*)errDoc["error"]);
        if (errorMsg.length() > 18) errorMsg = errorMsg.substring(0, 18) + "..";
      } else {
        errorMsg = "ERR:" + String(httpResponseCode);
      }
    }
    
    http.end();
    updateDisplay();
    stateStartTime = millis(); 
}

// =====================
// Web Server Handlers
// =====================
void handleRoot() {
  String html = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'><style>";
  html += "body{font-family:sans-serif;background:#1a1a1a;color:#fff;padding:20px;display:flex;flex-direction:column;align-items:center;}";
  html += "input{width:100%;padding:10px;margin:10px 0;border-radius:5px;border:none;}";
  html += "button{width:100%;padding:15px;background:#00DF81;color:#000;border:none;border-radius:5px;font-weight:bold;}";
  html += "</style></head><body>";
  html += "<h2>Sweephy Setup</h2>";
  const String existingDeviceId = preferences.getString("device_id", "");
  const String existingDeviceSecret = preferences.getString("device_secret", "");
  const bool needsDeviceCreds = existingDeviceId.length() == 0 || existingDeviceSecret.length() == 0;
  html += "<form action='/save' method='POST'>";
  if (needsDeviceCreds) {
    html += "<p style='max-width:420px;opacity:.9'>Step 1: Set device credentials (required for signing requests).</p>";
    html += "<input type='text' name='device_id' placeholder='Device ID' required>";
    html += "<input type='password' name='device_secret' placeholder='Device Secret' required>";
    html += "<button type='submit'>Save & Restart</button>";
  } else {
    html += "<p style='max-width:420px;opacity:.9'>Step 2: Configure WiFi.</p>";
    html += "<input type='text' name='ssid' placeholder='WiFi SSID' required>";
    html += "<input type='password' name='password' placeholder='WiFi Password' required>";
    html += "<button type='submit'>Save & Connect</button>";
  }
  html += "</form>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleSave() {
  const String existingDeviceId = preferences.getString("device_id", "");
  const String existingDeviceSecret = preferences.getString("device_secret", "");
  const bool needsDeviceCreds = existingDeviceId.length() == 0 || existingDeviceSecret.length() == 0;

  if (needsDeviceCreds) {
    if (server.hasArg("device_id") && server.hasArg("device_secret")) {
      const String newDeviceId = server.arg("device_id");
      const String newDeviceSecret = server.arg("device_secret");

      if (newDeviceId.length() == 0 || newDeviceSecret.length() == 0) {
        server.send(400, "text/plain", "Missing fields");
        return;
      }

      preferences.putString("device_id", newDeviceId);
      preferences.putString("device_secret", newDeviceSecret);

      server.send(200, "text/html", "<html><body><h2>Saved! Restarting...</h2></body></html>");
      delay(2000);
      ESP.restart();
    } else {
      server.send(400, "text/plain", "Missing fields");
    }
    return;
  }

  if (server.hasArg("ssid") && server.hasArg("password")) {
    String newSSID = server.arg("ssid");
    String newPass = server.arg("password");

    preferences.putString("ssid", newSSID);
    preferences.putString("password", newPass);

    server.send(200, "text/html", "<html><body><h2>Saved! Restarting...</h2></body></html>");
    delay(2000);
    ESP.restart();
  } else {
    server.send(400, "text/plain", "Missing fields");
  }
}

void enterProvisioningMode() {
    currentState = STATE_PROVISIONING;
    updateDisplay();
    
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP);
    WiFi.softAP("Sweephy-Setup", "12345678");
    
    server.on("/", HTTP_GET, handleRoot);
    server.on("/save", HTTP_POST, handleSave);
    server.begin();
}

// =====================
// Setup & Loop
// =====================
void showBootLogo() {
  tft.fillScreen(C_BLACK);
  drawCenteredText("SWEEPHY",         85,  4, C_RED);
  drawCenteredText("Hardware Wallet", 135, 2, C_WHITE);
  delay(1500);
}

void setup() {
  Serial.begin(115200);
  pinMode(BTN_PIN, INPUT_PULLUP);
  
  // Init Preferences
  preferences.begin("sweephy", false);
  ssid = preferences.getString("ssid", "");
  password = preferences.getString("password", "");
  deviceIdStr = preferences.getString("device_id", "");
  deviceSecretStr = preferences.getString("device_secret", "");

  // ST7789 init — width=240, height=320 (fisik portrait), rotation akan set landscape
  tft.init(240, 320);
  tft.setRotation(1);       // Landscape 320x240
  tft.invertDisplay(true);  // Invert display colors (fixes Pink/Magenta issue)
  tft.fillScreen(C_BLACK);

  showBootLogo();

  // Check for Provisioning Mode
  if (ssid == "" || password == "" || deviceIdStr == "" || deviceSecretStr == "") {
      enterProvisioningMode();
      return; // Exit setup, loop() will handle the rest
  }

  currentState = STATE_CONNECTING;
  updateDisplay();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  // Convert String to const char*
  WiFi.begin(ssid.c_str(), password.c_str());

  for (int retry = 0; retry < 40 && WiFi.status() != WL_CONNECTED; retry++) {
    // Check button to enter Setup Mode
    if (digitalRead(BTN_PIN) == LOW) {
        enterProvisioningMode();
        return;
    }

    tft.fillRect(0, 85, SCR_W, 95, C_BLACK);
    drawCenteredText("CONNECTING...", 95,  2, C_WHITE);
    String dots(retry % 4 + 1, '.');
    drawCenteredText(dots,        125, 2, C_YELLOW);
    tft.fillRect(0, BAR_Y, SCR_W, BAR_H, C_RED);
    drawCenteredText("HOLD TO SETUP WIFI", BAR_Y + 12, 2, C_WHITE, C_RED);
    delay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    fetchStatus();
  } else {
    // If connection fails, maybe we should offer to reset credentials?
    // For now, stick to original logic (STATE_ERROR) but maybe enhance it later.
    errorMsg     = "WIFI FAIL";
    currentState = STATE_ERROR;
  }
  updateDisplay();
}

void loop() {
  if (currentState == STATE_PROVISIONING) {
      server.handleClient();
      delay(10);
      return;
  }

  // ── Robust Reconnect Logic ──────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    currentState = STATE_CONNECTING;
    tft.fillScreen(C_BLACK);
    drawCenteredText("WIFI LOST", 85, 2, C_RED);
    drawCenteredText("Reconnecting", 115, 2, C_WHITE);
    tft.fillRect(0, BAR_Y, SCR_W, BAR_H, C_RED);
    drawCenteredText("HOLD BTN TO SETUP", BAR_Y + 12, 2, C_WHITE, C_RED);
    
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 10) {
       // Check button to enter Setup Mode
       if (digitalRead(BTN_PIN) == LOW) {
           enterProvisioningMode();
           return;
       }

       // Only disconnect/reconnect if we really need to, otherwise just wait
       if (retries == 0) WiFi.reconnect();
       
       String dots = "";
       for(int i=0; i<=retries%3; i++) dots += ".";
       tft.fillRect(0, 140, SCR_W, 20, C_BLACK);
       drawCenteredText(dots, 140, 2, C_PRIMARY);
       
       retries++;
       // Smaller delays to check button more frequently
       for(int d=0; d<20; d++) {
           if (digitalRead(BTN_PIN) == LOW) {
               enterProvisioningMode();
               return;
           }
           delay(100);
       }
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        currentState = STATE_READY;
        fetchStatus(); // Refresh status after reconnect
        updateDisplay();
    } else {
        // Hard reset attempt
        WiFi.disconnect(true);
        WiFi.begin(ssid.c_str(), password.c_str());
        delay(5000);
    }
    return;
  }

  // ── Button handling ──────────────────────────────────────────────
  int reading = digitalRead(BTN_PIN);

  if (reading == LOW && lastBtnState == HIGH) {
    // Pressed
    // Debounce: ignore if last press was very recent (e.g. < 500ms)
    if (millis() - btnPressStartTime > 500) {
        isBtnPressed     = true;
        btnPressStartTime = millis();
        if (currentState == STATE_READY) {
          currentState = STATE_CONFIRM_SWAP;
          updateDisplay();
        }
    }
  }
  else if (reading == LOW && isBtnPressed && currentState == STATE_CONFIRM_SWAP) {
    // Held — update progress bar only (no full redraw)
    unsigned long held = millis() - btnPressStartTime;
    int fill = map(held, 0, LONG_PRESS_TIME, 0, CONF_BAR_W - 4);
    fill = constrain(fill, 0, CONF_BAR_W - 4);
    tft.fillRect(CONF_BAR_X + 2, CONF_BAR_Y + 2, fill, CONF_BAR_H - 4, C_WHITE);
    
    // Add text "Processing..." when bar is full before performing swap
    if (held >= LONG_PRESS_TIME - 100 && held < LONG_PRESS_TIME) {
       drawCenteredText("RELEASE TO SWAP", CONF_HINT_Y, 2, C_RED);
    }

    if (held >= LONG_PRESS_TIME) {
      isBtnPressed = false;
      performSwap();
      while (digitalRead(BTN_PIN) == LOW) delay(10);
    }
  }
  else if (reading == HIGH && lastBtnState == LOW) {
    // Released
    isBtnPressed = false;
    if (currentState == STATE_CONFIRM_SWAP) {
      currentState = STATE_READY;
      updateDisplay();
    }
  }

  lastBtnState = reading;

  // ── Periodic tasks ───────────────────────────────────────────────
  unsigned long now  = millis();
  bool idle = (currentState != STATE_SWAPPING && currentState != STATE_CONFIRM_SWAP);

  if (idle && (currentState == STATE_READY || currentState == STATE_UNPAIRED) &&
      now - lastHeartbeatTime > heartbeatInterval) {
    lastHeartbeatTime = now;
    fetchStatus();
    updateDisplay();
  }

  if (idle && currentState == STATE_READY &&
      now - lastPriceTime > priceInterval) {
    lastPriceTime = now;
    fetchPrice();
    updateDisplay();
  }

  if ((currentState == STATE_SWAP_SUCCESS || currentState == STATE_SWAP_FAIL) &&
      now - stateStartTime > STATE_TIMEOUT) {
    currentState = STATE_READY;
    updateDisplay();
  }

  delay(10);
}

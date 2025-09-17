// Nordic UART Service UUIDs
const UART_SERVICE_UUID           = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Write TO device
const UART_TX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Notify FROM device

let bleDevice;
let rxCharacteristic; // write target
let txCharacteristic; // notify source

// Connect to any NUS-compatible device
async function connectButtonPressed() {
  try {
    console.log("Requesting Bluetooth Device...");
    bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [UART_SERVICE_UUID]
    });

    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

    console.log("Connecting to GATT Server...");
    const server = await bleDevice.gatt.connect();

    console.log("Getting UART service...");
    const service = await server.getPrimaryService(UART_SERVICE_UUID);

    console.log("Getting RX (write) characteristic...");
    rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

    console.log("Getting TX (notify) characteristic...");
    txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener("characteristicvaluechanged", onTxCharacteristicValueChanged);

    console.log("✅ Connected to", bleDevice.name || "(unnamed)");
  } catch (error) {
    console.error("Error during Bluetooth setup:", error);
  }
}

// Send data to Arduino/ESP32
async function sendUART(data) {
  if (!rxCharacteristic) {
    console.warn("Cannot send data, device is not connected.");
    return;
  }
  try {
    const encoded = new TextEncoder().encode(data);
    await rxCharacteristic.writeValue(encoded);
    console.log("Sent:", data);
  } catch (error) {
    console.error("Error sending data:", error);
  }
}

// Handle incoming data from Arduino/ESP32
function onTxCharacteristicValueChanged(event) {
  const value = new TextDecoder().decode(event.target.value);
  console.log("Received:", value);
}

// Disconnect
function disconnectButtonPressed() {
  if (bleDevice && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
    console.log("🔌 Disconnected");
  }
}

// Handle disconnection
function onDisconnected(event) {
  console.log(`Device ${event.target.name} disconnected`);
  rxCharacteristic = null;
  txCharacteristic = null;
}

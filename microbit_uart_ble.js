const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let uBitDevice;
let rxCharacteristic;

// Connect to the Bluetooth device
async function connectButtonPressed() {
    try {
        console.log("Requesting Bluetooth Device...");
        uBitDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: "Calliope mini" },
                { namePrefix: "BBC micro:bit" }
              ],
            optionalServices: [UART_SERVICE_UUID]
        });

        uBitDevice.addEventListener('gattserverdisconnected', onDisconnected);

        console.log("Connecting to GATT Server...");
        const server = await uBitDevice.gatt.connect();

        console.log("Getting Service...");
        const service = await server.getPrimaryService(UART_SERVICE_UUID);

        console.log("Getting RX Characteristic...");
        rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

        console.log("Getting TX Characteristic...");
        const txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
        txCharacteristic.startNotifications();
        txCharacteristic.addEventListener("characteristicvaluechanged", onTxCharacteristicValueChanged);

        document.getElementById('robotShow').classList.add("robotShow_connected");
    } catch (error) {
        console.log("Error during Bluetooth setup:", error);
    }
}

// Disconnect from the Bluetooth device
function disconnectButtonPressed() {
    if (uBitDevice && uBitDevice.gatt.connected) {
        uBitDevice.gatt.disconnect();
        console.log("Disconnected");
    }
}

// Send data to the micro:bit via UART
async function sendUART(num) {
    if (!rxCharacteristic) {
       // console.log("Cannot send data, device is not connected.");
        return;
    }
    
    let encoder = new TextEncoder();
    let encodedData = encoder.encode(num + "\n");
    
    queueGattOperation(() => rxCharacteristic.writeValue(encodedData)
        .then(() => console.log("Data sent"))
        .catch(error => console.error('Error sending data:', error)));
}

// Queue operations to handle GATT operations one at a time
let queue = Promise.resolve();
function queueGattOperation(operation) {
    queue = queue.then(operation, operation);
    return queue;
}

// Handle received data from the micro:bit
function onTxCharacteristicValueChanged(event) {
    let receivedData = new Uint8Array(event.target.value.buffer);
    const receivedString = String.fromCharCode(...receivedData);
    console.log("Received:", receivedString);
    data_received(receivedString); // Ensure this function is defined or remove this line if not needed
}

// Handle device disconnection
function onDisconnected(event) {
    let device = event.target;
    console.log(`Device ${device.name} is disconnected.`);
    document.getElementById('robotShow').classList.remove("robotShow_connected");
    rxCharacteristic = null; // Clear the characteristic on disconnection
}

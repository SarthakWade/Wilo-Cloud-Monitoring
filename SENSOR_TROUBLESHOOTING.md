# MPU6050 Sensor Troubleshooting Guide

This guide helps diagnose and resolve common issues with connecting the MPU6050 sensor to a Raspberry Pi.

## 1. Hardware Connection Verification

### Required Connections
Ensure the following connections between the MPU6050 and Raspberry Pi:

| MPU6050 Pin | Raspberry Pi Pin | Physical Pin Number |
|-------------|------------------|---------------------|
| VCC (VDD)   | 3.3V             | Pin 1               |
| GND         | Ground           | Pin 6               |
| SCL         | GPIO 3 (SCL)     | Pin 5               |
| SDA         | GPIO 2 (SDA)     | Pin 3               |

### Connection Checklist
- [ ] MPU6050 VCC connected to Raspberry Pi 3.3V (NOT 5V)
- [ ] MPU6050 GND connected to Raspberry Pi Ground
- [ ] MPU6050 SCL connected to Raspberry Pi GPIO 3 (Pin 5)
- [ ] MPU6050 SDA connected to Raspberry Pi GPIO 2 (Pin 3)
- [ ] All connections are secure and not loose
- [ ] No short circuits between adjacent pins

## 2. Software Configuration Verification

### Check I2C Interface Status
```bash
# Check if I2C is enabled
raspi-config nonint get_i2c

# Should return 0 if enabled
```

### Verify I2C Modules are Loaded
```bash
lsmod | grep i2c
```

Expected output should include:
- i2c_dev
- i2c_bcm2835

### Check I2C Configuration in config.txt
```bash
cat /boot/firmware/config.txt | grep -i i2c
```

Should show:
```
dtparam=i2c_arm=on
```

## 3. Diagnostic Commands

### Check Available I2C Buses
```bash
ls /dev/i2c-*
```

Should show at least:
```
/dev/i2c-1
```

### Scan I2C Bus for Devices (without sudo)
```bash
i2cdetect -y 1
```

### Scan I2C Bus for Devices (with sudo)
```bash
sudo i2cdetect -y 1
```

Expected output should show the MPU6050 at address 0x68:
```
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:                         -- -- -- -- -- -- -- -- 
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
40: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
70: -- -- -- -- -- -- -- 68
```

## 4. Common Issues and Solutions

### Issue 1: No Devices Detected on I2C Bus
**Symptoms**: `i2cdetect` shows no devices

**Possible Causes and Solutions**:
1. **Incorrect Wiring**
   - Double-check all connections
   - Ensure VCC is connected to 3.3V, not 5V
   - Verify SDA and SCL are connected to the correct pins

2. **Loose Connections**
   - Re-seat all jumper wires
   - Use a breadboard with secure connections
   - Check for broken wires

3. **Wrong Voltage**
   - MPU6050 requires 3.3V, not 5V
   - Connecting to 5V may damage the sensor

4. **Damaged Sensor**
   - Try a different MPU6050 sensor
   - Test the sensor with an Arduino if available

5. **I2C Not Enabled**
   - Enable I2C using `sudo raspi-config`
   - Navigate to Interface Options → I2C → Enable

### Issue 2: I/O Error When Connecting
**Symptoms**: `[Errno 5] Input/output error`

**Possible Causes and Solutions**:
1. **Sensor Not Properly Powered**
   - Verify 3.3V connection to VCC pin
   - Check GND connection

2. **Short Circuit**
   - Check for shorts between adjacent pins
   - Verify no conductive materials are touching the sensor

3. **Incorrect I2C Address**
   - Some MPU6050 clones use address 0x69 instead of 0x68
   - Try scanning with different addresses

### Issue 3: Pull-up Resistor Issues
**Symptoms**: I2C lines stuck low

**Solution**:
- Raspberry Pi has built-in pull-up resistors (1.8kΩ)
- If using a long cable, external 4.7kΩ pull-up resistors may be needed
- Connect 4.7kΩ resistors between SDA and 3.3V, and SCL and 3.3V

## 5. Advanced Troubleshooting

### Check System Logs
```bash
dmesg | grep -i i2c
```

### Test with Different I2C Bus
Some Raspberry Pi models have multiple I2C buses:
```bash
ls /dev/i2c-*
sudo i2cdetect -y 0  # Try bus 0
sudo i2cdetect -y 1  # Try bus 1
sudo i2cdetect -y 2  # Try bus 2 (if available)
```

### Verify Sensor with Arduino
If possible, test the MPU6050 with an Arduino to verify it's functioning:
- Connect to Arduino using the same wiring
- Use Arduino I2C scanner sketch
- This confirms if the issue is with Raspberry Pi or the sensor

## 6. Backend Code Configuration

The backend code requires a working MPU6050 sensor. If you need to test the system without a physical sensor, you can temporarily modify the code to use simulated data by:

1. Adding back the simulation logic in `sensor_service.py` and `sensor.py`
2. Or using a virtual I2C device for testing

However, for production use, a physical sensor connection is required.

## 7. Contact Support

If all troubleshooting steps fail:

1. Verify you have a genuine MPU6050 sensor
2. Check the sensor's datasheet for specific requirements
3. Contact the sensor manufacturer for support
4. Consider using a different sensor model that's known to work with Raspberry Pi
import smbus
import time
from typing import Optional, Tuple

class MPU6050:
    # MPU6050 Registers
    PWR_MGMT_1 = 0x6B
    SMPLRT_DIV = 0x19
    CONFIG = 0x1A
    GYRO_CONFIG = 0x1B
    ACCEL_CONFIG = 0x1C
    ACCEL_XOUT_H = 0x3B
    ACCEL_YOUT_H = 0x3D
    ACCEL_ZOUT_H = 0x3F
    TEMP_OUT_H = 0x41
    GYRO_XOUT_H = 0x43
    GYRO_YOUT_H = 0x45
    GYRO_ZOUT_H = 0x47
    
    # Sensitivity settings
    ACCEL_SENSITIVITY = 16384.0  # for +-2g
    GYRO_SENSITIVITY = 131.0     # for +-250 degrees/second
    
    def __init__(self, bus_number: int = 1, address: int = 0x68):
        """
        Initialize MPU6050 sensor.
        
        Args:
            bus_number: I2C bus number (default: 1 for Raspberry Pi)
            address: I2C address of MPU6050 (default: 0x68)
        """
        self.bus_number = bus_number
        self.address = address
        self.bus: Optional[smbus.SMBus] = None
        self.connected = False
        
    def connect(self) -> bool:
        """
        Connect to the MPU6050 sensor.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            self.bus = smbus.SMBus(self.bus_number)
            # Wake up the MPU6050 (0x00 to wake, 0x40 to sleep)
            self.bus.write_byte_data(self.address, self.PWR_MGMT_1, 0x00)
            
            # Configure for high-speed operation
            # Set sample rate divider for 800 Hz (if possible)
            # Sample Rate = Gyroscope Output Rate / (1 + SMPLRT_DIV)
            self.bus.write_byte_data(self.address, self.SMPLRT_DIV, 0x00)
            
            # Set DLPF (Digital Low Pass Filter) to minimum delay
            # 0x00 = 260 Hz bandwidth, 0ms delay
            self.bus.write_byte_data(self.address, self.CONFIG, 0x00)
            
            # Set accelerometer range to +-2g for highest sensitivity
            self.bus.write_byte_data(self.address, self.ACCEL_CONFIG, 0x00)
            
            # Set gyroscope range to +-250 deg/s
            self.bus.write_byte_data(self.address, self.GYRO_CONFIG, 0x00)
            
            self.connected = True
            return True
        except Exception as e:
            print(f"Failed to connect to MPU6050: {e}")
            self.connected = False
            return False
    
    def reconnect(self) -> bool:
        """
        Attempt to reconnect to the MPU6050 sensor.
        
        Returns:
            bool: True if reconnection successful, False otherwise
        """
        print("Attempting to reconnect to MPU6050...")
        # Close existing connection if any
        if self.bus:
            try:
                self.bus.close()
            except:
                pass
            self.bus = None
            
        # Wait a bit before reconnecting
        time.sleep(0.1)
        return self.connect()
    
    def read_word(self, reg: int) -> int:
        """
        Read two bytes from a register and combine them.
        
        Args:
            reg: Register address
            
        Returns:
            int: 16-bit signed value
        """
        if not self.bus:
            raise ConnectionError("Not connected to MPU6050")
            
        h = self.bus.read_byte_data(self.address, reg)
        l = self.bus.read_byte_data(self.address, reg + 1)
        value = (h << 8) + l
        # Convert to signed 16-bit integer
        return value - 65536 if value >= 32768 else value
    
    def read_acceleration(self) -> Tuple[float, float, float]:
        """
        Read acceleration data from MPU6050.
        
        Returns:
            Tuple[float, float, float]: (x, y, z) acceleration in g
        """
        if not self.connected or not self.bus:
            raise ConnectionError("Not connected to MPU6050")
            
        try:
            accel_x = self.read_word(self.ACCEL_XOUT_H) / self.ACCEL_SENSITIVITY
            accel_y = self.read_word(self.ACCEL_YOUT_H) / self.ACCEL_SENSITIVITY
            accel_z = self.read_word(self.ACCEL_ZOUT_H) / self.ACCEL_SENSITIVITY
            return (accel_x, accel_y, accel_z)
        except Exception as e:
            print(f"Error reading acceleration data: {e}")
            raise
    
    def read_gyro(self) -> Tuple[float, float, float]:
        """
        Read gyroscope data from MPU6050.
        
        Returns:
            Tuple[float, float, float]: (x, y, z) angular velocity in degrees/sec
        """
        if not self.connected or not self.bus:
            raise ConnectionError("Not connected to MPU6050")
            
        try:
            gyro_x = self.read_word(self.GYRO_XOUT_H) / self.GYRO_SENSITIVITY
            gyro_y = self.read_word(self.GYRO_YOUT_H) / self.GYRO_SENSITIVITY
            gyro_z = self.read_word(self.GYRO_ZOUT_H) / self.GYRO_SENSITIVITY
            return (gyro_x, gyro_y, gyro_z)
        except Exception as e:
            print(f"Error reading gyroscope data: {e}")
            raise
    
    def read_temperature(self) -> float:
        """
        Read temperature data from MPU6050.
        
        Returns:
            float: Temperature in Celsius
        """
        if not self.connected or not self.bus:
            raise ConnectionError("Not connected to MPU6050")
            
        try:
            temp = self.read_word(self.TEMP_OUT_H)
            # Convert to Celsius (from MPU6050 datasheet)
            return temp / 340.0 + 36.53
        except Exception as e:
            print(f"Error reading temperature data: {e}")
            raise
    
    def close(self):
        """
        Close the I2C connection.
        """
        if self.bus:
            try:
                self.bus.close()
            except:
                pass
            self.bus = None
        self.connected = False
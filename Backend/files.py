import time
import csv
import os
import json
import requests
from datetime import datetime
from typing import List, Tuple
import pandas as pd
from mpu import MPU6050
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class HighFrequencyDataCollector:
    def __init__(self, target_hz: int = 800, batch_size: int = 100):
        """
        Initialize the high-frequency data collector.
        
        Args:
            target_hz: Target sampling frequency in Hz
            batch_size: Number of samples to collect before writing to file
        """
        self.target_hz = target_hz
        self.batch_size = batch_size
        self.sample_interval = 1.0 / target_hz
        self.mpu = MPU6050()
        self.simulation_mode = False
        self.sample_count = 0
        self.start_time = None
        self.cloud_endpoint = os.getenv('CLOUD_ENDPOINT')
        self.api_key = os.getenv('API_KEY')
        
    def initialize_sensor(self) -> bool:
        """
        Initialize and connect to the MPU6050 sensor.
        
        Returns:
            bool: True if successful, False otherwise
        """
        print("Initializing MPU6050 sensor...")
        if self.mpu.connect():
            print("MPU6050 connected successfully!")
            return True
        else:
            print("Failed to connect to MPU6050. Switching to simulation mode.")
            self.simulation_mode = True
            return False
    
    def simulate_sensor_data(self) -> float:
        """
        Simulate sensor data for development without hardware.
        
        Returns:
            float: Simulated acceleration value
        """
        # Simple simulation with sine wave patterns
        t = time.time() - self.start_time if self.start_time else time.time()
        # Generate a value that looks like acceleration data
        accel = 16384 + 100 * (1 + __import__('math').sin(t * 50))
        return accel
    
    def collect_sample(self) -> Tuple[float, float]:
        """
        Collect a single sample from the sensor or simulation.
        
        Returns:
            Tuple[float, float]: (timestamp, acceleration) data
        """
        timestamp = time.time()
        
        if self.simulation_mode:
            acceleration = self.simulate_sensor_data()
        else:
            try:
                # Read only Z-axis acceleration for simplicity and speed
                _, _, z = self.mpu.read_acceleration()
                # Convert to integer to match the requested format
                acceleration = int(z * 16384)  # Scale to match example values
            except Exception as e:
                print(f"Error reading sensor data: {e}")
                # Fallback to simulation if sensor fails
                acceleration = self.simulate_sensor_data()
                
        return (timestamp, acceleration)
    
    def collect_batch(self) -> List[Tuple[float, float]]:
        """
        Collect a batch of samples at the target frequency.
        
        Returns:
            List[Tuple[float, float]]: List of (timestamp, acceleration) samples
        """
        batch_data = []
        next_sample_time = time.time()
        
        for i in range(self.batch_size):
            # Collect sample
            sample = self.collect_sample()
            batch_data.append(sample)
            self.sample_count += 1
            
            # Calculate next sample time
            next_sample_time += self.sample_interval
            
            # Sleep until next sample time if needed
            current_time = time.time()
            sleep_time = next_sample_time - current_time
            
            # Only sleep if we have time to spare
            if sleep_time > 0:
                # Use shorter sleep for better precision
                if sleep_time > 0.0001:  # 0.1ms
                    time.sleep(sleep_time * 0.95)  # Sleep for 95% of the remaining time
                # Busy wait for the last bit for better precision
                while time.time() < next_sample_time:
                    pass
            elif sleep_time < -0.001:  # More than 1ms behind
                print(f"Warning: Behind schedule by {-sleep_time*1000:.2f}ms")
                
        return batch_data
    
    def format_timestamp(self, timestamp: float) -> str:
        """
        Format timestamp to match the requested format.
        
        Args:
            timestamp: Unix timestamp
            
        Returns:
            str: Formatted timestamp string
        """
        datetime_object = datetime.fromtimestamp(timestamp)
        # Format as "YYYY-MMM-DDTHH-MM-SS" (e.g., "2023-Aug-28T23-28-15")
        formatted_time = datetime_object.strftime("%Y-%b-%dT%H-%M-%S")
        return formatted_time
    
    def save_batch_to_csv(self, batch_data: List[Tuple[float, float]], 
                         filename: str):
        """
        Save a batch of data to a CSV file in the requested format.
        
        Args:
            batch_data: List of (timestamp, acceleration) samples
            filename: Name of the CSV file to save to
        """
        # Create readings directory if it doesn't exist
        os.makedirs("readings", exist_ok=True)
        
        filepath = os.path.join("readings", filename)
        
        # Check if file exists to determine if we need headers
        file_exists = os.path.isfile(filepath)
        
        with open(filepath, 'a', newline='') as csvfile:
            writer = csv.writer(csvfile)
            
            # Write header if file is new
            if not file_exists:
                writer.writerow(['timestamp', 'acceleration'])
            
            # Write data rows with formatted timestamps
            for timestamp, acceleration in batch_data:
                formatted_timestamp = self.format_timestamp(timestamp)
                writer.writerow([formatted_timestamp, int(acceleration)])
    
    def upload_to_cloud(self, filepath: str) -> bool:
        """
        Upload a CSV file to the cloud service.
        
        Args:
            filepath: Path to the CSV file to upload
            
        Returns:
            bool: True if upload successful, False otherwise
        """
        if not self.cloud_endpoint or not self.api_key:
            print("Cloud endpoint or API key not configured. Skipping upload.")
            return False
            
        try:
            # Prepare headers
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'text/csv'
            }
            
            # Read the file
            with open(filepath, 'rb') as f:
                # Send the file
                response = requests.post(
                    self.cloud_endpoint,
                    headers=headers,
                    data=f
                )
                
            if response.status_code == 200:
                print(f"Successfully uploaded {filepath} to cloud")
                return True
            else:
                print(f"Failed to upload {filepath} to cloud. Status code: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"Error uploading {filepath} to cloud: {e}")
            return False
    
    def collect_continuous(self, duration_seconds: int = 10):
        """
        Collect data continuously for a specified duration.
        
        Args:
            duration_seconds: How long to collect data (in seconds)
        """
        if not self.simulation_mode:
            if not self.mpu.connected:
                print("Sensor not connected. Cannot collect data.")
                return
        
        print(f"Starting data collection at {self.target_hz} Hz for {duration_seconds} seconds...")
        print(f"Batch size: {self.batch_size} samples")
        
        self.start_time = time.time()
        end_time = self.start_time + duration_seconds
        file_counter = 0
        
        # Create a new file for this collection session
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"sensor_data_{timestamp_str}.csv"
        
        samples_collected = 0
        batches_collected = 0
        
        try:
            while time.time() < end_time:
                # Collect a batch of data
                batch_start = time.time()
                batch_data = self.collect_batch()
                batch_end = time.time()
                
                # Save batch to file
                self.save_batch_to_csv(batch_data, filename)
                
                samples_collected += len(batch_data)
                batches_collected += 1
                
                # Calculate actual sampling rate
                actual_hz = len(batch_data) / (batch_end - batch_start)
                overall_hz = samples_collected / (time.time() - self.start_time) if (time.time() - self.start_time) > 0 else 0
                
                print(f"Batch {batches_collected}: {len(batch_data)} samples @ {actual_hz:.1f} Hz (Overall: {overall_hz:.1f} Hz)")
                
                # Brief pause between batches to prevent overheating
                time.sleep(0.001)
                
        except KeyboardInterrupt:
            print("\nData collection interrupted by user.")
        except Exception as e:
            print(f"Error during data collection: {e}")
        finally:
            total_time = time.time() - self.start_time
            if total_time > 0:
                actual_rate = samples_collected / total_time
                print(f"\nCollection complete!")
                print(f"Total samples: {samples_collected}")
                print(f"Total time: {total_time:.2f} seconds")
                print(f"Actual sampling rate: {actual_rate:.1f} Hz")
                print(f"Performance: {actual_rate/self.target_hz*100:.1f}% of target")
                print(f"Data saved to: readings/{filename}")
                
                # Try to upload to cloud
                full_filepath = os.path.join("readings", filename)
                self.upload_to_cloud(full_filepath)
    
    def close(self):
        """
        Clean up resources.
        """
        if self.mpu:
            self.mpu.close()

def load_and_analyze_data(filename: str) -> pd.DataFrame:
    """
    Load collected data and perform basic analysis.
    
    Args:
        filename: Name of the CSV file to load
        
    Returns:
        pd.DataFrame: Loaded data
    """
    filepath = os.path.join("readings", filename)
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return pd.DataFrame()
    
    df = pd.read_csv(filepath)
    print(f"Loaded {len(df)} samples from {filename}")
    print(f"Time range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"Duration: {df['timestamp'].max() - df['timestamp'].min():.2f} seconds")
    print("\nAcceleration statistics:")
    print(df[['acceleration']].describe())
    
    return df
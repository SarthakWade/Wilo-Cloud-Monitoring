#!/usr/bin/env python3
"""
CSV Generator for sensor data - creates exactly 1 second CSV files
"""

import os
import csv
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
import threading
import queue

class CSVGenerator:
    def __init__(self, sampling_rate: int = 800):
        self.sampling_rate = sampling_rate
        self.readings_dir = Path("readings")
        self.readings_dir.mkdir(exist_ok=True)
        
        # Data buffer for current second
        self.current_buffer = []
        self.buffer_lock = threading.Lock()
        
        # Current second tracking
        self.current_second = None
        self.file_count = 0
        
        print(f"CSV Generator initialized")
        print(f"Sampling rate: {sampling_rate} Hz")
        print(f"Readings directory: {self.readings_dir.absolute()}")
        
    def add_sample(self, timestamp: datetime, acceleration: float):
        """Add a sensor sample to the current buffer"""
        with self.buffer_lock:
            # Get the current second (truncate to second precision)
            current_sec = timestamp.replace(microsecond=0)
            
            # If this is a new second, save the previous buffer
            if self.current_second is not None and current_sec != self.current_second:
                self._save_current_buffer()
                self.current_buffer = []
            
            # Update current second
            self.current_second = current_sec
            
            # Add sample to buffer
            sample = {
                'timestamp': timestamp.isoformat(),
                'acceleration': round(acceleration, 4)
            }
            self.current_buffer.append(sample)
            
            # If buffer is full (reached sampling rate), save immediately
            if len(self.current_buffer) >= self.sampling_rate:
                self._save_current_buffer()
                self.current_buffer = []
    
    def _save_current_buffer(self):
        """Save the current buffer to a CSV file"""
        if not self.current_buffer or self.current_second is None:
            return
            
        # Create hierarchical folder structure: readings/YYYY/MM/Week_N/DD/
        year = self.current_second.strftime("%Y")
        month = self.current_second.strftime("%m")
        day = self.current_second.strftime("%d")
        
        # Calculate week number within the month
        week_num = ((self.current_second.day - 1) // 7) + 1
        week_folder = f"Week_{week_num}"
        
        # Create folder structure
        folder_path = self.readings_dir / year / month / week_folder / day
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Generate filename: HHMMSS.csv (since date is in folder structure)
        filename = self.current_second.strftime("%H%M%S.csv")
        filepath = folder_path / filename
        
        try:
            with open(filepath, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write header
                writer.writerow(['Timestamp', 'Acceleration'])
                
                # Write data
                for sample in self.current_buffer:
                    writer.writerow([sample['timestamp'], sample['acceleration']])
            
            self.file_count += 1
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(self.current_buffer)} samples to {filename}")
            
        except Exception as e:
            print(f"Error saving CSV file {filename}: {e}")
    
    def force_save(self):
        """Force save current buffer (useful for shutdown)"""
        with self.buffer_lock:
            if self.current_buffer:
                self._save_current_buffer()
                self.current_buffer = []
    
    def get_file_list(self) -> List[str]:
        """Get list of all CSV files in readings directory"""
        try:
            csv_files = []
            for csv_file in self.readings_dir.rglob("*.csv"):
                # Get relative path from readings directory
                relative_path = csv_file.relative_to(self.readings_dir)
                csv_files.append(str(relative_path))
            return sorted(csv_files, reverse=True)  # Most recent first
        except Exception as e:
            print(f"Error getting file list: {e}")
            return []
    
    def get_folder_structure(self) -> Dict[str, Any]:
        """Get hierarchical folder structure for calendar view"""
        try:
            structure = {}
            
            for csv_file in self.readings_dir.rglob("*.csv"):
                relative_path = csv_file.relative_to(self.readings_dir)
                parts = relative_path.parts
                
                if len(parts) >= 4:  # year/month/week/day/file.csv
                    year, month, week, day = parts[:4]
                    filename = parts[-1]
                    
                    # Build nested structure
                    if year not in structure:
                        structure[year] = {}
                    if month not in structure[year]:
                        structure[year][month] = {}
                    if week not in structure[year][month]:
                        structure[year][month][week] = {}
                    if day not in structure[year][month][week]:
                        structure[year][month][week][day] = []
                    
                    structure[year][month][week][day].append({
                        'filename': filename,
                        'path': str(relative_path),
                        'size': csv_file.stat().st_size,
                        'modified': csv_file.stat().st_mtime
                    })
            
            return structure
        except Exception as e:
            print(f"Error getting folder structure: {e}")
            return {}
    
    def get_latest_file(self) -> str:
        """Get the most recent CSV file"""
        files = self.get_file_list()
        return files[0] if files else None
    
    def cleanup_old_files(self, days_to_keep: int = 365):
        """Remove CSV files older than specified days (default: 1 year)"""
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        removed_count = 0
        
        try:
            for csv_file in self.readings_dir.glob("*.csv"):
                # Parse date from filename
                try:
                    date_str = csv_file.stem[:8]  # YYYYMMDD part
                    file_date = datetime.strptime(date_str, "%Y%m%d")
                    
                    if file_date < cutoff_date:
                        csv_file.unlink()
                        removed_count += 1
                        
                except ValueError:
                    # Skip files that don't match our naming convention
                    continue
            
            if removed_count > 0:
                print(f"Cleaned up {removed_count} old CSV files")
                
        except Exception as e:
            print(f"Error during cleanup: {e}")
    
    def get_file_stats(self) -> Dict[str, Any]:
        """Get statistics about CSV files"""
        files = self.get_file_list()
        total_size = 0
        
        try:
            for filename in files:
                filepath = self.readings_dir / filename
                if filepath.exists():
                    total_size += filepath.stat().st_size
            
            return {
                'total_files': len(files),
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'latest_file': files[0] if files else None,
                'oldest_file': files[-1] if files else None
            }
        except Exception as e:
            print(f"Error getting file stats: {e}")
            return {'total_files': 0, 'total_size_mb': 0}
    
    def update_sampling_rate(self, new_rate: int):
        """Update the sampling rate"""
        with self.buffer_lock:
            # Save current buffer before changing rate
            if self.current_buffer:
                self._save_current_buffer()
                self.current_buffer = []
            
            self.sampling_rate = new_rate
            print(f"Sampling rate updated to {new_rate} Hz")

if __name__ == "__main__":
    # Test the CSV generator
    generator = CSVGenerator()
    
    # Simulate some data
    import random
    
    print("Testing CSV generator...")
    start_time = datetime.now()
    
    for i in range(1600):  # 2 seconds worth of data at 800Hz
        timestamp = start_time + timedelta(milliseconds=i * 1.25)  # 800Hz = 1.25ms intervals
        acceleration = 1000 + random.random() * 15000  # Random acceleration
        
        generator.add_sample(timestamp, acceleration)
        time.sleep(0.001)  # Small delay to simulate real timing
    
    # Force save any remaining data
    generator.force_save()
    
    # Show stats
    stats = generator.get_file_stats()
    print(f"Generated {stats['total_files']} files, {stats['total_size_mb']} MB total")
    print(f"Files: {generator.get_file_list()}")
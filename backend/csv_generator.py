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
from concurrent.futures import ThreadPoolExecutor

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
        
        # Thread pool for async file operations
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="csv_writer")
        
        print(f"CSV Generator initialized")
        print(f"Sampling rate: {sampling_rate} Hz")
        print(f"Readings directory: {self.readings_dir.absolute()}")
        
    def _format_ms(self, ms_value: float) -> str:
        """Format milliseconds with up to 4 decimal places and 'ms' suffix"""
        s = f"{ms_value:.4f}".rstrip('0').rstrip('.')
        return f"{s}ms"
        
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
            # Time within the current second in milliseconds
            time_ms = timestamp.microsecond / 1000.0
            sample = {
                'time_ms': self._format_ms(time_ms),
                'acceleration': round(acceleration, 4)
            }
            self.current_buffer.append(sample)
            
            # If buffer is full (reached sampling rate), save immediately
            if len(self.current_buffer) >= self.sampling_rate:
                self._save_current_buffer()
                self.current_buffer = []
    
    def add_sample_ultra_fast(self, timestamp: datetime, acceleration: float):
        """Optimized version for high-frequency sampling with minimal overhead"""
        # Pre-compute time within second in milliseconds for performance
        time_ms_value = timestamp.microsecond / 1000.0
        time_ms_str = self._format_ms(time_ms_value)
        current_sec = timestamp.replace(microsecond=0)
        
        # Minimal locking - only when absolutely necessary
        needs_save = False
        old_buffer = None
        old_second = None
        
        # Critical section - keep as short as possible
        if self.current_second is not None and current_sec != self.current_second:
            # Time boundary crossed - prepare for save
            with self.buffer_lock:
                old_buffer = self.current_buffer.copy() if self.current_buffer else []
                old_second = self.current_second
                self.current_buffer = []
                self.current_second = current_sec
            needs_save = bool(old_buffer)
        else:
            # Same second - just add sample
            if not hasattr(self, 'current_second') or self.current_second is None:
                self.current_second = current_sec
        
        # Add sample - fastest possible append
        sample_data = (time_ms_str, round(acceleration, 4))
        self.current_buffer.append(sample_data)
        
        # Check if buffer full (targeting sampling rate)
        if len(self.current_buffer) >= self.sampling_rate:
            with self.buffer_lock:
                old_buffer = self.current_buffer.copy()
                old_second = self.current_second
                self.current_buffer = []
            needs_save = True
        
        # Save outside of any locks for maximum performance
        if needs_save and old_buffer:
            self._write_csv_ultra_fast(old_buffer, old_second)
    
    def _write_csv_ultra_fast(self, buffer_data, buffer_second):
        """Optimized CSV writing with minimal overhead"""
        if not buffer_data or buffer_second is None:
            return
        
        try:
            # Efficient path creation
            year = buffer_second.year
            month = buffer_second.month
            day = buffer_second.day
            week_num = ((day - 1) // 7) + 1
            
            # Build path efficiently
            folder_path = self.readings_dir / str(year) / f"{month:02d}" / f"Week_{week_num}" / f"{day:02d}"
            folder_path.mkdir(parents=True, exist_ok=True)
            
            # Generate filename
            filename = f"{buffer_second.hour:02d}{buffer_second.minute:02d}{buffer_second.second:02d}.csv"
            filepath = folder_path / filename
            
            # Optimized file writing
            with open(filepath, 'w', newline='', buffering=8192) as csvfile:
                # Write header once
                csvfile.write('Time (ms),Acceleration\n')
                
                # Fast data writing - avoid csv.writer overhead
                for time_ms_str, acceleration in buffer_data:
                    csvfile.write(f'{time_ms_str},{acceleration}\n')
            
            self.file_count += 1
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(buffer_data)} samples to {filename} (Target: {self.sampling_rate})")
            
        except Exception as e:
            print(f"Error in optimized CSV write: {e}")
    
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
                writer.writerow(['Time (ms)', 'Acceleration'])
                
                # Write data
                for sample in self.current_buffer:
                    writer.writerow([sample['time_ms'], sample['acceleration']])
            
            self.file_count += 1
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(self.current_buffer)} samples to {filename}")
            
        except Exception as e:
            print(f"Error saving CSV file {filename}: {e}")
    
    def _save_buffer_async(self, buffer_data: List[Dict], buffer_second: datetime):
        """Save buffer data asynchronously to avoid blocking main sensor loop"""
        if not buffer_data or buffer_second is None:
            return
        
        # Submit to thread pool for background processing
        future = self.executor.submit(self._write_csv_file, buffer_data, buffer_second)
        # Don't wait for completion to avoid blocking
        
    def _write_csv_file(self, buffer_data: List[Dict], buffer_second: datetime):
        """Write CSV file in background thread"""
        try:
            # Create hierarchical folder structure: readings/YYYY/MM/Week_N/DD/
            year = buffer_second.strftime("%Y")
            month = buffer_second.strftime("%m")
            day = buffer_second.strftime("%d")
            
            # Calculate week number within the month
            week_num = ((buffer_second.day - 1) // 7) + 1
            week_folder = f"Week_{week_num}"
            
            # Create folder structure
            folder_path = self.readings_dir / year / month / week_folder / day
            folder_path.mkdir(parents=True, exist_ok=True)
            
            # Generate filename: HHMMSS.csv (since date is in folder structure)
            filename = buffer_second.strftime("%H%M%S.csv")
            filepath = folder_path / filename
            
            # Write CSV file efficiently
            with open(filepath, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write header
                writer.writerow(['Time (ms)', 'Acceleration'])
                
                # Write data efficiently
                for sample in buffer_data:
                    writer.writerow([sample['time_ms'], sample['acceleration']])
            
            self.file_count += 1
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(buffer_data)} samples to {filename} (Target: {self.sampling_rate})")
            
        except Exception as e:
            print(f"Error saving CSV file asynchronously: {e}")
    
    def force_save(self):
        """Force save current buffer (useful for shutdown)"""
        with self.buffer_lock:
            if self.current_buffer:
                self._save_current_buffer()
                self.current_buffer = []
        
        # Wait for any pending async operations to complete
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=True)
    
    def cleanup(self):
        """Clean up resources"""
        self.force_save()
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)
    
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
    
    def cleanup_old_files(self, days_to_keep: int = 7):
        """Remove CSV files older than specified days (default: 7 days).
        Uses file modification time and traverses the full readings tree.
        """
        cutoff_ts = (datetime.now() - timedelta(days=days_to_keep)).timestamp()
        removed_count = 0
        try:
            for csv_file in self.readings_dir.rglob("*.csv"):
                try:
                    if csv_file.stat().st_mtime < cutoff_ts:
                        csv_file.unlink()
                        removed_count += 1
                except FileNotFoundError:
                    continue
                except Exception as inner_e:
                    print(f"Warning: failed to delete {csv_file}: {inner_e}")
            if removed_count > 0:
                print(f"Cleaned up {removed_count} old CSV files (>{days_to_keep} days)")
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
    
    # Sampling rate is now fixed at initialization - no dynamic updates

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
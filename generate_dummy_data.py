"""
Generate dummy data showing gradual increase leading to failure
Uses current date to ensure data is within the 20-day window
"""
import csv
import datetime

# Create dummy data
data = []

# Use current date and time
now = datetime.datetime.now()
# Start from 5 days ago at 11:00 AM
base_time = (now - datetime.timedelta(days=5)).replace(hour=11, minute=0, second=0, microsecond=0)

# Stable baseline data (11:00 AM - hourly intervals with small variation)
for i in range(50):
    timestamp = base_time + datetime.timedelta(milliseconds=i*100)
    value = 2.1 + (i * 0.01)  # Slowly increasing from 2.1
    data.append((timestamp.isoformat(), value))

# Mid-day stable period
data.append((base_time.replace(hour=12, minute=0, second=0).isoformat(), 2.456789))
data.append((base_time.replace(hour=12, minute=10, second=0).isoformat(), 2.567890))
data.append((base_time.replace(hour=12, minute=15, second=0).isoformat(), 2.678901))
data.append((base_time.replace(hour=12, minute=20, second=0).isoformat(), 2.890123))

# Rapid increase leading to failure (12:20 - 12:24)
failure_approach_times = [
    (base_time.replace(hour=12, minute=20, second=30), 3.234567),
    (base_time.replace(hour=12, minute=21, second=0), 3.678901),
    (base_time.replace(hour=12, minute=21, second=30), 4.234567),
    (base_time.replace(hour=12, minute=22, second=0), 4.890123),
    (base_time.replace(hour=12, minute=22, second=30), 5.678901),
    (base_time.replace(hour=12, minute=23, second=0), 6.456789),
    (base_time.replace(hour=12, minute=23, second=15), 7.234567),
    (base_time.replace(hour=12, minute=23, second=30), 8.123456),
    (base_time.replace(hour=12, minute=23, second=45), 9.012345),
]

for timestamp, value in failure_approach_times:
    data.append((timestamp.isoformat(), value))

# FAILURE POINT at 12:24:00
data.append((base_time.replace(hour=12, minute=24, second=0).isoformat(), 9.790417))

# Return to normal after failure
data.append((base_time.replace(hour=13, minute=0, second=0).isoformat(), 2.345678))
data.append((base_time.replace(hour=14, minute=0, second=0).isoformat(), 2.456789))
data.append((base_time.replace(hour=15, minute=0, second=0).isoformat(), 2.234567))

# Write to CSV
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'Data')
os.makedirs(DATA_DIR, exist_ok=True)
output_file = os.path.join(DATA_DIR, 'max_reading_dummy.csv')
with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['timestamp', 'value'])
    for timestamp, value in data:
        writer.writerow([timestamp, f'{value:.6f}'])

failure_date = base_time.replace(hour=12, minute=24, second=0)
print(f"Created {len(data)} data points")
print(f"Failure time: {failure_date.isoformat()}")
print(f"Failure value: 9.790417")
print(f"Baseline value: ~2.1-2.9")
print(f"\nFile saved to: {output_file}")
print("\nThis data shows:")
print(f"- Data from: {base_time.date()} (5 days ago)")
print("- Stable baseline from 11:00 AM")
print("- Gradual increase from 12:20 PM")
print("- Steep rise from 12:23 PM")
print("- Failure at 12:24 PM (value: 9.79)")
print("- Return to normal after 1 PM")

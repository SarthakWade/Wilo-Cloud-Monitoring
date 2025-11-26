"""
Generate dummy data showing gradual increase leading to failure at 12:24:00
"""
import csv
import datetime

# Create dummy data
data = []

# Stable baseline data (11:00 AM - hourly intervals with small variation)
base_time = datetime.datetime(2025, 11, 27, 11, 0, 0)
for i in range(50):
    timestamp = base_time + datetime.timedelta(milliseconds=i*100)
    value = 2.1 + (i * 0.01)  # Slowly increasing from 2.1
    data.append((timestamp.isoformat(), value))

# Mid-day stable period
data.append((datetime.datetime(2025, 11, 27, 12, 0, 0).isoformat(), 2.456789))
data.append((datetime.datetime(2025, 11, 27, 12, 10, 0).isoformat(), 2.567890))
data.append((datetime.datetime(2025, 11, 27, 12, 15, 0).isoformat(), 2.678901))
data.append((datetime.datetime(2025, 11, 27, 12, 20, 0).isoformat(), 2.890123))

# Rapid increase leading to failure (12:20 - 12:24)
failure_approach_times = [
    (datetime.datetime(2025, 11, 27, 12, 20, 30), 3.234567),
    (datetime.datetime(2025, 11, 27, 12, 21, 0), 3.678901),
    (datetime.datetime(2025, 11, 27, 12, 21, 30), 4.234567),
    (datetime.datetime(2025, 11, 27, 12, 22, 0), 4.890123),
    (datetime.datetime(2025, 11, 27, 12, 22, 30), 5.678901),
    (datetime.datetime(2025, 11, 27, 12, 23, 0), 6.456789),
    (datetime.datetime(2025, 11, 27, 12, 23, 15), 7.234567),
    (datetime.datetime(2025, 11, 27, 12, 23, 30), 8.123456),
    (datetime.datetime(2025, 11, 27, 12, 23, 45), 9.012345),
]

for timestamp, value in failure_approach_times:
    data.append((timestamp.isoformat(), value))

# FAILURE POINT at 12:24:00
data.append((datetime.datetime(2025, 11, 27, 12, 24, 0).isoformat(), 9.790417))

# Return to normal after failure
data.append((datetime.datetime(2025, 11, 27, 13, 0, 0).isoformat(), 2.345678))
data.append((datetime.datetime(2025, 11, 27, 14, 0, 0).isoformat(), 2.456789))
data.append((datetime.datetime(2025, 11, 27, 15, 0, 0).isoformat(), 2.234567))

# Write to CSV
output_file = '/Users/adityagarud/Developer/Wilo-Cloud-Monitoring/Data/max_reading_dummy.csv'
with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['timestamp', 'value'])
    for timestamp, value in data:
        writer.writerow([timestamp, f'{value:.6f}'])

print(f"Created {len(data)} data points")
print(f"Failure time: 2025-11-27T12:24:00")
print(f"Failure value: 9.790417")
print(f"Baseline value: ~2.1-2.9")
print(f"\nFile saved to: {output_file}")
print("\nThis data shows:")
print("- Stable baseline from 11:00 AM")
print("- Gradual increase from 12:20 PM")
print("- Steep rise from 12:23 PM")
print("- Failure at 12:24 PM (value: 9.79)")
print("- Return to normal after 1 PM")

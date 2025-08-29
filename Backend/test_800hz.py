#!/usr/bin/env python3
"""
Performance validation tool for 800 Hz sensor data collection system.
"""

import time
import argparse
from files import HighFrequencyDataCollector

def test_sampling_rate(target_hz: int = 800, duration: int = 5):
    """
    Test the actual sampling rate achieved by the system.
    
    Args:
        target_hz: Target sampling frequency
        duration: Test duration in seconds
    """
    print(f"Testing {target_hz} Hz sampling rate for {duration} seconds...")
    
    collector = HighFrequencyDataCollector(target_hz=target_hz, batch_size=100)
    
    # Initialize sensor or simulation mode
    collector.initialize_sensor()
    
    # Run the collection test
    collector.collect_continuous(duration_seconds=duration)
    
    # Clean up
    collector.close()

def benchmark_batch_sizes():
    """
    Benchmark different batch sizes to find optimal performance.
    """
    batch_sizes = [10, 50, 100, 200, 500]
    target_hz = 800
    test_duration = 3
    
    print("Benchmarking batch sizes for optimal performance...")
    print("=" * 60)
    
    results = []
    
    for batch_size in batch_sizes:
        print(f"\nTesting batch size: {batch_size}")
        collector = HighFrequencyDataCollector(target_hz=target_hz, batch_size=batch_size)
        collector.initialize_sensor()
        
        start_time = time.time()
        sample_count = 0
        
        try:
            end_time = start_time + test_duration
            while time.time() < end_time:
                batch_data = collector.collect_batch()
                sample_count += len(batch_data)
        except Exception as e:
            print(f"Error during benchmark: {e}")
        finally:
            collector.close()
        
        actual_hz = sample_count / test_duration
        performance = (actual_hz / target_hz) * 100
        
        results.append({
            'batch_size': batch_size,
            'samples': sample_count,
            'actual_hz': actual_hz,
            'performance': performance
        })
        
        print(f"  Samples collected: {sample_count}")
        print(f"  Actual rate: {actual_hz:.1f} Hz")
        print(f"  Performance: {performance:.1f}%")
    
    # Find best performing batch size
    best_result = max(results, key=lambda x: x['performance'])
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS:")
    print("=" * 60)
    for result in results:
        marker = " <-- BEST" if result['batch_size'] == best_result['batch_size'] else ""
        print(f"Batch size {result['batch_size']:3d}: {result['actual_hz']:6.1f} Hz "
              f"({result['performance']:5.1f}%){marker}")

def main():
    parser = argparse.ArgumentParser(description="800 Hz Sensor Data Collection Performance Test")
    parser.add_argument("--rate", type=int, default=800, help="Target sampling rate (default: 800)")
    parser.add_argument("--duration", type=int, default=5, help="Test duration in seconds (default: 5)")
    parser.add_argument("--benchmark", action="store_true", help="Run batch size benchmark")
    
    args = parser.parse_args()
    
    if args.benchmark:
        benchmark_batch_sizes()
    else:
        test_sampling_rate(target_hz=args.rate, duration=args.duration)

if __name__ == "__main__":
    main()#!/usr/bin/env python3
"""
Performance validation tool for 800 Hz sensor data collection system.
"""

import time
import argparse
from files import HighFrequencyDataCollector

def test_sampling_rate(target_hz: int = 800, duration: int = 5):
    """
    Test the actual sampling rate achieved by the system.
    
    Args:
        target_hz: Target sampling frequency
        duration: Test duration in seconds
    """
    print(f"Testing {target_hz} Hz sampling rate for {duration} seconds...")
    
    collector = HighFrequencyDataCollector(target_hz=target_hz, batch_size=100)
    
    # Initialize sensor or simulation mode
    collector.initialize_sensor()
    
    # Run the collection test
    collector.collect_continuous(duration_seconds=duration)
    
    # Clean up
    collector.close()

def benchmark_batch_sizes():
    """
    Benchmark different batch sizes to find optimal performance.
    """
    batch_sizes = [10, 50, 100, 200, 500]
    target_hz = 800
    test_duration = 3
    
    print("Benchmarking batch sizes for optimal performance...")
    print("=" * 60)
    
    results = []
    
    for batch_size in batch_sizes:
        print(f"\nTesting batch size: {batch_size}")
        collector = HighFrequencyDataCollector(target_hz=target_hz, batch_size=batch_size)
        collector.initialize_sensor()
        
        start_time = time.time()
        sample_count = 0
        
        try:
            end_time = start_time + test_duration
            while time.time() < end_time:
                batch_data = collector.collect_batch()
                sample_count += len(batch_data)
        except Exception as e:
            print(f"Error during benchmark: {e}")
        finally:
            collector.close()
        
        actual_hz = sample_count / test_duration
        performance = (actual_hz / target_hz) * 100
        
        results.append({
            'batch_size': batch_size,
            'samples': sample_count,
            'actual_hz': actual_hz,
            'performance': performance
        })
        
        print(f"  Samples collected: {sample_count}")
        print(f"  Actual rate: {actual_hz:.1f} Hz")
        print(f"  Performance: {performance:.1f}%")
    
    # Find best performing batch size
    best_result = max(results, key=lambda x: x['performance'])
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS:")
    print("=" * 60)
    for result in results:
        marker = " <-- BEST" if result['batch_size'] == best_result['batch_size'] else ""
        print(f"Batch size {result['batch_size']:3d}: {result['actual_hz']:6.1f} Hz "
              f"({result['performance']:5.1f}%){marker}")

def main():
    parser = argparse.ArgumentParser(description="800 Hz Sensor Data Collection Performance Test")
    parser.add_argument("--rate", type=int, default=800, help="Target sampling rate (default: 800)")
    parser.add_argument("--duration", type=int, default=5, help="Test duration in seconds (default: 5)")
    parser.add_argument("--benchmark", action="store_true", help="Run batch size benchmark")
    
    args = parser.parse_args()
    
    if args.benchmark:
        benchmark_batch_sizes()
    else:
        test_sampling_rate(target_hz=args.rate, duration=args.duration)

if __name__ == "__main__":
    main()
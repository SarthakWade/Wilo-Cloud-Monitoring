'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Scatter
} from 'recharts';
import { Menu, FileText, Plus, BarChart3 } from 'lucide-react';
import Image from 'next/image';

interface DataPoint {
  timestamp: string;
  acceleration: number;
}

interface FileData {
  filename: string;
  data: DataPoint[];
}

type AggregationType =
  | 'max'
  | 'min'
  | 'average'
  | 'mean'
  | 'standardDeviation'
  | 'skewness';

const aggregateData = (
  data: DataPoint[],
  zoom: 'months' | 'dates' | 'time',
  aggregation: AggregationType
) => {
  const grouped: Record<string, DataPoint[]> = {};

  data.forEach((d) => {
    const date = new Date(d.timestamp);
    let key: string;

    if (zoom === 'months')
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    else if (zoom === 'dates')
      key = date.toISOString().split('T')[0];
    else
      key = `${date.toISOString().split('T')[0]} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  return Object.entries(grouped).map(([key, points]) => {
    const values = points.map((p) => p.acceleration);
    let value: number;

    switch (aggregation) {
      case 'max': value = Math.max(...values); break;
      case 'min': value = Math.min(...values); break;
      case 'average':
      case 'mean':
        value = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        break;
      case 'standardDeviation': {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        value = Math.round(Math.sqrt(variance));
        break;
      }
      case 'skewness': {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length);
        const skew = values.reduce((a, b) => a + Math.pow((b - avg) / stdDev, 3), 0) / values.length;
        value = Math.round(skew * 1000) / 1000;
        break;
      }
      default: value = Math.max(...values);
    }

    return { time: key, acceleration: value, dataPoints: points.length };
  }).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
};

const generateHistoricalData = (): FileData[] => {
  const start = new Date('2025-01-01T00:00:00');
  const now = new Date();
  const files: FileData[] = [
    { filename: 'SimFile_1.json', data: [] },
    { filename: 'SimFile_2.json', data: [] }
  ];

  for (let time = new Date(start); time <= now; time.setHours(time.getHours() + 2)) {
    files.forEach((file) => {
      file.data.push({
        timestamp: new Date(time).toISOString(),
        acceleration: Math.round(1000 + Math.random() * (16000 - 1000)),
      });
    });
  }

  return files;
};

const Dashboard: React.FC = () => {
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [selectedFileData, setSelectedFileData] = useState<DataPoint[]>([]);
  const [mainChartData, setMainChartData] = useState<any[]>([]);
  const [zoomLevel, setZoomLevel] = useState<'months' | 'dates' | 'time'>('months');
  const [aggregationType, setAggregationType] = useState<AggregationType>('max');
  const [eventName, setEventName] = useState('');
  const [domain, setDomain] = useState<[string, string] | undefined>(undefined);
  const chartRef = useRef<HTMLDivElement>(null);

  // Load historical data once
  useEffect(() => {
    const data = generateHistoricalData();
    setFileData(data);
    setSelectedFile(data[0].filename);
    setSelectedFileData(data[0].data);
  }, []);

  // Update charts whenever zoom, aggregation, or domain changes
  useEffect(() => {
    if (fileData.length > 0) {
      let filteredData = fileData.flatMap((f) => f.data);
      if (domain) {
        const [start, end] = domain;
        filteredData = filteredData.filter(
          (d) => new Date(d.timestamp) >= new Date(start) && new Date(d.timestamp) <= new Date(end)
        );
      }
      setMainChartData(aggregateData(filteredData, zoomLevel, aggregationType));

      const file = fileData.find((f) => f.filename === selectedFile);
      if (file) {
        setSelectedFileData(
          domain
            ? file.data.filter(
                (d) => new Date(d.timestamp) >= new Date(domain[0]) && new Date(d.timestamp) <= new Date(domain[1])
              )
            : file.data
        );
      }
    }
  }, [fileData, selectedFile, aggregationType, zoomLevel, domain]);

  const handleFileSelect = (filename: string) => {
    setSelectedFile(filename);
    const file = fileData.find((f) => f.filename === filename);
    if (file) setSelectedFileData(file.data);
  };

  const handleCreateEvent = () => {
    if (eventName.trim()) {
      alert(`Event "${eventName}" created successfully!`);
      setEventName('');
    }
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent page scrolling when over the chart
    if (!chartRef.current || !mainChartData.length) return;

    const chartRect = chartRef.current.getBoundingClientRect();
    const mouseX = e.clientX - chartRect.left;
    const chartWidth = chartRect.width;
    const normalizedX = mouseX / chartWidth; // 0 to 1

    // Find the closest data point to the mouse position
    const dataIndex = Math.round(normalizedX * (mainChartData.length - 1));
    const selectedTime = mainChartData[dataIndex]?.time;
    if (!selectedTime) return;

    let start: Date, end: Date;
    if (e.deltaY < 0) { // Scroll up (zoom in)
      if (zoomLevel === 'months') {
        const [year, month] = selectedTime.split('-').map(Number);
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0);
        setZoomLevel('dates');
      } else if (zoomLevel === 'dates') {
        start = new Date(selectedTime);
        end = new Date(selectedTime);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        setZoomLevel('time');
      } else {
        return; // No further zoom in time level
      }
      setDomain([start.toISOString(), end.toISOString()]);
    } else if (e.deltaY > 0) { // Scroll down (zoom out)
      if (zoomLevel === 'time') {
        const date = new Date(selectedTime);
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        setZoomLevel('dates');
        setDomain([start.toISOString(), end.toISOString()]);
      } else if (zoomLevel === 'dates') {
        setZoomLevel('months');
        setDomain(undefined);
      }
    }
  };

  const handleResetZoom = () => {
    setZoomLevel('months');
    setDomain(undefined);
  };

  return (
    <div className="min-h-screen bg-[#efefef]">
      {/* Header */}
      <header className="bg-[#019c7c] text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Menu className="h-6 w-6 cursor-pointer" />
            <div className="flex items-center space-x-3">
              <Image src="/vu.png" alt="VU Logo" width={40} height={40} className="rounded" />
              <Image src="/wilo.png" alt="Wilo Logo" width={40} height={40} className="rounded" />
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold">DASHBOARD</h1>
            <p className="text-sm opacity-90">Total Files: {fileData.length}</p>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto p-6 gap-6">
        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* Event Creation */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Plus className="h-5 w-5 mr-2 text-[#019c7c]" />
              Create Event
            </h2>
            <input
              type="text"
              placeholder="Enter Event Name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#019c7c]"
            />
            <button
              onClick={handleCreateEvent}
              className="w-full mt-3 bg-[#019c7c] text-white py-3 px-4 rounded-lg hover:bg-[#018a6f] transition-colors font-medium"
            >
              Create Event
            </button>
          </div>

          {/* File List */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-[#019c7c]" />
              Data Files
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fileData.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => handleFileSelect(file.filename)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedFile === file.filename
                      ? 'bg-[#019c7c] text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Graphs */}
        <div className="flex-1 space-y-6">
          {/* Main aggregated chart */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <BarChart3 className="h-6 w-6 text-[#019c7c]" />
                <h2 className="text-xl font-semibold text-gray-800">Acceleration Overview</h2>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={aggregationType}
                  onChange={(e) => setAggregationType(e.target.value as AggregationType)}
                  className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#019c7c]"
                >
                  <option value="max">Max</option>
                  <option value="min">Min</option>
                  <option value="average">Average</option>
                  <option value="mean">Mean</option>
                  <option value="standardDeviation">Standard Deviation</option>
                  <option value="skewness">Skewness</option>
                </select>
                <button
                  onClick={handleResetZoom}
                  className="bg-[#019c7c] text-white py-2 px-4 rounded-lg hover:bg-[#018a6f] transition-colors"
                >
                  Reset Zoom
                </button>
              </div>
            </div>

            <div ref={chartRef} onWheel={handleWheelZoom}>
              {mainChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={mainChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      stroke="#666"
                      tickFormatter={(value) => {
                        if (zoomLevel === 'months') return value;
                        if (zoomLevel === 'dates') return new Date(value).toLocaleDateString();
                        return value;
                      }}
                    />
                    <YAxis
                      label={{ value: 'Acceleration', angle: -90, position: 'insideLeft' }}
                      stroke="#666"
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        value,
                        typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : 'Value'
                      ]}
                      labelFormatter={(label) => {
                        if (zoomLevel === 'months') return label;
                        if (zoomLevel === 'dates') return new Date(label).toLocaleDateString();
                        return label;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acceleration"
                      stroke="#019c7c"
                      fill="#019c7c"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                    <Scatter dataKey="dataPoints" fill="#019c7c" r={6} stroke="#018a6f" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-600">
                  Loading data...
                </div>
              )}
            </div>
          </div>

          {/* Selected file chart */}
          {selectedFile && (
            <div className="bg-white rounded-lg p-6 shadow-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  File: {selectedFile}
                </h3>
                <div className="text-sm text-gray-600">
                  Records: {selectedFileData.length}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={selectedFileData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#666"
                    tickFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <YAxis
                    label={{ value: 'Acceleration', angle: -90, position: 'insideLeft' }}
                    stroke="#666"
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : 'Acceleration'
                    ]}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="acceleration" stroke="#019c7c" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
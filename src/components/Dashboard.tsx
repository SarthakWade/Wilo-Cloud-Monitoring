'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Scatter
} from 'recharts';
import { Menu, FileText, BarChart3, Activity, Wifi, WifiOff, Sun, Moon, Download, Settings, Image as ImageIcon } from 'lucide-react';
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
  const [domain, setDomain] = useState<[string, string] | undefined>(undefined);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [samplingRate, setSamplingRate] = useState<number>(800);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const fileChartRef = useRef<HTMLDivElement>(null);

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

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleConnection = () => {
    setIsConnected(!isConnected);
    // TODO: Implement actual WebSocket connection logic
  };

  const exportToCSV = (data: DataPoint[], filename: string) => {
    const csvContent = [
      'Timestamp,Acceleration',
      ...data.map(point => `${point.timestamp},${point.acceleration}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename.replace('.json', '')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSamplingRateChange = (newRate: number) => {
    setSamplingRate(newRate);
    // TODO: Send sampling rate change to backend WebSocket
    console.log(`Sampling rate changed to: ${newRate} Hz`);
  };

  const exportSelectedFileAsCSV = () => {
    if (selectedFile && selectedFileData.length > 0) {
      exportToCSV(selectedFileData, selectedFile);
    }
  };

  const exportAllDataAsCSV = () => {
    const allData = fileData.flatMap(file =>
      file.data.map(point => ({
        ...point,
        filename: file.filename
      }))
    );

    const csvContent = [
      'Timestamp,Acceleration,Filename',
      ...allData.map(point => `${point.timestamp},${point.acceleration},${point.filename}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all_sensor_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChartAsImage = async () => {
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import('html2canvas')).default;
      
      const chartElement = chartRef.current;
      if (!chartElement) {
        console.error('Chart element not found');
        return;
      }

      const canvas = await html2canvas(chartElement, {
        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `acceleration_chart_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to export chart as image:', error);
      // Fallback: show a message to the user
      alert('Chart export failed. Please try again or use a different browser.');
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
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900' : 'bg-[#efefef]'}`}>
      {/* Header */}
      <header className="bg-[#019c7c] text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <Image src="/vu.png" alt="VU Logo" width={60} height={60} className="rounded-lg border-2 border-white shadow-lg ring-1 ring-gray-800" />
            <Image src="/wilo.png" alt="Wilo Logo" width={60} height={60} className="rounded-lg border-2 border-white shadow-lg ring-1 ring-gray-800" />
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-[#018a6f] transition-colors"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <div className="text-right">
              <h1 className="text-2xl font-bold">DASHBOARD</h1>
              <p className="text-sm opacity-90">Total Files: {fileData.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto p-6 gap-6">
        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* System Status */}
          <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              <Activity className="h-5 w-5 mr-2 text-[#019c7c]" />
              System Status
            </h2>

            {/* Connection Status */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Connection</span>
                <button
                  onClick={toggleConnection}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${isConnected
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                >
                  {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </button>
              </div>
            </div>

            {/* Sampling Rate Control */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sampling Rate</span>
                <span className={`text-lg font-bold text-[#019c7c]`}>{samplingRate} Hz</span>
              </div>
              
              {/* Rate Slider */}
              <div className="mb-3">
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={samplingRate}
                  onChange={(e) => handleSamplingRateChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #019c7c 0%, #019c7c ${(samplingRate - 100) / 9}%, #e5e7eb ${(samplingRate - 100) / 9}%, #e5e7eb 100%)`
                  }}
                />
              </div>
              
              {/* Quick Rate Buttons */}
              <div className="flex space-x-2">
                {[200, 400, 600, 800].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleSamplingRateChange(rate)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      samplingRate === rate
                        ? 'bg-[#019c7c] text-white'
                        : isDarkMode
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Quality */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Data Quality</span>
                <span className="text-sm font-medium text-green-600">Excellent</span>
              </div>
              <div className="text-xs text-gray-500">
                {isConnected ? 'Real-time data streaming' : 'Using historical data'}
              </div>
            </div>
          </div>

          {/* File List */}
          <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              <FileText className="h-5 w-5 mr-2 text-[#019c7c]" />
              Data Files
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fileData.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => handleFileSelect(file.filename)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${selectedFile === file.filename
                    ? 'bg-[#019c7c] text-white'
                    : isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-lg font-semibold mb-4 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              <Download className="h-5 w-5 mr-2 text-[#019c7c]" />
              Export Options
            </h2>

            {/* Data Export */}
            <div className="space-y-3">
              <div>
                <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Data Export
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={exportSelectedFileAsCSV}
                    disabled={!selectedFile}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${selectedFile
                      ? isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <span className="text-sm">Export Selected File as CSV</span>
                    <FileText className="h-4 w-4" />
                  </button>

                  <button
                    onClick={exportAllDataAsCSV}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    <span className="text-sm">Export All Data as CSV</span>
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chart Export */}
              <div>
                <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Chart Export
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={exportChartAsImage}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    <span className="text-sm">Save Overview Chart</span>
                    <ImageIcon className="h-4 w-4" />
                  </button>

                  <button
                    onClick={exportChartAsImage}
                    disabled={!selectedFile}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${selectedFile
                      ? isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <span className="text-sm">Save File Chart</span>
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Graphs */}
        <div className="flex-1 space-y-6">
          {/* Main aggregated chart */}
          <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <BarChart3 className="h-6 w-6 text-[#019c7c]" />
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Acceleration Overview</h2>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={aggregationType}
                  onChange={(e) => setAggregationType(e.target.value as AggregationType)}
                  className={`p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#019c7c] transition-colors ${isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-800'
                    }`}
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

            <div ref={chartRef} onWheel={handleWheelZoom} className="relative">
              {mainChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={450}>
                  <AreaChart
                    data={mainChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#019c7c" stopOpacity={0.8} />
                        <stop offset="50%" stopColor="#019c7c" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#019c7c" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke={isDarkMode ? "#374151" : "#e5e7eb"}
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="time"
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(value) => {
                        if (zoomLevel === 'months') return value;
                        if (zoomLevel === 'dates') return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                      }}
                    />
                    <YAxis
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                        color: isDarkMode ? '#ffffff' : '#1f2937',
                        fontSize: '14px',
                        padding: '12px 16px'
                      }}
                      formatter={(value: any, name: any) => [
                        `${Number(value).toLocaleString()} m/s²`,
                        aggregationType.charAt(0).toUpperCase() + aggregationType.slice(1)
                      ]}
                      labelFormatter={(label) => {
                        if (zoomLevel === 'months') return `Month: ${label}`;
                        if (zoomLevel === 'dates') return `Date: ${new Date(label).toLocaleDateString()}`;
                        return `Time: ${label}`;
                      }}
                      cursor={{ stroke: '#019c7c', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acceleration"
                      stroke="#019c7c"
                      fill="url(#areaGradient)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 6,
                        fill: '#019c7c',
                        stroke: '#ffffff',
                        strokeWidth: 2,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={`h-[450px] flex flex-col items-center justify-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#019c7c] mb-4"></div>
                  <p className="text-lg font-medium">Loading acceleration data...</p>
                  <p className="text-sm opacity-75 mt-1">Preparing visualization</p>
                </div>
              )}

              {/* Zoom level indicator */}
              <div className="absolute top-4 right-4">
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  }`}>
                  Zoom: {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Selected file chart */}
          {selectedFile && (
            <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  File: {selectedFile}
                </h3>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Records: {selectedFileData.length}
                </div>
              </div>
              <div ref={fileChartRef} className="relative">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={selectedFileData.slice(-50)} // Show last 50 points for better performance
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                        <stop offset="50%" stopColor="#019c7c" stopOpacity={1} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke={isDarkMode ? "#374151" : "#e5e7eb"}
                      strokeOpacity={0.3}
                    />
                    <XAxis
                      dataKey="timestamp"
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => new Date(value).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    />
                    <YAxis
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                        color: isDarkMode ? '#ffffff' : '#1f2937',
                        fontSize: '13px',
                        padding: '10px 14px'
                      }}
                      formatter={(value: any) => [
                        `${Number(value).toLocaleString()} m/s²`,
                        'Acceleration'
                      ]}
                      labelFormatter={(label) => `Time: ${new Date(label).toLocaleString()}`}
                      cursor={{ stroke: '#019c7c', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="acceleration"
                      stroke="url(#lineGradient)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: '#019c7c',
                        stroke: '#ffffff',
                        strokeWidth: 2,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Data range indicator */}
                <div className="absolute top-4 right-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                    Latest {Math.min(50, selectedFileData.length)} points
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
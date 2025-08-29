'use client';

import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter
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

type AggregationType = 'max' | 'min' | 'average' | 'mean' | 'standardDeviation' | 'skewness';

const Dashboard: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [mainChartData, setMainChartData] = useState<any[]>([]);
  const [selectedFileData, setSelectedFileData] = useState<DataPoint[]>([]);
  const [zoomLevel, setZoomLevel] = useState<'months' | 'dates' | 'time'>('months');
  const [eventName, setEventName] = useState('');
  const [aggregationType, setAggregationType] = useState<AggregationType>('max');
  const [isLoading, setIsLoading] = useState(true);

  // Generate aggregated data based on aggregation type
  const generateAggregatedData = (data: FileData[], type: AggregationType) => {
    if (data.length === 0) return [];
    
    const aggregated = data.map(file => {
      const accelerations = file.data.map(d => d.acceleration);
      let value: number;
      
      switch (type) {
        case 'max':
          value = Math.max(...accelerations);
          break;
        case 'min':
          value = Math.min(...accelerations);
          break;
        case 'average':
        case 'mean':
          value = Math.round(accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length);
          break;
        case 'standardDeviation': {
          const mean = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
          const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accelerations.length;
          value = Math.round(Math.sqrt(variance));
          break;
        }
        case 'skewness': {
          const avg = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
          const stdDev = Math.sqrt(accelerations.reduce((sum, acc) => sum + Math.pow(acc - avg, 2), 0) / accelerations.length);
          const skew = accelerations.reduce((sum, acc) => sum + Math.pow((acc - avg) / stdDev, 3), 0) / accelerations.length;
          value = Math.round(skew * 1000) / 1000;
          break;
        }
        default:
          value = Math.max(...accelerations);
      }
      
      return {
        filename: file.filename,
        acceleration: value,
        dataPoints: file.data.length
      };
    });
    
    return aggregated;
  };

  // Generate zoom-specific data
  const getZoomData = () => {
    if (fileData.length === 0) return [];
    
    switch (zoomLevel) {
      case 'months': {
        // Group data by month
        const monthlyGroups = fileData.reduce((acc, file) => {
          const month = file.filename.split('_')[0].split('-')[1]; // Extract month from filename
          if (!acc[month]) acc[month] = [];
          acc[month].push(...file.data);
          return acc;
        }, {} as Record<string, DataPoint[]>);
        
        return Object.entries(monthlyGroups).map(([month, data]) => {
          const accelerations = data.map(d => d.acceleration);
          let value: number;
          
          switch (aggregationType) {
            case 'max':
              value = Math.max(...accelerations);
              break;
            case 'min':
              value = Math.min(...accelerations);
              break;
            case 'average':
            case 'mean':
              value = Math.round(accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length);
              break;
            case 'standardDeviation': {
              const mean = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
              const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accelerations.length;
              value = Math.round(Math.sqrt(variance));
              break;
            }
            case 'skewness': {
              const avg = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
              const stdDev = Math.sqrt(accelerations.reduce((sum, acc) => sum + Math.pow(acc - avg, 2), 0) / accelerations.length);
              const skew = accelerations.reduce((sum, acc) => sum + Math.pow((acc - avg) / stdDev, 3), 0) / accelerations.length;
              value = Math.round(skew * 1000) / 1000;
              break;
            }
            default:
              value = Math.max(...accelerations);
          }
          
          return {
            month: month,
            acceleration: value,
            dataPoints: data.length
          };
        }).sort((a, b) => parseInt(a.month) - parseInt(b.month));
      }
        
      case 'dates': {
        // Group data by date
        const dateGroups = fileData.reduce((acc, file) => {
          const date = file.filename.split('_')[0]; // Extract date from filename
          if (!acc[date]) acc[date] = [];
          acc[date].push(...file.data);
          return acc;
        }, {} as Record<string, DataPoint[]>);
        
        return Object.entries(dateGroups).map(([date, data]) => {
          const accelerations = data.map(d => d.acceleration);
          let value: number;
          
          switch (aggregationType) {
            case 'max':
              value = Math.max(...accelerations);
              break;
            case 'min':
              value = Math.min(...accelerations);
              break;
            case 'average':
            case 'mean':
              value = Math.round(accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length);
              break;
            case 'standardDeviation': {
              const mean = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
              const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accelerations.length;
              value = Math.round(Math.sqrt(variance));
              break;
            }
            case 'skewness': {
              const avg = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
              const stdDev = Math.sqrt(accelerations.reduce((sum, acc) => sum + Math.pow(acc - avg, 2), 0) / accelerations.length);
              const skew = accelerations.reduce((sum, acc) => sum + Math.pow((acc - avg) / stdDev, 3), 0) / accelerations.length;
              value = Math.round(skew * 1000) / 1000;
              break;
            }
            default:
              value = Math.max(...accelerations);
          }
          
          return {
            date: date,
            acceleration: value,
            dataPoints: data.length
          };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
        
      case 'time': {
        // Group data by time
        const timeGroups = fileData.reduce((acc, file) => {
          const time = file.filename.split('_')[1]; // Extract time from filename
          if (!acc[time]) acc[time] = [];
          acc[time].push(...file.data);
          return acc;
        }, {} as Record<string, DataPoint[]>);
        
        return Object.entries(timeGroups).map(([time, data]) => {
          const accelerations = data.map(d => d.acceleration);
          let value: number;
          
          switch (aggregationType) {
            case 'max':
              value = Math.max(...accelerations);
              break;
            case 'min':
              value = Math.min(...accelerations);
              break;
            case 'average':
            case 'mean':
              value = Math.round(accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length);
              break;
            case 'standardDeviation': {
              const mean = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
              const variance = accelerations.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) / accelerations.length;
              value = Math.round(Math.sqrt(variance));
              break;
            }
            case 'skewness': {
              const avg = accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length;
              const stdDev = Math.sqrt(accelerations.reduce((sum, acc) => sum + Math.pow(acc - avg, 2), 0) / accelerations.length);
              const skew = accelerations.reduce((sum, acc) => sum + Math.pow((acc - avg) / stdDev, 3), 0) / accelerations.length;
              value = Math.round(skew * 1000) / 1000;
              break;
            }
            default:
              value = Math.max(...accelerations);
          }
          
          return {
            time: time,
            acceleration: value,
            dataPoints: data.length
          };
        }).sort((a, b) => a.time.localeCompare(b.time));
      }
        
      default:
        return [];
    }
  };

  useEffect(() => {
    // Load JSON files
    const loadFiles = async () => {
      setIsLoading(true);
      const files = [
        '2025-08-13_19-32-54.json',
        '2025-08-13_17-32-31.json',
        '2025-08-13_15-32-08.json',
        '2025-08-13_13-31-42.json',
        '2025-08-12_23-27-50.json'
      ];
      
      const loadedFiles: FileData[] = [];
      
      for (const file of files) {
        try {
          const response = await fetch(`/data/${file}`);
          const jsonData = await response.json();
          const data: DataPoint[] = jsonData.readings || [];
          
          loadedFiles.push({ filename: file, data });
        } catch (error) {
          console.error(`Error loading ${file}:`, error);
        }
      }
      
      setFileData(loadedFiles);
      if (loadedFiles.length > 0) {
        setSelectedFile(loadedFiles[0].filename);
        setSelectedFileData(loadedFiles[0].data);
      }
      setIsLoading(false);
    };

    loadFiles();
  }, []);

  useEffect(() => {
    // Update main chart data based on zoom level and aggregation type
    if (fileData.length > 0) {
      const zoomData = getZoomData();
      setMainChartData(zoomData);
    }
  }, [zoomLevel, aggregationType, fileData]);

  const handleFileSelect = (filename: string) => {
    setSelectedFile(filename);
    const file = fileData.find(f => f.filename === filename);
    if (file) {
      setSelectedFileData(file.data);
    }
  };

  const handleZoomChange = () => {
    if (zoomLevel === 'months') setZoomLevel('dates');
    else if (zoomLevel === 'dates') setZoomLevel('time');
    else setZoomLevel('months');
  };

  const handleCreateEvent = () => {
    if (eventName.trim()) {
      alert(`Event "${eventName}" created successfully!`);
      setEventName('');
    }
  };

  return (
    <div className="min-h-screen bg-[#efefef]">
      {/* Header */}
      <header className="bg-[#019c7c] text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Menu className="h-6 w-6 cursor-pointer" />
            <div className="flex items-center space-x-3">
              <Image
                src="/vu.png"
                alt="VU Logo"
                width={40}
                height={40}
                className="rounded"
              />
              <Image
                src="/wilo.png"
                alt="Wilo Logo"
                width={40}
                height={40}
                className="rounded"
              />
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold">DASHBOARD</h1>
            <p className="text-sm opacity-90">Total Files: {fileData.length}</p>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto p-6 gap-6">
        {/* Left Sidebar */}
        <div className="w-80 space-y-6">
          {/* Create Event Section */}
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#019c7c] focus:border-transparent"
            />
            <button
              onClick={handleCreateEvent}
              className="w-full mt-3 bg-[#019c7c] text-white py-3 px-4 rounded-lg hover:bg-[#018a6f] transition-colors font-medium"
            >
              Create Event
            </button>
          </div>

          {/* Data Files Section */}
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

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Main Chart */}
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
                  className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#019c7c] focus:border-transparent"
                >
                  <option value="max">Max</option>
                  <option value="min">Min</option>
                  <option value="average">Average</option>
                  <option value="mean">Mean</option>
                  <option value="standardDeviation">Standard Deviation</option>
                  <option value="skewness">Skewness</option>
                </select>

              </div>
            </div>
            
            {/* Enhanced Zoom Controls */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700">Zoom Level:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setZoomLevel('months')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      zoomLevel === 'months' 
                        ? 'bg-[#019c7c] text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Months
                  </button>
                  <button
                    onClick={() => setZoomLevel('dates')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      zoomLevel === 'dates' 
                        ? 'bg-[#019c7c] text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Dates
                  </button>
                  <button
                    onClick={() => setZoomLevel('time')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      zoomLevel === 'time' 
                        ? 'bg-[#019c7c] text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Time
                  </button>
                </div>
              </div>
              
              {/* Zoom Progress Bar */}
              <div className="relative">
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r from-[#019c7c] to-[#018a6f] transition-all duration-500 ease-in-out ${
                      zoomLevel === 'months' ? 'w-1/3' : 
                      zoomLevel === 'dates' ? 'w-2/3' : 
                      'w-full'
                    }`}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>Overview</span>
                  <span>Detailed</span>
                  <span>Precise</span>
                </div>
              </div>
            </div>
            
            {isLoading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#019c7c] mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading accelerometer data...</p>
                </div>
              </div>
            ) : mainChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={mainChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey={zoomLevel === 'months' ? 'month' : zoomLevel === 'dates' ? 'date' : 'time'} 
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Acceleration', angle: -90, position: 'insideLeft' }}
                    stroke="#666"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ccc',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      <div key="tooltip">
                        <div className="font-semibold text-[#019c7c]">
                          {props.payload.label || `${name}: ${value}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          Data Points: {props.payload.dataPoints}
                        </div>
                        <div className="text-sm text-gray-600">
                          Aggregation: {aggregationType}
                        </div>
                      </div>
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="acceleration" 
                    stroke="#019c7c" 
                    fill="#019c7c" 
                    fillOpacity={0.3}
                    strokeWidth={3}
                  />
                  <Scatter 
                    dataKey="dataPoints" 
                    fill="#019c7c" 
                    r={6}
                    stroke="#018a6f"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600">No data available for the selected zoom level and aggregation type.</p>
                </div>
              </div>
            )}
            
            {/* Statistics Summary */}
            {mainChartData.length > 0 && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {Math.max(...mainChartData.map(d => d.acceleration))}
                  </div>
                  <div className="text-sm text-gray-600">Max Value</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {Math.min(...mainChartData.map(d => d.acceleration))}
                  </div>
                  <div className="text-sm text-gray-600">Min Value</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {Math.round(mainChartData.reduce((sum, d) => sum + d.acceleration, 0) / mainChartData.length)}
                  </div>
                  <div className="text-sm text-gray-600">Average</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {mainChartData.reduce((sum, d) => sum + d.dataPoints, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Data Points</div>
                </div>
              </div>
            )}
          </div>

          {/* Selected File Chart */}
          {selectedFile && (
            <div className="bg-white rounded-lg p-6 shadow-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  File: {selectedFile}
                </h3>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Records:</span> {selectedFileData.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Range:</span> {selectedFileData.length > 0 ? 
                      `${Math.min(...selectedFileData.map(d => d.acceleration))} - ${Math.max(...selectedFileData.map(d => d.acceleration))}` : 
                      'N/A'
                    }
                  </div>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={selectedFileData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    label={{ value: 'Acceleration', angle: -90, position: 'insideLeft' }}
                    stroke="#666"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ccc',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      <div key="tooltip">
                        <div className="font-semibold text-[#019c7c]">
                          Timestamp: {props.payload.timestamp}
                        </div>
                        <div className="text-sm text-gray-600">
                          Acceleration: {value}
                        </div>
                      </div>
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="acceleration" 
                    stroke="#019c7c" 
                    strokeWidth={3}
                    dot={{ fill: '#019c7c', r: 4 }}
                    activeDot={{ r: 6, stroke: '#018a6f', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              {/* File Statistics */}
              {selectedFileData.length > 0 && (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-[#019c7c]">
                      {Math.max(...selectedFileData.map(d => d.acceleration))}
                    </div>
                    <div className="text-xs text-gray-600">Peak</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-[#019c7c]">
                      {Math.round(selectedFileData.reduce((sum, d) => sum + d.acceleration, 0) / selectedFileData.length)}
                    </div>
                    <div className="text-xs text-gray-600">Mean</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-[#019c7c]">
                      {Math.min(...selectedFileData.map(d => d.acceleration))}
                    </div>
                    <div className="text-xs text-gray-600">Min</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

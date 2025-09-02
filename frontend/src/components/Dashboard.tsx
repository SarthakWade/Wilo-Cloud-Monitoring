'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import { FileText, BarChart3, Activity, Wifi, WifiOff, Sun, Moon, Download, Calendar, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import Image from 'next/image';

interface DataPoint {
  timestamp: string;
  acceleration: number;
}

interface FileData {
  filename: string;
  data: DataPoint[];
}

interface WebSocketMessage {
  type: string;
  data?: {
    connected: boolean;
    sampling_rate: number;
  };
  files?: string[];
  structure?: Record<string, unknown>;
  command?: string;
  success?: boolean;
  new_rate?: number;
  message?: string;
  filename?: string;
  download_url?: string;
  file_count?: number;
  error?: string;
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
  const [mainChartData, setMainChartData] = useState<{ time: string; acceleration: number; dataPoints: number }[]>([]);
  const [zoomLevel, setZoomLevel] = useState<'months' | 'dates' | 'time'>('months');
  const [aggregationType, setAggregationType] = useState<AggregationType>('max');
  const [domain, setDomain] = useState<[string, string] | undefined>(undefined);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [samplingRate, setSamplingRate] = useState<number>(800);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const fileChartRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showCalendarBrowser, setShowCalendarBrowser] = useState<boolean>(false);
  const [folderStructure, setFolderStructure] = useState<Record<string, unknown>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [liveData, setLiveData] = useState<DataPoint[]>([]);
  const [selectedCsvFile, setSelectedCsvFile] = useState<string>('');
  const [selectedCsvData, setSelectedCsvData] = useState<DataPoint[]>([]);
  
  // Popup states
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  const [showSamplingRatePopup, setShowSamplingRatePopup] = useState(false);
  const [pendingSamplingRate, setPendingSamplingRate] = useState<number | null>(null);
  const [showZipExportPopup, setShowZipExportPopup] = useState(false);
  
  // Notification system
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error' | 'info'} | null>(null);
  
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // Auto-dismiss after 4 seconds
  };

  // Dummy folder structure for demonstration
  const dummyFolderStructure = {
    "2025": {
      "01": {
        "Week_1": {
          "01": [
            { filename: "143022.csv", path: "2025/01/Week_1/01/143022.csv", size: 2048, modified: Date.now() / 1000 },
            { filename: "143023.csv", path: "2025/01/Week_1/01/143023.csv", size: 2156, modified: Date.now() / 1000 },
            { filename: "143024.csv", path: "2025/01/Week_1/01/143024.csv", size: 1987, modified: Date.now() / 1000 }
          ],
          "02": [
            { filename: "090015.csv", path: "2025/01/Week_1/02/090015.csv", size: 2234, modified: Date.now() / 1000 },
            { filename: "090016.csv", path: "2025/01/Week_1/02/090016.csv", size: 2098, modified: Date.now() / 1000 }
          ],
          "03": [
            { filename: "120030.csv", path: "2025/01/Week_1/03/120030.csv", size: 2345, modified: Date.now() / 1000 },
            { filename: "120031.csv", path: "2025/01/Week_1/03/120031.csv", size: 2123, modified: Date.now() / 1000 },
            { filename: "120032.csv", path: "2025/01/Week_1/03/120032.csv", size: 2267, modified: Date.now() / 1000 }
          ]
        },
        "Week_2": {
          "08": [
            { filename: "154500.csv", path: "2025/01/Week_2/08/154500.csv", size: 2456, modified: Date.now() / 1000 },
            { filename: "154501.csv", path: "2025/01/Week_2/08/154501.csv", size: 2334, modified: Date.now() / 1000 }
          ],
          "09": [
            { filename: "101245.csv", path: "2025/01/Week_2/09/101245.csv", size: 2178, modified: Date.now() / 1000 }
          ]
        }
      },
      "02": {
        "Week_1": {
          "01": [
            { filename: "083015.csv", path: "2025/02/Week_1/01/083015.csv", size: 2567, modified: Date.now() / 1000 }
          ]
        }
      }
    },
    "2024": {
      "12": {
        "Week_4": {
          "28": [
            { filename: "235959.csv", path: "2024/12/Week_4/28/235959.csv", size: 1876, modified: Date.now() / 1000 }
          ],
          "31": [
            { filename: "235958.csv", path: "2024/12/Week_4/31/235958.csv", size: 2001, modified: Date.now() / 1000 },
            { filename: "235959.csv", path: "2024/12/Week_4/31/235959.csv", size: 1999, modified: Date.now() / 1000 }
          ]
        }
      }
    }
  };

  // Load historical data once and setup WebSocket
  const handleWebSocketMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case 'status':
        // Update connection status and sampling rate from backend
        if (data.data) {
          setIsConnected(data.data.connected);
          setSamplingRate(data.data.sampling_rate);
          
          // Simulate live data for demonstration
          if (data.data.connected) {
            const newLivePoint = {
              timestamp: new Date().toISOString(),
              acceleration: Math.round(1000 + Math.random() * 15000)
            };
            setLiveData(prev => {
              const updated = [...prev, newLivePoint];
              // Keep only last 50 points for performance
              return updated.slice(-50);
            });
          }
        }
        break;

      case 'new_file':
        // Handle new CSV file notification
        console.log('New CSV file created:', data.filename);
        // Request updated file list from backend
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ command: 'get_file_list' }));
        }
        break;

      case 'zip_export':
        // Handle ZIP file download from backend
        console.log('Received ZIP export response:', data);
        if (data.download_url) {
          console.log('Downloading ZIP from URL:', data.download_url);
          
          // Create download link and trigger download
          const link = document.createElement('a');
          link.href = data.download_url;
          link.download = data.filename || `sensor_data_export_${new Date().toISOString().split('T')[0]}.zip`;
          link.style.display = 'none';
          document.body.appendChild(link);
          
          // Trigger download
          link.click();
          
          // Clean up
          document.body.removeChild(link);
          
          console.log(`ZIP download initiated: ${data.filename} with ${data.file_count} files`);
          showNotification(`ZIP export successful! Files exported: ${data.file_count}. Download should start automatically.`, 'success');
        } else if (data.error) {
          console.error('ZIP export error:', data.error);
          showNotification(`ZIP export failed: ${data.error}`, 'error');
        } else {
          console.error('ZIP export response missing download URL');
          showNotification('ZIP export failed: No download URL received', 'error');
        }
        break;

      case 'csv_data':
        // Handle CSV file data from backend
        if (data.filename && data.data) {
          setSelectedCsvFile(data.filename);
          // Type assertion since we know this contains DataPoint array
          setSelectedCsvData(data.data as unknown as DataPoint[]);
          console.log('Received CSV data for:', data.filename);
        }
        break;

      case 'file_list':
        // Update file list from backend
        if (data.files && data.files.length > 0) {
          setCsvFiles(data.files);
          console.log('Received file list from backend:', data.files);
        }
        break;

      case 'folder_structure':
        // Update folder structure for calendar browser
        if (data.structure) {
          setFolderStructure(data.structure);
        }
        console.log('Received folder structure:', data.structure);
        break;

      case 'command_response':
        if (data.command === 'set_sampling_rate') {
          if (data.success && data.new_rate) {
            setSamplingRate(data.new_rate);
            console.log(`Sampling rate updated to ${data.new_rate} Hz`);
          } else {
            console.error('Failed to update sampling rate');
          }
        }
        break;

      case 'error':
        console.error('WebSocket error:', data.message);
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setWsStatus('connecting');

    try {
      const ws = new WebSocket('ws://localhost:8765');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsStatus('connected');
        setIsConnected(true);
        wsRef.current = ws;

        // Request initial status and file list
        ws.send(JSON.stringify({ command: 'get_status' }));
        ws.send(JSON.stringify({ command: 'get_file_list' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsStatus('disconnected');
        setIsConnected(false);
        wsRef.current = null;
        
        // Auto-retry connection after 3 seconds
        setTimeout(() => {
          if (wsRef.current === null) {
            console.log('Attempting to reconnect WebSocket...');
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error details:', {
          error: error,
          readyState: ws.readyState,
          url: ws.url,
          timestamp: new Date().toISOString()
        });
        setWsStatus('disconnected');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setWsStatus('disconnected');
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    const data = generateHistoricalData();
    setFileData(data);
    setSelectedFile(data[0].filename);
    setSelectedFileData(data[0].data);

    // Auto-connect to WebSocket on component mount
    connectWebSocket();

    // Cleanup WebSocket on component unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

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

  const handleCsvFileSelect = (csvFilename: string) => {
    // Request CSV data from backend via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const command = {
        command: 'get_csv_data',
        filename: csvFilename
      };
      wsRef.current.send(JSON.stringify(command));
      console.log('Requesting CSV data for:', csvFilename);
    } else {
      console.log('WebSocket not connected, cannot load CSV data');
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('disconnected');
    setIsConnected(false);
  };

  const toggleConnection = () => {
    if (isConnected) {
      disconnectWebSocket();
    } else {
      connectWebSocket();
    }
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
    // Show custom confirmation popup instead of browser alert
    setPendingSamplingRate(newRate);
    setShowSamplingRatePopup(true);
  };
  
  const confirmSamplingRateChange = () => {
    if (pendingSamplingRate === null) return;
    
    const newRate = pendingSamplingRate;
    
    // Send sampling rate change to backend via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const command = {
        command: 'set_sampling_rate',
        rate: newRate
      };

      wsRef.current.send(JSON.stringify(command));
      console.log(`Sending sampling rate change to backend: ${newRate} Hz`);
    } else {
      // If not connected, just update local state
      setSamplingRate(newRate);
      console.log(`WebSocket not connected. Local sampling rate set to: ${newRate} Hz`);
    }
    
    // Close popup
    setShowSamplingRatePopup(false);
    setPendingSamplingRate(null);
  };
  
  const cancelSamplingRateChange = () => {
    setShowSamplingRatePopup(false);
    setPendingSamplingRate(null);
  };

  const exportSelectedFileAsCSV = () => {
    if (selectedCsvFile && selectedCsvData.length > 0) {
      // Export selected CSV file data
      exportToCSV(selectedCsvData, selectedCsvFile);
    } else if (selectedFile && selectedFileData.length > 0) {
      // Export selected JSON file data
      exportToCSV(selectedFileData, selectedFile);
    } else {
      alert('No file selected or no data available to export.');
    }
  };

  const exportAllDataAsCSV = () => {
    console.log('Export all data requested. CSV files available:', csvFiles.length);
    console.log('WebSocket state:', wsRef.current?.readyState);
    
    // Check if connected to backend
    if (wsRef.current?.readyState === WebSocket.OPEN && csvFiles.length > 0) {
      // Show custom confirmation popup
      setShowZipExportPopup(true);
    } else if (fileData.length > 0) {
      // Fallback: Export historical JSON data
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
    } else {
      alert('No data available to export. Please ensure the backend is connected and data is being collected.');
    }
  };
  
  const confirmZipExport = () => {
    const command = {
      command: 'export_all_csv_zip'
    };
    console.log('Sending ZIP export command:', command);
    try {
      wsRef.current?.send(JSON.stringify(command));
      console.log('ZIP export command sent successfully');
    } catch (error) {
      console.error('Failed to send ZIP export command:', error);
      alert('Failed to send export command. Please check the connection.');
    }
    setShowZipExportPopup(false);
  };
  
  const cancelZipExport = () => {
    setShowZipExportPopup(false);
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

  const openCalendarBrowser = () => {
    setShowCalendarBrowser(true);
    // Use dummy data for now, or request from backend if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: 'get_folder_structure' }));
    } else {
      // Use dummy data for demonstration
      setFolderStructure(dummyFolderStructure);
    }
  };

  const closeCalendarBrowser = () => {
    setShowCalendarBrowser(false);
  };

  const toggleNode = (nodePath: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodePath)) {
      newExpanded.delete(nodePath);
    } else {
      newExpanded.add(nodePath);
    }
    setExpandedNodes(newExpanded);
  };

  const handleCalendarFileSelect = (filePath: string) => {
    console.log('Selected file from calendar:', filePath);
    // Add visual feedback for file selection
    // TODO: Load actual CSV data and update charts
    // Close calendar browser after selection
    setShowCalendarBrowser(false);
  };

  const renderFolderNode = (name: string, content: Record<string, unknown> | { filename: string; path: string; size: number; modified: number }, path: string, level: number = 0) => {
    const isExpanded = expandedNodes.has(path);
    const isFile = typeof content === 'object' && 'filename' in content;
    const hasChildren = typeof content === 'object' && !('filename' in content);

    if (isFile) {
      // Render file with glass effect
      return (
        <div
          key={path}
          className={`
            flex items-center space-x-3 py-3 px-4 rounded-xl cursor-pointer transition-all duration-200
            backdrop-blur-sm border border-transparent
            ${isDarkMode
              ? 'hover:bg-gray-700/50 hover:border-gray-600/30 text-gray-300'
              : 'hover:bg-white/50 hover:border-gray-300/30 text-gray-700'
            }
            hover:scale-[1.02] active:scale-[0.98]
          `}
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() => handleCalendarFileSelect((content as { path: string }).path)}
        >
          <div className="p-1 rounded-lg bg-blue-500/20 backdrop-blur-sm">
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium">{(content as { filename: string }).filename}</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100/50 text-gray-500'}`}>
                {((content as { size: number }).size / 1024).toFixed(1)}KB
              </span>
              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {new Date((content as { modified: number }).modified * 1000).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (hasChildren) {
      // Render folder with glass effect
      return (
        <div key={path}>
          <div
            className={`
              flex items-center space-x-3 py-3 px-4 rounded-xl cursor-pointer transition-all duration-200
              backdrop-blur-sm border border-transparent
              ${isDarkMode
                ? 'hover:bg-gray-700/50 hover:border-gray-600/30 text-gray-200'
                : 'hover:bg-white/50 hover:border-gray-300/30 text-gray-800'
              }
              hover:scale-[1.02] active:scale-[0.98]
            `}
            style={{ marginLeft: `${level * 24}px` }}
            onClick={() => toggleNode(path)}
          >
            <div className="flex items-center space-x-2">
              {isExpanded ? (
                <ChevronDown className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              ) : (
                <ChevronRight className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              )}
              <div className="p-1 rounded-lg bg-yellow-500/20 backdrop-blur-sm">
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-yellow-500" />
                ) : (
                  <Folder className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>
            <span className="text-sm font-semibold">{name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100/50 text-gray-500'}`}>
              {Object.keys(content).length} items
            </span>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
            }`}>
            <div className="mt-2 space-y-1 pl-2">
              {Object.entries(content as Record<string, unknown>).map(([childName, childContent]) =>
                renderFolderNode(childName, childContent as Record<string, unknown> | { filename: string; path: string; size: number; modified: number }, `${path}/${childName}`, level + 1)
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`min-h-screen transition-colors ${isDarkMode ? 'bg-gray-900' : 'bg-[#efefef]'}`}>
      {/* Header */}
      <header className="bg-[#019c7c] text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Image
                src={process.env.NODE_ENV === 'production' ? '/Wilo-Cloud-Monitoring/vu.png' : '/vu.png'}
                alt="VU Logo"
                width={60}
                height={60}
                className="rounded-lg object-cover"
              />
            </div>
            <div className="relative">
              <Image
                src={process.env.NODE_ENV === 'production' ? '/Wilo-Cloud-Monitoring/wilo.png' : '/wilo.png'}
                alt="Wilo Logo"
                width={60}
                height={60}
                className="rounded-lg object-cover"
              />
            </div>
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
              <p className="text-sm opacity-90">
                {csvFiles.length > 0 ? `CSV Files: ${csvFiles.length}` : `Total Files: ${fileData.length}`}
              </p>
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
                  disabled={wsStatus === 'connecting'}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${wsStatus === 'connected'
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : wsStatus === 'connecting'
                      ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed'
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                >
                  {wsStatus === 'connected' ? (
                    <Wifi className="h-4 w-4" />
                  ) : wsStatus === 'connecting' ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-800"></div>
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  <span>
                    {wsStatus === 'connected' ? 'Connected' :
                      wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                  </span>
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {wsStatus === 'connected' ? 'Real-time data streaming' :
                  wsStatus === 'connecting' ? 'Establishing connection...' : 'Using historical data'}
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
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${samplingRate === rate
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

            {/* Data Statistics Button */}
            <div>
              <button
                onClick={() => setShowStatsPopup(true)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-[#019c7c]" />
                  <span className="text-sm font-medium">View Data Statistics</span>
                </div>
                <div className="text-xs text-gray-500">
                  {csvFiles.length} CSV files
                </div>
              </button>
            </div>
          </div>

          {/* File List */}
          <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                <FileText className="h-5 w-5 mr-2 text-[#019c7c]" />
                Data Files
              </h2>
              <button
                onClick={openCalendarBrowser}
                className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-[#019c7c] text-white hover:bg-[#018a6f] transition-colors text-sm"
              >
                <Calendar className="h-4 w-4" />
                <span>Browse</span>
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {csvFiles.length > 0 ? (
                csvFiles.map((file) => (
                  <button
                    key={file}
                    onClick={() => handleCsvFileSelect(file)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedCsvFile === file
                        ? 'bg-[#019c7c] text-white'
                        : isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <div className="text-sm font-medium">{file}</div>
                    <div className={`text-xs ${
                      selectedCsvFile === file 
                        ? 'text-white/70' 
                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      CSV • Live data
                    </div>
                  </button>
                ))
              ) : (
                fileData.map((file) => (
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
                    <div className="text-sm font-medium">{file.filename}</div>
                    <div className={`text-xs ${selectedFile === file.filename ? 'text-white/70' : isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      JSON • Historical data
                    </div>
                  </button>
                ))
              )}
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
                    disabled={!selectedFile && !selectedCsvFile}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                      (selectedFile || selectedCsvFile)
                        ? isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        : isDarkMode
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm">
                      Export Selected File as CSV
                      {selectedCsvFile && <span className="text-xs block text-green-500">• {selectedCsvFile}</span>}
                      {selectedFile && !selectedCsvFile && <span className="text-xs block text-blue-500">• {selectedFile}</span>}
                    </span>
                    <FileText className="h-4 w-4" />
                  </button>

                  <button
                    onClick={exportAllDataAsCSV}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    <span className="text-sm">
                      {csvFiles.length > 0 ? 'Export All Data as ZIP' : 'Export All Data as CSV'}
                      <span className="text-xs block text-orange-500">
                        {csvFiles.length > 0 ? `• ${csvFiles.length} CSV files` : '• Historical data'}
                      </span>
                    </span>
                    <FileText className="h-4 w-4" />
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
                      formatter={(value: number) => [
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
          {(selectedFile || selectedCsvFile) && (
            <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  File: {selectedCsvFile || selectedFile}
                </h3>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Records: {selectedCsvFile ? selectedCsvData.length : selectedFileData.length}
                </div>
              </div>
              <div ref={fileChartRef} className="relative">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={(selectedCsvFile ? selectedCsvData : selectedFileData).slice(-50)} // Show last 50 points for better performance
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
                      formatter={(value: number) => [
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
                    Latest {Math.min(50, selectedCsvFile ? selectedCsvData.length : selectedFileData.length)} points
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Reading Chart */}
          {isConnected && (
            <div className={`rounded-lg p-6 shadow-md transition-colors ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <Activity className="h-6 w-6 text-[#019c7c]" />
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Live Sensor Reading
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Live ({samplingRate} Hz)
                    </span>
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Points: {liveData.length}
                  </div>
                </div>
              </div>
              <div className="relative">
                {liveData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={liveData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="liveGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                          <stop offset="50%" stopColor="#f97316" stopOpacity={1} />
                          <stop offset="100%" stopColor="#eab308" stopOpacity={0.8} />
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
                          minute: '2-digit',
                          second: '2-digit'
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
                        formatter={(value: number) => [
                          `${Number(value).toLocaleString()} m/s²`,
                          'Live Reading'
                        ]}
                        labelFormatter={(label) => `Time: ${new Date(label).toLocaleString()}`}
                        cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="acceleration"
                        stroke="url(#liveGradient)"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{
                          r: 6,
                          fill: '#f97316',
                          stroke: '#ffffff',
                          strokeWidth: 2,
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={`h-[300px] flex flex-col items-center justify-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
                    <p className="text-lg font-medium">Waiting for live sensor data...</p>
                    <p className="text-sm opacity-75 mt-1">Connect to backend to see real-time readings</p>
                  </div>
                )}
                
                {/* Live indicator */}
                <div className="absolute top-4 right-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-500 to-orange-500 text-white`}>
                    🔴 LIVE
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Glass UI Calendar Browser Panel */}
      {showCalendarBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Glass Background Overlay */}
          <div
            className="absolute inset-0 backdrop-blur-md bg-black/20"
            onClick={closeCalendarBrowser}
          ></div>

          {/* Glass Panel */}
          <div className="relative w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden">
            {/* Glass morphism container */}
            <div className={`
              backdrop-blur-xl border border-white/20 shadow-2xl
              ${isDarkMode
                ? 'bg-gray-900/80 shadow-black/50'
                : 'bg-white/80 shadow-gray-900/20'
              }
            `}>
              {/* Header with glass effect */}
              <div className={`
                px-8 py-6 border-b border-white/10
                ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'}
              `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-[#019c7c]/20 backdrop-blur-sm">
                      <Calendar className="h-6 w-6 text-[#019c7c]" />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        CSV File Browser
                      </h2>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Navigate through your sensor data files
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeCalendarBrowser}
                    className={`
                      p-3 rounded-xl transition-all duration-200 backdrop-blur-sm
                      ${isDarkMode
                        ? 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white'
                        : 'bg-gray-100/50 hover:bg-gray-200/50 text-gray-600 hover:text-gray-800'
                      }
                      hover:scale-105 active:scale-95
                    `}
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="p-8 overflow-y-auto max-h-[60vh]">
                {Object.keys(folderStructure).length === 0 && Object.keys(dummyFolderStructure).length === 0 ? (
                  <div className="text-center py-12">
                    <div className={`
                      inline-flex p-6 rounded-2xl mb-6
                      ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'}
                      backdrop-blur-sm
                    `}>
                      <Calendar className={`h-16 w-16 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                      No CSV files found
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Start collecting sensor data to see files organized by date
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Info Banner */}
                    <div className={`
                      p-4 rounded-xl border backdrop-blur-sm
                      ${isDarkMode
                        ? 'bg-blue-900/20 border-blue-500/20 text-blue-300'
                        : 'bg-blue-50/50 border-blue-200/50 text-blue-700'
                      }
                    `}>
                      <div className="flex items-center space-x-2">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">
                          Structure: Year → Month → Week → Day → Files
                        </span>
                      </div>
                    </div>

                    {/* File Tree */}
                    <div className={`
                      rounded-xl border backdrop-blur-sm p-6
                      ${isDarkMode
                        ? 'bg-gray-800/30 border-gray-700/30'
                        : 'bg-white/30 border-gray-200/30'
                      }
                    `}>
                      <div className="space-y-2">
                        {Object.entries(Object.keys(folderStructure).length ? folderStructure : dummyFolderStructure).map(([year, yearContent]) =>
                          renderFolderNode(year, yearContent as Record<string, unknown>, year, 0)
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`
                px-8 py-6 border-t border-white/10
                ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'}
              `}>
                <div className="flex justify-between items-center">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Click folders to expand • Click files to select
                  </div>
                  <button
                    onClick={closeCalendarBrowser}
                    className="px-6 py-3 bg-[#019c7c] text-white rounded-xl hover:bg-[#018a6f] transition-all duration-200 backdrop-blur-sm hover:scale-105 active:scale-95 font-medium"
                  >
                    Close Browser
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Popup */}
      {showStatsPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className={`
            w-full max-w-2xl mx-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300
            ${isDarkMode
              ? 'bg-gray-900/90 border-gray-700/50 text-white'
              : 'bg-white/90 border-gray-200/50 text-gray-800'
            }
          `}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#019c7c] rounded-xl">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Data Statistics</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Overview of sensor data collection
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStatsPopup(false)}
                className={`
                  p-2 rounded-xl transition-all duration-200
                  ${isDarkMode
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
                  }
                  hover:scale-105 active:scale-95
                `}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Connection Status */}
              <div className={`
                p-4 rounded-xl border
                ${isConnected
                  ? 'bg-green-500/10 border-green-500/20 text-green-600'
                  : 'bg-red-500/10 border-red-500/20 text-red-600'
                }
              `}>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <Wifi className="h-5 w-5" />
                  ) : (
                    <WifiOff className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {isConnected ? 'Connected - Real-time data streaming' : 'Disconnected - Using historical data'}
                  </span>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${isDarkMode
                    ? 'bg-gray-800/50 border-gray-700/50'
                    : 'bg-gray-50/50 border-gray-200/50'
                  }
                `}>
                  <div className="text-2xl font-bold text-[#019c7c]">{csvFiles.length}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>CSV Files</div>
                </div>
                
                <div className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${isDarkMode
                    ? 'bg-gray-800/50 border-gray-700/50'
                    : 'bg-gray-50/50 border-gray-200/50'
                  }
                `}>
                  <div className="text-2xl font-bold text-[#019c7c]">{samplingRate}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Hz Rate</div>
                </div>
                
                <div className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${isDarkMode
                    ? 'bg-gray-800/50 border-gray-700/50'
                    : 'bg-gray-50/50 border-gray-200/50'
                  }
                `}>
                  <div className="text-2xl font-bold text-[#019c7c]">{liveData.length}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Live Points</div>
                </div>
                
                <div className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${isDarkMode
                    ? 'bg-gray-800/50 border-gray-700/50'
                    : 'bg-gray-50/50 border-gray-200/50'
                  }
                `}>
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {selectedCsvData.length || selectedFileData.length}
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Selected Data</div>
                </div>
              </div>
              
              {/* Additional Info */}
              <div className={`
                p-4 rounded-xl border backdrop-blur-sm
                ${isDarkMode
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50/50 border-gray-200/50'
                }
              `}>
                <h3 className="font-semibold mb-3">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>WebSocket Status:</span>
                    <span className={wsStatus === 'connected' ? 'text-green-600' : 'text-red-600'}>
                      {wsStatus.charAt(0).toUpperCase() + wsStatus.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Selected File:</span>
                    <span>{selectedCsvFile || selectedFile || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Data Structure:</span>
                    <span>Year/Month/Week/Day/Time.csv</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Export Formats:</span>
                    <span>CSV, ZIP Archive</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sampling Rate Confirmation Popup */}
      {showSamplingRatePopup && pendingSamplingRate !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className={`
            w-full max-w-md mx-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300
            ${isDarkMode
              ? 'bg-gray-900/90 border-gray-700/50 text-white'
              : 'bg-white/90 border-gray-200/50 text-gray-800'
            }
          `}>
            {/* Header */}
            <div className="flex items-center space-x-3 p-6 border-b border-white/10">
              <div className="p-3 bg-yellow-500 rounded-xl">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Confirm Sampling Rate Change</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  This will affect system performance
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <div className={`
                p-4 rounded-xl border backdrop-blur-sm
                ${isDarkMode
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50/50 border-gray-200/50'
                }
              `}>
                <div className="text-center space-y-2">
                  <div className="text-lg">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Current:</span>
                    <span className="font-bold text-[#019c7c] mx-2">{samplingRate} Hz</span>
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>→</span>
                    <span className="font-bold text-[#019c7c] mx-2">{pendingSamplingRate} Hz</span>
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    This change will affect data collection quality and system performance.
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex space-x-3 p-6 border-t border-white/10">
              <button
                onClick={cancelSamplingRateChange}
                className={`
                  flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  ${isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  hover:scale-105 active:scale-95
                `}
              >
                Cancel
              </button>
              <button
                onClick={confirmSamplingRateChange}
                className="flex-1 px-4 py-3 bg-[#019c7c] hover:bg-[#018a6f] text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ZIP Export Confirmation Popup */}
      {showZipExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className={`
            w-full max-w-md mx-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300
            ${isDarkMode
              ? 'bg-gray-900/90 border-gray-700/50 text-white'
              : 'bg-white/90 border-gray-200/50 text-gray-800'
            }
          `}>
            {/* Header */}
            <div className="flex items-center space-x-3 p-6 border-b border-white/10">
              <div className="p-3 bg-[#019c7c] rounded-xl">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Export All Data as ZIP</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Download complete sensor data archive
                </p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4">
              <div className={`
                p-4 rounded-xl border backdrop-blur-sm
                ${isDarkMode
                  ? 'bg-gray-800/50 border-gray-700/50'
                  : 'bg-gray-50/50 border-gray-200/50'
                }
              `}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Total CSV Files:</span>
                    <span className="font-bold text-[#019c7c]">{csvFiles.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Data Structure:</span>
                    <span className="text-sm">Year/Month/Week/Day</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Export Format:</span>
                    <span className="text-sm">ZIP Archive</span>
                  </div>
                </div>
              </div>
              
              <div className={`
                p-3 rounded-xl border-l-4 border-blue-500
                ${isDarkMode
                  ? 'bg-blue-900/20 text-blue-300'
                  : 'bg-blue-50 text-blue-700'
                }
              `}>
                <p className="text-sm">
                  This will download all sensor data files organized by the hierarchical date structure. 
                  The download will start automatically once the ZIP file is created.
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex space-x-3 p-6 border-t border-white/10">
              <button
                onClick={cancelZipExport}
                className={`
                  flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  ${isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  hover:scale-105 active:scale-95
                `}
              >
                Cancel
              </button>
              <button
                onClick={confirmZipExport}
                className="flex-1 px-4 py-3 bg-[#019c7c] hover:bg-[#018a6f] text-white rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Export ZIP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
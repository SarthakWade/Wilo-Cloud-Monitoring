import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './index.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const INTERVAL_SECONDS = 300;
const MAX_THRESHOLD = 0.6;
const MIN_THRESHOLD = -0.1;
const API_BASE_URL = 'http://localhost:5000';

// Parameter options for each chart
const BASIC_STATS_OPTIONS = [
  { value: 'raw_z', label: 'Raw Z-Axis' },
  { value: 'max', label: 'Maximum' },
  { value: 'min', label: 'Minimum' },
  { value: 'mean', label: 'Mean' },
  { value: 'abs_mean', label: 'Absolute Mean' },
  { value: 'rms', label: 'RMS' },
  { value: 'variance', label: 'Variance' },
  { value: 'std_dev', label: 'Standard Deviation' },
  { value: 'peak', label: 'Peak' },
  { value: 'peak_to_peak', label: 'Peak-to-Peak' }
];

const HEALTH_RATIOS_OPTIONS = [
  { value: 'crest_factor', label: 'Crest Factor' },
  { value: 'impulse_factor', label: 'Impulse Factor' },
  { value: 'shape_factor', label: 'Shape Factor' },
  { value: 'clearance_factor', label: 'Clearance Factor' }
];

const DISTRIBUTION_OPTIONS = [
  { value: 'skewness', label: 'Skewness' },
  { value: 'kurtosis', label: 'Kurtosis' },
  { value: 'excess_kurtosis', label: 'Excess Kurtosis' },
  { value: 'energy', label: 'Energy' },
  { value: 'zero_crossing_rate', label: 'Zero-Crossing Rate' },
  { value: 'percentile_90', label: '90th Percentile' },
  { value: 'percentile_95', label: '95th Percentile' },
  { value: 'percentile_99', label: '99th Percentile' }
];

// Chart colors for different themes
const getChartColors = (theme, chartIndex) => {
  const isDark = theme === 'dark';
  const colors = [
    { 
      border: isDark ? 'rgb(99, 102, 241)' : 'rgb(59, 130, 246)', 
      bg: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(59, 130, 246, 0.1)' 
    },
    { 
      border: isDark ? 'rgb(16, 185, 129)' : 'rgb(34, 197, 94)', 
      bg: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(34, 197, 94, 0.1)' 
    },
    { 
      border: isDark ? 'rgb(245, 158, 11)' : 'rgb(251, 191, 36)', 
      bg: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(251, 191, 36, 0.1)' 
    }
  ];
  return colors[chartIndex % colors.length];
};

// Chart component
const ParameterChart = ({ 
  chartData, 
  parameter, 
  chartIndex, 
  theme, 
  meta, 
  onParameterChange, 
  options, 
  title 
}) => {
  const colors = getChartColors(theme, chartIndex);
  const isDark = theme === 'dark';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: isDark ? '#e6e6e6' : '#212529',
          font: { size: 10 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(21, 25, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#e6e6e6' : '#212529',
        bodyColor: isDark ? '#e6e6e6' : '#212529',
        borderColor: isDark ? '#2a2f3a' : '#dee2e6',
        borderWidth: 1,
        padding: 8,
        displayColors: true,
        callbacks: {
          title: function(context) {
            return 'Time: ' + context[0].label;
          },
          label: function(context) {
            return context.dataset.label + ': ' + context.parsed.y.toFixed(4);
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Timestamp',
          color: isDark ? '#e6e6e6' : '#212529',
          font: { size: 10 }
        },
        ticks: {
          color: isDark ? '#a0a0a0' : '#6c757d',
          maxTicksLimit: 5,
          font: { size: 9 }
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: chartData?.datasets?.[0]?.label || 'Value',
          color: isDark ? '#e6e6e6' : '#212529',
          font: { size: 10 }
        },
        ticks: {
          color: isDark ? '#a0a0a0' : '#6c757d',
          font: { size: 9 }
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        }
      }
    }
  };

  const data = chartData ? {
    ...chartData,
    datasets: chartData.datasets.map(dataset => ({
      ...dataset,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      pointBackgroundColor: colors.border
    }))
  } : {
    labels: [],
    datasets: [{
      label: 'Loading...',
      data: [],
      borderColor: colors.border,
      backgroundColor: colors.bg
    }]
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-60 dark:bg-opacity-60">
      <div className="p-6">
        <h5 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">{title}</h5>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Parameter
          </label>
          <select 
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={parameter}
            onChange={(e) => onParameterChange(e.target.value)}
          >
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{meta}</div>
        <div className="h-80">
          <Line data={data} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

function App() {
  const [theme, setTheme] = useState('light');
  const [files, setFiles] = useState([]);
  const [lastFile, setLastFile] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [maxViolations, setMaxViolations] = useState(0);
  const [minViolations, setMinViolations] = useState(0);
  const [nextExpected, setNextExpected] = useState('Next expected in: —');
  const [latestActivity, setLatestActivity] = useState('No recent activity');
  const [systemStatus, setSystemStatus] = useState({ 
    text: 'Initializing…', 
    detail: 'Checking connectivity and schedule…', 
    status: 'warn' 
  });
  
  // Three chart states
  const [chart1Parameter, setChart1Parameter] = useState('raw_z');
  const [chart2Parameter, setChart2Parameter] = useState('crest_factor');
  const [chart3Parameter, setChart3Parameter] = useState('skewness');
  const [chart1Data, setChart1Data] = useState(null);
  const [chart2Data, setChart2Data] = useState(null);
  const [chart3Data, setChart3Data] = useState(null);
  const [chart1Meta, setChart1Meta] = useState('Loading chart data...');
  const [chart2Meta, setChart2Meta] = useState('Loading chart data...');
  const [chart3Meta, setChart3Meta] = useState('Loading chart data...');
  
  const socketRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Theme initialization
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  // Load chart data for a specific parameter
  const loadChartData = async (chartNumber, parameter) => {
    const setMeta = chartNumber === 1 ? setChart1Meta : chartNumber === 2 ? setChart2Meta : setChart3Meta;
    const setData = chartNumber === 1 ? setChart1Data : chartNumber === 2 ? setChart2Data : setChart3Data;
    
    setMeta('Loading chart data...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/parameter-data/${parameter}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const chartData = {
        labels: data.timestamps,
        datasets: [{
          label: data.parameter_label || 'Value',
          data: data.parameter_values || data.z_values || [],
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4
        }]
      };
      
      setData(chartData);
      setMeta(`Showing ${data.count} points - ${data.parameter_label}`);
      
      // Update threshold counts only for raw z-axis data
      if (parameter === 'raw_z') {
        setMaxViolations(data.max_violations_count || 0);
        setMinViolations(data.min_violations_count || 0);
      }
      
    } catch (error) {
      console.error('Error loading chart data:', error);
      setMeta(`Error: ${error.message}`);
    }
  };

  // Load all chart data
  const loadAllChartData = () => {
    loadChartData(1, chart1Parameter);
    loadChartData(2, chart2Parameter);
    loadChartData(3, chart3Parameter);
  };

  // Socket.io connection
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket']
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      updateSystemStatus();
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      updateSystemStatus();
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
      updateSystemStatus();
    });

    socket.on('file_created', (fileInfo) => {
      setFiles(prev => {
        const existingIndex = prev.findIndex(f => f.name === fileInfo.name);
        if (existingIndex === -1) {
          return [...prev, fileInfo];
        } else {
          const updated = [...prev];
          updated[existingIndex] = fileInfo;
          return updated;
        }
      });
      setLatestActivity(`New file created: ${fileInfo.name}`);
      updateSystemStatus();
      if (fileInfo.name.startsWith('max_reading')) {
        loadAllChartData();
      }
    });

    socket.on('file_modified', (fileInfo) => {
      setFiles(prev => {
        const index = prev.findIndex(f => f.name === fileInfo.name);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = fileInfo;
          return updated;
        }
        return prev;
      });
      setLatestActivity(`File modified: ${fileInfo.name}`);
      updateSystemStatus();
      if (fileInfo.name.startsWith('max_reading')) {
        loadAllChartData();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [chart1Parameter, chart2Parameter, chart3Parameter]);

  // Initial file load
  useEffect(() => {
    fetch(`${API_BASE_URL}/files`)
      .then(response => response.json())
      .then(data => {
        setFiles(data);
        if (data.length > 0) {
          const latest = data.reduce((acc, f) => {
            const t = new Date(f.modified.replace(' ', 'T'));
            if (!acc || t > acc.time) return { name: f.name, time: t };
            return acc;
          }, null);
          setLastFile(latest);
        }
        startCountdown();
        loadAllChartData();
      })
      .catch(error => {
        console.error('Error loading files:', error);
      });
  }, []);

  // Load chart data when parameters change
  useEffect(() => {
    loadChartData(1, chart1Parameter);
  }, [chart1Parameter]);

  useEffect(() => {
    loadChartData(2, chart2Parameter);
  }, [chart2Parameter]);

  useEffect(() => {
    loadChartData(3, chart3Parameter);
  }, [chart3Parameter]);

  const updateSystemStatus = () => {
    if (socketConnected) {
      setSystemStatus({
        text: 'Connected',
        detail: 'Real-time monitoring active',
        status: 'success'
      });
    } else {
      setSystemStatus({
        text: 'Disconnected',
        detail: 'Attempting to reconnect...',
        status: 'error'
      });
    }
  };

  const startCountdown = () => {
    // Countdown logic can be implemented here
    setNextExpected('Next expected in: 5:00');
  };

  const formatSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      theme === 'dark' 
        ? 'bg-gray-900 text-gray-100' 
        : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-gray-900'
    }`}>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Cloud Monitoring Dashboard</h1>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="text-sm">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</h5>
            <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{files.length}</h2>
            <small className="text-gray-500 dark:text-gray-400">CSV files monitored</small>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400">System Status</h5>
            <h2 className={`text-2xl font-bold ${
              systemStatus.status === 'success' ? 'text-green-600 dark:text-green-400' :
              systemStatus.status === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-yellow-600 dark:text-yellow-400'
            }`}>
              {systemStatus.text}
            </h2>
            <small className="text-gray-500 dark:text-gray-400">{systemStatus.detail}</small>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Threshold (≥ 0.6)</h5>
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{maxViolations}</h2>
            <small className="text-gray-500 dark:text-gray-400">violations detected</small>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400">Min Threshold (≤ -0.1)</h5>
            <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{minViolations}</h2>
            <small className="text-gray-500 dark:text-gray-400">violations detected</small>
          </div>
        </div>

        {/* Three Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <ParameterChart
            chartData={chart1Data}
            parameter={chart1Parameter}
            chartIndex={0}
            theme={theme}
            meta={chart1Meta}
            onParameterChange={setChart1Parameter}
            options={BASIC_STATS_OPTIONS}
            title="Basic Amplitude Statistics"
          />
          
          <ParameterChart
            chartData={chart2Data}
            parameter={chart2Parameter}
            chartIndex={1}
            theme={theme}
            meta={chart2Meta}
            onParameterChange={setChart2Parameter}
            options={HEALTH_RATIOS_OPTIONS}
            title="Severity / Health Ratios"
          />
          
          <ParameterChart
            chartData={chart3Data}
            parameter={chart3Parameter}
            chartIndex={2}
            theme={theme}
            meta={chart3Meta}
            onParameterChange={setChart3Parameter}
            options={DISTRIBUTION_OPTIONS}
            title="Distribution & Extras"
          />
        </div>

        {/* Files Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h5 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Files</h5>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.slice(0, 10).map((file, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{file.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{file.modified}</div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatSize(file.size)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h5 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Activity Log</h5>
              <div className="space-y-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-blue-800 dark:text-blue-200">{latestActivity}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">{nextExpected}</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Socket.IO: {socketConnected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h5 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            🎯 Three Independent Charts
          </h5>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Each chart can display a different parameter simultaneously, allowing easy comparison of multiple statistical measures over time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

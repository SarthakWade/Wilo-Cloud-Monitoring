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
const API_BASE_URL = 'http://localhost:5001';

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

const OPTION_COLORS = [
  '#566246', // Ebony
  '#a4c2a5', // Muted Teal
  '#8ba68c', // Teal variant
  '#6d8a6e', // Darker teal
  '#4a4a48', // Charcoal
  '#7a8a7b', // Grey-teal mix
  '#9db29e', // Light teal
  '#758d76', // Medium teal
  '#5a6b5b', // Dark teal
  '#d8dad3', // Dust Grey
];

// Chart colors for different themes - Soft Linen Palette
const getChartColors = (theme, chartIndex) => {
  const isDark = theme === 'dark';
  const colors = [
    {
      border: isDark ? 'rgb(164, 194, 165)' : 'rgb(86, 98, 70)',
      bg: isDark ? 'rgba(164, 194, 165, 0.15)' : 'rgba(86, 98, 70, 0.1)'
    },
    {
      border: isDark ? 'rgb(139, 166, 140)' : 'rgb(107, 138, 108)',
      bg: isDark ? 'rgba(139, 166, 140, 0.15)' : 'rgba(107, 138, 108, 0.1)'
    },
    {
      border: isDark ? 'rgb(157, 178, 158)' : 'rgb(90, 107, 91)',
      bg: isDark ? 'rgba(157, 178, 158, 0.15)' : 'rgba(90, 107, 91, 0.1)'
    }
  ];
  return colors[chartIndex % colors.length];
};

// Modal component for expanded graph view
const GraphModal = ({ isOpen, onClose, chartData, parameter, title, theme, options, onParameterChange }) => {
  const colors = getChartColors(theme, 0);
  const isDark = theme === 'dark';

  if (!isOpen) return null;

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
          color: isDark ? '#f1f2eb' : '#4a4a48',
          font: { size: 14 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(86, 98, 70, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f1f2eb' : '#4a4a48',
        bodyColor: isDark ? '#f1f2eb' : '#4a4a48',
        borderColor: isDark ? '#4a4a48' : '#d8dad3',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          title: function (context) {
            return 'Time: ' + context[0].label;
          },
          label: function (context) {
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
          font: { size: 14 }
        },
        ticks: {
          color: isDark ? '#a0a0a0' : '#6c757d',
          maxTicksLimit: 10,
          font: { size: 12 }
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
          font: { size: 14 }
        },
        ticks: {
          color: isDark ? '#a0a0a0' : '#6c757d',
          font: { size: 12 }
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-11/12 h-5/6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 group"
          aria-label="Close modal"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Content */}
        <div className="h-full flex flex-col">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{title}</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Parameter
            </label>
            <select
              className="w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 font-medium"
              style={{ color: OPTION_COLORS[options.findIndex(o => o.value === parameter) % OPTION_COLORS.length] || 'inherit' }}
              value={parameter}
              onChange={(e) => onParameterChange(e.target.value)}
            >
              {options.map((option, idx) => (
                <option
                  key={option.value}
                  value={option.value}
                  style={{ color: OPTION_COLORS[idx % OPTION_COLORS.length] }}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-h-0">
            <Line data={data} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
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
  title,
  onExpand
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
          color: isDark ? '#f1f2eb' : '#4a4a48',
          font: { size: 10 }
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(86, 98, 70, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f1f2eb' : '#4a4a48',
        bodyColor: isDark ? '#f1f2eb' : '#4a4a48',
        borderColor: isDark ? '#4a4a48' : '#d8dad3',
        borderWidth: 1,
        padding: 8,
        displayColors: true,
        callbacks: {
          title: function (context) {
            return 'Time: ' + context[0].label;
          },
          label: function (context) {
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
          color: isDark ? '#f1f2eb' : '#4a4a48',
          font: { size: 10 }
        },
        ticks: {
          color: isDark ? '#d8dad3' : '#566246',
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
          color: isDark ? '#f1f2eb' : '#4a4a48',
          font: { size: 10 }
        },
        ticks: {
          color: isDark ? '#d8dad3' : '#566246',
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
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h5>
          <button
            onClick={onExpand}
            className="px-3 py-1.5 text-sm bg-[#566246] hover:bg-[#4a4a48] dark:bg-[#a4c2a5] dark:hover:bg-[#8ba68c] text-[#f1f2eb] rounded-lg transition-colors duration-200 flex items-center gap-2"
            aria-label="Expand graph"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
        </div>
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
        <div
          className="h-80 cursor-pointer hover:opacity-80 transition-opacity duration-200"
          onClick={onExpand}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => e.key === 'Enter' && onExpand()}
        >
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

  // FFT Graph state
  const [fftData, setFftData] = useState(null);
  const [fftMeta, setFftMeta] = useState('Loading FFT data...');

  // Event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTime, setEventTime] = useState('');
  const [eventName, setEventName] = useState('');
  const [selectedExistingEvent, setSelectedExistingEvent] = useState('');
  const [eventHistory, setEventHistory] = useState([]);
  const [eventSubmitting, setEventSubmitting] = useState(false);

  // Modal state
  const [expandedChartIndex, setExpandedChartIndex] = useState(null);

  const socketRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Load event names from backend
  useEffect(() => {
    fetch(`${API_BASE_URL}/event-names`)
      .then(response => response.json())
      .then(data => {
        if (data.event_names) {
          setEventHistory(data.event_names);
        }
      })
      .catch(error => {
        console.error('Error loading event names:', error);
      });
  }, []);

  // Configuration for the three charts to map index to state
  const chartsConfig = [
    {
      data: chart1Data,
      parameter: chart1Parameter,
      setParameter: setChart1Parameter,
      meta: chart1Meta,
      options: BASIC_STATS_OPTIONS,
      title: "Basic Amplitude Statistics"
    },
    {
      data: chart2Data,
      parameter: chart2Parameter,
      setParameter: setChart2Parameter,
      meta: chart2Meta,
      options: HEALTH_RATIOS_OPTIONS,
      title: "Severity / Health Ratios"
    },
    {
      data: chart3Data,
      parameter: chart3Parameter,
      setParameter: setChart3Parameter,
      meta: chart3Meta,
      options: DISTRIBUTION_OPTIONS,
      title: "Distribution & Extras"
    }
  ];

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

  // Load FFT data
  const loadFftData = async () => {
    setFftMeta('Loading FFT data...');

    try {
      const response = await fetch(`${API_BASE_URL}/parameter-data/raw_z`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Calculate slopes for each point
      const slopes = [];
      const values = data.parameter_values || data.z_values || [];

      for (let i = 0; i < values.length; i++) {
        if (i === 0) {
          slopes.push(0); // First point has no slope
        } else {
          const deltaY = values[i] - values[i - 1];
          const deltaX = 1; // Assuming uniform time intervals
          slopes.push(deltaY / deltaX);
        }
      }

      const chartData = {
        labels: data.timestamps,
        datasets: [{
          label: 'Amplitude (FFT)',
          data: values,
          slopes: slopes, // Store slopes for tooltip
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 6
        }]
      };

      setFftData(chartData);
      setFftMeta(`FFT Data - ${data.count} points with slope calculation`);

    } catch (error) {
      console.error('Error loading FFT data:', error);
      setFftMeta(`Error: ${error.message}`);
    }
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

    } catch (error) {
      console.error('Error loading chart data:', error);
      setMeta(`Error: ${error.message}`);
    }
  };

  // Load all chart data
  const loadAllChartData = () => {
    loadFftData();
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
    <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark'
      ? 'bg-[#4a4a48] text-[#f1f2eb]'
      : 'bg-[#f1f2eb] text-[#4a4a48]'
      }`}>
      <div className="container mx-auto px-4 py-6">
        {/* Theme Toggle - Absolute Top Right */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 shadow-lg border border-gray-200 dark:border-gray-700"
            aria-label="Toggle theme"
          >
            <span className="text-xl leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 relative">
          {/* Left: Wilo Logo */}
          <div className="flex-shrink-0 w-48">
            <img src="/wilo.png" alt="Wilo Logo" className="h-12 object-contain" />
          </div>

          {/* Center: Title */}
          <h1 className="text-3xl font-bold text-center flex-grow bg-clip-text text-transparent bg-gradient-to-r from-[#566246] to-[#a4c2a5] dark:from-[#a4c2a5] dark:to-[#d8dad3]">
            Cloud Monitoring Dashboard
          </h1>

          {/* Right: VU Logo */}
          <div className="flex-shrink-0 w-48 flex justify-end">
            <img src="/vu.png" alt="VU Logo" className="h-12 object-contain" />
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Files</h5>
            <h2 className="text-2xl font-bold text-[#566246] dark:text-[#a4c2a5]">{files.length}</h2>
            <small className="text-gray-500 dark:text-gray-400">CSV files monitored</small>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400">System Status</h5>
            <h2 className={`text-2xl font-bold ${systemStatus.status === 'success' ? 'text-green-600 dark:text-green-400' :
              systemStatus.status === 'error' ? 'text-red-600 dark:text-red-400' :
                'text-yellow-600 dark:text-yellow-400'
              }`}>
              {systemStatus.text}
            </h2>
            <small className="text-gray-500 dark:text-gray-400">{systemStatus.detail}</small>
          </div>
        </div>

        {/* Create Event Button and Event Selector */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Previous Event
            </label>
            <select
              value={selectedExistingEvent}
              onChange={(e) => {
                setSelectedExistingEvent(e.target.value);
                setShowEventModal(true);
                setEventTime(''); // Clear time when selecting a new event type
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">-- Select an existing event --</option>
              {eventHistory.map((event, idx) => (
                <option key={idx} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setShowEventModal(true);
              setSelectedExistingEvent(''); // Ensure new event form is shown
              setEventTime('');
              setEventName('');
            }}
            className="px-6 py-3 bg-gradient-to-r from-[#566246] to-[#a4c2a5] hover:from-[#4a4a48] hover:to-[#8ba68c] text-[#f1f2eb] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </button>
        </div>

        {/* FFT Graph */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-60 dark:bg-opacity-60">
            <div className="p-6">
              <h5 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">FFT Amplitude Analysis</h5>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{fftMeta}</div>
              <div className="h-96">
                {fftData && (
                  <Line
                    data={{
                      ...fftData,
                      datasets: fftData.datasets.map(dataset => ({
                        ...dataset,
                        borderColor: theme === 'dark' ? 'rgb(164, 194, 165)' : 'rgb(86, 98, 70)',
                        backgroundColor: theme === 'dark' ? 'rgba(164, 194, 165, 0.15)' : 'rgba(86, 98, 70, 0.1)',
                        pointBackgroundColor: theme === 'dark' ? 'rgb(164, 194, 165)' : 'rgb(86, 98, 70)'
                      }))
                    }}
                    options={{
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
                            color: theme === 'dark' ? '#f1f2eb' : '#4a4a48',
                            font: { size: 12 }
                          }
                        },
                        tooltip: {
                          backgroundColor: theme === 'dark' ? 'rgba(86, 98, 70, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          titleColor: theme === 'dark' ? '#f1f2eb' : '#4a4a48',
                          bodyColor: theme === 'dark' ? '#f1f2eb' : '#4a4a48',
                          borderColor: theme === 'dark' ? '#4a4a48' : '#d8dad3',
                          borderWidth: 1,
                          padding: 12,
                          displayColors: true,
                          callbacks: {
                            title: function (context) {
                              return 'Time: ' + context[0].label;
                            },
                            label: function (context) {
                              const slope = fftData.datasets[0].slopes[context.dataIndex];
                              return [
                                context.dataset.label + ': ' + context.parsed.y.toFixed(4),
                                'Slope (m): ' + slope.toFixed(6)
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        x: {
                          display: true,
                          title: {
                            display: true,
                            text: 'Time',
                            color: theme === 'dark' ? '#f1f2eb' : '#4a4a48',
                            font: { size: 12 }
                          },
                          ticks: {
                            color: theme === 'dark' ? '#d8dad3' : '#566246',
                            maxTicksLimit: 8,
                            font: { size: 10 }
                          },
                          grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                          }
                        },
                        y: {
                          display: true,
                          title: {
                            display: true,
                            text: 'Amplitude',
                            color: theme === 'dark' ? '#f1f2eb' : '#4a4a48',
                            font: { size: 12 }
                          },
                          ticks: {
                            color: theme === 'dark' ? '#d8dad3' : '#566246',
                            font: { size: 10 }
                          },
                          grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
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
            onExpand={() => setExpandedChartIndex(0)}
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
            onExpand={() => setExpandedChartIndex(1)}
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
            onExpand={() => setExpandedChartIndex(2)}
          />
        </div>

        {/* Graph Modal */}
        {expandedChartIndex !== null && (
          <GraphModal
            isOpen={true}
            onClose={() => setExpandedChartIndex(null)}
            chartData={chartsConfig[expandedChartIndex].data}
            parameter={chartsConfig[expandedChartIndex].parameter}
            title={chartsConfig[expandedChartIndex].title}
            theme={theme}
            options={chartsConfig[expandedChartIndex].options}
            onParameterChange={chartsConfig[expandedChartIndex].setParameter}
          />
        )}

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
                <div className="p-3 bg-[#d8dad3] dark:bg-[#566246]/30 rounded-lg">
                  <div className="text-sm text-[#566246] dark:text-[#d8dad3]">{latestActivity}</div>
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

        {/* Event Creation Modal */}
        {showEventModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={() => {
              setShowEventModal(false);
              setEventTime('');
              setEventName('');
              setSelectedExistingEvent('');
            }}
          >
            <div
              className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowEventModal(false);
                  setEventTime('');
                  setEventName('');
                  setSelectedExistingEvent('');
                }}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 group"
                aria-label="Close modal"
              >
                <svg
                  className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Modal Content */}
              <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                {selectedExistingEvent ? 'Log Existing Event' : 'Create New Event'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Event Time
                  </label>
                  <input
                    type="datetime-local"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {selectedExistingEvent ? (
                  <div className="p-4 bg-[#d8dad3] dark:bg-[#566246]/30 rounded-lg border border-[#a4c2a5] dark:border-[#566246]">
                    <p className="text-sm font-medium text-[#566246] dark:text-[#d8dad3]">
                      Event Name:
                    </p>
                    <p className="text-lg font-bold text-[#4a4a48] dark:text-[#f1f2eb] mt-1">
                      {selectedExistingEvent}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Event Name
                    </label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="Enter new event name..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}

                <button
                  onClick={async () => {
                    const finalEventName = selectedExistingEvent || eventName;

                    if (!eventTime || !finalEventName) {
                      alert('Please fill in all required fields');
                      return;
                    }

                    setEventSubmitting(true);

                    try {
                      // Convert datetime-local format to ISO format
                      const failureTimeISO = new Date(eventTime).toISOString();

                      const response = await fetch(`${API_BASE_URL}/create-event`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          event_name: finalEventName,
                          failure_time_iso: failureTimeISO
                        })
                      });

                      const data = await response.json();

                      if (!response.ok) {
                        throw new Error(data.error || 'Failed to create event');
                      }

                      alert(`Event "${finalEventName}" successfully logged!\n\nEvent ID: ${data.event_id}\nTime Before Failure: ${Math.abs(data.metadata.time_before_failure_seconds).toFixed(2)} seconds\nData Points Tracked: ${data.metadata.total_data_points}\n\nAnalyzing slopes from ${Math.abs(data.metadata.time_before_failure_seconds).toFixed(2)}s before failure back to baseline.`);

                      // Refresh event names list
                      const namesResponse = await fetch(`${API_BASE_URL}/event-names`);
                      const namesData = await namesResponse.json();
                      if (namesData.event_names) {
                        setEventHistory(namesData.event_names);
                      }

                      // Reset form
                      setEventTime('');
                      setEventName('');
                      setSelectedExistingEvent('');
                      setShowEventModal(false);

                    } catch (error) {
                      console.error('Error creating event:', error);
                      alert(`Error: ${error.message}`);
                    } finally {
                      setEventSubmitting(false);
                    }
                  }}
                  disabled={eventSubmitting}
                  className={`w-full px-6 py-3 bg-gradient-to-r from-[#566246] to-[#a4c2a5] hover:from-[#4a4a48] hover:to-[#8ba68c] text-[#f1f2eb] font-semibold rounded-lg shadow-lg transition-all duration-200 ${eventSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {eventSubmitting ? 'Creating...' : (selectedExistingEvent ? 'Log Event' : 'Create Event')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

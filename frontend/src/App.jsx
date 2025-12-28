import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { io } from 'socket.io-client';
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
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

// Chart colors for different themes - Modern Gradient Palette
const getChartColors = (theme, chartIndex) => {
  const isDark = theme === 'dark';
  const colors = [
    {
      border: isDark ? 'rgb(52, 211, 153)' : 'rgb(16, 185, 129)',
      bg: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)'
    },
    {
      border: isDark ? 'rgb(96, 165, 250)' : 'rgb(59, 130, 246)',
      bg: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.1)'
    },
    {
      border: isDark ? 'rgb(167, 139, 250)' : 'rgb(139, 92, 246)',
      bg: isDark ? 'rgba(167, 139, 250, 0.15)' : 'rgba(139, 92, 246, 0.1)'
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
    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h5 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h5>
          <button
            onClick={onExpand}
            className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
            aria-label="Expand graph"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
            Parameter
          </label>
          <select
            className="w-full px-3 py-2.5 border border-slate-200/50 dark:border-slate-600/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white/80 dark:bg-slate-700/80 text-slate-900 dark:text-slate-100 transition-all duration-200"
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
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{meta}</div>
        <div
          className="h-72 cursor-pointer rounded-xl bg-slate-50/50 dark:bg-slate-900/30 p-3 transition-all duration-200 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
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
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark'
      ? 'bg-slate-900 text-slate-100'
      : 'bg-slate-50 text-slate-900'
      }`}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Theme Toggle - Floating */}
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl hover:bg-white dark:hover:bg-slate-700 transition-all duration-300 shadow-lg border border-slate-200/50 dark:border-slate-700/50 hover:scale-105"
            aria-label="Toggle theme"
          >
            <span className="text-xl leading-none block transition-transform duration-300 hover:rotate-12">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>

        {/* Header - Enhanced */}
        <header className="mb-10 relative">
          <div className="flex items-center justify-between bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50">
            {/* Left: Wilo Logo */}
            <div className="flex-shrink-0 w-40">
              <img src="/wilo.png" alt="Wilo Logo" className="h-10 object-contain opacity-90 hover:opacity-100 transition-opacity" />
            </div>

            {/* Center: Title */}
            <div className="text-center flex-grow">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Cloud Monitoring Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time sensor data analysis</p>
            </div>

            {/* Right: VU Logo */}
            <div className="flex-shrink-0 w-40 flex justify-end">
              <img src="/vu.png" alt="VU Logo" className="h-10 object-contain opacity-90 hover:opacity-100 transition-opacity" />
            </div>
          </div>
          
          {/* Gradient accent line */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent rounded-full opacity-50"></div>
        </header>

        {/* Status Cards - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Total Files Card */}
          <div className="group relative overflow-hidden bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h5 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Files</h5>
              </div>
              <div className="text-4xl font-bold text-emerald-500 mb-1">{files.length}</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">CSV files monitored</p>
            </div>
          </div>

          {/* System Status Card */}
          <div className="group relative overflow-hidden bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2 ${systemStatus.status === 'success' ? 'bg-gradient-to-br from-emerald-500/20 to-transparent' : systemStatus.status === 'error' ? 'bg-gradient-to-br from-red-500/20 to-transparent' : 'bg-gradient-to-br from-amber-500/20 to-transparent'}`}></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${systemStatus.status === 'success' ? 'bg-emerald-500/10' : systemStatus.status === 'error' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                  <svg className={`w-6 h-6 ${systemStatus.status === 'success' ? 'text-emerald-500' : systemStatus.status === 'error' ? 'text-red-500' : 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h5 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">System Status</h5>
              </div>
              <div className="flex items-center gap-3 mb-1">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${systemStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : systemStatus.status === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${systemStatus.status === 'success' ? 'bg-emerald-500' : systemStatus.status === 'error' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                  {systemStatus.text}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{systemStatus.detail}</p>
            </div>
          </div>
        </div>

        {/* Create Event Section - Enhanced */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Select Previous Event
            </label>
            <select
              value={selectedExistingEvent}
              onChange={(e) => {
                setSelectedExistingEvent(e.target.value);
                setShowEventModal(true);
                setEventTime('');
              }}
              className="w-full px-4 py-3 border border-slate-300/50 dark:border-slate-600/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 transition-all duration-200"
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
              setSelectedExistingEvent('');
              setEventTime('');
              setEventName('');
            }}
            className="group px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 flex items-center gap-3 hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Event
          </button>
        </div>

        {/* FFT Graph - Enhanced */}
        <div className="mb-8">
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-xl font-bold text-slate-900 dark:text-slate-100">FFT Amplitude Analysis</h5>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{fftMeta}</p>
                </div>
              </div>
              <div className="h-96 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 p-4">
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

        {/* Three Charts - Enhanced Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
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

        {/* Files Section - Enhanced */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Files */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <h5 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent Files</h5>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {files.slice(0, 10).map((file, index) => (
                  <div key={index} className="group flex justify-between items-center p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{file.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{file.modified}</div>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {formatSize(file.size)}
                    </div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">No files yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h5 className="text-lg font-bold text-slate-900 dark:text-slate-100">Activity Log</h5>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Latest Activity
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">{latestActivity}</div>
                </div>
                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl flex items-center gap-3">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{nextExpected}</div>
                </div>
                <div className="p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Socket.IO</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${socketConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {socketConnected ? 'Connected' : 'Disconnected'}
                  </span>
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

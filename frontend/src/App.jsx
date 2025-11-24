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

function App() {
  const [theme, setTheme] = useState('light');
  const [files, setFiles] = useState([]);
  const [lastFile, setLastFile] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartMeta, setChartMeta] = useState('Loading chart data...');
  const [maxViolations, setMaxViolations] = useState(0);
  const [minViolations, setMinViolations] = useState(0);
  const [nextExpected, setNextExpected] = useState('Next expected in: —');
  const [latestActivity, setLatestActivity] = useState('No recent activity');
  const [systemStatus, setSystemStatus] = useState({ text: 'Initializing…', detail: 'Checking connectivity and schedule…', status: 'warn' });
  const socketRef = useRef(null);
  const chartRef = useRef(null);
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
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  // Socket.io connection
  useEffect(() => {
    const socket = io({
      transports: ['websocket'],
      path: window.location.pathname + 'socket.io'
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
        loadChartData();
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
        loadChartData();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Initial file load
  useEffect(() => {
    fetch('/files')
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
          previewFile(data[0].name);
        }
        startCountdown();
      })
      .catch(err => console.error('Failed to load files:', err));
  }, []);

  // Update lastFile when files change
  useEffect(() => {
    if (files && files.length) {
      const latest = files.reduce((acc, f) => {
        const t = new Date(f.modified.replace(' ', 'T'));
        if (!acc || t > acc.time) return { name: f.name, time: t };
        return acc;
      }, null);
      setLastFile(latest);
    }
  }, [files]);

  // Chart initialization
  useEffect(() => {
    loadChartData();
  }, []);

  // Update chart theme when theme changes
  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current;
      const isDark = theme === 'dark';
      
      // Update dataset colors
      if (chart.data.datasets[0]) {
        chart.data.datasets[0].borderColor = isDark ? 'rgb(99, 102, 241)' : 'rgb(59, 130, 246)';
        chart.data.datasets[0].backgroundColor = isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(59, 130, 246, 0.1)';
        chart.data.datasets[0].pointBackgroundColor = isDark ? 'rgb(99, 102, 241)' : 'rgb(59, 130, 246)';
      }
      
      // Update options
      chart.options.plugins.legend.labels.color = isDark ? '#e6e6e6' : '#212529';
      chart.options.plugins.tooltip.backgroundColor = isDark ? 'rgba(21, 25, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)';
      chart.options.plugins.tooltip.titleColor = isDark ? '#e6e6e6' : '#212529';
      chart.options.plugins.tooltip.bodyColor = isDark ? '#e6e6e6' : '#212529';
      chart.options.plugins.tooltip.borderColor = isDark ? '#2a2f3a' : '#dee2e6';
      chart.options.scales.x.title.color = isDark ? '#e6e6e6' : '#212529';
      chart.options.scales.x.ticks.color = isDark ? '#a0a0a0' : '#6c757d';
      chart.options.scales.x.grid.color = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
      chart.options.scales.y.title.color = isDark ? '#e6e6e6' : '#212529';
      chart.options.scales.y.ticks.color = isDark ? '#a0a0a0' : '#6c757d';
      chart.options.scales.y.grid.color = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
      
      chart.update();
    }
  }, [theme, chartData]);

  // Countdown timer
  useEffect(() => {
    startCountdown();
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [lastFile]);

  const parseFileTime = (s) => {
    return new Date(s.replace(' ', 'T'));
  };


  const startCountdown = () => {
    if (countdownTimerRef.current) return;
    countdownTimerRef.current = setInterval(() => {
      updateNextExpected();
    }, 1000);
  };

  const updateNextExpected = () => {
    if (!lastFile || !lastFile.time || isNaN(lastFile.time.getTime())) {
      setNextExpected('Next expected in: —');
      updateSystemStatus();
      return;
    }
    const now = new Date();
    const elapsedSec = Math.floor((now - lastFile.time) / 1000);
    const remaining = INTERVAL_SECONDS - elapsedSec;
    if (remaining >= 0) {
      setNextExpected(`Next expected in: ${formatHMS(remaining)}`);
    } else {
      setNextExpected(`Overdue by: ${formatHMS(Math.abs(remaining))}`);
    }
    updateSystemStatus(remaining);
  };

  const formatHMS = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    if (hh === '00') return `${mm}:${ss}`;
    return `${hh}:${mm}:${ss}`;
  };

  const updateSystemStatus = (remainingOverride) => {
    const now = new Date();
    let remaining;
    if (typeof remainingOverride === 'number') {
      remaining = remainingOverride;
    } else if (lastFile && lastFile.time) {
      const elapsedSec = Math.floor((now - lastFile.time) / 1000);
      remaining = INTERVAL_SECONDS - elapsedSec;
    } else {
      remaining = null;
    }

    if (!socketConnected) {
      setSystemStatus({
        text: 'Disconnected',
        detail: 'Realtime channel is offline',
        status: 'bad'
      });
      return;
    }

    if (remaining == null) {
      setSystemStatus({
        text: 'Awaiting first file',
        detail: 'Connected, waiting for initial data',
        status: 'warn'
      });
      return;
    }

    const grace = Math.floor(INTERVAL_SECONDS * 0.2);
    if (remaining >= -grace) {
      setSystemStatus({
        text: 'All systems normal',
        detail: 'Receiving on schedule',
        status: 'ok'
      });
    } else {
      setSystemStatus({
        text: 'Delayed',
        detail: 'Data overdue beyond grace',
        status: 'warn'
      });
    }
  };

  const loadChartData = () => {
    setChartMeta('Loading chart data...');
    fetch('/chart-data')
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          setChartMeta('Error: ' + data.error);
          return;
        }
        setChartData(data);
        setMaxViolations(data.max_violations_count || 0);
        setMinViolations(data.min_violations_count || 0);
        setChartMeta(`Showing ${data.count} points from ${data.filename}`);
      })
      .catch(error => {
        setChartMeta('Failed to load chart data: ' + error.message);
      });
  };

  const previewFile = async (name) => {
    try {
      const res = await fetch(`/view/${encodeURIComponent(name)}`);
      const text = await res.text();
      setSelectedFile(name);
      setCsvContent(text);
    } catch (e) {
      setSelectedFile(name);
      setCsvContent(null);
      console.error('Failed to load file:', e);
    }
  };

  const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let inQuotes = false;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        } else { field += ch; i++; continue; }
      } else {
        if (ch === '"') { inQuotes = true; i++; continue; }
        if (ch === ',') { pushField(); i++; continue; }
        if (ch === '\n') { pushField(); pushRow(); i++; continue; }
        if (ch === '\r') {
          if (text[i + 1] === '\n') { pushField(); pushRow(); i += 2; continue; }
          pushField(); pushRow(); i++; continue;
        }
        field += ch; i++; continue;
      }
    }
    pushField();
    if (row.length > 1 || row[0] !== '') pushRow();
    return rows.slice(0, 500);
  };

  const escapeHtml = (s) => {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const classifyCell = (raw) => {
    const val = (raw ?? '').trim();
    if (val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'na') {
      return { cls: 'null', val: val };
    }
    const lower = val.toLowerCase();
    if (lower === 'true') return { cls: 'bool-true', val };
    if (lower === 'false') return { cls: 'bool-false', val };
    const num = Number(val.replace(/,/g, ''));
    if (!isNaN(num) && isFinite(num)) return { cls: 'num', val };
    return { cls: '', val };
  };

  const formatSize = (bytes) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  const sortedFiles = [...files].sort((a, b) => new Date(b.modified) - new Date(a.modified));
  const totalSize = files.reduce((acc, file) => acc + file.size, 0);
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
          font: { size: 12 },
          filter: (legendItem) => legendItem.datasetIndex === 0
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(21, 25, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#e6e6e6' : '#212529',
        bodyColor: isDark ? '#e6e6e6' : '#212529',
        borderColor: isDark ? '#2a2f3a' : '#dee2e6',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        filter: (tooltipItem) => tooltipItem.datasetIndex === 0,
        callbacks: {
          title: (context) => 'Timestamp: ' + context[0].label,
          label: (context) => 'Z: ' + context.parsed.y.toFixed(6)
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
          font: { size: 14, weight: 'bold' }
        },
        ticks: {
          color: isDark ? '#a0a0a0' : '#6c757d',
          maxTicksLimit: 10,
          callback: function(value, index, values) {
            const label = this.getLabelForValue(value);
            return parseFloat(label).toFixed(2);
          }
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Z-Axis Value',
          color: isDark ? '#e6e6e6' : '#212529',
          font: { size: 14, weight: 'bold' }
        },
        ticks: {
          color: isDark ? '#a0a0a0' : '#6c757d'
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        }
      }
    }
  };

  const chartDataConfig = chartData ? {
    labels: chartData.timestamps,
    datasets: [
      {
        label: 'Z-Axis Value',
        data: chartData.z_values,
        borderColor: isDark ? 'rgb(99, 102, 241)' : 'rgb(59, 130, 246)',
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: isDark ? 'rgb(99, 102, 241)' : 'rgb(59, 130, 246)',
        order: 1
      },
      {
        label: 'Max Threshold (0.6)',
        data: new Array(chartData.timestamps.length).fill(MAX_THRESHOLD),
        borderColor: 'rgb(220, 53, 69)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 0,
        hidden: false
      },
      {
        label: 'Min Threshold (-0.1)',
        data: new Array(chartData.timestamps.length).fill(MIN_THRESHOLD),
        borderColor: 'rgb(255, 193, 7)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 0,
        hidden: false
      }
    ]
  } : null;

  let csvRows = null;
  if (csvContent) {
    csvRows = parseCSV(csvContent);
  }

  return (
    <div className="container mx-auto py-4 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold mb-0">CSV File Monitor Dashboard</h1>
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          type="button"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="ml-1">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-2">Total Files</h5>
          <h2 className="text-3xl font-bold">{files.length}</h2>
        </div>
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-2">System Status</h5>
          <p className="mb-1">
            <span className={`status-dot status-${systemStatus.status}`}></span>
            <span>{systemStatus.text}</span>
          </p>
          <small className="text-gray-500 dark:text-gray-400">{systemStatus.detail}</small>
        </div>
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-2">Latest Activity</h5>
          <p>{latestActivity}</p>
          <p className="text-gray-500 dark:text-gray-400 mb-0">{nextExpected}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-2">Total Size</h5>
          <h2 className="text-3xl font-bold">{formatSize(totalSize)}</h2>
        </div>
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-2">Max Threshold (≥ 0.6)</h5>
          <h2 className="text-3xl font-bold text-red-600">{maxViolations}</h2>
          <small className="text-gray-500 dark:text-gray-400">violations detected</small>
        </div>
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-2">Min Threshold (≤ -0.1)</h5>
          <h2 className="text-3xl font-bold text-yellow-600">{minViolations}</h2>
          <small className="text-gray-500 dark:text-gray-400">violations detected</small>
        </div>
      </div>

      {/* Chart Section */}
      <div className="mb-4">
        <div className="glass-card rounded-lg p-4">
          <h5 className="text-lg font-semibold mb-3">Z-Axis Readings - Latest Max Reading</h5>
          <div className="text-gray-500 dark:text-gray-400 text-sm mb-2">{chartMeta}</div>
          <div style={{ position: 'relative', height: '400px' }}>
            {chartDataConfig && (
              <Line ref={chartRef} data={chartDataConfig} options={chartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Files and Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedFiles.map((file, idx) => (
              <div key={file.name} className="mb-4">
                {idx === 0 && <div className="recent-strip">Most Recent</div>}
                <div className={`glass-card rounded-lg p-4 file-card ${idx === 0 ? 'rounded-t-none' : ''}`}>
                  <h5 className="text-lg font-semibold mb-2">{file.name}</h5>
                  <p className="text-sm mb-2">
                    Size: {formatSize(file.size)}<br />
                    Modified: {file.modified}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => previewFile(file.name)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Preview
                    </button>
                    <a
                      href={`/download/${encodeURIComponent(file.name)}`}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="glass-card rounded-lg p-4 sticky top-4">
            <h5 className="text-lg font-semibold mb-3">Inline Preview</h5>
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-2">
              {selectedFile || 'Select a file to preview'}
            </div>
            <div className="csv-viewer">
              {csvRows ? (
                csvRows.length > 0 ? (
                  <table className="csv-table">
                    {csvRows.length > 1 && csvRows[0].every(cell => isNaN(Number(cell)) === true) && (
                      <thead>
                        <tr>
                          {csvRows[0].map((h, i) => (
                            <th key={i}>{escapeHtml(h)}</th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {(csvRows.length > 1 && csvRows[0].every(cell => isNaN(Number(cell)) === true) ? csvRows.slice(1) : csvRows).map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => {
                            const cl = classifyCell(c);
                            return (
                              <td key={j} className={cl.cls} title={escapeHtml(cl.val)}>
                                {escapeHtml(cl.val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">Empty file</div>
                )
              ) : (
                <div className="text-gray-500 dark:text-gray-400">No file selected</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

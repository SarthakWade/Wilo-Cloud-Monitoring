"use client";

import {
  Activity,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Moon,
  Sun,
  Wifi,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  timestamp: string;
  acceleration: number;
}

interface WebSocketMessage {
  type: string;
  data?: {
    connected: boolean;
    sampling_rate: number;
    csv_files?: number;
    total_samples?: number;
    latest_file?: string;
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
  | "max"
  | "min"
  | "average"
  | "mean"
  | "standardDeviation"
  | "skewness";

const aggregateData = (
  data: DataPoint[],
  zoom: "months" | "dates" | "time",
  aggregation: AggregationType
) => {
  const grouped: Record<string, DataPoint[]> = {};
  const now = new Date();

  data.forEach((d) => {
    const date = new Date(d.timestamp);
    let key: string;

    if (zoom === "months") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
    } else if (zoom === "dates") {
      key = date.toISOString().split("T")[0];
    } else {
      // Group by 2-hour intervals for time zoom, working backwards from current time
      const hours = date.getHours();
      const intervalHour = Math.floor(hours / 2) * 2; // Round down to nearest 2-hour interval
      const timeKey = `${String(intervalHour).padStart(2, "0")}:00`;
      key = `${date.toISOString().split("T")[0]} ${timeKey}`;
    }

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  const result = Object.entries(grouped)
    .map(([key, points]) => {
      const values = points.map((p) => p.acceleration);
      let value: number;

      switch (aggregation) {
        case "max":
          value = Math.max(...values);
          break;
        case "min":
          value = Math.min(...values);
          break;
        case "average":
        case "mean":
          value =
            Math.round(
              (values.reduce((a, b) => a + b, 0) / values.length) * 100
            ) / 100;
          break;
        case "standardDeviation": {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const variance =
            values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
            values.length;
          value = Math.round(Math.sqrt(variance) * 100) / 100;
          break;
        }
        case "skewness": {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const stdDev = Math.sqrt(
            values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length
          );
          const skew =
            values.reduce((a, b) => a + Math.pow((b - avg) / stdDev, 3), 0) /
            values.length;
          value = Math.round(skew * 1000) / 1000;
          break;
        }
        default:
          value = Math.max(...values);
      }

      // Format time display for better readability
      let displayTime = key;
      if (zoom === "time") {
        const datePart = key.split(" ")[0];
        const timePart = key.split(" ")[1];
        const keyDate = new Date(datePart);
        const isToday = keyDate.toDateString() === now.toDateString();
        const isYesterday =
          keyDate.toDateString() ===
          new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();

        if (isToday) {
          displayTime = `Today ${timePart}`;
        } else if (isYesterday) {
          displayTime = `Yesterday ${timePart}`;
        } else {
          displayTime = `${keyDate.toLocaleDateString()} ${timePart}`;
        }
      }

      return {
        time: displayTime,
        acceleration: value,
        dataPoints: points.length,
      };
    })
    .sort((a, b) => {
      // Sort by actual timestamp, not display time
      const getTimestamp = (item: { time: string }) => {
        if (item.time.startsWith("Today")) {
          const timeStr = item.time.replace("Today ", "");
          const today = new Date();
          const [hours] = timeStr.split(":").map(Number);
          return new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            hours
          ).getTime();
        } else if (item.time.startsWith("Yesterday")) {
          const timeStr = item.time.replace("Yesterday ", "");
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [hours] = timeStr.split(":").map(Number);
          return new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
            hours
          ).getTime();
        } else {
          return new Date(item.time).getTime();
        }
      };
      return getTimestamp(a) - getTimestamp(b);
    });

  // For time zoom, show only the last 12 intervals (24 hours)
  if (zoom === "time") {
    return result.slice(-12);
  }

  return result;
};

const Dashboard: React.FC = () => {
  const [mainChartData, setMainChartData] = useState<
    { time: string; acceleration: number; dataPoints: number }[]
  >([]);
  const [zoomLevel, setZoomLevel] = useState<"months" | "dates" | "time">(
    "time"
  );
  const [aggregationType, setAggregationType] =
    useState<AggregationType>("max");
  const [domain, setDomain] = useState<[string, string] | undefined>(undefined);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [samplingRate] = useState<number>(800); // Fixed sampling rate
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<{
    csvFiles: number;
    totalSamples: number;
    samplingRate: number;
    latestFile?: string;
  } | null>(null);
  const verboseLogs = false;
  const describeEvent = (ev: unknown): string => {
    try {
      if (!ev) return "";
      if (typeof ev === "string") return ev;
      if (typeof ev === "object") {
        const anyEv = ev as {
          type?: string;
          message?: string;
          code?: number;
          reason?: string;
          wasClean?: boolean;
        };
        const out: Record<string, unknown> = {};
        if (anyEv.type) out.type = anyEv.type;
        if (anyEv.message) out.message = anyEv.message;
        if (typeof anyEv.code === "number") out.code = anyEv.code;
        if (anyEv.reason) out.reason = anyEv.reason;
        if (typeof anyEv.wasClean === "boolean") out.wasClean = anyEv.wasClean;
        const json = JSON.stringify(out);
        return json === "{}" ? "" : json;
      }
      const s = String(ev);
      return s === "[object Event]" ? "" : s;
    } catch {
      return "";
    }
  };
  const chartRef = useRef<HTMLDivElement>(null);
  const fileChartRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [showCalendarBrowser, setShowCalendarBrowser] =
    useState<boolean>(false);
  const [folderStructure, setFolderStructure] = useState<
    Record<string, unknown>
  >({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [liveData, setLiveData] = useState<DataPoint[]>([]);
  const [selectedCsvFile, setSelectedCsvFile] = useState<string>("");
  const [selectedCsvData, setSelectedCsvData] = useState<DataPoint[]>([]);
  const [realSensorData, setRealSensorData] = useState<DataPoint[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Popup states
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  // Sampling rate popup removed - rate is now fixed
  const [showZipExportPopup, setShowZipExportPopup] = useState(false);

  // Notification system
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // Auto-dismiss after 4 seconds
  };

  // Function to load recent CSV files and aggregate for main chart
  const loadRecentSensorData = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsLoadingData(true);
      const command = { command: "get_recent_data" };
      wsRef.current.send(JSON.stringify(command));
    } else {
      // Try to reconnect and then fetch
      showNotification("Trying to reconnect to backend…", "info");
      connectWebSocket();
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          setIsLoadingData(true);
          wsRef.current.send(JSON.stringify({ command: "get_status" }));
          wsRef.current.send(JSON.stringify({ command: "get_file_list" }));
          wsRef.current.send(JSON.stringify({ command: "get_recent_data" }));
        } else {
          showNotification(
            "Reconnection failed. Please ensure backend is running.",
            "error"
          );
        }
      }, 1200);
    }
  }, []);

  // Setup WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setWsStatus("connecting");

    try {
      // Get backend IP from environment variable or default to localhost
      const backendHost = process.env.NEXT_PUBLIC_BACKEND_HOST || "localhost";
      const websocketUrl = `ws://${backendHost}:8765`;

      console.log(`Attempting to connect to backend at ${websocketUrl}`);

      const ws = new WebSocket(websocketUrl);

      ws.onopen = () => {
        console.log("WebSocket connected to", websocketUrl);
        setWsStatus("connected");
        setIsConnected(true);
        wsRef.current = ws;

        // Request initial status and file list
        ws.send(JSON.stringify({ command: "get_status" }));
        ws.send(JSON.stringify({ command: "get_file_list" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          const info = describeEvent(error);
          if (verboseLogs && info) console.debug("WS parse error:", info);
        }
      };

      ws.onclose = (event) => {
        const info = describeEvent(event);
        console.log("WS closed:", info, "state:", {
          url: ws.url,
          ts: new Date().toISOString(),
        });
        setWsStatus("disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Auto-retry connection after 3 seconds
        setTimeout(() => {
          if (wsRef.current === null) {
            console.log("Attempting to reconnect WebSocket...");
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        const info = describeEvent(error);
        console.log("WS error:", info, "state:", {
          readyState: ws.readyState,
          url: ws.url,
          ts: new Date().toISOString(),
        });
        setWsStatus("disconnected");
        setIsConnected(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setWsStatus("disconnected");
      setIsConnected(false);
    }
  }, [verboseLogs]);

  const handleWebSocketMessage = useCallback(
    (data: WebSocketMessage) => {
      switch (data.type) {
        case "status":
          // Update connection status from backend
          if (data.data) {
            setIsConnected(data.data.connected);
            // Sampling rate is now fixed at 800 Hz
            // Update backend-derived stats for realtime display
            try {
              setBackendStatus({
                csvFiles: data.data?.csv_files ?? 0,
                totalSamples: data.data?.total_samples ?? 0,
                samplingRate: data.data?.sampling_rate ?? samplingRate,
                latestFile: data.data?.latest_file,
              });
            } catch (e) {
              // Handle error silently
            }

            // Generate realistic live data for demonstration
            if (data.data.connected) {
              // Generate realistic acceleration values (similar to actual sensor data)
              const baseAcceleration = 9.81; // 1g in m/s²
              const variation = (Math.random() - 0.5) * 1.0; // ±0.5g variation
              const acceleration =
                Math.round((baseAcceleration + variation) * 100) / 100;

              const newLivePoint = {
                timestamp: new Date().toISOString(),
                acceleration: Math.max(0.1, acceleration), // Ensure minimum positive value
              };
              setLiveData((prev) => {
                const updated = [...prev, newLivePoint];
                // Keep only last 50 points for performance
                return updated.slice(-50);
              });
            }
          }
          break;

        case "new_file":
          // Handle new CSV file notification
          console.log("New CSV file created:", data.filename);

          // Auto-refresh recent data when new files are created
          setTimeout(() => {
            if (
              wsRef.current?.readyState === WebSocket.OPEN &&
              !isLoadingData
            ) {
              console.log(
                "Auto-refreshing data due to new file:",
                data.filename
              );
              loadRecentSensorData();
            }
          }, 1000); // Small delay to ensure file is fully written

          // Request updated file list from backend
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ command: "get_file_list" }));
          }
          break;

        case "zip_export":
          // Handle ZIP file download from backend
          console.log("Received ZIP export response:", data);
          if (data.download_url) {
            console.log("Downloading ZIP from URL:", data.download_url);

            // Create download link and trigger download
            const link = document.createElement("a");
            link.href = data.download_url;
            link.download =
              data.filename ||
              `sensor_data_export_${
                new Date().toISOString().split("T")[0]
              }.zip`;
            link.style.display = "none";
            document.body.appendChild(link);

            // Trigger download
            link.click();

            // Clean up
            document.body.removeChild(link);

            console.log(
              `ZIP download initiated: ${data.filename} with ${data.file_count} files`
            );
            showNotification(
              `ZIP export successful! Files exported: ${data.file_count}. Download should start automatically.`,
              "success"
            );
          } else if (data.error) {
            console.error("ZIP export error:", data.error);
            showNotification(`ZIP export failed: ${data.error}`, "error");
          } else {
            console.error("ZIP export response missing download URL");
            showNotification(
              "ZIP export failed: No download URL received",
              "error"
            );
          }
          break;

        case "csv_data":
          // Handle CSV file data from backend
          if (data.filename && data.data) {
            setSelectedCsvFile(data.filename);
            // Type assertion since we know this contains DataPoint array
            setSelectedCsvData(data.data as unknown as DataPoint[]);
            console.log("Received CSV data for:", data.filename);
          }
          break;

        case "recent_data":
          // Handle recent aggregated sensor data for main chart
          if (data.data) {
            const recentData = data.data as unknown as DataPoint[];
            setRealSensorData(recentData);
            setIsLoadingData(false);

            // Show timestamp range in notification
            if (recentData.length > 0) {
              const firstTime = new Date(
                recentData[0].timestamp
              ).toLocaleTimeString();
              const lastTime = new Date(
                recentData[recentData.length - 1].timestamp
              ).toLocaleTimeString();
              console.log(
                `Loaded ${recentData.length} recent data points from ${data.file_count} files`
              );
              console.log(`Data range: ${firstTime} to ${lastTime}`);
              showNotification(
                `Loaded ${recentData.length} sensor readings (${firstTime} - ${lastTime})`,
                "success"
              );
            } else {
              showNotification("No recent sensor data available", "info");
            }
          }
          break;

        case "file_list":
          // Update file list from backend
          if (data.files && data.files.length > 0) {
            setCsvFiles(data.files);
            console.log("Received file list from backend:", data.files);
          }
          break;

        case "folder_structure":
          // Update folder structure for calendar browser
          if (data.structure) {
            setFolderStructure(data.structure);
          }
          console.log("Received folder structure:", data.structure);
          break;

        case "command_response":
          // Sampling rate commands removed - rate is now fixed
          break;

        case "error":
          console.error("WebSocket error:", data.message);
          break;

        default:
          console.log("Unknown WebSocket message type:", data.type);
      }
    },
    [isLoadingData, loadRecentSensorData, samplingRate]
  );

  useEffect(() => {
    // Auto-connect to WebSocket on component mount
    connectWebSocket();

    // Cleanup WebSocket on component unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Load recent data automatically when connected
  useEffect(() => {
    if (
      isConnected &&
      wsRef.current?.readyState === WebSocket.OPEN &&
      realSensorData.length === 0
    ) {
      setTimeout(() => {
        loadRecentSensorData();
      }, 1000); // Wait a moment after connection
    }
  }, [isConnected, loadRecentSensorData, realSensorData.length]);

  // Update main chart whenever real sensor data changes or view changes
  useEffect(() => {
    if (realSensorData.length > 0) {
      let filteredData = realSensorData;
      if (domain) {
        const [start, end] = domain;
        filteredData = realSensorData.filter(
          (d) =>
            new Date(d.timestamp) >= new Date(start) &&
            new Date(d.timestamp) <= new Date(end)
        );
      }
      setMainChartData(aggregateData(filteredData, zoomLevel, aggregationType));
    } else {
      setMainChartData([]);
    }
  }, [realSensorData, zoomLevel, aggregationType, domain]);

  const handleCsvFileSelect = (csvFilename: string) => {
    // Request CSV data from backend via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const command = {
        command: "get_csv_data",
        filename: csvFilename,
      };
      wsRef.current.send(JSON.stringify(command));
      console.log("Requesting CSV data for:", csvFilename);
    } else {
      console.log("WebSocket not connected, cannot load CSV data");
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
    setWsStatus("disconnected");
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
      "Timestamp,Acceleration",
      ...data.map((point) => `${point.timestamp},${point.acceleration}`),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${filename.replace(".json", "")}_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSelectedFileAsCSV = () => {
    if (selectedCsvFile && selectedCsvData.length > 0) {
      exportToCSV(selectedCsvData, selectedCsvFile);
    } else {
      alert("No CSV file selected or no data available to export.");
    }
  };

  const exportAllDataAsCSV = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && csvFiles.length > 0) {
      setShowZipExportPopup(true);
    } else {
      alert(
        "No CSV files available from backend. Connect and collect data first."
      );
    }
  };

  const confirmZipExport = () => {
    const command = {
      command: "export_all_csv_zip",
    };
    console.log("Sending ZIP export command:", command);
    try {
      wsRef.current?.send(JSON.stringify(command));
      console.log("ZIP export command sent successfully");
    } catch (error) {
      console.error("Failed to send ZIP export command:", error);
      alert("Failed to send export command. Please check the connection.");
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
    if (e.deltaY < 0) {
      // Scroll up (zoom in)
      if (zoomLevel === "months") {
        const [year, month] = selectedTime.split("-").map(Number);
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0);
        setZoomLevel("dates");
      } else if (zoomLevel === "dates") {
        start = new Date(selectedTime);
        end = new Date(selectedTime);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        setZoomLevel("time");
      } else {
        return; // No further zoom in time level
      }
      setDomain([start.toISOString(), end.toISOString()]);
    } else if (e.deltaY > 0) {
      // Scroll down (zoom out)
      if (zoomLevel === "time") {
        const date = new Date(selectedTime);
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        setZoomLevel("dates");
        setDomain([start.toISOString(), end.toISOString()]);
      } else if (zoomLevel === "dates") {
        setZoomLevel("months");
        setDomain(undefined);
      }
    }
  };

  const handleResetZoom = () => {
    setZoomLevel("months");
    setDomain(undefined);
  };

  const openCalendarBrowser = () => {
    setShowCalendarBrowser(true);
    // Always request real folder structure from backend
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: "get_folder_structure" }));
      console.log("Requesting real folder structure from backend");
    } else {
      showNotification(
        "WebSocket not connected. Cannot load real file structure.",
        "error"
      );
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ command: "get_csv_data", filename: filePath })
      );
      setSelectedCsvFile(filePath);
    }
    setShowCalendarBrowser(false);
  };

  const renderFolderNode = (
    name: string,
    content:
      | Record<string, unknown>
      | { filename: string; path: string; size: number; modified: number },
    path: string,
    level: number = 0
  ) => {
    const isExpanded = expandedNodes.has(path);
    const isFile = typeof content === "object" && "filename" in content;
    const hasChildren = typeof content === "object" && !("filename" in content);

    if (isFile) {
      // Render file with glass effect
      return (
        <div
          key={path}
          className={`
            flex items-center space-x-3 py-3 px-4 rounded-xl cursor-pointer transition-all duration-200
            backdrop-blur-sm border border-transparent
            ${
              isDarkMode
                ? "hover:bg-gray-700/50 hover:border-gray-600/30 text-gray-300"
                : "hover:bg-white/50 hover:border-gray-300/30 text-gray-700"
            }
            hover:scale-[1.02] active:scale-[0.98]
          `}
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() =>
            handleCalendarFileSelect((content as { path: string }).path)
          }
        >
          <div className="p-1 rounded-lg bg-blue-500/20 backdrop-blur-sm">
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium">
              {(content as { filename: string }).filename}
            </span>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  isDarkMode
                    ? "bg-gray-700/50 text-gray-400"
                    : "bg-gray-100/50 text-gray-500"
                }`}
              >
                {((content as { size: number }).size / 1024).toFixed(1)}KB
              </span>
              <span
                className={`text-xs ${
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                }`}
              >
                {new Date(
                  (content as { modified: number }).modified * 1000
                ).toLocaleTimeString()}
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
              ${
                isDarkMode
                  ? "hover:bg-gray-700/50 hover:border-gray-600/30 text-gray-200"
                  : "hover:bg-white/50 hover:border-gray-300/30 text-gray-800"
              }
              hover:scale-[1.02] active:scale-[0.98]
            `}
            style={{ marginLeft: `${level * 24}px` }}
            onClick={() => toggleNode(path)}
          >
            <div className="flex items-center space-x-2">
              {isExpanded ? (
                <ChevronDown
                  className={`h-4 w-4 ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                />
              ) : (
                <ChevronRight
                  className={`h-4 w-4 ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                />
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
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                isDarkMode
                  ? "bg-gray-700/50 text-gray-400"
                  : "bg-gray-100/50 text-gray-500"
              }`}
            >
              {Object.keys(content).length} items
            </span>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="mt-2 space-y-1 pl-2">
              {Object.entries(content as Record<string, unknown>).map(
                ([childName, childContent]) =>
                  renderFolderNode(
                    childName,
                    childContent as
                      | Record<string, unknown>
                      | {
                          filename: string;
                          path: string;
                          size: number;
                          modified: number;
                        },
                    `${path}/${childName}`,
                    level + 1
                  )
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`min-h-screen transition-colors ${
        isDarkMode ? "bg-gray-900" : "bg-[#efefef]"
      }`}
    >
      {/* Header */}
      <header className="bg-[#019c7c] text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Image
                src={
                  process.env.NODE_ENV === "production"
                    ? "/Wilo-Cloud-Monitoring/vu.png"
                    : "/vu.png"
                }
                alt="VU Logo"
                width={60}
                height={60}
                className="rounded-lg object-cover"
              />
            </div>
            <div className="relative">
              <Image
                src={
                  process.env.NODE_ENV === "production"
                    ? "/Wilo-Cloud-Monitoring/wilo.png"
                    : "/wilo.png"
                }
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
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={loadRecentSensorData}
              disabled={wsStatus !== "connected" || isLoadingData}
              className={`p-2 rounded-lg transition-colors flex items-center space-x-1 ${
                wsStatus === "connected" && !isLoadingData
                  ? "hover:bg-[#018a6f] text-white"
                  : "text-gray-400 cursor-not-allowed"
              }`}
              title="Refresh sensor data to see latest readings"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isLoadingData && (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              )}
            </button>
            <div className="text-right">
              <h1 className="text-2xl font-bold">DASHBOARD</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto p-6 gap-6">
        {/* Sidebar */}
        <div className="w-80 space-y-6">
          {/* File List (backend only) */}
          <div
            className={`rounded-lg p-6 shadow-md transition-colors ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className={`text-lg font-semibold flex items-center ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
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
              {csvFiles.length > 0
                ? csvFiles.map((file) => (
                    <button
                      key={file}
                      onClick={() => handleCsvFileSelect(file)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedCsvFile === file
                          ? "bg-[#019c7c] text-white"
                          : isDarkMode
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      <div className="text-sm font-medium">{file}</div>
                      <div
                        className={`text-xs ${
                          selectedCsvFile === file
                            ? "text-white/70"
                            : isDarkMode
                            ? "text-gray-400"
                            : "text-gray-500"
                        }`}
                      >
                        CSV • Live data
                      </div>
                    </button>
                  ))
                : null}
            </div>
          </div>

          {/* Export Options */}
          <div
            className={`rounded-lg p-6 shadow-md transition-colors ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <h2
              className={`text-lg font-semibold mb-4 flex items-center ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}
            >
              <Download className="h-5 w-5 mr-2 text-[#019c7c]" />
              Export Options
            </h2>

            {/* Data Export */}
            <div className="space-y-3">
              <div>
                <h3
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  Data Export
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={exportSelectedFileAsCSV}
                    disabled={!selectedCsvFile}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                      selectedCsvFile
                        ? isDarkMode
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        : isDarkMode
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "bg-gray-50 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-sm">
                      Export Selected File as CSV
                      {selectedCsvFile && (
                        <span className="text-xs block text-green-500">
                          • {selectedCsvFile}
                        </span>
                      )}
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
          <div
            className={`rounded-lg p-6 shadow-md transition-colors ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <BarChart3 className="h-6 w-6 text-[#019c7c]" />
                <h2
                  className={`text-xl font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}
                >
                  Acceleration Overview
                </h2>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={aggregationType}
                  onChange={(e) =>
                    setAggregationType(e.target.value as AggregationType)
                  }
                  className={`p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#019c7c] transition-colors ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-800"
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
                      <linearGradient
                        id="areaGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#019c7c"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="50%"
                          stopColor="#019c7c"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="#019c7c"
                          stopOpacity={0.1}
                        />
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
                        if (zoomLevel === "months") return value;
                        if (zoomLevel === "dates")
                          return new Date(value).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        return new Date(value).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      }}
                    />
                    <YAxis
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(value) => `${value.toFixed(1)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                        color: isDarkMode ? "#ffffff" : "#1f2937",
                        fontSize: "14px",
                        padding: "12px 16px",
                      }}
                      formatter={(value: number) => [
                        `${Number(value).toFixed(2)} m/s²`,
                        aggregationType.charAt(0).toUpperCase() +
                          aggregationType.slice(1),
                      ]}
                      labelFormatter={(label) => {
                        if (zoomLevel === "months") return `Month: ${label}`;
                        if (zoomLevel === "dates")
                          return `Date: ${new Date(
                            label
                          ).toLocaleDateString()}`;
                        return `Time: ${label}`;
                      }}
                      cursor={{
                        stroke: "#019c7c",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
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
                        fill: "#019c7c",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className={`h-[450px] flex flex-col items-center justify-center ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {isConnected ? (
                    <div
                      className={`px-6 py-5 rounded-2xl border backdrop-blur-sm ${
                        isDarkMode
                          ? "bg-gray-800/60 border-gray-700 text-white"
                          : "bg-white/70 border-gray-200 text-gray-800"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#019c7c]"></div>
                        <div>
                          <div className="text-base font-semibold">
                            Loading acceleration data…
                          </div>
                          <div className="text-xs opacity-75 mt-0.5">
                            Preparing visualization
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-6 py-5 rounded-2xl border backdrop-blur-sm ${
                        isDarkMode
                          ? "bg-gray-800/60 border-gray-700 text-white"
                          : "bg-white/70 border-gray-200 text-gray-800"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                        <div>
                          <div className="text-base font-semibold">
                            No backend connected
                          </div>
                          <div className="text-xs opacity-75 mt-0.5">
                            Start the backend and refresh data
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Zoom level indicator */}
              <div className="absolute top-4 right-4">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isDarkMode
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Zoom: {zoomLevel.charAt(0).toUpperCase() + zoomLevel.slice(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Selected file chart (backend only) */}
          {selectedCsvFile && (
            <div
              className={`rounded-lg p-6 shadow-md transition-colors ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3
                  className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}
                >
                  File: {selectedCsvFile}
                </h3>
                <div
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Records: {selectedCsvData.length}
                </div>
              </div>
              <div ref={fileChartRef} className="relative">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart
                    data={selectedCsvData.slice(-50)} // Show last 50 points for better performance
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient
                        id="lineGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop
                          offset="0%"
                          stopColor="#06b6d4"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="50%"
                          stopColor="#019c7c"
                          stopOpacity={1}
                        />
                        <stop
                          offset="100%"
                          stopColor="#10b981"
                          stopOpacity={0.8}
                        />
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
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                    />
                    <YAxis
                      stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => `${value.toFixed(1)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                        color: isDarkMode ? "#ffffff" : "#1f2937",
                        fontSize: "13px",
                        padding: "10px 14px",
                      }}
                      formatter={(value: number) => [
                        `${Number(value).toFixed(2)} m/s²`,
                        "Acceleration",
                      ]}
                      labelFormatter={(label) =>
                        `Time: ${new Date(label).toLocaleString()}`
                      }
                      cursor={{
                        stroke: "#019c7c",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="acceleration"
                      stroke="url(#lineGradient)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "#019c7c",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Data range indicator */}
                <div className="absolute top-4 right-4">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isDarkMode
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    Latest {Math.min(50, selectedCsvData.length)} points
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Reading Chart */}
          {isConnected && (
            <div
              className={`rounded-lg p-6 shadow-md transition-colors ${
                isDarkMode ? "bg-gray-800" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <Activity className="h-6 w-6 text-[#019c7c]" />
                  <h3
                    className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}
                  >
                    Live Sensor Reading
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span
                      className={`text-sm font-medium ${
                        isDarkMode ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      Live ({samplingRate} Hz)
                    </span>
                  </div>
                  <div
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
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
                        <linearGradient
                          id="liveGradient"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="0%"
                            stopColor="#ef4444"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="50%"
                            stopColor="#f97316"
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor="#eab308"
                            stopOpacity={0.8}
                          />
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
                        tickFormatter={(value) =>
                          new Date(value).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        }
                      />
                      <YAxis
                        stroke={isDarkMode ? "#9ca3af" : "#6b7280"}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => `${value.toFixed(1)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                          color: isDarkMode ? "#ffffff" : "#1f2937",
                          fontSize: "13px",
                          padding: "10px 14px",
                        }}
                        formatter={(value: number) => [
                          `${Number(value).toFixed(2)} m/s²`,
                          "Live Reading",
                        ]}
                        labelFormatter={(label) =>
                          `Time: ${new Date(label).toLocaleString()}`
                        }
                        cursor={{
                          stroke: "#f97316",
                          strokeWidth: 1,
                          strokeDasharray: "4 4",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="acceleration"
                        stroke="url(#liveGradient)"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{
                          r: 6,
                          fill: "#f97316",
                          stroke: "#ffffff",
                          strokeWidth: 2,
                          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    className={`h-[300px] flex flex-col items-center justify-center ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4"></div>
                    <p className="text-lg font-medium">
                      Waiting for live sensor data...
                    </p>
                    <p className="text-sm opacity-75 mt-1">
                      Connect to backend to see real-time readings
                    </p>
                  </div>
                )}

                {/* Live indicator */}
                <div className="absolute top-4 right-4">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-500 to-orange-500 text-white`}
                  >
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
            <div
              className={`
              backdrop-blur-xl border border-white/20 shadow-2xl
              ${
                isDarkMode
                  ? "bg-gray-900/80 shadow-black/50"
                  : "bg-white/80 shadow-gray-900/20"
              }
            `}
            >
              {/* Header with glass effect */}
              <div
                className={`
                px-8 py-6 border-b border-white/10
                ${isDarkMode ? "bg-gray-800/50" : "bg-white/50"}
              `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-[#019c7c]/20 backdrop-blur-sm">
                      <Calendar className="h-6 w-6 text-[#019c7c]" />
                    </div>
                    <div>
                      <h2
                        className={`text-2xl font-bold ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}
                      >
                        CSV File Browser
                      </h2>
                      <p
                        className={`text-sm ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Navigate through your sensor data files
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeCalendarBrowser}
                    className={`
                      p-3 rounded-xl transition-all duration-200 backdrop-blur-sm
                      ${
                        isDarkMode
                          ? "bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white"
                          : "bg-gray-100/50 hover:bg-gray-200/50 text-gray-600 hover:text-gray-800"
                      }
                      hover:scale-105 active:scale-95
                    `}
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content Area */}
              <div className="p-8 overflow-y-auto max-h-[60vh]">
                {Object.keys(folderStructure).length === 0 ? (
                  <div className="text-center py-12">
                    <div
                      className={`
                      inline-flex p-6 rounded-2xl mb-6
                      ${isDarkMode ? "bg-gray-800/50" : "bg-gray-100/50"}
                      backdrop-blur-sm
                    `}
                    >
                      <Calendar
                        className={`h-16 w-16 ${
                          isDarkMode ? "text-gray-500" : "text-gray-400"
                        }`}
                      />
                    </div>
                    <h3
                      className={`text-xl font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}
                    >
                      {wsStatus === "connected"
                        ? "Loading CSV files..."
                        : "No CSV files found"}
                    </h3>
                    <p
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {wsStatus === "connected"
                        ? "Please wait while we load your sensor data files"
                        : "Connect to backend to see files organized by date"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Info Banner */}
                    <div
                      className={`
                      p-4 rounded-xl border backdrop-blur-sm
                      ${
                        isDarkMode
                          ? "bg-blue-900/20 border-blue-500/20 text-blue-300"
                          : "bg-blue-50/50 border-blue-200/50 text-blue-700"
                      }
                    `}
                    >
                      <div className="flex items-center space-x-2">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium">
                          Real CSV Files - Structure: Year → Month → Week → Day
                          → Files
                        </span>
                      </div>
                    </div>

                    {/* File Tree */}
                    <div
                      className={`
                      rounded-xl border backdrop-blur-sm p-6
                      ${
                        isDarkMode
                          ? "bg-gray-800/30 border-gray-700/30"
                          : "bg-white/30 border-gray-200/30"
                      }
                    `}
                    >
                      <div className="space-y-2">
                        {Object.entries(folderStructure).map(
                          ([year, yearContent]) =>
                            renderFolderNode(
                              year,
                              yearContent as Record<string, unknown>,
                              year,
                              0
                            )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className={`
                px-8 py-6 border-t border-white/10
                ${isDarkMode ? "bg-gray-800/50" : "bg-white/50"}
              `}
              >
                <div className="flex justify-between items-center">
                  <div
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
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
          <div
            className={`
            w-full max-w-2xl mx-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300
            ${
              isDarkMode
                ? "bg-gray-900/90 border-gray-700/50 text-white"
                : "bg-white/90 border-gray-200/50 text-gray-800"
            }
          `}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#019c7c] rounded-xl">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Data Statistics</h2>
                  <p
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Overview of sensor data collection
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStatsPopup(false)}
                className={`
                  p-2 rounded-xl transition-all duration-200
                  ${
                    isDarkMode
                      ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                      : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
                  }
                  hover:scale-105 active:scale-95
                `}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Connection Status */}
              <div
                className={`
                p-4 rounded-xl border
                ${
                  isConnected
                    ? "bg-green-500/10 border-green-500/20 text-green-600"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }
              `}
              >
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <Wifi className="h-5 w-5" />
                  ) : (
                    <WifiOff className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {isConnected
                      ? "Connected - Real-time data streaming"
                      : "Disconnected - Using historical data"}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${
                    isDarkMode
                      ? "bg-gray-800/50 border-gray-700/50"
                      : "bg-gray-50/50 border-gray-200/50"
                  }
                `}
                >
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {backendStatus?.csvFiles ?? csvFiles.length}
                  </div>
                  <div
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    CSV Files
                  </div>
                </div>

                <div
                  className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${
                    isDarkMode
                      ? "bg-gray-800/50 border-gray-700/50"
                      : "bg-gray-50/50 border-gray-200/50"
                  }
                `}
                >
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {backendStatus?.samplingRate ?? samplingRate}
                  </div>
                  <div
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Hz Rate
                  </div>
                </div>

                <div
                  className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${
                    isDarkMode
                      ? "bg-gray-800/50 border-gray-700/50"
                      : "bg-gray-50/50 border-gray-200/50"
                  }
                `}
                >
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {backendStatus?.totalSamples ?? 0}
                  </div>
                  <div
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Samples
                  </div>
                </div>

                <div
                  className={`
                  p-4 rounded-xl border backdrop-blur-sm
                  ${
                    isDarkMode
                      ? "bg-gray-800/50 border-gray-700/50"
                      : "bg-gray-50/50 border-gray-200/50"
                  }
                `}
                >
                  <div className="text-2xl font-bold text-[#019c7c]">
                    {selectedCsvData.length}
                  </div>
                  <div
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Selected Data
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div
                className={`
                p-4 rounded-xl border backdrop-blur-sm
                ${
                  isDarkMode
                    ? "bg-gray-800/50 border-gray-700/50"
                    : "bg-gray-50/50 border-gray-200/50"
                }
              `}
              >
                <h3 className="font-semibold mb-3">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      WebSocket Status:
                    </span>
                    <span
                      className={
                        wsStatus === "connected"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {wsStatus.charAt(0).toUpperCase() + wsStatus.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      Selected File:
                    </span>
                    <span>{selectedCsvFile || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      Data Structure:
                    </span>
                    <span>Year/Month/Week/Day/Time.csv</span>
                  </div>
                  <div className="flex justify-between">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      Export Formats:
                    </span>
                    <span>CSV, ZIP Archive</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZIP Export Confirmation Popup */}
      {showZipExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div
            className={`
            w-full max-w-md mx-4 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300
            ${
              isDarkMode
                ? "bg-gray-900/90 border-gray-700/50 text-white"
                : "bg-white/90 border-gray-200/50 text-gray-800"
            }
          `}
          >
            {/* Header */}
            <div className="flex items-center space-x-3 p-6 border-b border-white/10">
              <div className="p-3 bg-[#019c7c] rounded-xl">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Export All Data as ZIP</h2>
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Download complete sensor data archive
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div
                className={`
                p-4 rounded-xl border backdrop-blur-sm
                ${
                  isDarkMode
                    ? "bg-gray-800/50 border-gray-700/50"
                    : "bg-gray-50/50 border-gray-200/50"
                }
              `}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      Total CSV Files:
                    </span>
                    <span className="font-bold text-[#019c7c]">
                      {csvFiles.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      Data Structure:
                    </span>
                    <span className="text-sm">Year/Month/Week/Day</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                    >
                      Export Format:
                    </span>
                    <span className="text-sm">ZIP Archive</span>
                  </div>
                </div>
              </div>

              <div
                className={`
                p-3 rounded-xl border-l-4 border-blue-500
                ${
                  isDarkMode
                    ? "bg-blue-900/20 text-blue-300"
                    : "bg-blue-50 text-blue-700"
                }
              `}
              >
                <p className="text-sm">
                  This will download all sensor data files organized by the
                  hierarchical date structure. The download will start
                  automatically once the ZIP file is created.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 p-6 border-t border-white/10">
              <button
                onClick={cancelZipExport}
                className={`
                  flex-1 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  ${
                    isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
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

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border transition-all duration-300 ${
            notification.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : notification.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`flex-shrink-0 ${
                notification.type === "success"
                  ? "text-green-400"
                  : notification.type === "error"
                  ? "text-red-400"
                  : "text-blue-400"
              }`}
            >
              {notification.type === "success" ? (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : notification.type === "error" ? (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600 ${
                notification.type === "success"
                  ? "hover:text-green-600"
                  : notification.type === "error"
                  ? "hover:text-red-600"
                  : "hover:text-blue-600"
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

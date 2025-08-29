# Frontend Integration Guide

This document explains how to integrate a frontend with the Wilo-Cloud-Monitoring system.

## System Architecture

The Wilo-Cloud-Monitoring system provides a RESTful API that allows frontend applications to:
1. Monitor system status
2. Control data collection
3. Access collected data
4. View system statistics

## API Endpoints

All API endpoints are prefixed with `/api/` and are accessible at `http://[server-ip]:8000/api/`.

### Status Endpoints

- `GET /api/status` - Get system status
  - Response: 
    ```json
    {
      "continuous_collection_running": true,
      "sensor_connected": false,
      "sampling_rate": 800,
      "batch_size": 100,
      "timestamp": "2023-08-30T01:00:00.000000"
    }
    ```

- `GET /api/stats` - Get system statistics
  - Response:
    ```json
    {
      "file_count": 10,
      "total_size_bytes": 102400,
      "total_size_mb": 0.1,
      "continuous_collection_running": true,
      "timestamp": "2023-08-30T01:00:00.000000"
    }
    ```

### Data Endpoints

- `GET /api/files` - List available data files
  - Response:
    ```json
    {
      "files": ["sensor_data_20230830_010000.csv", "sensor_data_20230830_010001.csv"],
      "count": 2
    }
    ```

- `GET /api/file/{filename}` - Get specific data file content
  - Response:
    ```json
    {
      "filename": "sensor_data_20230830_010000.csv",
      "data": [
        {"timestamp": "2023-Aug-30T01-00-00", "acceleration": "16384"},
        {"timestamp": "2023-Aug-30T01-00-00", "acceleration": "16385"}
      ],
      "count": 2
    }
    ```

### Control Endpoints

- `POST /api/start` - Start data collection
  - Request Body:
    ```json
    {
      "duration": 10,
      "continuous": true
    }
    ```
  - Response:
    ```json
    {
      "status": "Continuous data collection started"
    }
    ```

- `POST /api/stop` - Stop continuous data collection
  - Response:
    ```json
    {
      "status": "Continuous data collection stopped"
    }
    ```

## Example Frontend Implementation

The system includes a simple HTML frontend (`frontend.html`) that demonstrates how to interact with the API:

1. **Status Monitoring**: The dashboard continuously polls `/api/status` to display system status
2. **Data Collection Control**: Buttons send POST requests to `/api/start` and `/api/stop`
3. **File Management**: The file list is populated from `/api/files`
4. **Data Visualization**: File content is retrieved from `/api/file/{filename}`

## Integration Steps

1. **Start the System**: Run `./finalize_setup.sh` to set up the systemd service
2. **Start the Service**: Run `sudo systemctl start sensor-monitor.service`
3. **Verify API Availability**: Check that `http://[server-ip]:8000/health` returns a success response
4. **Connect Frontend**: Configure your frontend to communicate with the API endpoints

## CORS Support

The API includes CORS headers to allow cross-origin requests from web browsers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Error Handling

All API endpoints return appropriate HTTP status codes:
- `200`: Success
- `404`: Endpoint not found
- `500`: Internal server error

Error responses include a JSON body with an error message:
```json
{
  "error": "Description of the error"
}
```

## Security Considerations

For production use, consider implementing:
1. Authentication/authorization for API endpoints
2. HTTPS encryption
3. Rate limiting
4. Input validation

## Example API Calls

### Get System Status
```bash
curl http://localhost:8000/api/status
```

### Start Continuous Collection
```bash
curl -X POST http://localhost:8000/api/start \
  -H "Content-Type: application/json" \
  -d '{"continuous": true, "duration": 1}'
```

### Stop Collection
```bash
curl -X POST http://localhost:8000/api/stop
```

### List Data Files
```bash
curl http://localhost:8000/api/files
```

### Get File Content
```bash
curl http://localhost:8000/api/file/sensor_data_20230830_010000.csv
```
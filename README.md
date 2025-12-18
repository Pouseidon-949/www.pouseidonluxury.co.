# Pouseidon Bot v2 - Comprehensive Monitoring, Logging & Metrics Collection System

A comprehensive monitoring, logging, and metrics collection system for Pouseidon Bot v2 that provides real-time tracking, performance analytics, and growth monitoring capabilities.

## 🚀 Features

### Core Monitoring Capabilities
- **Hourly Growth Tracking**: Automatic hourly growth tracking and reporting
- **Real-time Trade Execution Logging**: Detailed trade execution logs with execution metrics
- **Profit/Loss Metrics Collection**: Comprehensive P&L tracking and analysis
- **Loop Execution Performance Metrics**: Performance monitoring for trading loops
- **Liquidity Analysis Logs**: Market liquidity analysis and tracking
- **Error and Failure Event Logging**: Comprehensive error tracking and categorization
- **Configurable Log Levels**: Configurable logging levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- **Metrics Dashboard Data Structure**: Structured data for dashboard integration
- **Performance Analytics**: Performance analytics for optimization

### Technical Features
- **Structured Logging**: JSON and text format support with rotating file logs
- **SQLite Database Storage**: Persistent metrics storage with automatic cleanup
- **Real-time Metrics Collection**: Configurable collection intervals
- **Callback System**: Integration callbacks for external systems
- **Thread Safety**: Safe concurrent access to monitoring data
- **Dashboard APIs**: RESTful-style APIs for dashboard integration

## 📦 Installation

1. **Clone and Setup**:
   ```bash
   cd poseidon-monitor
   pip install -r requirements.txt
   ```

2. **Configuration** (optional):
   ```bash
   export POSEIDON_LOG_LEVEL=INFO
   export POSEIDON_LOG_FORMAT=json
   export POSEIDON_DB_URL=sqlite:///poseidon_metrics.db
   export POSEIDON_HOURLY_GROWTH=true
   ```

## 🛠 Quick Start

### Basic Usage

```python
from poseidon_monitor import MonitoringSystem, MonitoringConfig

# Initialize monitoring system
config = MonitoringConfig()
monitor = MonitoringSystem(config)

# Start monitoring
monitor.start()

# Log a trade
monitor.log_trade(
    symbol="BTCUSDT",
    side="buy",
    quantity=0.1,
    price=45000.0,
    fee=4.50,
    execution_time_ms=150.0,
    slippage_bps=2.5
)

# Log performance metric
monitor.log_performance_metric(
    "api_response_time",
    120.5,
    "milliseconds"
)

# Log error
monitor.log_error(
    "Connection timeout",
    error_type="network_timeout"
)

# Get dashboard data
summary = monitor.get_dashboard_summary()
print(f"Total trades: {summary.total_trades_24h}")
print(f"System status: {summary.system_status}")

# Stop monitoring
monitor.stop()
```

### Context Manager Usage

```python
with MonitoringSystem() as monitor:
    # Your trading bot code here
    monitor.log_trade("ETHUSDT", "sell", 1.0, 3200.0, 3.20)
    summary = monitor.get_dashboard_summary()
    print(f"Active trades: {summary.total_trades_24h}")
```

### Loop Execution Monitoring

```python
# Start monitoring a trading loop
monitor.start_loop_execution("main_trading_loop", execution_id="exec_123")

try:
    # Your trading logic here
    trades_executed = execute_trades()
    
    # End loop monitoring
    monitor.end_loop_execution(
        "main_trading_loop", 
        success=True, 
        trades_executed=trades_executed
    )
    
except Exception as e:
    monitor.log_error(f"Loop execution failed: {e}", error_type="execution_error")
    monitor.end_loop_execution("main_trading_loop", success=False)
```

## ⚙ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSEIDON_LOG_LEVEL` | Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL) | INFO |
| `POSEIDON_LOG_FORMAT` | Log format (json, text, both) | both |
| `POSEIDON_LOG_FILE` | Log file path | logs/poseidon_monitor.log |
| `POSEIDON_LOG_MAX_SIZE` | Max log file size in bytes | 10485760 (10MB) |
| `POSEIDON_LOG_BACKUP_COUNT` | Number of backup log files | 5 |
| `POSEIDON_METRICS_INTERVAL` | Metrics collection interval in seconds | 60 |
| `POSEIDON_METRICS_RETENTION_DAYS` | Days to retain metrics data | 30 |
| `POSEIDON_HOURLY_GROWTH` | Enable hourly growth tracking | true |
| `POSEIDON_DASHBOARD_REFRESH` | Dashboard refresh rate in seconds | 30 |
| `POSEIDON_MAX_DATA_POINTS` | Maximum data points in memory | 10000 |
| `POSEIDON_STORAGE` | Storage backend (file, redis, sqlite) | file |
| `POSEIDON_DB_URL` | Database connection URL | sqlite:///poseidon_metrics.db |
| `POSEIDON_PERFORMANCE_MONITORING` | Enable performance monitoring | true |
| `POSEIDON_LOOP_MONITORING` | Enable loop monitoring | true |
| `POSEIDON_TRACK_TRADES` | Enable trade tracking | true |
| `POSEIDON_DETAILED_TRADES` | Enable detailed trade logging | true |
| `POSEIDON_LIQUIDITY_TRACKING` | Enable liquidity tracking | true |
| `POSEIDON_LIQUIDITY_INTERVAL` | Liquidity analysis interval in minutes | 15 |
| `POSEIDON_ERROR_TRACKING` | Enable error tracking | true |
| `POSEIDON_CRITICAL_ALERTS` | Enable critical error alerts | true |

### Custom Configuration

```python
from poseidon_monitor import MonitoringConfig
from poseidon_monitor.config.settings import LogLevel, OutputFormat

config = MonitoringConfig()
config.log_level = LogLevel.DEBUG
config.log_format = OutputFormat.JSON
config.metrics_collection_interval = timedelta(seconds=30)
config.enable_hourly_growth_tracking = True

monitor = MonitoringSystem(config)
```

## 📊 Dashboard & Analytics

### Dashboard APIs

The monitoring system provides multiple dashboard endpoints:

#### Summary Dashboard
```python
summary = monitor.get_dashboard_summary()
print(f"System Status: {summary.system_status}")
print(f"Uptime: {summary.uptime_seconds}s")
print(f"Total Trades 24h: {summary.total_trades_24h}")
print(f"Total Volume 24h: ${summary.total_volume_24h:,.2f}")
print(f"Growth 24h: {summary.growth_24h:.2f}%")
```

#### Trading Dashboard
```python
trading_dashboard = monitor.get_trading_dashboard(hours=24)
print(f"Recent Trades: {len(trading_dashboard.recent_trades)}")
print(f"Trading Stats: {trading_dashboard.trading_stats}")
print(f"Hourly Growth: {trading_dashboard.hourly_growth}")
```

#### Performance Dashboard
```python
performance_dashboard = monitor.get_performance_dashboard(hours=24)
print(f"Loop Performance: {performance_dashboard.loop_performance}")
print(f"Error Rates: {performance_dashboard.error_rates}")
print(f"Resource Utilization: {performance_dashboard.resource_utilization}")
```

#### Real-time Metrics
```python
real_time = monitor.get_real_time_metrics()
print(f"Events per minute: {real_time['events_per_minute']}")
print(f"Trades last hour: {real_time['trades_last_hour']}")
print(f"Error rate: {real_time['error_rate']:.2f}%")
```

### Hourly Reports

```python
# Get hourly report for current hour
report = monitor.get_hourly_report()
print(f"Hour: {report['report_hour']}")
print(f"Growth: {report['growth_data']}")
print(f"Trades: {report['trades_summary']}")
```

### Data Export

```python
# Export all dashboard data as JSON
json_data = monitor.export_dashboard_data(format_type='json')
with open('dashboard_export.json', 'w') as f:
    f.write(json_data)
```

## 🔍 Event Types & Logging

### Supported Event Types

1. **TRADE_EXECUTION**: Trade execution events
2. **PROFIT_LOSS**: Profit/loss tracking events
3. **LOOP_EXECUTION**: Trading loop execution events
4. **LIQUIDITY_ANALYSIS**: Market liquidity analysis events
5. **ERROR_EVENT**: Error and failure events
6. **PERFORMANCE_METRIC**: Performance measurement events
7. **GROWTH_TRACKING**: Growth tracking events
8. **SYSTEM_EVENT**: General system events

### Event Query Methods

```python
# Get recent events
events = monitor.get_recent_events(limit=100)

# Get events by type
trade_events = monitor.get_recent_events(event_type="trade_execution")

# Get error events since timestamp
since_24h = datetime.now() - timedelta(hours=24)
errors = monitor.logger.get_errors_since(since_24h)

# Get trade events
trades = monitor.logger.get_trades_since(since_24h)
```

## 📈 Metrics Collection

### Trade Metrics
```python
# Trade metrics are automatically collected when logging trades
monitor.log_trade(
    symbol="BTCUSDT",
    side="buy",
    quantity=0.1,
    price=45000.0,
    fee=4.50,
    execution_time_ms=150.0,
    slippage_bps=2.5
)
```

### Performance Metrics
```python
# Custom performance metrics
monitor.log_performance_metric("custom_metric", 42.5, "units")

# System metrics (automatically collected)
# - CPU usage
# - Memory usage
# - Network I/O
# - Database size
# - Active processes
```

### Growth Tracking
```python
# Hourly growth is automatically tracked
monitor.update_account_balance(15000.0)  # System tracks growth hourly

# Manual growth record
metrics_collector.record_hourly_growth(
    current_balance=15000.0,
    trade_count=5,
    pnl=500.0
)
```

### Liquidity Metrics
```python
# Log liquidity analysis
monitor.log_liquidity_analysis(
    symbol="BTCUSDT",
    spread=0.02,  # 0.02% spread
    bid_size=100.5,
    ask_size=95.2,
    market_depth=2500.0,
    volatility_24h=0.025,  # 2.5% volatility
    volume_24h=1500000.0
)
```

## 🔧 Integration Callbacks

```python
def on_trade(trade_data):
    print(f"Trade executed: {trade_data.symbol}")
    # Send notification, update external systems, etc.

def on_error(error_data):
    print(f"Error: {error_data['error_type']}")
    # Send alerts, update monitoring dashboards, etc.

def on_performance(metric_data):
    print(f"Performance: {metric_data.metric_name} = {metric_data.metric_value}")
    # Update performance dashboards, trigger alerts, etc.

# Register callbacks
monitor.add_trade_callback(on_trade)
monitor.add_error_callback(on_error)
monitor.add_performance_callback(on_performance)
```

## 🗄 Database & Storage

### SQLite Database Schema

The system automatically creates a SQLite database with the following tables:

1. **trades**: Trade execution records
2. **performance_metrics**: Performance measurement records
3. **growth_metrics**: Hourly growth tracking records
4. **liquidity_metrics**: Market liquidity analysis records

### Database Operations

```python
# Get database statistics
stats = monitor.get_database_stats()
print(f"Total trades: {stats['trades']}")
print(f"Total metrics: {stats['performance_metrics']}")

# Query specific metrics
trades = monitor.metrics_collector.get_trade_metrics(
    since=datetime.now() - timedelta(hours=24),
    symbol="BTCUSDT"
)

performance = monitor.metrics_collector.get_performance_metrics(
    metric_name="system_cpu_percent"
)

# Cleanup old data
monitor.metrics_collector.cleanup_old_data(days=30)
```

## 🔒 Logging Configuration

### Log Levels

```python
from poseidon_monitor.config.settings import LogLevel

config = MonitoringConfig()
config.log_level = LogLevel.DEBUG  # Most verbose
# LogLevel.INFO  # Normal operation
# LogLevel.WARNING  # Only warnings and errors
# LogLevel.ERROR  # Only errors
# LogLevel.CRITICAL  # Only critical errors
```

### Log Formats

```python
from poseidon_monitor.config.settings import OutputFormat

config = MonitoringConfig()
config.log_format = OutputFormat.JSON    # JSON structured logs
# config.log_format = OutputFormat.TEXT   # Human-readable text
# config.log_format = OutputFormat.BOTH   # Both formats
```

## 🚨 Error Handling & Monitoring

### Error Categories

- **SYSTEM_ERROR**: Internal system errors
- **NETWORK_TIMEOUT**: Connection timeouts
- **API_RATE_LIMIT**: Rate limiting errors
- **INSUFFICIENT_FUNDS**: Trading errors
- **INVALID_ORDER**: Order validation errors
- **EXECUTION_ERROR**: Trade execution errors

### Health Monitoring

```python
# Get system health
health = monitor.get_system_health()
print(f"Monitoring running: {health['monitoring_system_running']}")
print(f"Active executions: {health['active_executions']}")

# Check database health
db_stats = monitor.get_database_stats()
total_records = sum(db_stats.values())
print(f"Total records in database: {total_records}")
```

## 📝 Example Integration

See `example_integration.py` for a complete example of how to integrate the monitoring system into a trading bot.

```python
# Run the example
python example_integration.py
```

## 🔄 Cleanup & Maintenance

### Automatic Cleanup

The system automatically cleans up old data based on retention settings. You can trigger manual cleanup:

```python
# Manual cleanup
monitor.metrics_collector.cleanup_old_data(days=7)

# Clear event logs (use carefully)
monitor.logger.clear_events()
```

### Performance Considerations

- Metrics are collected every 60 seconds by default
- Data retention is 30 days by default
- Maximum 10,000 data points kept in memory
- Database automatically maintains data integrity

## 🤝 API Reference

### MonitoringSystem Class

#### Methods
- `start()` - Start the monitoring system
- `stop()` - Stop the monitoring system
- `log_trade()` - Log a trade execution
- `log_performance_metric()` - Log a performance metric
- `log_liquidity_analysis()` - Log liquidity analysis
- `log_error()` - Log an error event
- `start_loop_execution()` - Start loop execution monitoring
- `end_loop_execution()` - End loop execution monitoring
- `update_account_balance()` - Update account balance for growth tracking
- `get_dashboard_summary()` - Get summary dashboard data
- `get_trading_dashboard()` - Get trading dashboard data
- `get_performance_dashboard()` - Get performance dashboard data
- `get_real_time_metrics()` - Get real-time metrics
- `get_hourly_report()` - Get hourly report data
- `export_dashboard_data()` - Export dashboard data

#### Properties
- `logger` - Access to PoseidonLogger instance
- `metrics_collector` - Access to MetricsCollector instance
- `dashboard_data` - Access to DashboardData instance

### Data Structures

#### TradeMetric
- `timestamp` - Trade execution time
- `symbol` - Trading pair symbol
- `side` - Buy or sell
- `quantity` - Trade quantity
- `price` - Trade price
- `notional_value` - Total value (quantity * price)
- `fee` - Trading fee
- `execution_time_ms` - Execution time in milliseconds
- `slippage_bps` - Slippage in basis points
- `execution_id` - Unique execution identifier

#### PerformanceMetric
- `timestamp` - Metric timestamp
- `metric_name` - Name of the metric
- `metric_value` - Metric value
- `unit` - Unit of measurement
- `additional_data` - Additional metadata

#### DashboardSummary
- `timestamp` - Report generation time
- `system_status` - System health status
- `uptime_seconds` - System uptime
- `total_trades_24h` - Total trades in last 24 hours
- `total_volume_24h` - Total volume in last 24 hours
- `total_pnl_24h` - Total P&L in last 24 hours
- `growth_24h` - Growth percentage in last 24 hours
- `error_count_24h` - Error count in last 24 hours

## ✅ Acceptance Criteria Completion

### ✅ Hourly Growth Tracking and Reporting
- Implemented automatic hourly growth tracking
- Configurable via `POSEIDON_HOURLY_GROWTH` environment variable
- Growth data stored in database and accessible via API
- Hourly reports generated with growth metrics

### ✅ Real-time Trade Execution Logging
- Comprehensive trade logging with all execution details
- Real-time trade events with structured data
- Trade callbacks for immediate notification
- Query methods for trade history and analysis

### ✅ Profit/Loss Metrics Collection
- P&L tracking integrated with trade execution
- Growth metrics that include profit/loss calculations
- Performance metrics for profit-related measurements
- Dashboard summaries include P&L data

### ✅ Loop Execution Performance Metrics
- Start/end loop execution monitoring
- Execution time tracking for each loop
- Success/failure status tracking
- Loop performance dashboard with timing analysis

### ✅ Liquidity Analysis Logs
- Market liquidity analysis logging
- Spread, market depth, and volatility tracking
- Symbol-specific liquidity summaries
- 24-hour volume and volatility metrics

### ✅ Error and Failure Event Logging
- Comprehensive error categorization and logging
- Error rate monitoring and alerting
- Error history tracking and analysis
- Critical error detection and alerting

### ✅ Configurable Log Levels and Output
- Five configurable log levels (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Multiple output formats (JSON, TEXT, BOTH)
- Environment variable configuration
- File rotation and retention policies

### ✅ Metrics Dashboard Data Structure
- Structured dashboard data APIs
- Summary, trading, and performance dashboards
- Real-time metrics for live monitoring
- Hourly reports with comprehensive data

### ✅ Performance Analytics for Optimization
- System performance monitoring (CPU, memory, network)
- Trading performance analytics (execution times, slippage)
- Loop execution performance tracking
- Resource utilization monitoring

### ✅ Ready for Integration with Monitoring Tools
- Callback system for external integrations
- JSON export functionality
- RESTful-style APIs for dashboard integration
- Database connectivity for external analytics tools

## 🔧 Testing

```bash
# Run the example integration
python example_integration.py

# The example will:
# 1. Initialize monitoring system
# 2. Simulate trading activities
# 3. Generate various metrics and logs
# 4. Display dashboard summaries
# 5. Demonstrate all monitoring features
```

## 📞 Support

For issues, feature requests, or questions about the Pouseidon Monitoring System:

1. Check the example integration for usage patterns
2. Review the configuration options
3. Examine the dashboard APIs for data access patterns
4. Consult the database schema for data structure details

## 📄 License

This monitoring system is part of Pouseidon Bot v2 and follows the same licensing terms.
"""
Test script for Pouseidon Monitoring System
Validates that all components work correctly together
"""

import os
import sys
import time
import tempfile
from datetime import datetime, timezone, timedelta

# Add the current directory to Python path for imports
sys.path.insert(0, '/home/engine/project')

try:
    from poseidon_monitor import MonitoringSystem, MonitoringConfig
    print("✅ Successfully imported Pouseidon monitoring modules")
except ImportError as e:
    print(f"❌ Failed to import modules: {e}")
    sys.exit(1)

try:
    from poseidon_monitor.config.settings import LogLevel, OutputFormat
except ImportError as e:
    print(f"⚠️ Could not import config settings: {e}")
    # Define fallback classes
    class LogLevel:
        DEBUG = "DEBUG"
        INFO = "INFO"
        WARNING = "WARNING"
        ERROR = "ERROR" 
        CRITICAL = "CRITICAL"
    
    class OutputFormat:
        JSON = "json"
        TEXT = "text"
        BOTH = "both"


def test_configuration():
    """Test configuration initialization and validation"""
    print("\n🔧 Testing Configuration...")
    
    # Test default configuration
    config = MonitoringConfig()
    errors = config.validate()
    
    if errors:
        print(f"❌ Configuration validation failed: {errors}")
        return False
    
    print("✅ Default configuration validated")
    
    # Test custom configuration
    config.log_level = LogLevel.DEBUG
    config.log_format = OutputFormat.JSON
    
    # Use temporary directory for testing
    config.log_file_path = os.path.join(tempfile.gettempdir(), "test_poseidon.log")
    config.database_url = "sqlite:///" + os.path.join(tempfile.gettempdir(), "test_metrics.db")
    
    print("✅ Custom configuration created")
    return True


def test_logger():
    """Test logger functionality"""
    print("\n📝 Testing Logger...")
    
    config = MonitoringConfig()
    config.log_file_path = os.path.join(tempfile.gettempdir(), "test_logger.log")
    
    try:
        from poseidon_monitor.core.logger import PoseidonLogger, EventType
        
        logger = PoseidonLogger(config)
        
        # Test different log levels
        logger.debug("Debug message", EventType.SYSTEM_EVENT)
        logger.info("Info message", EventType.SYSTEM_EVENT)
        logger.warning("Warning message", EventType.SYSTEM_EVENT)
        logger.error("Error message", EventType.SYSTEM_EVENT)
        logger.critical("Critical message", EventType.SYSTEM_EVENT)
        
        # Test specialized logging methods
        logger.log_trade_execution({
            "symbol": "BTCUSDT",
            "side": "buy",
            "quantity": 0.1,
            "price": 45000.0
        })
        
        logger.log_performance_metric({
            "metric_name": "test_metric",
            "value": 42.5,
            "unit": "test_units"
        })
        
        logger.log_growth_tracking({
            "growth_rate": 2.5,
            "current_balance": 10500.0
        })
        
        # Test query methods
        recent_events = logger.get_recent_events(limit=10)
        event_counts = logger.get_event_counts()
        
        print(f"✅ Logger recorded {len(recent_events)} events")
        print(f"✅ Event counts: {event_counts}")
        return True
        
    except Exception as e:
        print(f"❌ Logger test failed: {e}")
        return False


def test_metrics_collector():
    """Test metrics collection functionality"""
    print("\n📊 Testing Metrics Collector...")
    
    config = MonitoringConfig()
    config.database_url = "sqlite:///" + os.path.join(tempfile.gettempdir(), "test_metrics.db")
    
    try:
        from poseidon_monitor.core.metrics import MetricsCollector, TradeMetric, PerformanceMetric, GrowthMetric
        
        metrics = MetricsCollector(config)
        
        # Test trade metric recording
        trade = TradeMetric(
            timestamp=datetime.now(timezone.utc).isoformat(),
            symbol="BTCUSDT",
            side="buy",
            quantity=0.1,
            price=45000.0,
            notional_value=4500.0,
            fee=4.50,
            execution_time_ms=150.0,
            slippage_bps=2.5
        )
        metrics.record_trade(trade)
        
        # Test performance metric recording
        performance = PerformanceMetric(
            timestamp=datetime.now(timezone.utc).isoformat(),
            metric_name="test_performance",
            metric_value=123.45,
            unit="ms"
        )
        metrics.record_performance_metric(performance)
        
        # Test growth metric recording
        metrics.record_hourly_growth(
            current_balance=10500.0,
            trade_count=5,
            pnl=500.0
        )
        
        # Test retrieval methods
        trades = metrics.get_trade_metrics()
        performance_metrics = metrics.get_performance_metrics()
        growth_data = metrics.get_hourly_growth()
        
        trading_summary = metrics.get_trading_summary(24)
        growth_summary = metrics.get_growth_summary(24)
        
        print(f"✅ Recorded and retrieved {len(trades)} trades")
        print(f"✅ Recorded and retrieved {len(performance_metrics)} performance metrics")
        print(f"✅ Recorded and retrieved {len(growth_data)} growth metrics")
        print(f"✅ Trading summary: {trading_summary}")
        print(f"✅ Growth summary: {growth_summary}")
        
        return True
        
    except Exception as e:
        print(f"❌ Metrics collector test failed: {e}")
        return False


def test_dashboard():
    """Test dashboard data generation"""
    print("\n📈 Testing Dashboard...")
    
    config = MonitoringConfig()
    config.database_url = "sqlite:///" + os.path.join(tempfile.gettempdir(), "test_dashboard.db")
    
    try:
        from poseidon_monitor.core.dashboard import DashboardData
        from poseidon_monitor.core.metrics import MetricsCollector
        from poseidon_monitor.core.logger import PoseidonLogger
        
        # Create mock dependencies
        metrics_collector = MetricsCollector(config)
        logger = PoseidonLogger(config)
        dashboard = DashboardData(metrics_collector, logger)
        
        # Test dashboard generation
        summary = dashboard.get_summary_dashboard()
        trading_dashboard = dashboard.get_trading_dashboard(24)
        performance_dashboard = dashboard.get_performance_dashboard(24)
        real_time = dashboard.get_real_time_metrics()
        
        print(f"✅ Generated summary dashboard")
        print(f"✅ Generated trading dashboard with {len(trading_dashboard.recent_trades)} recent trades")
        print(f"✅ Generated performance dashboard")
        print(f"✅ Generated real-time metrics")
        
        # Test export functionality
        export_data = dashboard.export_dashboard_data('json')
        print(f"✅ Exported dashboard data ({len(export_data)} characters)")
        
        return True
        
    except Exception as e:
        print(f"❌ Dashboard test failed: {e}")
        return False


def test_monitoring_system():
    """Test full monitoring system integration"""
    print("\n🚀 Testing Full Monitoring System...")
    
    config = MonitoringConfig()
    config.log_file_path = os.path.join(tempfile.gettempdir(), "test_monitor.log")
    config.database_url = "sqlite:///" + os.path.join(tempfile.gettempdir(), "test_monitor.db")
    
    try:
        monitor = MonitoringSystem(config)
        
        # Test start/stop
        monitor.start()
        print("✅ Monitoring system started")
        
        # Test trade logging
        monitor.log_trade(
            symbol="BTCUSDT",
            side="buy",
            quantity=0.1,
            price=45000.0,
            fee=4.50,
            execution_time_ms=150.0,
            slippage_bps=2.5
        )
        print("✅ Trade logged successfully")
        
        # Test performance metrics
        monitor.log_performance_metric(
            "test_metric",
            42.5,
            "units"
        )
        print("✅ Performance metric logged successfully")
        
        # Test error logging
        monitor.log_error(
            "Test error message",
            error_type="test_error"
        )
        print("✅ Error logged successfully")
        
        # Test loop execution monitoring
        monitor.start_loop_execution("test_loop", "exec_123")
        time.sleep(0.1)  # Brief execution time
        monitor.end_loop_execution("test_loop", success=True, trades_executed=1)
        print("✅ Loop execution monitored successfully")
        
        # Test dashboard APIs
        summary = monitor.get_dashboard_summary()
        trading_dashboard = monitor.get_trading_dashboard(24)
        performance_dashboard = monitor.get_performance_dashboard(24)
        real_time = monitor.get_real_time_metrics()
        
        print(f"✅ Dashboard APIs working")
        print(f"   - System status: {summary.system_status}")
        print(f"   - Total trades: {summary.total_trades_24h}")
        
        # Test context manager
        with MonitoringSystem(config) as ctx_monitor:
            ctx_monitor.log_performance_metric("context_test", 100.0, "test")
            print("✅ Context manager working")
        
        # Test stop
        monitor.stop()
        print("✅ Monitoring system stopped successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Monitoring system test failed: {e}")
        return False


def test_callbacks():
    """Test callback system"""
    print("\n🔔 Testing Callback System...")
    
    config = MonitoringConfig()
    config.database_url = "sqlite:///" + os.path.join(tempfile.gettempdir(), "test_callbacks.db")
    
    try:
        from poseidon_monitor.core.metrics import TradeMetric
        from datetime import datetime, timezone
        
        monitor = MonitoringSystem(config)
        monitor.start()
        
        # Track callback invocations
        trade_called = False
        error_called = False
        performance_called = False
        
        def trade_callback(trade):
            nonlocal trade_called
            trade_called = True
            print(f"   Trade callback: {trade.symbol}")
        
        def error_callback(error_data):
            nonlocal error_called
            error_called = True
            print(f"   Error callback: {error_data['error_type']}")
        
        def performance_callback(metric):
            nonlocal performance_called
            performance_called = True
            print(f"   Performance callback: {metric.metric_name}")
        
        # Register callbacks
        monitor.add_trade_callback(trade_callback)
        monitor.add_error_callback(error_callback)
        monitor.add_performance_callback(performance_callback)
        
        # Trigger callbacks
        monitor.log_trade("BTCUSDT", "buy", 0.1, 45000.0)
        monitor.log_error("Test error", "test_type")
        monitor.log_performance_metric("test", 42.5)
        
        # Verify callbacks were called
        if trade_called and error_called and performance_called:
            print("✅ All callbacks executed successfully")
        else:
            print(f"❌ Callbacks failed: trade={trade_called}, error={error_called}, performance={performance_called}")
            return False
        
        monitor.stop()
        return True
        
    except Exception as e:
        print(f"❌ Callback test failed: {e}")
        return False


def cleanup_test_files():
    """Clean up temporary test files"""
    print("\n🧹 Cleaning up test files...")
    
    temp_dir = tempfile.gettempdir()
    test_files = [
        "test_poseidon.log",
        "test_metrics.db", 
        "test_logger.log",
        "test_dashboard.db",
        "test_monitor.log",
        "test_monitor.db",
        "test_callbacks.db"
    ]
    
    for filename in test_files:
        filepath = os.path.join(temp_dir, filename)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"   Warning: Could not remove {filepath}: {e}")
    
    print("✅ Cleanup completed")


def main():
    """Main test runner"""
    print("🧪 Pouseidon Monitoring System - Test Suite")
    print("=" * 50)
    
    test_results = []
    
    # Run all tests
    test_results.append(("Configuration", test_configuration()))
    test_results.append(("Logger", test_logger()))
    test_results.append(("Metrics Collector", test_metrics_collector()))
    test_results.append(("Dashboard", test_dashboard()))
    test_results.append(("Monitoring System", test_monitoring_system()))
    test_results.append(("Callbacks", test_callbacks()))
    
    # Print results
    print("\n📊 Test Results Summary")
    print("=" * 30)
    
    passed = 0
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{len(test_results)} tests passed")
    
    if passed == len(test_results):
        print("\n🎉 All tests passed! Monitoring system is working correctly.")
    else:
        print(f"\n⚠️  {len(test_results) - passed} tests failed. Please check the output above.")
    
    # Cleanup
    cleanup_test_files()
    
    return passed == len(test_results)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
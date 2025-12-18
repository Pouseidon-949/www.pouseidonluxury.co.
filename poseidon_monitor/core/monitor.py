"""
Main Monitoring System for Pouseidon Bot v2
Orchestrates logging, metrics collection, and dashboard data generation
"""

import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Callable
from pathlib import Path

# Optional dependencies
try:
    import schedule
    HAS_SCHEDULE = True
except ImportError:
    HAS_SCHEDULE = False

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

from ..config.settings import MonitoringConfig
from .logger import PoseidonLogger, EventType
from .metrics import MetricsCollector, TradeMetric, PerformanceMetric, GrowthMetric, LiquidityMetric
from .dashboard import DashboardData


class MonitoringSystem:
    """
    Comprehensive monitoring system for Pouseidon Bot v2
    Integrates logging, metrics collection, and dashboard data generation
    """
    
    def __init__(self, config: Optional[MonitoringConfig] = None):
        """Initialize monitoring system with configuration"""
        self.config = config or MonitoringConfig()
        self._validate_config()
        
        # Initialize core components
        self.logger = PoseidonLogger(self.config)
        self.metrics_collector = MetricsCollector(self.config)
        self.dashboard_data = DashboardData(self.metrics_collector, self.logger)
        
        # Control flags
        self._is_running = False
        self._monitoring_thread = None
        
        # Callbacks for external integration
        self.trade_callbacks = []
        self.error_callbacks = []
        self.performance_callbacks = []
        
        # Performance tracking
        self.loop_start_times = {}
        self.active_executions = {}
        
    def _validate_config(self):
        """Validate configuration and log warnings"""
        errors = self.config.validate()
        if errors:
            self._log_config_errors(errors)
            
    def _log_config_errors(self, errors: list):
        """Log configuration errors"""
        print("Configuration validation errors:")
        for error in errors:
            print(f"  - {error}")
    
    def start(self):
        """Start the monitoring system"""
        if self._is_running:
            self.logger.warning("Monitoring system is already running", EventType.SYSTEM_EVENT)
            return
            
        self._is_running = True
        self.logger.info("Starting Pouseidon monitoring system", EventType.SYSTEM_EVENT)
        
        # Start monitoring thread
        self._monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self._monitoring_thread.start()
        
        # Schedule hourly tasks (if schedule library is available)
        if HAS_SCHEDULE:
            self._schedule_hourly_tasks()
        else:
            self.logger.info("Schedule library not available - manual task scheduling required", EventType.SYSTEM_EVENT)
        
        self.logger.info("Monitoring system started successfully", EventType.SYSTEM_EVENT)
        
    def stop(self):
        """Stop the monitoring system"""
        if not self._is_running:
            self.logger.warning("Monitoring system is not running", EventType.SYSTEM_EVENT)
            return
            
        self._is_running = False
        self.logger.info("Stopping Pouseidon monitoring system", EventType.SYSTEM_EVENT)
        
        # Wait for monitoring thread to finish
        if self._monitoring_thread and self._monitoring_thread.is_alive():
            self._monitoring_thread.join(timeout=5)
            
        self.logger.info("Monitoring system stopped", EventType.SYSTEM_EVENT)
        
    def _monitoring_loop(self):
        """Main monitoring loop"""
        last_hour_check = time.time()
        
        while self._is_running:
            try:
                # Run scheduled tasks (if available)
                if HAS_SCHEDULE:
                    schedule.run_pending()
                else:
                    # Manual hourly task scheduling
                    current_time = time.time()
                    if current_time - last_hour_check >= 3600:  # 1 hour
                        self._record_hourly_growth()
                        last_hour_check = current_time
                
                # Collect system metrics
                self._collect_system_metrics()
                
                # Sleep for collection interval
                time.sleep(self.config.metrics_collection_interval.total_seconds())
                
            except Exception as e:
                self.logger.error(
                    f"Error in monitoring loop: {str(e)}",
                    EventType.ERROR_EVENT,
                    {'error_type': 'monitoring_loop_error', 'error_message': str(e)}
                )
                
    def _schedule_hourly_tasks(self):
        """Schedule hourly monitoring tasks"""
        if self.config.enable_hourly_growth_tracking:
            schedule.every().hour.do(self._record_hourly_growth)
            
        # Clean up old data daily
        schedule.every().day.at("00:00").do(self._cleanup_old_data)
        
    def _collect_system_metrics(self):
        """Collect system performance metrics"""
        if not HAS_PSUTIL:
            return
            
        try:
            # Get system performance data
            performance_data = {
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_usage_percent': psutil.disk_usage('/').percent,
                'network_bytes_sent': psutil.net_io_counters().bytes_sent,
                'network_bytes_recv': psutil.net_io_counters().bytes_recv,
                'process_count': len(psutil.pids()),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # Record performance metrics
            for metric_name, value in performance_data.items():
                if isinstance(value, (int, float)):
                    metric = PerformanceMetric(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        metric_name=f"system_{metric_name}",
                        metric_value=value,
                        unit='percent' if 'percent' in metric_name else 'bytes' if 'bytes' in metric_name else 'count'
                    )
                    self.metrics_collector.record_performance_metric(metric)
                    
        except Exception as e:
            self.logger.error(
                f"Failed to collect system metrics: {str(e)}",
                EventType.ERROR_EVENT,
                {'error_type': 'system_metrics_collection', 'error_message': str(e)}
            )
    
    def _record_hourly_growth(self):
        """Record hourly growth metrics"""
        try:
            # This would typically get real account balance from trading system
            # For now, we'll simulate or use a callback
            current_balance = self._get_current_balance()
            trade_count = self._get_trade_count_last_hour()
            pnl = self._get_pnl_last_hour()
            
            self.metrics_collector.record_hourly_growth(current_balance, trade_count, pnl)
            self.logger.log_growth_tracking({
                'current_balance': current_balance,
                'trade_count': trade_count,
                'pnl': pnl
            })
            
        except Exception as e:
            self.logger.error(
                f"Failed to record hourly growth: {str(e)}",
                EventType.ERROR_EVENT,
                {'error_type': 'hourly_growth_recording', 'error_message': str(e)}
            )
    
    def _cleanup_old_data(self):
        """Clean up old metrics data"""
        try:
            self.metrics_collector.cleanup_old_data()
            self.logger.info("Cleaned up old metrics data", EventType.SYSTEM_EVENT)
        except Exception as e:
            self.logger.error(
                f"Failed to cleanup old data: {str(e)}",
                EventType.ERROR_EVENT,
                {'error_type': 'data_cleanup', 'error_message': str(e)}
            )
    
    # Public API methods for integration
    
    def log_trade(self, symbol: str, side: str, quantity: float, price: float, 
                  fee: float = 0.0, execution_time_ms: float = 0.0, 
                  slippage_bps: float = 0.0, execution_id: str = None):
        """Log a trade execution"""
        trade = TradeMetric(
            timestamp=datetime.now(timezone.utc).isoformat(),
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            notional_value=quantity * price,
            fee=fee,
            execution_time_ms=execution_time_ms,
            slippage_bps=slippage_bps,
            execution_id=execution_id
        )
        
        self.metrics_collector.record_trade(trade)
        self.logger.log_trade_execution({
            'symbol': symbol,
            'side': side,
            'quantity': quantity,
            'price': price,
            'notional_value': quantity * price,
            'fee': fee,
            'execution_time_ms': execution_time_ms,
            'slippage_bps': slippage_bps,
            'execution_id': execution_id
        })
        
        # Trigger callbacks
        self._trigger_callbacks(self.trade_callbacks, trade)
    
    def log_performance_metric(self, metric_name: str, value: float, 
                              unit: str = '', additional_data: Dict[str, Any] = None):
        """Log performance metric"""
        metric = PerformanceMetric(
            timestamp=datetime.now(timezone.utc).isoformat(),
            metric_name=metric_name,
            metric_value=value,
            unit=unit,
            additional_data=additional_data or {}
        )
        
        self.metrics_collector.record_performance_metric(metric)
        self.logger.log_performance_metric({
            'metric_name': metric_name,
            'value': value,
            'unit': unit,
            'additional_data': additional_data
        })
        
        # Trigger callbacks
        self._trigger_callbacks(self.performance_callbacks, metric)
    
    def log_liquidity_analysis(self, symbol: str, spread: float, bid_size: float, 
                              ask_size: float, market_depth: float, 
                              volatility_24h: float, volume_24h: float):
        """Log liquidity analysis"""
        liquidity = LiquidityMetric(
            timestamp=datetime.now(timezone.utc).isoformat(),
            symbol=symbol,
            spread=spread,
            bid_size=bid_size,
            ask_size=ask_size,
            market_depth=market_depth,
            volatility_24h=volatility_24h,
            volume_24h=volume_24h
        )
        
        self.metrics_collector.record_liquidity_metric(liquidity)
        self.logger.log_liquidity_analysis({
            'symbol': symbol,
            'spread': spread,
            'bid_size': bid_size,
            'ask_size': ask_size,
            'market_depth': market_depth,
            'volatility_24h': volatility_24h,
            'volume_24h': volume_24h
        })
    
    def log_error(self, error_message: str, error_type: str = 'general', 
                  execution_id: str = None, additional_data: Dict[str, Any] = None):
        """Log error event"""
        error_data = {
            'error_message': error_message,
            'error_type': error_type,
            'execution_id': execution_id,
            'additional_data': additional_data or {}
        }
        
        self.logger.log_error_event(error_data)
        
        # Trigger callbacks
        self._trigger_callbacks(self.error_callbacks, error_data)
    
    def start_loop_execution(self, loop_id: str, execution_id: str = None):
        """Mark the start of a loop execution"""
        self.loop_start_times[loop_id] = time.time()
        if execution_id:
            self.active_executions[execution_id] = {
                'loop_id': loop_id,
                'start_time': time.time(),
                'status': 'running'
            }
        
        self.logger.debug(f"Started loop execution: {loop_id}", EventType.LOOP_EXECUTION)
    
    def end_loop_execution(self, loop_id: str, success: bool = True, 
                          trades_executed: int = 0, additional_data: Dict[str, Any] = None):
        """Mark the end of a loop execution"""
        if loop_id not in self.loop_start_times:
            self.logger.error(f"Loop execution not found: {loop_id}", EventType.LOOP_EXECUTION)
            return
            
        execution_time = time.time() - self.loop_start_times[loop_id]
        del self.loop_start_times[loop_id]
        
        # Update execution tracking
        for exec_id, exec_data in self.active_executions.items():
            if exec_data['loop_id'] == loop_id:
                exec_data['status'] = 'completed' if success else 'failed'
                exec_data['end_time'] = time.time()
                exec_data['execution_time'] = execution_time
                exec_data['trades_executed'] = trades_executed
                break
        
        loop_data = {
            'loop_id': loop_id,
            'execution_time': execution_time,
            'success': success,
            'trades_executed': trades_executed,
            'additional_data': additional_data or {}
        }
        
        self.logger.log_loop_execution(loop_data)
    
    def update_account_balance(self, balance: float):
        """Update current account balance for growth tracking"""
        # This would typically be called internally or via callback
        # For now, we store it for growth calculations
        if not hasattr(self, '_current_balance'):
            self._current_balance = balance
        else:
            self._current_balance = balance
    
    def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get dashboard summary data"""
        return self.dashboard_data.get_summary_dashboard()
    
    def get_trading_dashboard(self, hours: int = 24) -> Dict[str, Any]:
        """Get trading dashboard data"""
        return self.dashboard_data.get_trading_dashboard(hours)
    
    def get_performance_dashboard(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance dashboard data"""
        return self.dashboard_data.get_performance_dashboard(hours)
    
    def get_real_time_metrics(self) -> Dict[str, Any]:
        """Get real-time metrics"""
        return self.dashboard_data.get_real_time_metrics()
    
    def get_hourly_report(self, target_hour: int = None) -> Dict[str, Any]:
        """Get hourly report data"""
        return self.dashboard_data.get_hourly_report_data(target_hour)
    
    def export_dashboard_data(self, format_type: str = 'json') -> str:
        """Export all dashboard data"""
        return self.dashboard_data.export_dashboard_data(format_type)
    
    def get_recent_events(self, limit: int = 100, event_type: str = None) -> list:
        """Get recent log events"""
        from .core.logger import EventType as LogEventType
        event_type_enum = LogEventType(event_type) if event_type else None
        return self.logger.get_recent_events(limit, event_type_enum)
    
    def get_trading_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get trading summary"""
        return self.metrics_collector.get_trading_summary(hours)
    
    def get_growth_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get growth summary"""
        return self.metrics_collector.get_growth_summary(hours)
    
    def get_liquidity_summary(self, symbol: str, hours: int = 24) -> Dict[str, Any]:
        """Get liquidity summary"""
        return self.metrics_collector.get_liquidity_summary(symbol, hours)
    
    # Callback management
    
    def add_trade_callback(self, callback: Callable):
        """Add callback for trade events"""
        self.trade_callbacks.append(callback)
    
    def add_error_callback(self, callback: Callable):
        """Add callback for error events"""
        self.error_callbacks.append(callback)
    
    def add_performance_callback(self, callback: Callable):
        """Add callback for performance events"""
        self.performance_callbacks.append(callback)
    
    def _trigger_callbacks(self, callbacks: list, data: Any):
        """Trigger registered callbacks"""
        for callback in callbacks:
            try:
                callback(data)
            except Exception as e:
                self.logger.error(
                    f"Callback execution failed: {str(e)}",
                    EventType.ERROR_EVENT,
                    {'error_type': 'callback_error', 'callback': str(callback)}
                )
    
    # Utility methods for external integration
    
    def _get_current_balance(self) -> float:
        """Get current account balance (placeholder for external integration)"""
        return getattr(self, '_current_balance', 10000.0)  # Default balance
    
    def _get_trade_count_last_hour(self) -> int:
        """Get trade count for last hour"""
        last_hour = datetime.now(timezone.utc) - timedelta(hours=1)
        trades = self.metrics_collector.get_trade_metrics(last_hour)
        return len(trades)
    
    def _get_pnl_last_hour(self) -> float:
        """Get P&L for last hour (placeholder)"""
        # This would calculate actual P&L from trades
        return 0.0
    
    def get_database_stats(self) -> Dict[str, int]:
        """Get database statistics"""
        return self.metrics_collector.get_database_stats()
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        return {
            'monitoring_system_running': self._is_running,
            'active_executions': len(self.active_executions),
            'database_stats': self.get_database_stats(),
            'last_update': datetime.now(timezone.utc).isoformat()
        }
    
    def __enter__(self):
        """Context manager entry"""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.stop()
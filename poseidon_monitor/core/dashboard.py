"""
Dashboard Data Structure for Pouseidon Monitoring System
"""

import json
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from collections import defaultdict

from .metrics import TradeMetric, PerformanceMetric, GrowthMetric, LiquidityMetric
from .logger import LogEntry, EventType, LogLevel

# Optional dependencies
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


@dataclass
class DashboardSummary:
    """Dashboard summary data structure"""
    timestamp: str
    system_status: str  # 'healthy', 'warning', 'critical'
    uptime_seconds: int
    total_trades_24h: int
    total_volume_24h: float
    total_pnl_24h: float
    growth_24h: float
    error_count_24h: int
    active_loops: int
    memory_usage_mb: float
    cpu_usage_percent: float


@dataclass
class TradingDashboard:
    """Trading-focused dashboard data"""
    timestamp: str
    recent_trades: List[Dict[str, Any]]
    trading_stats: Dict[str, Any]
    performance_metrics: Dict[str, Any]
    hourly_growth: List[Dict[str, Any]]
    error_summary: Dict[str, Any]
    liquidity_overview: List[Dict[str, Any]]


@dataclass
class PerformanceDashboard:
    """Performance monitoring dashboard data"""
    timestamp: str
    loop_performance: List[Dict[str, Any]]
    system_metrics: Dict[str, Any]
    error_rates: Dict[str, float]
    resource_utilization: Dict[str, float]
    execution_timeline: List[Dict[str, Any]]


class DashboardData:
    """
    Dashboard data aggregator for Pouseidon Bot v2
    Provides structured data for monitoring dashboards and analytics
    """
    
    def __init__(self, metrics_collector, logger):
        self.metrics_collector = metrics_collector
        self.logger = logger
        self.start_time = time.time()
        
    def get_summary_dashboard(self) -> DashboardSummary:
        """Generate summary dashboard data"""
        now = datetime.now(timezone.utc)
        uptime = int(time.time() - self.start_time)
        
        # Get 24h metrics
        trading_summary = self.metrics_collector.get_trading_summary(24)
        growth_summary = self.metrics_collector.get_growth_summary(24)
        
        # Get error count
        since_24h = now - timedelta(hours=24)
        error_events = self.logger.get_errors_since(since_24h)
        
        # Determine system status
        system_status = self._determine_system_status(trading_summary, error_events)
        
        # Get resource usage (simplified - would integrate with actual monitoring)
        memory_usage = self._get_memory_usage()
        cpu_usage = self._get_cpu_usage()
        
        return DashboardSummary(
            timestamp=now.isoformat(),
            system_status=system_status,
            uptime_seconds=uptime,
            total_trades_24h=trading_summary.get('total_trades', 0),
            total_volume_24h=trading_summary.get('total_volume', 0.0),
            total_pnl_24h=trading_summary.get('total_pnl', 0.0),
            growth_24h=growth_summary.get('total_growth', 0.0),
            error_count_24h=len(error_events),
            active_loops=1,  # Would be dynamic in real implementation
            memory_usage_mb=memory_usage,
            cpu_usage_percent=cpu_usage
        )
    
    def get_trading_dashboard(self, hours: int = 24) -> TradingDashboard:
        """Generate trading-focused dashboard"""
        now = datetime.now(timezone.utc)
        
        # Get recent trades
        since = now - timedelta(hours=hours)
        trades = self.metrics_collector.get_trade_metrics(since)
        
        # Get trading statistics
        trading_stats = self.metrics_collector.get_trading_summary(hours)
        
        # Get performance metrics
        performance_data = self._get_performance_summary(hours)
        
        # Get hourly growth
        growth_data = self.metrics_collector.get_hourly_growth(hours)
        hourly_growth = [asdict(g) for g in growth_data]
        
        # Get error summary
        error_summary = self._get_error_summary(hours)
        
        # Get liquidity overview
        liquidity_overview = self._get_liquidity_overview(hours)
        
        # Convert trades to dict format
        recent_trades = [asdict(trade) for trade in trades[-20:]]  # Last 20 trades
        
        return TradingDashboard(
            timestamp=now.isoformat(),
            recent_trades=recent_trades,
            trading_stats=trading_stats,
            performance_metrics=performance_data,
            hourly_growth=hourly_growth,
            error_summary=error_summary,
            liquidity_overview=liquidity_overview
        )
    
    def get_performance_dashboard(self, hours: int = 24) -> PerformanceDashboard:
        """Generate performance monitoring dashboard"""
        now = datetime.now(timezone.utc)
        
        # Get loop performance data
        loop_performance = self._get_loop_performance(hours)
        
        # Get system metrics
        system_metrics = self._get_system_metrics()
        
        # Calculate error rates
        error_rates = self._calculate_error_rates(hours)
        
        # Get resource utilization
        resource_utilization = self._get_resource_utilization()
        
        # Get execution timeline
        execution_timeline = self._get_execution_timeline(hours)
        
        return PerformanceDashboard(
            timestamp=now.isoformat(),
            loop_performance=loop_performance,
            system_metrics=system_metrics,
            error_rates=error_rates,
            resource_utilization=resource_utilization,
            execution_timeline=execution_timeline
        )
    
    def get_real_time_metrics(self) -> Dict[str, Any]:
        """Get real-time metrics for live monitoring"""
        now = datetime.now(timezone.utc)
        
        # Get recent events
        recent_events = self.logger.get_recent_events(limit=100)
        
        # Get current trade data
        last_hour = now - timedelta(hours=1)
        recent_trades = self.metrics_collector.get_trade_metrics(last_hour)
        
        # Calculate real-time metrics
        metrics = {
            'timestamp': now.isoformat(),
            'events_per_minute': self._calculate_events_per_minute(recent_events),
            'trades_last_hour': len(recent_trades),
            'avg_execution_time': self._calculate_avg_execution_time(recent_trades),
            'system_load': self._get_system_load(),
            'memory_usage': self._get_memory_usage(),
            'error_rate': self._calculate_current_error_rate(recent_events),
            'active_components': self._get_active_components()
        }
        
        return metrics
    
    def export_dashboard_data(self, format_type: str = 'json') -> str:
        """Export dashboard data in specified format"""
        dashboard_data = {
            'summary': asdict(self.get_summary_dashboard()),
            'trading': asdict(self.get_trading_dashboard()),
            'performance': asdict(self.get_performance_dashboard()),
            'real_time': self.get_real_time_metrics()
        }
        
        if format_type.lower() == 'json':
            return json.dumps(dashboard_data, indent=2, default=str)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    def get_hourly_report_data(self, target_hour: int = None) -> Dict[str, Any]:
        """Generate hourly report data"""
        if target_hour is None:
            target_hour = datetime.now(timezone.utc).hour
        
        # Get hourly growth data
        hourly_growth = self.metrics_collector.get_hourly_growth(1)  # Last hour
        current_hour_data = [g for g in hourly_growth if g.hour == target_hour]
        
        if not current_hour_data:
            current_hour_data = []
        
        # Get trades for the hour
        now = datetime.now(timezone.utc)
        start_of_hour = now.replace(minute=0, second=0, microsecond=0)
        hourly_trades = self.metrics_collector.get_trade_metrics(start_of_hour)
        
        # Compile report
        report = {
            'report_hour': target_hour,
            'report_date': start_of_hour.date().isoformat(),
            'timestamp': now.isoformat(),
            'growth_data': [asdict(g) for g in current_hour_data],
            'trades_summary': {
                'count': len(hourly_trades),
                'total_volume': sum(t.notional_value for t in hourly_trades),
                'total_fees': sum(t.fee for t in hourly_trades),
                'avg_execution_time': sum(t.execution_time_ms for t in hourly_trades) / len(hourly_trades) if hourly_trades else 0
            },
            'performance_summary': self._get_performance_summary(1),
            'error_summary': self._get_error_summary(1),
            'system_status': self._determine_system_status(
                {'total_trades': len(hourly_trades)}, []
            )
        }
        
        return report
    
    # Private helper methods
    
    def _determine_system_status(self, trading_summary: Dict, error_events: List[LogEntry]) -> str:
        """Determine overall system status"""
        total_trades = trading_summary.get('total_trades', 0)
        error_count = len(error_events)
        
        # Critical: High error rate or system failures
        if error_count > 50 or any(LogLevel(e.level) in [LogLevel.CRITICAL] for e in error_events):
            return 'critical'
        
        # Warning: Moderate errors or low performance
        if error_count > 10 or total_trades < 1:
            return 'warning'
        
        # Healthy: Normal operation
        return 'healthy'
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        if not HAS_PSUTIL:
            return 0.0
        try:
            process = psutil.Process()
            return process.memory_info().rss / 1024 / 1024
        except:
            return 0.0
    
    def _get_cpu_usage(self) -> float:
        """Get current CPU usage percentage"""
        if not HAS_PSUTIL:
            return 0.0
        try:
            return psutil.cpu_percent(interval=1)
        except:
            return 0.0
    
    def _get_performance_summary(self, hours: int) -> Dict[str, Any]:
        """Get performance summary for time period"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        metrics = self.metrics_collector.get_performance_metrics(since=since)
        
        if not metrics:
            return {}
        
        # Group by metric name
        metric_groups = defaultdict(list)
        for metric in metrics:
            metric_groups[metric.metric_name].append(metric.metric_value)
        
        # Calculate aggregations
        performance_summary = {}
        for metric_name, values in metric_groups.items():
            if all(isinstance(v, (int, float)) for v in values):
                performance_summary[metric_name] = {
                    'current': values[-1] if values else 0,
                    'average': sum(values) / len(values),
                    'min': min(values),
                    'max': max(values),
                    'count': len(values)
                }
        
        return performance_summary
    
    def _get_error_summary(self, hours: int) -> Dict[str, Any]:
        """Get error summary for time period"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        error_events = self.logger.get_errors_since(since)
        
        # Group errors by type
        error_types = defaultdict(int)
        for event in error_events:
            error_types[event.data.get('error_type', 'unknown')] += 1
        
        return {
            'total_errors': len(error_events),
            'error_types': dict(error_types),
            'critical_errors': len([e for e in error_events if LogLevel(e.level) == LogLevel.CRITICAL]),
            'recent_errors': [asdict(e) for e in error_events[-10:]]
        }
    
    def _get_liquidity_overview(self, hours: int) -> List[Dict[str, Any]]:
        """Get liquidity overview for monitoring symbols"""
        # This would typically be configured or discovered
        symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT']  # Example symbols
        
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        liquidity_data = []
        
        for symbol in symbols:
            summary = self.metrics_collector.get_liquidity_summary(symbol, hours)
            if summary.get('data_points', 0) > 0:
                liquidity_data.append(summary)
        
        return liquidity_data
    
    def _get_loop_performance(self, hours: int) -> List[Dict[str, Any]]:
        """Get loop performance data"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        loop_events = [
            event for event in self.logger.get_recent_events(limit=1000)
            if event.event_type == EventType.LOOP_EXECUTION 
            and datetime.fromisoformat(event.timestamp) > since
        ]
        
        # Extract performance data from events
        loop_performance = []
        for event in loop_events:
            performance_data = event.data
            loop_performance.append({
                'timestamp': event.timestamp,
                'execution_time': performance_data.get('execution_time', 0),
                'success': performance_data.get('success', False),
                'trades_executed': performance_data.get('trades_executed', 0),
                'loop_id': performance_data.get('loop_id', 'unknown')
            })
        
        return loop_performance
    
    def _get_system_metrics(self) -> Dict[str, Any]:
        """Get system-level performance metrics"""
        return {
            'uptime': time.time() - self.start_time,
            'memory_usage': self._get_memory_usage(),
            'cpu_usage': self._get_cpu_usage(),
            'active_threads': len([t for t in threading.enumerate() if t.is_alive()]),
            'database_size': self._get_database_size(),
            'psutil_available': HAS_PSUTIL
        }
    
    def _calculate_error_rates(self, hours: int) -> Dict[str, float]:
        """Calculate error rates over time period"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        all_events = self.logger.get_recent_events(limit=10000)
        recent_events = [
            event for event in all_events 
            if datetime.fromisoformat(event.timestamp) > since
        ]
        
        total_events = len(recent_events)
        error_events = len([e for e in recent_events if LogLevel(e.level) in [LogLevel.ERROR, LogLevel.CRITICAL]])
        
        return {
            'error_rate_percent': (error_events / total_events * 100) if total_events > 0 else 0,
            'critical_rate_percent': (len([e for e in recent_events if LogLevel(e.level) == LogLevel.CRITICAL]) / total_events * 100) if total_events > 0 else 0,
            'events_per_hour': total_events / hours if hours > 0 else 0
        }
    
    def _get_resource_utilization(self) -> Dict[str, float]:
        """Get current resource utilization"""
        return {
            'cpu_percent': self._get_cpu_usage(),
            'memory_percent': self._get_memory_percent(),
            'disk_usage_percent': self._get_disk_usage_percent(),
            'network_io': self._get_network_io()
        }
    
    def _get_execution_timeline(self, hours: int) -> List[Dict[str, Any]]:
        """Get execution timeline for analysis"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        timeline_events = [
            event for event in self.logger.get_recent_events(limit=5000)
            if datetime.fromisoformat(event.timestamp) > since
            and event.event_type in [EventType.TRADE_EXECUTION, EventType.LOOP_EXECUTION, EventType.ERROR_EVENT]
        ]
        
        return [
            {
                'timestamp': event.timestamp,
                'event_type': event.event_type.value,
                'level': event.level,
                'message': event.message,
                'data': event.data
            }
            for event in timeline_events
        ]
    
    def _calculate_events_per_minute(self, events: List[LogEntry]) -> float:
        """Calculate events per minute from recent events"""
        if not events:
            return 0.0
        
        # Group events by minute
        minute_counts = defaultdict(int)
        for event in events:
            minute_key = event.timestamp[:16]  # YYYY-MM-DDTHH:MM
            minute_counts[minute_key] += 1
        
        if minute_counts:
            return sum(minute_counts.values()) / len(minute_counts)
        return 0.0
    
    def _calculate_avg_execution_time(self, trades: List[TradeMetric]) -> float:
        """Calculate average execution time from trades"""
        if not trades:
            return 0.0
        return sum(trade.execution_time_ms for trade in trades) / len(trades)
    
    def _get_system_load(self) -> float:
        """Get current system load (simplified)"""
        if not HAS_PSUTIL:
            return 0.0
        try:
            return psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else 0.0
        except:
            return 0.0
    
    def _calculate_current_error_rate(self, events: List[LogEntry]) -> float:
        """Calculate current error rate from recent events"""
        if not events:
            return 0.0
        error_count = len([e for e in events if LogLevel(e.level) in [LogLevel.ERROR, LogLevel.CRITICAL]])
        return (error_count / len(events)) * 100
    
    def _get_active_components(self) -> List[str]:
        """Get list of active system components"""
        return ['trading_engine', 'metrics_collector', 'logger', 'liquidity_monitor']
    
    def _get_memory_percent(self) -> float:
        """Get memory usage percentage"""
        if not HAS_PSUTIL:
            return 0.0
        try:
            return psutil.virtual_memory().percent
        except:
            return 0.0
    
    def _get_disk_usage_percent(self) -> float:
        """Get disk usage percentage"""
        if not HAS_PSUTIL:
            return 0.0
        try:
            return psutil.disk_usage('/').percent
        except:
            return 0.0
    
    def _get_network_io(self) -> Dict[str, float]:
        """Get network I/O stats"""
        if not HAS_PSUTIL:
            return {'bytes_sent': 0, 'bytes_recv': 0, 'packets_sent': 0, 'packets_recv': 0}
        try:
            net_io = psutil.net_io_counters()
            return {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv
            }
        except:
            return {'bytes_sent': 0, 'bytes_recv': 0, 'packets_sent': 0, 'packets_recv': 0}
    
    def _get_database_size(self) -> int:
        """Get database file size in bytes"""
        try:
            return self.metrics_collector.db_path.stat().st_size
        except:
            return 0
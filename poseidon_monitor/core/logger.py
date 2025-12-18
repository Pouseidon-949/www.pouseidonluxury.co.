"""
Pouseidon Logger - Comprehensive Logging System
"""

import os
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from pathlib import Path
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from enum import Enum

from ..config.settings import LogLevel, OutputFormat, MonitoringConfig


class EventType(Enum):
    TRADE_EXECUTION = "trade_execution"
    PROFIT_LOSS = "profit_loss"
    LOOP_EXECUTION = "loop_execution"
    LIQUIDITY_ANALYSIS = "liquidity_analysis"
    ERROR_EVENT = "error_event"
    PERFORMANCE_METRIC = "performance_metric"
    GROWTH_TRACKING = "growth_tracking"
    SYSTEM_EVENT = "system_event"


@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: str
    level: str
    event_type: EventType
    message: str
    data: Dict[str, Any]
    thread_id: Optional[str] = None
    execution_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


class PoseidonLogger:
    """
    Comprehensive logging system for Pouseidon Bot v2
    Handles structured logging with multiple output formats and event types
    """
    
    def __init__(self, config: MonitoringConfig):
        self.config = config
        self.log_file_path = Path(config.log_file_path)
        self._setup_file_logging()
        self._setup_memory_handler()
        
        # Thread safety
        self._lock = threading.RLock()
        
        # Event tracking
        self._event_counts = defaultdict(int)
        self._recent_events = deque(maxlen=1000)  # Keep last 1000 events in memory
        
    def _setup_file_logging(self):
        """Setup file-based logging"""
        # Create log directory if it doesn't exist
        self.log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Setup rotating file handler
        from logging.handlers import RotatingFileHandler
        
        file_handler = RotatingFileHandler(
            filename=self.log_file_path,
            maxBytes=self.config.log_max_size,
            backupCount=self.config.log_backup_count,
            encoding='utf-8'
        )
        
        # Custom formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        
        self._logger = logging.getLogger('poseidon.monitor')
        self._logger.setLevel(getattr(logging, self.config.log_level.value))
        self._logger.addHandler(file_handler)
        
    def _setup_memory_handler(self):
        """Setup in-memory event storage for dashboard"""
        self._memory_handler = deque(maxlen=10000)  # Keep last 10k events in memory
        
    def _should_log(self, level: LogLevel) -> bool:
        """Check if message should be logged based on current log level"""
        level_order = {
            LogLevel.DEBUG: 0,
            LogLevel.INFO: 1,
            LogLevel.WARNING: 2,
            LogLevel.ERROR: 3,
            LogLevel.CRITICAL: 4
        }
        return level_order[level] >= level_order[self.config.log_level]
        
    def _create_log_entry(self, level: LogLevel, event_type: EventType, 
                         message: str, data: Dict[str, Any] = None) -> LogEntry:
        """Create structured log entry"""
        return LogEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            level=level.value,
            event_type=event_type,
            message=message,
            data=data or {},
            thread_id=threading.current_thread().name,
            execution_id=data.get('execution_id') if data else None
        )
        
    def _store_event(self, entry: LogEntry):
        """Store event in memory and update counters"""
        with self._lock:
            self._recent_events.append(entry)
            self._event_counts[entry.event_type.value] += 1
            
    def _log_structured(self, entry: LogEntry):
        """Log structured entry"""
        # Log to file with Python logging
        log_level_map = {
            LogLevel.DEBUG: self._logger.debug,
            LogLevel.INFO: self._logger.info,
            LogLevel.WARNING: self._logger.warning,
            LogLevel.ERROR: self._logger.error,
            LogLevel.CRITICAL: self._logger.critical
        }
        
        log_func = log_level_map[LogLevel(entry.level)]
        
        if self.config.log_format in [OutputFormat.JSON, OutputFormat.BOTH]:
            log_func(entry.to_json())
        else:
            log_func(f"[{entry.event_type.value}] {entry.message}")
            
        # Store in memory for dashboard
        self._store_event(entry)
        
    # Public logging methods
    
    def debug(self, message: str, event_type: EventType = EventType.SYSTEM_EVENT, 
              data: Dict[str, Any] = None, **kwargs):
        """Log debug message"""
        if self._should_log(LogLevel.DEBUG):
            entry = self._create_log_entry(LogLevel.DEBUG, event_type, message, data)
            self._log_structured(entry)
            
    def info(self, message: str, event_type: EventType = EventType.SYSTEM_EVENT, 
             data: Dict[str, Any] = None, **kwargs):
        """Log info message"""
        if self._should_log(LogLevel.INFO):
            entry = self._create_log_entry(LogLevel.INFO, event_type, message, data)
            self._log_structured(entry)
            
    def warning(self, message: str, event_type: EventType = EventType.SYSTEM_EVENT, 
                data: Dict[str, Any] = None, **kwargs):
        """Log warning message"""
        if self._should_log(LogLevel.WARNING):
            entry = self._create_log_entry(LogLevel.WARNING, event_type, message, data)
            self._log_structured(entry)
            
    def error(self, message: str, event_type: EventType = EventType.ERROR_EVENT, 
              data: Dict[str, Any] = None, **kwargs):
        """Log error message"""
        if self._should_log(LogLevel.ERROR):
            entry = self._create_log_entry(LogLevel.ERROR, event_type, message, data)
            self._log_structured(entry)
            
    def critical(self, message: str, event_type: EventType = EventType.ERROR_EVENT, 
                 data: Dict[str, Any] = None, **kwargs):
        """Log critical message"""
        if self._should_log(LogLevel.CRITICAL):
            entry = self._create_log_entry(LogLevel.CRITICAL, event_type, message, data)
            self._log_structured(entry)
            
    # Specialized logging methods for different event types
    
    def log_trade_execution(self, trade_data: Dict[str, Any]):
        """Log trade execution event"""
        self.info(
            f"Trade executed: {trade_data.get('symbol', 'Unknown')} - {trade_data.get('side', 'Unknown')}",
            EventType.TRADE_EXECUTION,
            trade_data
        )
        
    def log_profit_loss(self, pnl_data: Dict[str, Any]):
        """Log profit/loss event"""
        pnl_type = "profit" if pnl_data.get('pnl', 0) > 0 else "loss"
        self.info(
            f"P&L: {pnl_type} of {pnl_data.get('pnl', 0)} on {pnl_data.get('symbol', 'Unknown')}",
            EventType.PROFIT_LOSS,
            pnl_data
        )
        
    def log_loop_execution(self, loop_data: Dict[str, Any]):
        """Log loop execution event"""
        self.info(
            f"Loop execution completed in {loop_data.get('execution_time', 0):.2f}s",
            EventType.LOOP_EXECUTION,
            loop_data
        )
        
    def log_liquidity_analysis(self, liquidity_data: Dict[str, Any]):
        """Log liquidity analysis event"""
        self.debug(
            f"Liquidity analysis: spread={liquidity_data.get('spread', 0):.4f}",
            EventType.LIQUIDITY_ANALYSIS,
            liquidity_data
        )
        
    def log_error_event(self, error_data: Dict[str, Any]):
        """Log error event"""
        self.error(
            f"Error: {error_data.get('error_message', 'Unknown error')}",
            EventType.ERROR_EVENT,
            error_data
        )
        
    def log_performance_metric(self, performance_data: Dict[str, Any]):
        """Log performance metric"""
        self.debug(
            f"Performance: {performance_data.get('metric_name', 'Unknown')} = {performance_data.get('value', 'N/A')}",
            EventType.PERFORMANCE_METRIC,
            performance_data
        )
        
    def log_growth_tracking(self, growth_data: Dict[str, Any]):
        """Log growth tracking event"""
        self.info(
            f"Hourly growth: {growth_data.get('growth_rate', 0):.2f}%",
            EventType.GROWTH_TRACKING,
            growth_data
        )
        
    def log_system_event(self, event_description: str, data: Dict[str, Any] = None):
        """Log system event"""
        self.info(event_description, EventType.SYSTEM_EVENT, data)
        
    # Query methods for dashboard and analysis
    
    def get_recent_events(self, limit: int = 100, 
                         event_type: Optional[EventType] = None,
                         level: Optional[LogLevel] = None) -> List[LogEntry]:
        """Get recent events with optional filtering"""
        with self._lock:
            events = list(self._recent_events)
            
        # Apply filters
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if level:
            events = [e for e in events if LogLevel(e.level) == level]
            
        return events[-limit:]  # Return last 'limit' events
        
    def get_event_counts(self) -> Dict[str, int]:
        """Get count of events by type"""
        with self._lock:
            return dict(self._event_counts)
            
    def get_errors_since(self, since_timestamp: datetime) -> List[LogEntry]:
        """Get all error events since timestamp"""
        with self._lock:
            return [e for e in self._recent_events 
                   if LogLevel(e.level) in [LogLevel.ERROR, LogLevel.CRITICAL] 
                   and datetime.fromisoformat(e.timestamp) > since_timestamp]
                   
    def get_trades_since(self, since_timestamp: datetime) -> List[LogEntry]:
        """Get all trade events since timestamp"""
        with self._lock:
            return [e for e in self._recent_events 
                   if e.event_type == EventType.TRADE_EXECUTION 
                   and datetime.fromisoformat(e.timestamp) > since_timestamp]
                   
    def get_performance_metrics(self, since_timestamp: datetime) -> List[LogEntry]:
        """Get all performance metrics since timestamp"""
        with self._lock:
            return [e for e in self._recent_events 
                   if e.event_type == EventType.PERFORMANCE_METRIC 
                   and datetime.fromisoformat(e.timestamp) > since_timestamp]
                   
    def clear_events(self):
        """Clear all stored events (for cleanup)"""
        with self._lock:
            self._recent_events.clear()
            self._event_counts.clear()
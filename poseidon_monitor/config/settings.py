"""
Monitoring System Configuration
"""

import os
from enum import Enum
from typing import Dict, List, Optional
from datetime import timedelta


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class OutputFormat(Enum):
    JSON = "json"
    TEXT = "text"
    BOTH = "both"


class MonitoringConfig:
    """Configuration class for Pouseidon monitoring system"""
    
    def __init__(self):
        # Logging Configuration
        self.log_level = LogLevel(os.getenv("POSEIDON_LOG_LEVEL", "INFO"))
        self.log_format = OutputFormat(os.getenv("POSEIDON_LOG_FORMAT", "both"))
        self.log_file_path = os.getenv("POSEIDON_LOG_FILE", "logs/poseidon_monitor.log")
        self.log_max_size = int(os.getenv("POSEIDON_LOG_MAX_SIZE", "10485760"))  # 10MB
        self.log_backup_count = int(os.getenv("POSEIDON_LOG_BACKUP_COUNT", "5"))
        
        # Metrics Configuration
        self.metrics_collection_interval = timedelta(seconds=int(os.getenv("POSEIDON_METRICS_INTERVAL", "60")))
        self.metrics_retention_days = int(os.getenv("POSEIDON_METRICS_RETENTION_DAYS", "30"))
        self.enable_hourly_growth_tracking = os.getenv("POSEIDON_HOURLY_GROWTH", "true").lower() == "true"
        
        # Dashboard Configuration
        self.dashboard_refresh_rate = timedelta(seconds=int(os.getenv("POSEIDON_DASHBOARD_REFRESH", "30")))
        self.max_data_points = int(os.getenv("POSEIDON_MAX_DATA_POINTS", "10000"))
        
        # Storage Configuration
        self.storage_backend = os.getenv("POSEIDON_STORAGE", "file")  # file, redis, sqlite
        self.database_url = os.getenv("POSEIDON_DB_URL", "sqlite:///poseidon_metrics.db")
        
        # Performance Configuration
        self.enable_performance_monitoring = os.getenv("POSEIDON_PERFORMANCE_MONITORING", "true").lower() == "true"
        self.loop_monitoring_enabled = os.getenv("POSEIDON_LOOP_MONITORING", "true").lower() == "true"
        
        # Trade Tracking Configuration
        self.track_all_trades = os.getenv("POSEIDON_TRACK_TRADES", "true").lower() == "true"
        self.detailed_trade_logging = os.getenv("POSEIDON_DETAILED_TRADES", "true").lower() == "true"
        
        # Liquidity Analysis Configuration
        self.liquidity_tracking_enabled = os.getenv("POSEIDON_LIQUIDITY_TRACKING", "true").lower() == "true"
        self.liquidity_analysis_interval = timedelta(minutes=int(os.getenv("POSEIDON_LIQUIDITY_INTERVAL", "15")))
        
        # Error Monitoring Configuration
        self.error_tracking_enabled = os.getenv("POSEIDON_ERROR_TRACKING", "true").lower() == "true"
        self.critical_error_alerts = os.getenv("POSEIDON_CRITICAL_ALERTS", "true").lower() == "true"
        
    def validate(self) -> List[str]:
        """Validate configuration and return list of errors"""
        errors = []
        
        if not isinstance(self.log_max_size, int) or self.log_max_size < 1024:
            errors.append("log_max_size must be a positive integer >= 1024")
            
        if not isinstance(self.log_backup_count, int) or self.log_backup_count < 1:
            errors.append("log_backup_count must be a positive integer >= 1")
            
        if not isinstance(self.metrics_retention_days, int) or self.metrics_retention_days < 1:
            errors.append("metrics_retention_days must be a positive integer >= 1")
            
        if not isinstance(self.max_data_points, int) or self.max_data_points < 100:
            errors.append("max_data_points must be a positive integer >= 100")
            
        return errors
    
    def to_dict(self) -> Dict:
        """Convert configuration to dictionary"""
        return {
            "log_level": self.log_level.value,
            "log_format": self.log_format.value,
            "log_file_path": self.log_file_path,
            "log_max_size": self.log_max_size,
            "log_backup_count": self.log_backup_count,
            "metrics_collection_interval": str(self.metrics_collection_interval),
            "metrics_retention_days": self.metrics_retention_days,
            "enable_hourly_growth_tracking": self.enable_hourly_growth_tracking,
            "dashboard_refresh_rate": str(self.dashboard_refresh_rate),
            "max_data_points": self.max_data_points,
            "storage_backend": self.storage_backend,
            "database_url": self.database_url,
            "enable_performance_monitoring": self.enable_performance_monitoring,
            "loop_monitoring_enabled": self.loop_monitoring_enabled,
            "track_all_trades": self.track_all_trades,
            "detailed_trade_logging": self.detailed_trade_logging,
            "liquidity_tracking_enabled": self.liquidity_tracking_enabled,
            "liquidity_analysis_interval": str(self.liquidity_analysis_interval),
            "error_tracking_enabled": self.error_tracking_enabled,
            "critical_error_alerts": self.critical_error_alerts
        }
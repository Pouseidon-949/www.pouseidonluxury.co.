"""
Pouseidon Bot v2 - Comprehensive Monitoring, Logging & Metrics Collection System
"""

from .core.monitor import MonitoringSystem
from .core.logger import PoseidonLogger
from .core.metrics import MetricsCollector
from .core.dashboard import DashboardData
from .config.settings import MonitoringConfig

__version__ = "2.0.0"
__all__ = [
    "MonitoringSystem",
    "PoseidonLogger", 
    "MetricsCollector",
    "DashboardData",
    "MonitoringConfig"
]
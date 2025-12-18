"""
Metrics Collection System for Pouseidon Bot v2
"""

import sqlite3
import json
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict, field
from collections import defaultdict, deque
from pathlib import Path
import statistics

from ..config.settings import MonitoringConfig


@dataclass
class TradeMetric:
    """Individual trade metric record"""
    timestamp: str
    symbol: str
    side: str  # 'buy' or 'sell'
    quantity: float
    price: float
    notional_value: float
    fee: float
    execution_time_ms: float
    slippage_bps: float = 0.0
    execution_id: Optional[str] = None


@dataclass
class PerformanceMetric:
    """Performance metric record"""
    timestamp: str
    metric_name: str
    metric_value: Union[int, float, str]
    unit: str
    execution_id: Optional[str] = None
    additional_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GrowthMetric:
    """Hourly growth tracking metric"""
    timestamp: str
    hour: int
    account_balance: float
    previous_balance: float
    growth_amount: float
    growth_percentage: float
    trade_count: int
    profit_loss: float


@dataclass
class LiquidityMetric:
    """Liquidity analysis metric"""
    timestamp: str
    symbol: str
    spread: float
    bid_size: float
    ask_size: float
    market_depth: float
    volatility_24h: float
    volume_24h: float


class MetricsCollector:
    """
    Comprehensive metrics collection system for Pouseidon Bot v2
    Collects and stores trading metrics, performance data, and growth tracking
    """
    
    def __init__(self, config: MonitoringConfig):
        self.config = config
        self.db_path = Path(config.database_url.replace('sqlite:///', ''))
        self._setup_database()
        
        # Thread safety
        self._lock = threading.RLock()
        
        # In-memory storage for real-time access
        self._recent_trades = deque(maxlen=config.max_data_points)
        self._recent_performance = deque(maxlen=config.max_data_points)
        self._growth_data = deque(maxlen=168)  # Keep 1 week of hourly data
        self._liquidity_data = deque(maxlen=config.max_data_points)
        
        # Real-time aggregations
        self._daily_stats = defaultdict(lambda: {
            'trades': 0,
            'total_volume': 0.0,
            'total_fees': 0.0,
            'total_pnl': 0.0,
            'avg_execution_time': 0.0,
            'slippage_sum': 0.0
        })
        
        # Hourly growth tracking
        self._last_hour_balance = 0.0
        self._last_hour_timestamp = None
        
    def _setup_database(self):
        """Setup SQLite database for metrics storage"""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            # Trades table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    price REAL NOT NULL,
                    notional_value REAL NOT NULL,
                    fee REAL NOT NULL,
                    execution_time_ms REAL NOT NULL,
                    slippage_bps REAL DEFAULT 0.0,
                    execution_id TEXT
                )
            ''')
            
            # Performance metrics table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value TEXT NOT NULL,
                    unit TEXT NOT NULL,
                    execution_id TEXT,
                    additional_data TEXT
                )
            ''')
            
            # Growth metrics table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS growth_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    hour INTEGER NOT NULL,
                    account_balance REAL NOT NULL,
                    previous_balance REAL NOT NULL,
                    growth_amount REAL NOT NULL,
                    growth_percentage REAL NOT NULL,
                    trade_count INTEGER NOT NULL,
                    profit_loss REAL NOT NULL
                )
            ''')
            
            # Liquidity metrics table
            conn.execute('''
                CREATE TABLE IF NOT EXISTS liquidity_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    spread REAL NOT NULL,
                    bid_size REAL NOT NULL,
                    ask_size REAL NOT NULL,
                    market_depth REAL NOT NULL,
                    volatility_24h REAL NOT NULL,
                    volume_24h REAL NOT NULL
                )
            ''')
            
            conn.commit()
    
    # Trade metrics methods
    
    def record_trade(self, trade: TradeMetric):
        """Record a trade execution"""
        with self._lock:
            # Store in memory
            self._recent_trades.append(trade)
            
            # Store in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO trades (
                        timestamp, symbol, side, quantity, price, notional_value,
                        fee, execution_time_ms, slippage_bps, execution_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    trade.timestamp, trade.symbol, trade.side, trade.quantity,
                    trade.price, trade.notional_value, trade.fee, trade.execution_time_ms,
                    trade.slippage_bps, trade.execution_id
                ))
                conn.commit()
            
            # Update daily stats
            day_key = trade.timestamp[:10]  # YYYY-MM-DD
            stats = self._daily_stats[day_key]
            stats['trades'] += 1
            stats['total_volume'] += trade.notional_value
            stats['total_fees'] += trade.fee
            stats['slippage_sum'] += trade.slippage_bps
    
    def get_trade_metrics(self, since: Optional[datetime] = None, 
                         symbol: Optional[str] = None) -> List[TradeMetric]:
        """Get trade metrics with optional filtering"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT * FROM trades WHERE 1=1"
            params = []
            
            if since:
                query += " AND timestamp >= ?"
                params.append(since.isoformat())
            
            if symbol:
                query += " AND symbol = ?"
                params.append(symbol)
            
            query += " ORDER BY timestamp DESC"
            
            cursor = conn.execute(query, params)
            return [TradeMetric(*row[1:]) for row in cursor.fetchall()]
    
    def get_trading_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get trading summary for specified hours"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        trades = self.get_trade_metrics(since)
        
        if not trades:
            return {
                'total_trades': 0,
                'total_volume': 0.0,
                'total_fees': 0.0,
                'total_pnl': 0.0,
                'avg_execution_time': 0.0,
                'avg_slippage': 0.0,
                'win_rate': 0.0
            }
        
        total_volume = sum(t.notional_value for t in trades)
        total_fees = sum(t.fee for t in trades)
        total_execution_time = sum(t.execution_time_ms for t in trades)
        total_slippage = sum(t.slippage_bps for t in trades)
        
        return {
            'total_trades': len(trades),
            'total_volume': total_volume,
            'total_fees': total_fees,
            'total_pnl': self._calculate_total_pnl(trades),
            'avg_execution_time': total_execution_time / len(trades),
            'avg_slippage': total_slippage / len(trades),
            'win_rate': self._calculate_win_rate(trades),
            'volume_by_symbol': self._group_volume_by_symbol(trades)
        }
    
    # Performance metrics methods
    
    def record_performance_metric(self, metric: PerformanceMetric):
        """Record performance metric"""
        with self._lock:
            # Store in memory
            self._recent_performance.append(metric)
            
            # Store in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO performance_metrics (
                        timestamp, metric_name, metric_value, unit,
                        execution_id, additional_data
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    metric.timestamp, metric.metric_name, str(metric.metric_value),
                    metric.unit, metric.execution_id, json.dumps(metric.additional_data)
                ))
                conn.commit()
    
    def get_performance_metrics(self, metric_name: Optional[str] = None,
                               since: Optional[datetime] = None) -> List[PerformanceMetric]:
        """Get performance metrics"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT * FROM performance_metrics WHERE 1=1"
            params = []
            
            if metric_name:
                query += " AND metric_name = ?"
                params.append(metric_name)
            
            if since:
                query += " AND timestamp >= ?"
                params.append(since.isoformat())
            
            query += " ORDER BY timestamp DESC"
            
            cursor = conn.execute(query, params)
            metrics = []
            for row in cursor.fetchall():
                metrics.append(PerformanceMetric(
                    timestamp=row[1],
                    metric_name=row[2],
                    metric_value=row[3],
                    unit=row[4],
                    execution_id=row[5],
                    additional_data=json.loads(row[6]) if row[6] else {}
                ))
            return metrics
    
    # Growth tracking methods
    
    def record_hourly_growth(self, current_balance: float, 
                            trade_count: int = 0, pnl: float = 0.0):
        """Record hourly growth metric"""
        now = datetime.now(timezone.utc)
        hour = now.hour
        
        # Calculate growth
        growth_amount = current_balance - self._last_hour_balance
        growth_percentage = (growth_amount / self._last_hour_balance * 100) if self._last_hour_balance > 0 else 0.0
        
        growth_metric = GrowthMetric(
            timestamp=now.isoformat(),
            hour=hour,
            account_balance=current_balance,
            previous_balance=self._last_hour_balance,
            growth_amount=growth_amount,
            growth_percentage=growth_percentage,
            trade_count=trade_count,
            profit_loss=pnl
        )
        
        with self._lock:
            # Store in memory
            self._growth_data.append(growth_metric)
            
            # Store in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO growth_metrics (
                        timestamp, hour, account_balance, previous_balance,
                        growth_amount, growth_percentage, trade_count, profit_loss
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    growth_metric.timestamp, growth_metric.hour,
                    growth_metric.account_balance, growth_metric.previous_balance,
                    growth_metric.growth_amount, growth_metric.growth_percentage,
                    growth_metric.trade_count, growth_metric.profit_loss
                ))
                conn.commit()
            
            # Update last hour tracking
            self._last_hour_balance = current_balance
            self._last_hour_timestamp = now
    
    def get_hourly_growth(self, hours: int = 24) -> List[GrowthMetric]:
        """Get hourly growth data for specified hours"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                SELECT * FROM growth_metrics 
                WHERE timestamp >= ? 
                ORDER BY timestamp ASC
            ''', (since.isoformat(),))
            
            return [GrowthMetric(*row[1:]) for row in cursor.fetchall()]
    
    def get_growth_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get growth summary statistics"""
        growth_data = self.get_hourly_growth(hours)
        
        if not growth_data:
            return {
                'total_growth': 0.0,
                'avg_hourly_growth': 0.0,
                'max_hourly_growth': 0.0,
                'min_hourly_growth': 0.0,
                'growth_streak': 0
            }
        
        growth_amounts = [g.growth_amount for g in growth_data]
        growth_percentages = [g.growth_percentage for g in growth_data]
        
        # Calculate growth streak (consecutive positive growth periods)
        growth_streak = 0
        for g in reversed(growth_data):
            if g.growth_amount > 0:
                growth_streak += 1
            else:
                break
        
        return {
            'total_growth': sum(growth_amounts),
            'avg_hourly_growth': statistics.mean(growth_amounts),
            'max_hourly_growth': max(growth_amounts),
            'min_hourly_growth': min(growth_amounts),
            'avg_growth_percentage': statistics.mean(growth_percentages),
            'growth_streak': growth_streak,
            'positive_periods': len([g for g in growth_amounts if g > 0])
        }
    
    # Liquidity metrics methods
    
    def record_liquidity_metric(self, metric: LiquidityMetric):
        """Record liquidity analysis metric"""
        with self._lock:
            # Store in memory
            self._liquidity_data.append(metric)
            
            # Store in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO liquidity_metrics (
                        timestamp, symbol, spread, bid_size, ask_size,
                        market_depth, volatility_24h, volume_24h
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    metric.timestamp, metric.symbol, metric.spread,
                    metric.bid_size, metric.ask_size, metric.market_depth,
                    metric.volatility_24h, metric.volume_24h
                ))
                conn.commit()
    
    def get_liquidity_metrics(self, symbol: Optional[str] = None,
                             since: Optional[datetime] = None) -> List[LiquidityMetric]:
        """Get liquidity metrics"""
        with sqlite3.connect(self.db_path) as conn:
            query = "SELECT * FROM liquidity_metrics WHERE 1=1"
            params = []
            
            if symbol:
                query += " AND symbol = ?"
                params.append(symbol)
            
            if since:
                query += " AND timestamp >= ?"
                params.append(since.isoformat())
            
            query += " ORDER BY timestamp DESC"
            
            cursor = conn.execute(query, params)
            return [LiquidityMetric(*row[1:]) for row in cursor.fetchall()]
    
    def get_liquidity_summary(self, symbol: str, hours: int = 24) -> Dict[str, Any]:
        """Get liquidity summary for a symbol"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        metrics = self.get_liquidity_metrics(symbol, since)
        
        if not metrics:
            return {
                'symbol': symbol,
                'avg_spread': 0.0,
                'avg_market_depth': 0.0,
                'avg_volatility': 0.0,
                'total_volume': 0.0
            }
        
        spreads = [m.spread for m in metrics]
        depths = [m.market_depth for m in metrics]
        volatilities = [m.volatility_24h for m in metrics]
        volumes = [m.volume_24h for m in metrics]
        
        return {
            'symbol': symbol,
            'avg_spread': statistics.mean(spreads),
            'min_spread': min(spreads),
            'max_spread': max(spreads),
            'avg_market_depth': statistics.mean(depths),
            'avg_volatility': statistics.mean(volatilities),
            'total_volume': sum(volumes),
            'data_points': len(metrics)
        }
    
    # Utility methods
    
    def _calculate_total_pnl(self, trades: List[TradeMetric]) -> float:
        """Calculate total P&L from trades (simplified - assumes paired trades)"""
        # This is a simplified calculation - real implementation would need
        # to match buy/sell pairs or track positions properly
        return sum(getattr(trade, 'profit_loss', 0) for trade in trades)
    
    def _calculate_win_rate(self, trades: List[TradeMetric]) -> float:
        """Calculate win rate from trades"""
        # This is simplified - would need proper P&L calculation
        # For now, assume positive execution_time/slippage indicates win
        winning_trades = sum(1 for trade in trades if trade.slippage_bps < 0)
        return (winning_trades / len(trades) * 100) if trades else 0.0
    
    def _group_volume_by_symbol(self, trades: List[TradeMetric]) -> Dict[str, float]:
        """Group trading volume by symbol"""
        volume_by_symbol = defaultdict(float)
        for trade in trades:
            volume_by_symbol[trade.symbol] += trade.notional_value
        return dict(volume_by_symbol)
    
    def cleanup_old_data(self, days: int = None):
        """Clean up old data based on retention policy"""
        retention_days = days or self.config.metrics_retention_days
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        cutoff_str = cutoff.isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            # Clean up old data
            for table in ['trades', 'performance_metrics', 'growth_metrics', 'liquidity_metrics']:
                conn.execute(f'DELETE FROM {table} WHERE timestamp < ?', (cutoff_str,))
            
            conn.commit()
    
    def get_database_stats(self) -> Dict[str, int]:
        """Get database statistics"""
        with sqlite3.connect(self.db_path) as conn:
            stats = {}
            for table in ['trades', 'performance_metrics', 'growth_metrics', 'liquidity_metrics']:
                cursor = conn.execute(f'SELECT COUNT(*) FROM {table}')
                stats[table] = cursor.fetchone()[0]
            return stats
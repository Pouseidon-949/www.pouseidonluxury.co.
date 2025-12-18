"""
Example integration script for Pouseidon Monitoring System
Demonstrates how to integrate monitoring into a trading bot
"""

import time
import random
from datetime import datetime
from poseidon_monitor import MonitoringSystem, MonitoringConfig


class ExampleTradingBot:
    """
    Example trading bot demonstrating monitoring integration
    """
    
    def __init__(self):
        # Initialize monitoring system
        config = MonitoringConfig()
        self.monitor = MonitoringSystem(config)
        self.monitor.start()
        
        # Bot state
        self.account_balance = 10000.0
        self.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT']
        self.is_running = False
        
    def start_trading(self):
        """Start the trading bot"""
        print("Starting Example Trading Bot with Monitoring...")
        self.is_running = True
        
        # Update initial balance
        self.monitor.update_account_balance(self.account_balance)
        
        # Main trading loop
        while self.is_running:
            try:
                # Start loop monitoring
                loop_id = f"trading_loop_{int(time.time())}"
                self.monitor.start_loop_execution(loop_id)
                
                # Simulate trading activities
                trades_in_loop = self.execute_trading_cycle()
                
                # End loop monitoring
                self.monitor.end_loop_execution(loop_id, success=True, 
                                              trades_executed=trades_in_loop)
                
                # Update account balance periodically
                if random.random() < 0.1:  # 10% chance per loop
                    self.update_account_balance()
                
                # Log performance metrics
                self.log_performance_metrics()
                
                # Sleep between cycles
                time.sleep(random.uniform(5, 15))  # Random delay between 5-15 seconds
                
            except KeyboardInterrupt:
                print("\\nStopping bot...")
                break
            except Exception as e:
                self.monitor.log_error(f"Trading loop error: {str(e)}", 
                                     error_type='trading_loop_error')
                time.sleep(10)  # Wait before retrying
        
        self.stop()
    
    def execute_trading_cycle(self) -> int:
        """Execute a cycle of trading activities"""
        trades_executed = 0
        
        # Simulate 0-3 trades per cycle
        num_trades = random.randint(0, 3)
        
        for i in range(num_trades):
            symbol = random.choice(self.symbols)
            side = random.choice(['buy', 'sell'])
            quantity = random.uniform(0.1, 2.0)
            price = random.uniform(30000, 50000) if 'BTC' in symbol else random.uniform(2000, 4000)
            
            # Simulate trade execution time
            execution_time = random.uniform(50, 500)  # 50-500ms
            slippage = random.uniform(-5, 5)  # -5 to +5 basis points
            fee = quantity * price * 0.001  # 0.1% fee
            
            # Log the trade
            self.monitor.log_trade(
                symbol=symbol,
                side=side,
                quantity=quantity,
                price=price,
                fee=fee,
                execution_time_ms=execution_time,
                slippage_bps=slippage,
                execution_id=f"trade_{int(time.time() * 1000)}"
            )
            
            trades_executed += 1
            
            # Simulate liquidity analysis
            self.analyze_liquidity(symbol)
        
        # Simulate some errors occasionally
        if random.random() < 0.05:  # 5% chance of error
            error_types = ['network_timeout', 'api_rate_limit', 'insufficient_funds']
            error_type = random.choice(error_types)
            self.monitor.log_error(
                f"Simulated error: {error_type}",
                error_type=error_type
            )
        
        return trades_executed
    
    def analyze_liquidity(self, symbol: str):
        """Analyze and log liquidity for a symbol"""
        # Simulate liquidity metrics
        spread = random.uniform(0.01, 0.1)
        bid_size = random.uniform(10, 1000)
        ask_size = random.uniform(10, 1000)
        market_depth = random.uniform(1000, 10000)
        volatility_24h = random.uniform(0.01, 0.05)
        volume_24h = random.uniform(100000, 1000000)
        
        self.monitor.log_liquidity_analysis(
            symbol=symbol,
            spread=spread,
            bid_size=bid_size,
            ask_size=ask_size,
            market_depth=market_depth,
            volatility_24h=volatility_24h,
            volume_24h=volume_24h
        )
    
    def update_account_balance(self):
        """Update account balance (simulate P&L)"""
        # Simulate small profit/loss
        pnl = random.uniform(-100, 200)  # -$100 to +$200
        self.account_balance += pnl
        
        # Log the balance update
        self.monitor.update_account_balance(self.account_balance)
        
        # Record P&L as performance metric
        self.monitor.log_performance_metric(
            'account_balance',
            self.account_balance,
            'USD'
        )
        
        self.monitor.log_performance_metric(
            'pnl_change',
            pnl,
            'USD'
        )
    
    def log_performance_metrics(self):
        """Log various performance metrics"""
        # Simulate system performance metrics
        self.monitor.log_performance_metric(
            'api_response_time',
            random.uniform(100, 1000),  # ms
            'milliseconds'
        )
        
        self.monitor.log_performance_metric(
            'success_rate',
            random.uniform(0.95, 0.99),  # 95-99%
            'percentage'
        )
        
        self.monitor.log_performance_metric(
            'active_positions',
            random.randint(0, 5),
            'count'
        )
    
    def print_dashboard(self):
        """Print dashboard summary"""
        try:
            dashboard = self.monitor.get_dashboard_summary()
            print(f"\\n=== Dashboard Summary ===")
            print(f"System Status: {dashboard.system_status}")
            print(f"Uptime: {dashboard.uptime_seconds}s")
            print(f"Total Trades 24h: {dashboard.total_trades_24h}")
            print(f"Total Volume 24h: ${dashboard.total_volume_24h:,.2f}")
            print(f"Total P&L 24h: ${dashboard.total_pnl_24h:,.2f}")
            print(f"Growth 24h: {dashboard.growth_24h:,.2f}")
            print(f"Errors 24h: {dashboard.error_count_24h}")
            print(f"Memory Usage: {dashboard.memory_usage_mb:.1f} MB")
            
        except Exception as e:
            print(f"Error getting dashboard: {e}")
    
    def stop(self):
        """Stop the trading bot"""
        self.is_running = False
        self.monitor.stop()
        print("Bot stopped and monitoring system shut down.")


def main():
    """Main function to run the example"""
    print("Pouseidon Monitoring System - Example Integration")
    print("=" * 50)
    
    # Create and start the example bot
    bot = ExampleTradingBot()
    
    try:
        # Add callback for real-time monitoring
        def on_trade(trade):
            print(f"📈 Trade executed: {trade.symbol} {trade.side} {trade.quantity}")
        
        def on_error(error_data):
            print(f"⚠️  Error logged: {error_data['error_type']}")
        
        bot.monitor.add_trade_callback(on_trade)
        bot.monitor.add_error_callback(on_error)
        
        # Print initial dashboard
        bot.print_dashboard()
        
        # Start trading (will run for demonstration)
        # In real usage, this would run continuously
        import threading
        
        def run_with_dashboard():
            """Run bot with periodic dashboard updates"""
            bot.start_trading()
        
        # Start bot in background thread
        bot_thread = threading.Thread(target=run_with_dashboard, daemon=True)
        bot_thread.start()
        
        # Print dashboard every 30 seconds
        for i in range(6):  # 6 iterations = 3 minutes
            time.sleep(30)
            bot.print_dashboard()
        
        print("\\nDemo completed. Stopping bot...")
        
    except KeyboardInterrupt:
        print("\\nDemo interrupted by user.")
    except Exception as e:
        print(f"Demo error: {e}")
    finally:
        bot.stop()


if __name__ == "__main__":
    main()
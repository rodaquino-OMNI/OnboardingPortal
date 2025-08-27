#!/usr/bin/env python3
"""
Advanced Load Testing Suite for Onboarding Portal
Performs comprehensive API load testing with detailed metrics
"""

import asyncio
import aiohttp
import json
import time
import statistics
import sys
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import argparse
from dataclasses import dataclass
from typing import List, Dict, Any
import csv
import os

@dataclass
class TestResult:
    endpoint: str
    method: str
    status_code: int
    response_time: float
    timestamp: float
    response_size: int
    error: str = None

@dataclass
class LoadTestConfig:
    base_url: str = "http://127.0.0.1:8000"
    max_concurrent: int = 100
    ramp_up_time: int = 30
    test_duration: int = 300
    endpoints: List[Dict] = None

class AdvancedLoadTester:
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results: List[TestResult] = []
        self.start_time = None
        self.session = None
        
        # Default test endpoints
        if not config.endpoints:
            self.config.endpoints = [
                {
                    "name": "health_check",
                    "path": "/api/health",
                    "method": "GET",
                    "weight": 30,
                    "headers": {"Accept": "application/json"}
                },
                {
                    "name": "auth_login", 
                    "path": "/api/auth/login",
                    "method": "POST",
                    "weight": 20,
                    "headers": {"Content-Type": "application/json"},
                    "data": {
                        "email": "test@example.com",
                        "password": "password123",
                        "device_name": "load_test"
                    }
                },
                {
                    "name": "questionnaire_templates",
                    "path": "/api/health-questionnaires/templates", 
                    "method": "GET",
                    "weight": 25,
                    "headers": {
                        "Accept": "application/json",
                        "Authorization": "Bearer test_token"
                    }
                },
                {
                    "name": "gamification_progress",
                    "path": "/api/gamification/progress",
                    "method": "GET", 
                    "weight": 15,
                    "headers": {"Accept": "application/json"}
                },
                {
                    "name": "user_info",
                    "path": "/api/auth/user",
                    "method": "GET",
                    "weight": 10,
                    "headers": {
                        "Accept": "application/json",
                        "Authorization": "Bearer test_token"
                    }
                }
            ]

    async def make_request(self, endpoint_config: Dict) -> TestResult:
        """Make a single HTTP request and record metrics"""
        start_time = time.time()
        url = f"{self.config.base_url}{endpoint_config['path']}"
        
        try:
            async with self.session.request(
                method=endpoint_config['method'],
                url=url,
                headers=endpoint_config.get('headers', {}),
                json=endpoint_config.get('data'),
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                response_body = await response.text()
                response_time = time.time() - start_time
                
                return TestResult(
                    endpoint=endpoint_config['name'],
                    method=endpoint_config['method'],
                    status_code=response.status,
                    response_time=response_time,
                    timestamp=start_time,
                    response_size=len(response_body.encode('utf-8')),
                    error=None
                )
                
        except Exception as e:
            response_time = time.time() - start_time
            return TestResult(
                endpoint=endpoint_config['name'],
                method=endpoint_config['method'], 
                status_code=0,
                response_time=response_time,
                timestamp=start_time,
                response_size=0,
                error=str(e)
            )

    def select_endpoint(self) -> Dict:
        """Select endpoint based on weights"""
        import random
        
        total_weight = sum(ep['weight'] for ep in self.config.endpoints)
        r = random.uniform(0, total_weight)
        
        current_weight = 0
        for endpoint in self.config.endpoints:
            current_weight += endpoint['weight']
            if r <= current_weight:
                return endpoint
        
        return self.config.endpoints[0]  # Fallback

    async def worker(self, worker_id: int):
        """Worker coroutine that makes requests"""
        requests_made = 0
        
        while time.time() - self.start_time < self.config.test_duration:
            endpoint_config = self.select_endpoint()
            result = await self.make_request(endpoint_config)
            self.results.append(result)
            requests_made += 1
            
            # Small delay to prevent overwhelming
            await asyncio.sleep(0.1)
        
        print(f"Worker {worker_id} completed {requests_made} requests")

    async def ramp_up_workers(self):
        """Gradually ramp up worker load"""
        workers = []
        ramp_interval = self.config.ramp_up_time / self.config.max_concurrent
        
        for i in range(self.config.max_concurrent):
            worker = asyncio.create_task(self.worker(i))
            workers.append(worker)
            
            if i < self.config.max_concurrent - 1:
                await asyncio.sleep(ramp_interval)
                print(f"Ramped up to {i + 1} concurrent workers")
        
        # Wait for all workers to complete
        await asyncio.gather(*workers)

    def analyze_results(self) -> Dict[str, Any]:
        """Analyze test results and generate metrics"""
        if not self.results:
            return {"error": "No results to analyze"}
        
        # Group results by endpoint
        endpoint_results = {}
        for result in self.results:
            if result.endpoint not in endpoint_results:
                endpoint_results[result.endpoint] = []
            endpoint_results[result.endpoint].append(result)
        
        analysis = {
            "test_summary": {
                "total_requests": len(self.results),
                "test_duration": self.config.test_duration,
                "max_concurrent": self.config.max_concurrent,
                "average_rps": len(self.results) / self.config.test_duration
            },
            "endpoints": {}
        }
        
        # Analyze each endpoint
        for endpoint_name, results in endpoint_results.items():
            response_times = [r.response_time for r in results if r.status_code > 0]
            status_codes = [r.status_code for r in results]
            errors = [r for r in results if r.error or r.status_code >= 400]
            
            if response_times:
                analysis["endpoints"][endpoint_name] = {
                    "total_requests": len(results),
                    "successful_requests": len([r for r in results if 200 <= r.status_code < 400]),
                    "error_rate": len(errors) / len(results) * 100,
                    "response_times": {
                        "min": min(response_times),
                        "max": max(response_times), 
                        "mean": statistics.mean(response_times),
                        "median": statistics.median(response_times),
                        "p95": sorted(response_times)[int(len(response_times) * 0.95)] if len(response_times) > 1 else response_times[0],
                        "p99": sorted(response_times)[int(len(response_times) * 0.99)] if len(response_times) > 1 else response_times[0]
                    },
                    "throughput": len(results) / self.config.test_duration,
                    "status_code_distribution": {str(code): status_codes.count(code) for code in set(status_codes)},
                    "errors": len(errors)
                }
        
        return analysis

    def save_results(self, analysis: Dict, output_dir: str):
        """Save detailed results to files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        os.makedirs(output_dir, exist_ok=True)
        
        # Save analysis JSON
        with open(f"{output_dir}/load_test_analysis_{timestamp}.json", 'w') as f:
            json.dump(analysis, f, indent=2, default=str)
        
        # Save raw results CSV
        with open(f"{output_dir}/load_test_results_{timestamp}.csv", 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['timestamp', 'endpoint', 'method', 'status_code', 
                           'response_time', 'response_size', 'error'])
            
            for result in self.results:
                writer.writerow([
                    result.timestamp, result.endpoint, result.method,
                    result.status_code, result.response_time, result.response_size,
                    result.error or ''
                ])
        
        # Generate readable report
        self.generate_report(analysis, f"{output_dir}/load_test_report_{timestamp}.txt")
        
        print(f"Results saved to {output_dir}/")

    def generate_report(self, analysis: Dict, filename: str):
        """Generate human-readable report"""
        with open(filename, 'w') as f:
            f.write("=== ONBOARDING PORTAL LOAD TEST REPORT ===\n")
            f.write(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Base URL: {self.config.base_url}\n")
            f.write(f"Duration: {self.config.test_duration}s\n")
            f.write(f"Max Concurrent: {self.config.max_concurrent}\n")
            f.write(f"Total Requests: {analysis['test_summary']['total_requests']}\n")
            f.write(f"Average RPS: {analysis['test_summary']['average_rps']:.2f}\n\n")
            
            # Endpoint details
            for endpoint_name, metrics in analysis["endpoints"].items():
                f.write(f"=== {endpoint_name.upper()} ===\n")
                f.write(f"Total Requests: {metrics['total_requests']}\n")
                f.write(f"Successful: {metrics['successful_requests']}\n")
                f.write(f"Error Rate: {metrics['error_rate']:.2f}%\n")
                f.write(f"Throughput: {metrics['throughput']:.2f} req/s\n")
                
                rt = metrics['response_times']
                f.write(f"Response Times (s):\n")
                f.write(f"  Min: {rt['min']:.4f}\n")
                f.write(f"  Mean: {rt['mean']:.4f}\n") 
                f.write(f"  Median: {rt['median']:.4f}\n")
                f.write(f"  95th percentile: {rt['p95']:.4f}\n")
                f.write(f"  99th percentile: {rt['p99']:.4f}\n")
                f.write(f"  Max: {rt['max']:.4f}\n")
                
                f.write(f"Status Codes: {metrics['status_code_distribution']}\n")
                f.write(f"Errors: {metrics['errors']}\n\n")

    async def run_test(self):
        """Execute the complete load test"""
        print("Starting Advanced Load Test...")
        print(f"Target: {self.config.base_url}")
        print(f"Duration: {self.config.test_duration}s")
        print(f"Max Concurrent: {self.config.max_concurrent}")
        
        # Create HTTP session
        connector = aiohttp.TCPConnector(limit=self.config.max_concurrent * 2)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(connector=connector, timeout=timeout)
        
        try:
            self.start_time = time.time()
            
            # Run the test
            await self.ramp_up_workers()
            
            print(f"Test completed. {len(self.results)} total requests made.")
            
            # Analyze and save results
            analysis = self.analyze_results()
            output_dir = "/Users/rodrigo/claude-projects/OnboardingPortal/load_test_results"
            self.save_results(analysis, output_dir)
            
            return analysis
            
        finally:
            await self.session.close()

def main():
    parser = argparse.ArgumentParser(description='Advanced Load Testing Suite')
    parser.add_argument('--url', default='http://127.0.0.1:8000', help='Base URL')
    parser.add_argument('--concurrent', type=int, default=50, help='Max concurrent users')
    parser.add_argument('--duration', type=int, default=120, help='Test duration in seconds')
    parser.add_argument('--ramp-up', type=int, default=20, help='Ramp up time in seconds')
    
    args = parser.parse_args()
    
    config = LoadTestConfig(
        base_url=args.url,
        max_concurrent=args.concurrent,
        test_duration=args.duration,
        ramp_up_time=args.ramp_up
    )
    
    tester = AdvancedLoadTester(config)
    
    try:
        # Test server connectivity first
        import requests
        response = requests.get(f"{config.base_url}/api/health", timeout=10)
        print(f"Server connectivity test: {response.status_code}")
    except Exception as e:
        print(f"Cannot connect to server: {e}")
        sys.exit(1)
    
    # Run the load test
    asyncio.run(tester.run_test())

if __name__ == "__main__":
    main()
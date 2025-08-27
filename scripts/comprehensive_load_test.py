#!/usr/bin/env python3
"""
Comprehensive Load Testing Suite for Onboarding Portal
Specifically tests critical endpoints under various load conditions
"""

import asyncio
import aiohttp
import json
import time
import statistics
import sys
from datetime import datetime
import argparse
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
import csv
import os
import random
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class TestResult:
    endpoint: str
    method: str
    status_code: int
    response_time: float
    timestamp: float
    response_size: int
    concurrent_users: int
    error: Optional[str] = None

@dataclass
class EndpointMetrics:
    name: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    p95_response_time: float
    p99_response_time: float
    throughput: float
    error_rate: float
    status_codes: Dict[int, int]

class ComprehensiveLoadTester:
    def __init__(self, base_url: str = "http://127.0.0.1:8001"):
        self.base_url = base_url
        self.results: List[TestResult] = []
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Critical endpoints for onboarding portal
        self.endpoints = {
            "health_check": {
                "path": "/api/health",
                "method": "GET",
                "headers": {"Accept": "application/json"},
                "weight": 25
            },
            "auth_login": {
                "path": "/api/auth/login", 
                "method": "POST",
                "headers": {"Content-Type": "application/json", "Accept": "application/json"},
                "data": {
                    "email": "test@example.com",
                    "password": "password123",
                    "device_name": "load_test"
                },
                "weight": 20
            },
            "auth_check_email": {
                "path": "/api/auth/check-email",
                "method": "POST", 
                "headers": {"Content-Type": "application/json", "Accept": "application/json"},
                "data": {"email": "test@example.com"},
                "weight": 15
            },
            "questionnaire_templates": {
                "path": "/api/health-questionnaires/templates",
                "method": "GET",
                "headers": {"Accept": "application/json", "Authorization": "Bearer test_token"},
                "weight": 20
            },
            "gamification_progress": {
                "path": "/api/gamification/progress", 
                "method": "GET",
                "headers": {"Accept": "application/json"},
                "weight": 15
            },
            "api_info": {
                "path": "/api/info",
                "method": "GET",
                "headers": {"Accept": "application/json"},
                "weight": 5
            }
        }

    async def make_request(self, endpoint_name: str, endpoint_config: Dict, concurrent_users: int) -> TestResult:
        """Make a single HTTP request and record metrics"""
        start_time = time.time()
        url = f"{self.base_url}{endpoint_config['path']}"
        
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            async with self.session.request(
                method=endpoint_config['method'],
                url=url,
                headers=endpoint_config.get('headers', {}),
                json=endpoint_config.get('data'),
                timeout=timeout
            ) as response:
                response_body = await response.text()
                response_time = time.time() - start_time
                
                return TestResult(
                    endpoint=endpoint_name,
                    method=endpoint_config['method'],
                    status_code=response.status,
                    response_time=response_time,
                    timestamp=start_time,
                    response_size=len(response_body.encode('utf-8')),
                    concurrent_users=concurrent_users,
                    error=None
                )
                
        except Exception as e:
            response_time = time.time() - start_time
            return TestResult(
                endpoint=endpoint_name,
                method=endpoint_config['method'],
                status_code=0,
                response_time=response_time,
                timestamp=start_time,
                response_size=0,
                concurrent_users=concurrent_users,
                error=str(e)
            )

    def select_endpoint(self) -> tuple:
        """Select endpoint based on weights"""
        total_weight = sum(ep['weight'] for ep in self.endpoints.values())
        r = random.uniform(0, total_weight)
        
        current_weight = 0
        for name, config in self.endpoints.items():
            current_weight += config['weight']
            if r <= current_weight:
                return name, config
        
        # Fallback
        first_endpoint = list(self.endpoints.items())[0]
        return first_endpoint[0], first_endpoint[1]

    async def load_test_level(self, concurrent_users: int, duration: int = 60):
        """Run load test for specific concurrent user level"""
        logger.info(f"Starting load test with {concurrent_users} concurrent users for {duration}s")
        
        start_time = time.time()
        tasks = []
        
        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(concurrent_users)
        
        async def worker():
            async with semaphore:
                while time.time() - start_time < duration:
                    endpoint_name, endpoint_config = self.select_endpoint()
                    result = await self.make_request(endpoint_name, endpoint_config, concurrent_users)
                    self.results.append(result)
                    
                    # Small delay to prevent overwhelming the server
                    await asyncio.sleep(0.1 + random.uniform(0, 0.2))
        
        # Start worker tasks
        for _ in range(concurrent_users):
            tasks.append(asyncio.create_task(worker()))
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks)
        
        logger.info(f"Completed load test level with {concurrent_users} users")

    def analyze_results_by_level(self, concurrent_users: int) -> Dict[str, Any]:
        """Analyze results for specific concurrent user level"""
        level_results = [r for r in self.results if r.concurrent_users == concurrent_users]
        
        if not level_results:
            return {"error": f"No results found for {concurrent_users} concurrent users"}
        
        # Group by endpoint
        endpoint_results = {}
        for result in level_results:
            if result.endpoint not in endpoint_results:
                endpoint_results[result.endpoint] = []
            endpoint_results[result.endpoint].append(result)
        
        analysis = {
            "concurrent_users": concurrent_users,
            "total_requests": len(level_results),
            "duration": max(r.timestamp for r in level_results) - min(r.timestamp for r in level_results),
            "endpoints": {}
        }
        
        # Analyze each endpoint
        for endpoint_name, results in endpoint_results.items():
            response_times = [r.response_time for r in results if r.status_code > 0]
            status_codes = [r.status_code for r in results]
            successful = [r for r in results if 200 <= r.status_code < 400]
            errors = [r for r in results if r.error or r.status_code >= 400]
            
            if response_times:
                sorted_times = sorted(response_times)
                analysis["endpoints"][endpoint_name] = {
                    "total_requests": len(results),
                    "successful_requests": len(successful),
                    "failed_requests": len(errors),
                    "success_rate": len(successful) / len(results) * 100,
                    "error_rate": len(errors) / len(results) * 100,
                    "response_times": {
                        "min": min(response_times),
                        "max": max(response_times),
                        "mean": statistics.mean(response_times),
                        "median": statistics.median(response_times),
                        "p95": sorted_times[int(len(sorted_times) * 0.95)] if len(sorted_times) > 1 else sorted_times[0],
                        "p99": sorted_times[int(len(sorted_times) * 0.99)] if len(sorted_times) > 1 else sorted_times[0]
                    },
                    "throughput": len(results) / analysis["duration"] if analysis["duration"] > 0 else 0,
                    "status_codes": dict(sorted([(code, status_codes.count(code)) for code in set(status_codes)])),
                    "errors": [{"error": r.error, "status": r.status_code} for r in errors[:5]]  # Sample errors
                }
        
        return analysis

    async def run_comprehensive_test(self, max_concurrent: int = 100, step: int = 10, duration_per_level: int = 60):
        """Run comprehensive load test with increasing concurrent users"""
        logger.info(f"Starting comprehensive load test up to {max_concurrent} concurrent users")
        
        # Initialize HTTP session
        connector = aiohttp.TCPConnector(limit=max_concurrent * 2, limit_per_host=max_concurrent)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(connector=connector, timeout=timeout)
        
        try:
            # Test connectivity first
            logger.info("Testing server connectivity...")
            test_result = await self.make_request("health_check", self.endpoints["health_check"], 1)
            if test_result.status_code == 0:
                logger.error(f"Cannot connect to server: {test_result.error}")
                return None
            
            logger.info(f"Server connectivity OK (HTTP {test_result.status_code})")
            
            # Run tests for different concurrent user levels
            levels = list(range(1, max_concurrent + 1, step))
            levels.extend([max_concurrent])  # Ensure we test max level
            levels = sorted(set(levels))  # Remove duplicates and sort
            
            all_analysis = {}
            
            for concurrent_users in levels:
                logger.info(f"=== Testing with {concurrent_users} concurrent users ===")
                
                # Clear results for this level
                initial_count = len(self.results)
                
                await self.load_test_level(concurrent_users, duration_per_level)
                
                # Analyze results for this level
                level_analysis = self.analyze_results_by_level(concurrent_users)
                all_analysis[concurrent_users] = level_analysis
                
                # Log summary
                if "endpoints" in level_analysis:
                    total_requests = level_analysis["total_requests"]
                    avg_response_time = statistics.mean([
                        ep["response_times"]["mean"] 
                        for ep in level_analysis["endpoints"].values() 
                        if "response_times" in ep
                    ])
                    logger.info(f"Level {concurrent_users}: {total_requests} requests, avg {avg_response_time:.3f}s")
                
                # Brief pause between levels
                await asyncio.sleep(2)
            
            return all_analysis
            
        finally:
            await self.session.close()

    def save_comprehensive_results(self, analysis: Dict, output_dir: str):
        """Save comprehensive test results"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        os.makedirs(output_dir, exist_ok=True)
        
        # Save complete analysis
        with open(f"{output_dir}/comprehensive_analysis_{timestamp}.json", 'w') as f:
            json.dump(analysis, f, indent=2, default=str)
        
        # Save raw results
        with open(f"{output_dir}/raw_results_{timestamp}.csv", 'w', newline='') as f:
            if self.results:
                writer = csv.DictWriter(f, fieldnames=asdict(self.results[0]).keys())
                writer.writeheader()
                for result in self.results:
                    writer.writerow(asdict(result))
        
        # Generate summary report
        self.generate_comprehensive_report(analysis, f"{output_dir}/load_test_summary_{timestamp}.txt")
        
        logger.info(f"Comprehensive results saved to {output_dir}/")

    def generate_comprehensive_report(self, analysis: Dict, filename: str):
        """Generate comprehensive human-readable report"""
        with open(filename, 'w') as f:
            f.write("=== ONBOARDING PORTAL COMPREHENSIVE LOAD TEST REPORT ===\n")
            f.write(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Base URL: {self.base_url}\n")
            f.write(f"Total Test Results: {len(self.results)}\n\n")
            
            # Summary table header
            f.write("LOAD LEVEL SUMMARY:\n")
            f.write("Concurrent | Total Req | Avg Response | P95 Response | Error Rate | Top Endpoint\n")
            f.write("-" * 80 + "\n")
            
            for level, level_data in sorted(analysis.items()):
                if isinstance(level, int) and "endpoints" in level_data:
                    total_reqs = level_data["total_requests"]
                    
                    # Calculate overall metrics
                    all_response_times = []
                    all_error_rates = []
                    endpoint_throughputs = []
                    
                    for ep_name, ep_data in level_data["endpoints"].items():
                        if "response_times" in ep_data:
                            all_response_times.append(ep_data["response_times"]["mean"])
                            all_error_rates.append(ep_data["error_rate"])
                            endpoint_throughputs.append((ep_name, ep_data["throughput"]))
                    
                    avg_response = statistics.mean(all_response_times) if all_response_times else 0
                    avg_p95 = statistics.mean([ep["response_times"]["p95"] for ep in level_data["endpoints"].values() if "response_times" in ep])
                    avg_error_rate = statistics.mean(all_error_rates) if all_error_rates else 0
                    top_endpoint = max(endpoint_throughputs, key=lambda x: x[1])[0] if endpoint_throughputs else "N/A"
                    
                    f.write(f"{level:10d} | {total_reqs:9d} | {avg_response:8.3f}s | {avg_p95:8.3f}s | {avg_error_rate:7.1f}% | {top_endpoint}\n")
            
            f.write("\nDETAILED ENDPOINT ANALYSIS:\n")
            f.write("=" * 80 + "\n")
            
            # Detailed analysis by load level
            for level, level_data in sorted(analysis.items()):
                if isinstance(level, int) and "endpoints" in level_data:
                    f.write(f"\n=== {level} CONCURRENT USERS ===\n")
                    f.write(f"Duration: {level_data.get('duration', 0):.1f}s\n")
                    f.write(f"Total Requests: {level_data['total_requests']}\n\n")
                    
                    for endpoint_name, metrics in level_data["endpoints"].items():
                        f.write(f"--- {endpoint_name.upper()} ---\n")
                        f.write(f"Requests: {metrics['total_requests']}\n")
                        f.write(f"Success Rate: {metrics['success_rate']:.1f}%\n")
                        f.write(f"Throughput: {metrics['throughput']:.2f} req/s\n")
                        
                        if "response_times" in metrics:
                            rt = metrics["response_times"]
                            f.write(f"Response Times: min={rt['min']:.3f}s, mean={rt['mean']:.3f}s, ")
                            f.write(f"p95={rt['p95']:.3f}s, max={rt['max']:.3f}s\n")
                        
                        f.write(f"Status Codes: {metrics['status_codes']}\n")
                        if metrics['errors']:
                            f.write(f"Sample Errors: {metrics['errors'][:2]}\n")
                        f.write("\n")

async def main():
    parser = argparse.ArgumentParser(description='Comprehensive Load Testing Suite')
    parser.add_argument('--url', default='http://127.0.0.1:8001', help='Base URL')
    parser.add_argument('--max-concurrent', type=int, default=50, help='Maximum concurrent users')
    parser.add_argument('--step', type=int, default=10, help='Step size for concurrent users')
    parser.add_argument('--duration', type=int, default=60, help='Duration per load level in seconds')
    
    args = parser.parse_args()
    
    tester = ComprehensiveLoadTester(args.url)
    
    # Run comprehensive test
    analysis = await tester.run_comprehensive_test(
        max_concurrent=args.max_concurrent,
        step=args.step, 
        duration_per_level=args.duration
    )
    
    if analysis:
        output_dir = "/Users/rodrigo/claude-projects/OnboardingPortal/load_test_results"
        tester.save_comprehensive_results(analysis, output_dir)
        
        # Print summary
        print("\n=== LOAD TEST SUMMARY ===")
        print(f"Total requests made: {len(tester.results)}")
        print(f"Concurrent user levels tested: {len(analysis)}")
        print(f"Results saved to: {output_dir}")
    else:
        print("Load test failed - check server connectivity")

if __name__ == "__main__":
    asyncio.run(main())
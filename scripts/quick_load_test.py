#!/usr/bin/env python3
"""
Quick Load Test for Onboarding Portal Critical Endpoints
"""

import asyncio
import aiohttp
import time
import json
from datetime import datetime

async def test_endpoint(session, endpoint, method="GET", data=None, headers=None):
    """Test a single endpoint and return metrics"""
    if headers is None:
        headers = {"Accept": "application/json"}
    
    start_time = time.time()
    try:
        async with session.request(method, endpoint, json=data, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as response:
            content = await response.text()
            response_time = time.time() - start_time
            return {
                "endpoint": endpoint,
                "method": method,
                "status": response.status,
                "response_time": response_time,
                "content_length": len(content),
                "success": 200 <= response.status < 400
            }
    except Exception as e:
        return {
            "endpoint": endpoint,
            "method": method,
            "status": 0,
            "response_time": time.time() - start_time,
            "content_length": 0,
            "success": False,
            "error": str(e)
        }

async def concurrent_load_test(base_url, concurrent_users, duration=30):
    """Run concurrent load test"""
    print(f"Running load test with {concurrent_users} concurrent users for {duration}s")
    
    endpoints_to_test = [
        {"url": f"{base_url}/api/health", "method": "GET", "weight": 30},
        {"url": f"{base_url}/api/gamification/progress", "method": "GET", "weight": 25},
        {"url": f"{base_url}/api/info", "method": "GET", "weight": 20},
        {"url": f"{base_url}/api/auth/check-email", "method": "POST", "data": {"email": "test@example.com"}, "weight": 15},
        {"url": f"{base_url}/api/gamification/badges", "method": "GET", "weight": 10}
    ]
    
    results = []
    start_time = time.time()
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        
        async def worker():
            import random
            requests_made = 0
            while time.time() - start_time < duration:
                # Select endpoint based on weight
                total_weight = sum(ep['weight'] for ep in endpoints_to_test)
                r = random.uniform(0, total_weight)
                current_weight = 0
                selected_endpoint = endpoints_to_test[0]
                
                for ep in endpoints_to_test:
                    current_weight += ep['weight']
                    if r <= current_weight:
                        selected_endpoint = ep
                        break
                
                result = await test_endpoint(
                    session, 
                    selected_endpoint['url'], 
                    selected_endpoint['method'],
                    selected_endpoint.get('data')
                )
                results.append(result)
                requests_made += 1
                
                await asyncio.sleep(0.1)  # Small delay
            
            print(f"Worker completed {requests_made} requests")
        
        # Start concurrent workers
        for _ in range(concurrent_users):
            tasks.append(asyncio.create_task(worker()))
        
        await asyncio.gather(*tasks)
    
    return results

def analyze_results(results):
    """Analyze load test results"""
    if not results:
        return {"error": "No results to analyze"}
    
    total_requests = len(results)
    successful_requests = len([r for r in results if r['success']])
    failed_requests = total_requests - successful_requests
    
    response_times = [r['response_time'] for r in results if r['success']]
    
    if response_times:
        avg_response_time = sum(response_times) / len(response_times)
        min_response_time = min(response_times)
        max_response_time = max(response_times)
        sorted_times = sorted(response_times)
        p95_time = sorted_times[int(len(sorted_times) * 0.95)] if len(sorted_times) > 1 else sorted_times[0]
        p99_time = sorted_times[int(len(sorted_times) * 0.99)] if len(sorted_times) > 1 else sorted_times[0]
    else:
        avg_response_time = min_response_time = max_response_time = p95_time = p99_time = 0
    
    # Group by endpoint
    endpoint_stats = {}
    for result in results:
        endpoint = result['endpoint']
        if endpoint not in endpoint_stats:
            endpoint_stats[endpoint] = {'total': 0, 'successful': 0, 'response_times': []}
        
        endpoint_stats[endpoint]['total'] += 1
        if result['success']:
            endpoint_stats[endpoint]['successful'] += 1
            endpoint_stats[endpoint]['response_times'].append(result['response_time'])
    
    # Calculate per-endpoint metrics
    for endpoint, stats in endpoint_stats.items():
        if stats['response_times']:
            stats['avg_response_time'] = sum(stats['response_times']) / len(stats['response_times'])
            stats['success_rate'] = (stats['successful'] / stats['total']) * 100
        else:
            stats['avg_response_time'] = 0
            stats['success_rate'] = 0
    
    analysis = {
        "total_requests": total_requests,
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "success_rate": (successful_requests / total_requests) * 100 if total_requests > 0 else 0,
        "response_time_stats": {
            "average": avg_response_time,
            "minimum": min_response_time,
            "maximum": max_response_time,
            "p95": p95_time,
            "p99": p99_time
        },
        "endpoint_breakdown": endpoint_stats
    }
    
    return analysis

async def main():
    base_url = "http://127.0.0.1:8002"
    
    print("=== ONBOARDING PORTAL QUICK LOAD TEST ===")
    print(f"Target: {base_url}")
    print(f"Timestamp: {datetime.now()}")
    
    # Test different load levels
    load_levels = [1, 5, 10, 20]
    all_results = {}
    
    for concurrent_users in load_levels:
        print(f"\n--- Testing {concurrent_users} concurrent users ---")
        results = await concurrent_load_test(base_url, concurrent_users, duration=20)  # 20 seconds per level
        analysis = analyze_results(results)
        all_results[concurrent_users] = analysis
        
        print(f"Total requests: {analysis['total_requests']}")
        print(f"Success rate: {analysis['success_rate']:.1f}%")
        print(f"Average response time: {analysis['response_time_stats']['average']:.3f}s")
        print(f"P95 response time: {analysis['response_time_stats']['p95']:.3f}s")
        
        # Brief pause between tests
        await asyncio.sleep(2)
    
    # Save comprehensive results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"/Users/rodrigo/claude-projects/OnboardingPortal/load_test_results/quick_test_{timestamp}.json"
    
    import os
    os.makedirs(os.path.dirname(results_file), exist_ok=True)
    
    with open(results_file, 'w') as f:
        json.dump(all_results, f, indent=2, default=str)
    
    print(f"\nResults saved to: {results_file}")
    
    # Generate summary report
    report_file = f"/Users/rodrigo/claude-projects/OnboardingPortal/load_test_results/quick_summary_{timestamp}.txt"
    with open(report_file, 'w') as f:
        f.write("=== ONBOARDING PORTAL QUICK LOAD TEST SUMMARY ===\n")
        f.write(f"Test Date: {datetime.now()}\n")
        f.write(f"Base URL: {base_url}\n\n")
        
        f.write("LOAD LEVEL RESULTS:\n")
        f.write("Users | Requests | Success% | Avg Time | P95 Time | Top Performing Endpoint\n")
        f.write("-" * 80 + "\n")
        
        for users, data in all_results.items():
            # Find best performing endpoint
            best_endpoint = ""
            best_success_rate = 0
            for endpoint, stats in data['endpoint_breakdown'].items():
                if stats['success_rate'] > best_success_rate:
                    best_success_rate = stats['success_rate']
                    best_endpoint = endpoint.split('/')[-1]  # Just the endpoint name
            
            f.write(f"{users:5d} | {data['total_requests']:8d} | {data['success_rate']:7.1f} | "
                   f"{data['response_time_stats']['average']:8.3f} | {data['response_time_stats']['p95']:8.3f} | "
                   f"{best_endpoint}\n")
        
        f.write("\nDETAILED ENDPOINT ANALYSIS:\n")
        for users, data in all_results.items():
            f.write(f"\n=== {users} CONCURRENT USERS ===\n")
            for endpoint, stats in data['endpoint_breakdown'].items():
                endpoint_name = endpoint.split('/')[-1]
                f.write(f"{endpoint_name}: {stats['total']} req, {stats['success_rate']:.1f}% success, "
                       f"{stats['avg_response_time']:.3f}s avg\n")
    
    print(f"Summary report saved to: {report_file}")
    print("\n=== LOAD TEST COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(main())
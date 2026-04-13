import requests
import sys
from datetime import datetime

class SoletraAPITester:
    def __init__(self, base_url="https://soletra-solver.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.api_url = f"{base_url}/api"

    def run_test(self, name, method, endpoint, expected_status, data=None, expected_keys=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            print(f"Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                
                # Check response structure if expected_keys provided
                if expected_keys and response.status_code == 200:
                    try:
                        json_response = response.json()
                        for key in expected_keys:
                            if key not in json_response:
                                print(f"⚠️  Warning: Expected key '{key}' not found in response")
                            else:
                                print(f"✓ Found expected key: {key}")
                        return True, json_response
                    except Exception as e:
                        print(f"⚠️  Warning: Could not parse JSON response: {e}")
                        return True, {}
                        
                return True, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_response = response.json()
                    print(f"Error response: {error_response}")
                except:
                    print(f"Error response (text): {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (30s)")
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200,
            expected_keys=["message"]
        )

    def test_solve_valid_request(self):
        """Test solve endpoint with valid data - B center + A,U,D,T,O,R outer"""
        success, response = self.run_test(
            "Solve with B center + A,U,D,T,O,R outer",
            "POST",
            "solve",
            200,
            data={
                "center_letter": "B",
                "outer_letters": ["A", "U", "D", "T", "O", "R"]
            },
            expected_keys=["total", "pangram_count", "groups"]
        )
        
        if success and response:
            print(f"📊 Results: {response.get('total', 0)} words, {response.get('pangram_count', 0)} pangrams")
            groups = response.get('groups', {})
            for length, words in groups.items():
                print(f"  {length} letters: {len(words)} words")
                # Show first few words as examples
                if words:
                    examples = [w['word'] for w in words[:3]]
                    print(f"    Examples: {', '.join(examples)}")
        
        return success, response

    def test_solve_missing_center(self):
        """Test solve endpoint with missing center letter"""
        return self.run_test(
            "Solve with missing center letter",
            "POST",
            "solve",
            422,  # Validation error
            data={
                "outer_letters": ["A", "U", "D", "T", "O", "R"]
            }
        )

    def test_solve_missing_outer(self):
        """Test solve endpoint with missing outer letters"""
        return self.run_test(
            "Solve with missing outer letters",
            "POST",
            "solve",
            422,  # Validation error
            data={
                "center_letter": "B"
            }
        )

    def test_solve_invalid_outer_count(self):
        """Test solve endpoint with wrong number of outer letters"""
        return self.run_test(
            "Solve with wrong number of outer letters",
            "POST",
            "solve",
            422,  # Validation error
            data={
                "center_letter": "B",
                "outer_letters": ["A", "U", "D", "T"]  # Only 4 instead of 6
            }
        )

    def test_solve_empty_letters(self):
        """Test solve endpoint with empty letters"""
        return self.run_test(
            "Solve with empty letters",
            "POST",
            "solve",
            422,  # Validation error
            data={
                "center_letter": "",
                "outer_letters": ["", "", "", "", "", ""]
            }
        )

    def test_solve_accented_letters(self):
        """Test solve endpoint with accented letters"""
        success, response = self.run_test(
            "Solve with accented letters - Ç center + A,O,R,T,E,S outer",
            "POST",
            "solve",
            200,
            data={
                "center_letter": "Ç",
                "outer_letters": ["A", "O", "R", "T", "E", "S"]
            },
            expected_keys=["total", "pangram_count", "groups"]
        )
        
        if success and response:
            print(f"📊 Results with accented letters: {response.get('total', 0)} words, {response.get('pangram_count', 0)} pangrams")
        
        return success, response

    def test_solve_no_results(self):
        """Test solve endpoint with letters that should produce no results"""
        success, response = self.run_test(
            "Solve with letters producing no results - X center + Z,Q,W,Y,J,K outer",
            "POST",
            "solve",
            200,
            data={
                "center_letter": "X",
                "outer_letters": ["Z", "Q", "W", "Y", "J", "K"]
            },
            expected_keys=["total", "pangram_count", "groups"]
        )
        
        if success and response:
            print(f"📊 Results with rare letters: {response.get('total', 0)} words, {response.get('pangram_count', 0)} pangrams")
        
        return success, response

def main():
    print("🚀 Starting Soletra API Tests")
    print("=" * 50)
    
    # Setup
    tester = SoletraAPITester()
    
    # Run tests
    print("\n📋 Testing API Endpoints...")
    
    # Test root endpoint
    tester.test_root_endpoint()
    
    # Test main solve functionality
    success, response = tester.test_solve_valid_request()
    if success and response:
        # Validate expected results for B + A,U,D,T,O,R
        total = response.get('total', 0)
        pangram_count = response.get('pangram_count', 0)
        
        print(f"\n📈 Validation Results:")
        print(f"Expected ~238 words, got {total}")
        print(f"Expected ~6 pangrams, got {pangram_count}")
        
        if 200 <= total <= 300:  # Allow some variance
            print("✅ Word count is in expected range")
        else:
            print("⚠️  Word count differs significantly from expected")
            
        if 4 <= pangram_count <= 8:  # Allow some variance
            print("✅ Pangram count is in expected range")
        else:
            print("⚠️  Pangram count differs from expected")
    
    # Test error cases
    print("\n🔍 Testing Error Cases...")
    tester.test_solve_missing_center()
    tester.test_solve_missing_outer()
    tester.test_solve_invalid_outer_count()
    tester.test_solve_empty_letters()
    
    # Test edge cases
    print("\n🧪 Testing Edge Cases...")
    tester.test_solve_accented_letters()
    tester.test_solve_no_results()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
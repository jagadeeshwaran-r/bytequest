// Canonical public company associations from dist/problem-details.js.
// Apply only to exact matching problem ID and Java method when staging omits tags.
// No hidden suite, private data or arbitrary company inference is involved.
const canonical: Readonly<Record<string,{readonly method:string;readonly companies:readonly string[]}>> = {
  "two-sum": {
    "method": "twoSum",
    "companies": [
      "Amazon",
      "Google"
    ]
  },
  "contains-duplicate": {
    "method": "containsDuplicate",
    "companies": [
      "Amazon"
    ]
  },
  "valid-anagram": {
    "method": "isAnagram",
    "companies": [
      "Amazon",
      "Apple"
    ]
  },
  "binary-search": {
    "method": "search",
    "companies": [
      "Google"
    ]
  },
  "lower-bound": {
    "method": "lowerBound",
    "companies": []
  },
  "sorted-squares": {
    "method": "sortedSquares",
    "companies": [
      "Adobe"
    ]
  },
  "valid-palindrome": {
    "method": "isPalindrome",
    "companies": [
      "Amazon",
      "Apple"
    ]
  },
  "move-zeroes": {
    "method": "moveZeroes",
    "companies": [
      "Apple",
      "Google"
    ]
  },
  "max-profit": {
    "method": "maxProfit",
    "companies": [
      "Facebook"
    ]
  },
  "window-sum": {
    "method": "maxWindowSum",
    "companies": []
  },
  "valid-parentheses": {
    "method": "isValid",
    "companies": [
      "Amazon",
      "Microsoft"
    ]
  },
  "fibonacci": {
    "method": "fib",
    "companies": [
      "Amazon",
      "Microsoft"
    ]
  },
  "gcd": {
    "method": "gcd",
    "companies": []
  },
  "count-primes": {
    "method": "countPrimes",
    "companies": [
      "Amazon",
      "Google"
    ]
  },
  "climb-stairs": {
    "method": "climbStairs",
    "companies": [
      "Amazon",
      "Apple"
    ]
  },
  "max-subarray": {
    "method": "maxSubArray",
    "companies": [
      "Amazon",
      "Microsoft"
    ]
  }
};
export function canonicalCompanyTags(id:string,method:string):readonly string[]{
  const entry=canonical[id];
  return entry&&entry.method===method?entry.companies:[];
}

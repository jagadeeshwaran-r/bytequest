export const problemDetails={
  "two-sum": {
    "title": "Two Sum",
    "description": "Return the zero-based indices of two distinct elements whose sum is target. Exactly one valid pair exists. The same array position cannot be used twice, even when target is twice its value. Equal numbers at different indices are allowed. Return the two indices in either order; returning the values themselves does not satisfy the contract.",
    "inputGuide": "nums is an unsorted integer array; target is the required sum.",
    "outputGuide": "An int[] containing exactly two different indices.",
    "companies": [
      "Amazon",
      "Google"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "contains-duplicate": {
    "title": "Contains Duplicate",
    "description": "Determine whether any integer appears at least twice in nums. Compare values, not positions. Return true as soon as a repeated value is found, and false if all values are distinct. Negative numbers and zero are ordinary values. An empty array or an array with one element has no duplicate. You do not need to report which value repeats.",
    "inputGuide": "nums is an integer array, with no ordering guarantee.",
    "outputGuide": "A boolean indicating whether a duplicate exists.",
    "companies": [
      "Amazon"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "valid-anagram": {
    "title": "Valid Anagram",
    "description": "Decide whether strings s and t contain exactly the same letters with the same frequencies. Rearranging letters is allowed; adding or removing a letter is not. Matching only the set of distinct letters is insufficient because repeated letters matter. The inputs contain lowercase English letters. Two empty strings are anagrams, and different-length strings cannot be anagrams.",
    "inputGuide": "s and t contain lowercase a–z characters.",
    "outputGuide": "true if the two character frequency distributions are equal; otherwise false.",
    "companies": [
      "Amazon",
      "Apple"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "binary-search": {
    "title": "Binary Search",
    "description": "Find target in the strictly increasing sorted array nums. Return its zero-based index if present, or -1 if it is absent. The ordering is part of the input contract, so no sorting is required. Handle an empty search interval without accessing an invalid index. Your algorithm should halve the search interval at each step and run in logarithmic time.",
    "inputGuide": "nums is sorted in strictly increasing order; target is an integer.",
    "outputGuide": "The matching index, or -1 when target does not occur.",
    "companies": [
      "Google"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "lower-bound": {
    "title": "Lower Bound",
    "description": "Find the first index i for which nums[i] is greater than or equal to target. The array is sorted in nondecreasing order and can contain duplicates. If every element is smaller than target, return nums.length. This is an insertion boundary rather than an exact-match search: if target occurs several times, return the index of its first occurrence. For an empty array the answer is 0.",
    "inputGuide": "A nondecreasing integer array nums and an integer target.",
    "outputGuide": "An integer boundary in the inclusive range 0 through nums.length.",
    "companies": [],
    "companySource": ""
  },
  "sorted-squares": {
    "title": "Squares of a Sorted Array",
    "description": "Square every value in the sorted input array and return those squares in nondecreasing order. Negative values can have larger squares than positive values, so preserving the original order is not sufficient. Include repeated values and zeros with their original multiplicities. Aim for a linear-time approach by comparing values at the two ends and filling the output from largest to smallest.",
    "inputGuide": "nums is sorted in nondecreasing order within the stated safe squaring bounds.",
    "outputGuide": "A new int[] of sorted squares, with the same length as nums.",
    "companies": [
      "Adobe"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "valid-palindrome": {
    "title": "Valid Palindrome",
    "description": "Check whether s reads the same forward and backward after ignoring non-alphanumeric characters and letter case. For this exercise, alphanumeric means ASCII letters a–z or A–Z and digits 0–9. Spaces and punctuation do not participate in comparisons. A string with no remaining characters is a palindrome. You can compare from both ends without constructing a cleaned copy.",
    "inputGuide": "s is an ASCII string and may contain spaces or punctuation.",
    "outputGuide": "true when its filtered, case-insensitive sequence is a palindrome.",
    "companies": [
      "Amazon",
      "Apple"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "move-zeroes": {
    "title": "Move Zeroes",
    "description": "Move every zero in nums to the end while preserving the relative order of all nonzero values. Perform the rearrangement in the original array. Unlike a void-returning version of this exercise, this platform also requires you to return the modified array so the judge can compare it. Preserve the length and every value; do not simply remove zero entries. Empty and all-zero arrays should remain valid.",
    "inputGuide": "nums is an integer array to modify in place.",
    "outputGuide": "Return the same array after stable movement of zero values.",
    "companies": [
      "Apple",
      "Google"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "max-profit": {
    "title": "Best Time to Buy and Sell Stock",
    "description": "Choose at most one day to buy and one later day to sell a stock. prices[i] is the price on day i. Return the greatest possible profit. You must buy before selling and cannot make multiple transactions. If no profitable transaction exists, return 0 rather than a loss. Track the lowest earlier buying price while scanning the possible selling days.",
    "inputGuide": "prices is an array of daily stock prices in chronological order.",
    "outputGuide": "The maximum nonnegative profit from at most one transaction.",
    "companies": [
      "Facebook"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "window-sum": {
    "title": "Maximum Sum of a Fixed-Size Subarray",
    "description": "Among all contiguous subarrays containing exactly k elements, return the largest sum. A subarray uses consecutive positions and cannot skip elements. The window length must stay exactly k, even if some numbers are negative. Initialize from a real window rather than zero so that arrays whose window sums are all negative are handled correctly. The input guarantees a valid window length.",
    "inputGuide": "nums is an integer array and 1 ≤ k ≤ nums.length.",
    "outputGuide": "The maximum sum over all contiguous windows of length k.",
    "companies": [],
    "companySource": ""
  },
  "valid-parentheses": {
    "title": "Valid Parentheses",
    "description": "Check whether every opening bracket has a matching closing bracket of the same type and the pairs are correctly nested. The string contains only parentheses (), square brackets [], and braces {}. A closing bracket must match the most recent unmatched opening bracket. Equal counts alone are insufficient; for example, crossed pairs are invalid. The empty string is valid.",
    "inputGuide": "s contains only the six bracket characters.",
    "outputGuide": "true if the entire bracket sequence is balanced and properly nested.",
    "companies": [
      "Amazon",
      "Microsoft"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "fibonacci": {
    "title": "Fibonacci Number",
    "description": "Compute the nth Fibonacci number using F(0)=0, F(1)=1, and F(n)=F(n−1)+F(n−2) for n≥2. Return the exact integer result, not the sequence. The bounded input keeps the result within the supported int range. Consider an iterative approach that stores only the previous two terms instead of repeatedly recomputing smaller subproblems.",
    "inputGuide": "n is an integer from 0 through 40.",
    "outputGuide": "The exact value F(n).",
    "companies": [
      "Amazon",
      "Microsoft"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "gcd": {
    "title": "Greatest Common Divisor",
    "description": "Return the greatest common divisor of nonnegative integers a and b: the largest positive integer that divides both without a remainder. Use the convention gcd(0,0)=0. If only one argument is zero, the answer is the other argument. Euclid’s algorithm repeatedly replaces the pair with the smaller value and the division remainder until the remainder is zero.",
    "inputGuide": "a and b are nonnegative integers within the stated bounds.",
    "outputGuide": "The nonnegative greatest common divisor.",
    "companies": [],
    "companySource": ""
  },
  "count-primes": {
    "title": "Count Primes",
    "description": "Count how many prime numbers are strictly less than n. A prime is an integer greater than 1 with exactly two positive divisors: 1 and itself. Neither 0 nor 1 is prime. Do not count n itself even if it is prime. For n≤2 the answer is 0. A sieve can mark multiples in batches instead of testing every candidate independently.",
    "inputGuide": "n is an integer in the stated range.",
    "outputGuide": "The number of primes p satisfying 2 ≤ p < n.",
    "companies": [
      "Amazon",
      "Google"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "climb-stairs": {
    "title": "Climbing Stairs",
    "description": "Count the distinct ordered sequences of steps that reach exactly stair n when each move climbs either one or two stairs. Order matters: one then two differs from two then one. For n=0, count the empty sequence as one valid way. The bounded input keeps the answer within the supported int range. Relate the ways to reach a stair to the previous two stairs.",
    "inputGuide": "n is an integer from 0 through 40.",
    "outputGuide": "The number of ordered one-step and two-step sequences totaling n.",
    "companies": [
      "Amazon",
      "Apple"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  },
  "max-subarray": {
    "title": "Maximum Subarray",
    "description": "Find the largest sum among all nonempty contiguous subarrays of nums. A subarray is a consecutive range, not an arbitrary selection of elements. Return only the sum. You must select at least one value, so an all-negative input returns its largest individual element rather than zero. At each position, decide whether to extend the previous range or start a new one.",
    "inputGuide": "nums is a nonempty integer array within the stated sum bounds.",
    "outputGuide": "The maximum sum of any nonempty contiguous range.",
    "companies": [
      "Amazon",
      "Microsoft"
    ],
    "companySource": "https://github.com/duanehutchins/leetcode-questions-by-company"
  }
};

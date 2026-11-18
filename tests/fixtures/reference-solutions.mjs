// Test-only reference bodies. NEVER import from dist/ or bundle on GitHub Pages.
// NOTE: public Git history remains accessible; move fixture to private CI to protect from source readers.
import {problems} from '../../dist/problems.js';
const bodies = {
  ["two-sum"]: "Map<Integer, Integer> seen = new HashMap<>();\nfor (int i = 0; i < nums.length; i++) {\n    int need = target - nums[i];\n    if (seen.containsKey(need)) {\n        return new int[]{seen.get(need), i};\n    }\n    seen.put(nums[i], i);\n}\nreturn new int[0];",
  ["contains-duplicate"]: "Set<Integer> seen = new HashSet<>();\nfor (int value : nums) {\n    if (!seen.add(value)) return true;\n}\nreturn false;",
  ["valid-anagram"]: "if (s.length() != t.length()) return false;\nint[] counts = new int[26];\nfor (int i = 0; i < s.length(); i++) {\n    counts[s.charAt(i) - 'a']++;\n    counts[t.charAt(i) - 'a']--;\n}\nfor (int count : counts) if (count != 0) return false;\nreturn true;",
  ["binary-search"]: "int left = 0, right = nums.length - 1;\nwhile (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (nums[mid] == target) return mid;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid - 1;\n}\nreturn -1;",
  ["lower-bound"]: "int left = 0, right = nums.length;\nwhile (left < right) {\n    int mid = left + (right - left) / 2;\n    if (nums[mid] < target) left = mid + 1;\n    else right = mid;\n}\nreturn left;",
  ["sorted-squares"]: "int[] result = new int[nums.length];\nint left = 0, right = nums.length - 1;\nfor (int i = nums.length - 1; i >= 0; i--) {\n    if (Math.abs(nums[left]) > Math.abs(nums[right])) {\n        result[i] = nums[left] * nums[left];\n        left++;\n    } else {\n        result[i] = nums[right] * nums[right];\n        right--;\n    }\n}\nreturn result;",
  ["valid-palindrome"]: "int left = 0, right = s.length() - 1;\nwhile (left < right) {\n    if (!Character.isLetterOrDigit(s.charAt(left))) { left++; continue; }\n    if (!Character.isLetterOrDigit(s.charAt(right))) { right--; continue; }\n    if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right))) return false;\n    left++;\n    right--;\n}\nreturn true;",
  ["move-zeroes"]: "int write = 0;\nfor (int value : nums) {\n    if (value != 0) nums[write++] = value;\n}\nwhile (write < nums.length) nums[write++] = 0;\nreturn nums;",
  ["max-profit"]: "int lowest = Integer.MAX_VALUE, best = 0;\nfor (int price : prices) {\n    lowest = Math.min(lowest, price);\n    best = Math.max(best, price - lowest);\n}\nreturn best;",
  ["window-sum"]: "int sum = 0;\nfor (int i = 0; i < k; i++) sum += nums[i];\nint best = sum;\nfor (int i = k; i < nums.length; i++) {\n    sum += nums[i] - nums[i - k];\n    best = Math.max(best, sum);\n}\nreturn best;",
  ["valid-parentheses"]: "Deque<Character> stack = new ArrayDeque<>();\nfor (char c : s.toCharArray()) {\n    if (c == '(') stack.push(')');\n    else if (c == '[') stack.push(']');\n    else if (c == '{') stack.push('}');\n    else if (stack.isEmpty() || stack.pop() != c) return false;\n}\nreturn stack.isEmpty();",
  ["fibonacci"]: "int a = 0, b = 1;\nfor (int i = 0; i < n; i++) {\n    int next = a + b;\n    a = b;\n    b = next;\n}\nreturn a;",
  ["gcd"]: "while (b != 0) {\n    int remainder = a % b;\n    a = b;\n    b = remainder;\n}\nreturn a;",
  ["count-primes"]: "boolean[] composite = new boolean[n];\nfor (int p = 2; p * p < n; p++) {\n    if (!composite[p]) {\n        for (int m = p * p; m < n; m += p) composite[m] = true;\n    }\n}\nint count = 0;\nfor (int i = 2; i < n; i++) if (!composite[i]) count++;\nreturn count;",
  ["climb-stairs"]: "int previous = 1, current = 1;\nfor (int step = 2; step <= n; step++) {\n    int next = previous + current;\n    previous = current;\n    current = next;\n}\nreturn current;",
  ["max-subarray"]: "int endingHere = nums[0], best = nums[0];\nfor (int i = 1; i < nums.length; i++) {\n    endingHere = Math.max(nums[i], endingHere + nums[i]);\n    best = Math.max(best, endingHere);\n}\nreturn best;"
};
for(const problem of problems){
  const body=bodies[problem.id];
  if(typeof body!=='string')throw new Error('Missing test-only reference for '+problem.id);
  problem.reference='import java.util.*;\n\nclass Solution {\n    public '+problem.returns+' '+problem.method+'('+problem.params.map(p=>p.type+' '+p.name).join(', ')+') {\n'+body.split('\n').map(line=>'        '+line).join('\n')+'\n    }\n}\n';
}
export {bodies as testOnlyReferenceBodies};

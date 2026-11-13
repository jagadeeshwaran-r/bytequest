const frame = (values, active, message, note = "", found = [], dim = []) => ({values,active,message,note,found,dim});
export function traceFor(p) {
  if (p.id === "two-sum") return [
    frame([2,7,11,15],[], "We need two values that add up to 9. Start with an empty map.", "seen = {}"),
    frame([2,7,11,15],[0], "Visit 2. Its complement is 9 − 2 = 7. We have not seen 7 yet.", "need = 7 · not found"),
    frame([2,7,11,15],[0], "Remember the value 2 and its index. Check first, then insert.", "seen = {2 → 0}"),
    frame([2,7,11,15],[1], "Visit 7. Its complement is 9 − 7 = 2. Our map has it!", "need = 2 · found at index 0"),
    frame([2,7,11,15],[], "Return indices [0, 1]. The map avoids checking every possible pair.", "2 + 7 = 9", [0,1])
  ];
  if (p.id === "contains-duplicate") return [
    frame([1,2,3,1],[], "A set remembers which values have visited before.", "seen = {}"),
    frame([1,2,3,1],[0], "Add 1. This is its first visit.", "seen = {1}"),
    frame([1,2,3,1],[1], "Add 2. Still unique.", "seen = {1, 2}"),
    frame([1,2,3,1],[2], "Add 3. No duplicate yet.", "seen = {1, 2, 3}"),
    frame([1,2,3,1],[], "The next 1 is already in the set. Return true.", "1 is a repeated visitor",[0,3])
  ];
  if (p.id === "binary-search") return [
    frame([-1,0,3,5,9,12],[], "Search for 9. The whole array is our candidate interval.", "left = 0 · right = 5"),
    frame([-1,0,3,5,9,12],[2], "The midpoint is index 2, value 3. Since 3 < 9, discard this index and its left side.", "mid = 2 · move left to 3"),
    frame([-1,0,3,5,9,12],[4], "The new midpoint is index 4. The value is 9.", "left = 3 · right = 5 · mid = 4",[],[0,1,2]),
    frame([-1,0,3,5,9,12],[], "Found it! Return 4. Every unsuccessful comparison halves the interval.", "answer = 4",[4],[0,1,2])
  ];
  if (p.id === "lower-bound") return [
    frame([1,3,3,5],[], "Find the first value at least 3. Use [left, right) with right = 4.", "left = 0 · right = 4"),
    frame([1,3,3,5],[2], "Value 3 qualifies, but there may be an earlier one. Keep mid as a candidate.", "mid = 2 → right = 2"),
    frame([1,3,3,5],[1], "Value 3 qualifies again. Move right to 1.", "mid = 1 → right = 1",[],[2,3]),
    frame([1,3,3,5],[0], "Value 1 is too small. Everything through index 0 can be discarded.", "mid = 0 → left = 1",[],[2,3]),
    frame([1,3,3,5],[], "left equals right. Index 1 is the first qualifying position.", "answer = 1",[1],[0,2,3])
  ];
  if (p.id === "sorted-squares") return [
    frame([-4,-1,0,3,10],[0,4], "Compare absolute values at both ends. The larger square goes at the back.", "output = [_, _, _, _, _]"),
    frame([-4,-1,0,3,10],[0,4], "|10| beats |−4|. Place 100 at the end and move right inward.", "output = [_, _, _, _, 100]"),
    frame([-4,-1,0,3,10],[0,3], "|−4| beats |3|. Place 16 next and move left inward.", "output = [_, _, _, 16, 100]"),
    frame([-4,-1,0,3,10],[1,3], "|3| beats |−1|. Place 9.", "output = [_, _, 9, 16, 100]"),
    frame([-4,-1,0,3,10],[1,2], "Place 1, then 0. Filling from the back keeps the result sorted.", "output = [0, 1, 9, 16, 100]",[0,1,2,3,4])
  ];
  if (p.id === "valid-palindrome") return [
    frame(["a","b","b","a"],[0,3], "Compare the outer characters of abba.", "left = 0 · right = 3"),
    frame(["a","b","b","a"],[0,3], "a equals a. Move both pointers inward.", "outer pair matches",[0,3]),
    frame(["a","b","b","a"],[1,2], "b equals b. This pair matches too.", "inner pair matches",[0,3]),
    frame(["a","b","b","a"],[], "The pointers crossed. Every pair matched: return true.", "When reading real input, skip punctuation first.",[0,1,2,3])
  ];
  if (p.id === "move-zeroes") return [
    frame([0,1,0,3,12],[0], "Read each value. write marks the next slot for a nonzero value.", "write = 0"),
    frame([1,1,0,3,12],[1], "Read 1 and copy it to index 0. Advance write.", "write = 1 · built prefix = [1]",[0]),
    frame([1,1,0,3,12],[2], "Read 0. Skip it; leave write where it is.", "write = 1",[0]),
    frame([1,3,0,3,12],[3], "Read 3 and copy it to index 1.", "write = 2 · built prefix = [1, 3]",[0,1]),
    frame([1,3,12,3,12],[4], "Read 12 and copy it to index 2. The useful prefix is complete.", "write = 3",[0,1,2]),
    frame([1,3,12,0,0],[], "Fill the remaining positions with zeroes. The nonzero order is unchanged.", "return nums",[0,1,2,3,4])
  ];
  if (p.id === "window-sum") return [
    frame([1,12,-5,-6,50,3],[0,1,2,3], "The first width-4 window sums to 2.", "sum = 2 · best = 2"),
    frame([1,12,-5,-6,50,3],[1,2,3,4], "Slide once: subtract 1 and add 50. No need to rescan the middle.", "sum = 2 − 1 + 50 = 51 · best = 51",[],[0]),
    frame([1,12,-5,-6,50,3],[2,3,4,5], "Slide again: subtract 12 and add 3. The new sum is 42.", "sum = 51 − 12 + 3 = 42 · best = 51",[],[0,1]),
    frame([1,12,-5,-6,50,3],[], "Return the largest sum seen: 51.", "The best window is [12, −5, −6, 50].",[1,2,3,4])
  ];
  if (p.id === "valid-parentheses") return [
    frame(["{","[","]","}"],[], "A stack remembers the closing brackets we expect.", "stack = []"),
    frame(["{","[","]","}"],[0], "Read {. Push its partner }.", "stack = [}] · top on the right"),
    frame(["{","[","]","}"],[1], "Read [. Its partner ] must close before }.", "stack = [}, ]]"),
    frame(["{","[","]","}"],[2], "Read ]. It matches the stack top, so pop it.", "stack = [}]"),
    frame(["{","[","]","}"],[3], "Read }. It matches and empties the stack. Return true.", "stack = []",[0,1,2,3])
  ];
  if (p.id === "valid-anagram") return [
    frame(["l","i","s","t","e","n"],[], "listen and silent have the same length. Compare letter counts.", "Count up for s. Count down for t."),
    frame(["l","i","s","t","e","n"],[0,1,2,3,4,5], "First count the letters in listen.", "e:1  i:1  l:1  n:1  s:1  t:1"),
    frame(["s","i","l","e","n","t"],[0,1,2,3,4,5], "Subtract the letters in silent. Each increment is balanced.", "e:0  i:0  l:0  n:0  s:0  t:0"),
    frame(["s","i","l","e","n","t"],[], "Every counter is zero, so return true. Equal lengths alone would not be enough.", "An anagram preserves all frequencies.",[0,1,2,3,4,5])
  ];
  if (p.id === "gcd") return [
    frame([48,18],[0,1], "Euclid's algorithm keeps the GCD unchanged while shrinking the problem.", "a = 48 · b = 18"),
    frame([18,12],[0,1], "48 % 18 = 12. Replace the pair with (18, 12).", "gcd(48, 18) = gcd(18, 12)"),
    frame([12,6],[0,1], "18 % 12 = 6. Replace the pair with (12, 6).", "gcd(18, 12) = gcd(12, 6)"),
    frame([6,0],[], "12 % 6 = 0. Stop: the answer is 6.", "return a = 6",[0])
  ];
  if (p.id === "count-primes") return [
    frame([2,3,4,5,6,7,8,9],[], "Count primes strictly below 10. Start with candidates from 2 onward.", "0 and 1 are never prime."),
    frame([2,3,4,5,6,7,8,9],[0], "2 is prime. Mark its multiples starting at 2² = 4.", "Mark 4, 6, 8.",[0],[2,4,6]),
    frame([2,3,4,5,6,7,8,9],[1], "3 is prime. Mark its multiples starting at 3² = 9.", "Mark 9.",[0,1],[2,4,6,7]),
    frame([2,3,4,5,6,7,8,9],[], "The unmarked numbers are 2, 3, 5 and 7. Return 4.", "count = 4",[0,1,3,5],[2,4,6,7])
  ];
  if (p.trace === "dp") {
    const isStairs = p.id === "climb-stairs";
    const values = isStairs ? [1,1,2,3,5,8] : [0,1,1,2,3,5,8];
    return values.map((v,i) => frame(values,[i],i < 2 ? "Start with the base cases. These anchor every later result." : "Add the previous two states: " + values[i-2] + " + " + values[i-1] + " = " + v + ". Keep only those two numbers for the next step.", (isStairs ? "ways(" : "F(") + i + ") = " + v, Array.from({length:i},(_,j)=>j), Array.from({length:values.length-i-1},(_,j)=>j+i+1)));
  }
  if (p.id === "max-profit") return [
    frame([7,1,5,3,6,4],[0], "Start with the first price. You cannot make a profit yet.", "lowest = 7 · best = 0"),
    frame([7,1,5,3,6,4],[1], "1 is a new lower purchase price. Remember it.", "lowest = 1 · best = 0"),
    frame([7,1,5,3,6,4],[2], "Selling at 5 after buying at 1 earns 4.", "lowest = 1 · best = 4",[1,2]),
    frame([7,1,5,3,6,4],[3], "Selling at 3 would earn 2. Keep the better profit.", "lowest = 1 · best = 4",[1,2]),
    frame([7,1,5,3,6,4],[4], "Selling at 6 improves the profit to 5.", "lowest = 1 · best = 5",[1,4]),
    frame([7,1,5,3,6,4],[5], "4 gives a smaller profit. Return the best seen, 5.", "answer = 5",[1,4])
  ];
  return [
    frame([-2,1,-3,4,-1,2,1,-5,4],[0], "Initialize from the first value. A nonempty answer may be negative.", "endingHere = −2 · best = −2"),
    frame([-2,1,-3,4,-1,2,1,-5,4],[1], "Start fresh at 1: it is better than extending the sum −2.", "endingHere = 1 · best = 1"),
    frame([-2,1,-3,4,-1,2,1,-5,4],[2], "Extend to −2. The overall best stays 1.", "endingHere = −2 · best = 1"),
    frame([-2,1,-3,4,-1,2,1,-5,4],[3], "Start fresh at 4. A negative prefix would reduce the sum.", "endingHere = 4 · best = 4",[3]),
    frame([-2,1,-3,4,-1,2,1,-5,4],[4,5,6], "Extend through −1, 2 and 1. The running sum reaches 6.", "endingHere = 6 · best = 6",[3,4,5,6]),
    frame([-2,1,-3,4,-1,2,1,-5,4],[], "The remaining values never improve on 6. Return 6.", "best subarray = [4, −1, 2, 1]",[3,4,5,6])
  ];
}

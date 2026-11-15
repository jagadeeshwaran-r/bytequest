// Shared server-side Java support for LeetCode-style linked-list inputs.
export const linkedListJavaSource = `
class ListNode {
    int val;
    ListNode next;
    ListNode(int value) { this.val = value; }
    ListNode(int value, ListNode next) { this.val = value; this.next = next; }
}
class ListHelper {
    static ListNode createList(int[] values) { return createList(values, -1); }
    static ListNode createList(int[] values, int pos) {
        if (values == null || values.length == 0) {
            if (pos != -1) throw new IllegalArgumentException("Invalid cycle position");
            return null;
        }
        if (pos < -1 || pos >= values.length) throw new IllegalArgumentException("Invalid cycle position");
        ListNode head = new ListNode(values[0]), tail = head;
        ListNode cycle = pos == 0 ? head : null;
        for (int i = 1; i < values.length; i++) {
            tail.next = new ListNode(values[i]);
            tail = tail.next;
            if (i == pos) cycle = tail;
        }
        if (cycle != null) tail.next = cycle;
        return head;
    }
    static int indexOfReturned(ListNode head, java.util.function.Function<ListNode,ListNode> solver) {
        ListNode result = solver.apply(head);
        if (result == null) return -1;
        java.util.IdentityHashMap<ListNode,Boolean> visited = new java.util.IdentityHashMap<>();
        int index = 0;
        while (head != null && visited.put(head, Boolean.TRUE) == null) {
            if (result == head) return index;
            head = head.next;
            if (++index > 10000) throw new IllegalStateException("List exceeds maximum length");
        }
        return -2;
    }
}
`;
export const hasLinkedListType = problem =>
  problem.params.some(p => p.type === 'ListNode') || problem.returns === 'ListNode';

// Level-order LeetCode tree representation; null marks absent children.
export const binaryTreeJavaSource = `
class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode(int value) { this.val = value; }
    TreeNode(int value, TreeNode left, TreeNode right) { this.val = value; this.left = left; this.right = right; }
}
class TreeHelper {
    static TreeNode createTree(Integer... values) {
        if (values == null || values.length == 0 || values[0] == null) return null;
        TreeNode root = new TreeNode(values[0]);
        java.util.Queue<TreeNode> queue = new java.util.ArrayDeque<>();
        queue.add(root);
        int index = 1;
        while (index < values.length && !queue.isEmpty()) {
            TreeNode node = queue.remove();
            if (index < values.length && values[index] != null) {
                node.left = new TreeNode(values[index]);
                queue.add(node.left);
            }
            index++;
            if (index < values.length && values[index] != null) {
                node.right = new TreeNode(values[index]);
                queue.add(node.right);
            }
            index++;
        }
        return root;
    }
}
`;
export const hasTreeNodeType = problem =>
  problem.params.some(p => p.type === 'TreeNode');
export const requiresJavaStructures = problem =>
  hasLinkedListType(problem) || hasTreeNodeType(problem) ||
  problem.params.some(p => p.type === 'int[][]') || problem.returns === 'int[][]';
export const javaInputStructures = problem =>
  (hasLinkedListType(problem) ? linkedListJavaSource : '') +
  (hasTreeNodeType(problem) ? binaryTreeJavaSource : '');

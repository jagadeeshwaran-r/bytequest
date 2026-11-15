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
}
`;
export const hasLinkedListType = problem =>
  problem.params.some(p => p.type === 'ListNode');

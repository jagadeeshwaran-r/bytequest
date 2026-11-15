package quest;

import java.io.*;
import java.lang.reflect.InvocationTargetException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.tools.*;

/** A real javac + JVM bridge. Runs only inside the visitor's browser in production. */
public final class JavaRunner {
    private static final int OUTPUT_LIMIT = 24_000;

    public static synchronized String run(String source, String testBody) {
        Path dir = null;
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;
        CappedOutput captured = new CappedOutput();
        try {
            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            if (compiler == null) return error("runtime_error", "The browser JDK did not provide javac. Reload and try again.");
            dir = Files.createTempDirectory("bytequest-");
            Path solution = dir.resolve("Solution.java");
            Path harness = dir.resolve("QuestTests.java");
            Files.write(solution, source.getBytes(StandardCharsets.UTF_8));
            Files.write(harness, harnessSource(testBody).getBytes(StandardCharsets.UTF_8));
            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            try (StandardJavaFileManager fm = compiler.getStandardFileManager(diagnostics, Locale.ENGLISH, StandardCharsets.UTF_8)) {
                Iterable<? extends JavaFileObject> units = fm.getJavaFileObjects(solution.toFile(), harness.toFile());
                boolean ok = Boolean.TRUE.equals(compiler.getTask(null, fm, diagnostics,
                    Arrays.asList("-proc:none", "-encoding", "UTF-8", "-d", dir.toString()), null, units).call());
                if (!ok) {
                    StringBuilder message = new StringBuilder();
                    for (Diagnostic<?> d : diagnostics.getDiagnostics()) {
                        if (d.getKind() == Diagnostic.Kind.ERROR) message.append("Line ").append(d.getLineNumber())
                            .append(": ").append(d.getMessage(Locale.ENGLISH)).append('\n');
                    }
                    return error("compile_error", message.toString());
                }
            }
            PrintStream capture = new PrintStream(captured, true, "UTF-8");
            System.setOut(capture);
            System.setErr(capture);
            long start = System.nanoTime();
            try (URLClassLoader loader = new URLClassLoader(new URL[]{dir.toUri().toURL()}, JavaRunner.class.getClassLoader())) {
                String results = (String) Class.forName("QuestTests", true, loader).getMethod("run").invoke(null);
                double elapsed = (System.nanoTime() - start) / 1_000_000.0;
                return "{\"status\":\"ok\",\"cases\":" + results + ",\"stdout\":" + quote(captured.toString("UTF-8"))
                    + ",\"elapsedMs\":" + String.format(Locale.ROOT, "%.2f", elapsed) + "}";
            }
        } catch (Throwable e) {
            Throwable cause = e instanceof InvocationTargetException && e.getCause() != null ? e.getCause() : e;
            return error("runtime_error", cause.getClass().getSimpleName() + ": " + String.valueOf(cause.getMessage()));
        } finally {
            System.setOut(originalOut);
            System.setErr(originalErr);
            if (dir != null) {
                try (java.util.stream.Stream<Path> paths = Files.walk(dir)) {
                    paths.sorted(Comparator.reverseOrder()).forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });
                } catch (IOException ignored) {}
            }
        }
    }

    private static String harnessSource(String tests) {
        return "import java.util.*;\nimport java.lang.reflect.Array;\n\nclass ListNode {\n    int val;\n    ListNode next;\n    ListNode(int val) { this.val = val; }\n    ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n}\nclass ListHelper {\n    static ListNode createList(int[] values) { return createList(values, -1); }\n    static ListNode createList(int[] values, int pos) {\n        if (values == null || values.length == 0) {\n            if (pos != -1) throw new IllegalArgumentException(\"Invalid cycle position\");\n            return null;\n        }\n        if (pos < -1 || pos >= values.length) throw new IllegalArgumentException(\"Invalid cycle position\");\n        ListNode head = new ListNode(values[0]), tail = head, cycle = pos == 0 ? head : null;\n        for (int i = 1; i < values.length; i++) {\n            tail.next = new ListNode(values[i]);\n            tail = tail.next;\n            if (i == pos) cycle = tail;\n        }\n        if (cycle != null) tail.next = cycle;\n        return head;\n    }\n}\nclass TreeNode {\n    int val;\n    TreeNode left, right;\n    TreeNode(int val) { this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }\n}\nclass TreeHelper {\n    static TreeNode createTree(Integer... values) {\n        if (values == null || values.length == 0 || values[0] == null) return null;\n        TreeNode root = new TreeNode(values[0]);\n        Queue<TreeNode> queue = new ArrayDeque<>();\n        queue.add(root);\n        int i = 1;\n        while (i < values.length && !queue.isEmpty()) {\n            TreeNode node = queue.remove();\n            if (i < values.length && values[i] != null) {\n                node.left = new TreeNode(values[i]);\n                queue.add(node.left);\n            }\n            i++;\n            if (i < values.length && values[i] != null) {\n                node.right = new TreeNode(values[i]);\n                queue.add(node.right);\n            }\n            i++;\n        }\n        return root;\n    }\n}\nclass GraphNode {\n    int val;\n    List<GraphNode> neighbors = new ArrayList<>();\n    GraphNode(int val) { this.val = val; }\n}\nclass GraphHelper {\n    static GraphNode createGraph(int[][] adjacency) {\n        if (adjacency == null || adjacency.length == 0) return null;\n        GraphNode[] nodes = new GraphNode[adjacency.length];\n        for (int i = 0; i < nodes.length; i++) nodes[i] = new GraphNode(i + 1);\n        for (int i = 0; i < nodes.length; i++) {\n            for (int id : adjacency[i]) {\n                if (id < 1 || id > nodes.length) throw new IllegalArgumentException(\"Invalid neighbor id: \" + id);\n                nodes[i].neighbors.add(nodes[id - 1]);\n            }\n        }\n        return nodes[0];\n    }\n}\npublic class QuestTests {\n    static List<String> results = new ArrayList<>();\n    interface Attempt { Object get() throws Throwable; }\n    static int[] sorted(int[] values) { if (values != null) Arrays.sort(values); return values; }\n\n    static Object normalize(Object x) {\n        if (x == null) return null;\n        if (x instanceof ListNode) {\n            List<Object> values = new ArrayList<>();\n            IdentityHashMap<ListNode,Integer> visited = new IdentityHashMap<>();\n            ListNode node = (ListNode)x;\n            while (node != null) {\n                Integer previous = visited.putIfAbsent(node, values.size());\n                if (previous != null) {\n                    values.add(\"cycle@\" + previous);\n                    return values;\n                }\n                if (values.size() >= 10000) throw new IllegalStateException(\"List exceeds 10,000 nodes\");\n                values.add(node.val);\n                node = node.next;\n            }\n            return values;\n        }\n        if (x instanceof TreeNode) {\n            List<Object> values = new ArrayList<>();\n            Queue<TreeNode> queue = new LinkedList<>();\n            Set<TreeNode> visited = Collections.newSetFromMap(new IdentityHashMap<TreeNode,Boolean>());\n            queue.add((TreeNode)x);\n            while (!queue.isEmpty()) {\n                TreeNode node = queue.remove();\n                if (node == null) { values.add(null); continue; }\n                if (!visited.add(node)) throw new IllegalStateException(\"Tree contains a cycle/shared node\");\n                if (visited.size() > 10000) throw new IllegalStateException(\"Tree exceeds 10,000 nodes\");\n                values.add(node.val);\n                queue.add(node.left);\n                queue.add(node.right);\n            }\n            while (!values.isEmpty() && values.get(values.size()-1) == null) values.remove(values.size()-1);\n            return values;\n        }\n        if (x instanceof GraphNode) {\n            Map<Integer,List<Integer>> graph = new TreeMap<>();\n            Queue<GraphNode> queue = new ArrayDeque<>();\n            Set<GraphNode> visited = Collections.newSetFromMap(new IdentityHashMap<GraphNode,Boolean>());\n            queue.add((GraphNode)x);\n            while (!queue.isEmpty()) {\n                GraphNode node = queue.remove();\n                if (!visited.add(node)) continue;\n                if (visited.size() > 10000) throw new IllegalStateException(\"Graph exceeds 10,000 nodes\");\n                List<Integer> ids = new ArrayList<>();\n                for (GraphNode next : node.neighbors) {\n                    ids.add(next.val);\n                    if (!visited.contains(next)) queue.add(next);\n                }\n                Collections.sort(ids);\n                if (graph.put(node.val, ids) != null) throw new IllegalArgumentException(\"Graph node values must be unique\");\n            }\n            return graph;\n        }\n        if (x.getClass().isArray()) {\n            List<Object> array = new ArrayList<>();\n            int size = Array.getLength(x);\n            if (size > 10000) throw new IllegalStateException(\"Array exceeds 10,000 elements\");\n            for (int i = 0; i < size; i++) array.add(normalize(Array.get(x,i)));\n            return array;\n        }\n        if (x instanceof List<?>) {\n            List<Object> list = new ArrayList<>();\n            for (Object value : (List<?>)x) list.add(normalize(value));\n            return list;\n        }\n        if (x instanceof Set<?>) {\n            Set<Object> set = new HashSet<>();\n            for (Object value : (Set<?>)x) set.add(normalize(value));\n            return set;\n        }\n        if (x instanceof Map<?,?>) {\n            Map<Object,Object> map = new HashMap<>();\n            for (Map.Entry<?,?> entry : ((Map<?,?>)x).entrySet())\n                map.put(normalize(entry.getKey()), normalize(entry.getValue()));\n            return map;\n        }\n        return x;\n    }\n    static String repr(Object x) { return String.valueOf(normalize(x)); }\n    static void check(String name, Attempt attempt, Object expected) {\n        try {\n            Object actual = attempt.get();\n            boolean passed = Objects.deepEquals(normalize(actual), normalize(expected));\n            results.add(\"{\\\"name\\\":\"+q(name)+\",\\\"passed\\\":\"+passed+\",\\\"actual\\\":\"+q(repr(actual))+\",\\\"expected\\\":\"+q(repr(expected))+\"}\");\n        } catch (Throwable e) {\n            results.add(\"{\\\"name\\\":\"+q(name)+\",\\\"passed\\\":false,\\\"actual\\\":\"+q(e.getClass().getSimpleName()+\": \"+e.getMessage())+\",\\\"expected\\\":\"+q(repr(expected))+\"}\");\n        }\n    }\n    static String q(String s) {\n        if (s == null) return \"null\";\n        StringBuilder b = new StringBuilder(\"\\\"\");\n        for (char c : s.toCharArray()) {\n            if (c == '\"' || c == '\\\\') b.append('\\\\').append(c);\n            else if (c < 32) b.append('\\\\').append('u').append(String.format(\"%04x\",(int)c));\n            else b.append(c);\n        }\n        return b.append('\"').toString();\n    }\n    public static String run() {\n" + tests + "\n        if (results.isEmpty()) throw new IllegalStateException(\"No test cases were executed\");\n        return \"[\" + String.join(\",\", results) + \"]\";\n    }\n}\n";
    }

    public static String quote(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (c < 32) b.append(String.format("\\u%04x", (int)c)); else b.append(c);
            }
        }
        return b.append('"').toString();
    }

    private static String error(String status, String message) {
        return "{\"status\":" + quote(status) + ",\"message\":" + quote(message) + "}";
    }

    private static final class CappedOutput extends OutputStream {
        final ByteArrayOutputStream data = new ByteArrayOutputStream();
        public void write(int b) { if (data.size() < OUTPUT_LIMIT) data.write(b); }
        public String toString(String encoding) throws UnsupportedEncodingException { return data.toString(encoding); }
    }
}

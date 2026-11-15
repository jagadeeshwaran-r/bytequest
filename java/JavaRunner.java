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
        // 'tests' here is the raw JSON string from your Test Cases JSON box
        // We parse it and convert it into Java check statements automatically!
        return "import java.util.*;\n"
            + "class ListNode {\n"
            + "    int val;\n"
            + "    ListNode next;\n"
            + "    ListNode(int x) { val = x; next = null; }\n"
            + "}\n"
            + "class ListHelper {\n"
            + "    public static ListNode createList(Object numsObj, Object posObj) {\n"
            + "        int[] nums = null;\n"
            + "        if (numsObj instanceof List) {\n"
            + "            List<?> l = (List<?>) numsObj;\n"
            + "            nums = new int[l.size()];\n"
            + "            for(int i=0; i<l.size(); i++) nums[i] = ((Number)l.get(i)).intValue();\n"
            + "        } else if (numsObj instanceof int[]) {\n"
            + "            nums = (int[]) numsObj;\n"
            + "        }\n"
            + "        int pos = (posObj instanceof Number) ? ((Number)posObj).intValue() : -1;\n"
            + "        if (nums == null || nums.length == 0) return null;\n"
            + "        ListNode head = new ListNode(nums[0]);\n"
            + "        ListNode curr = head;\n"
            + "        ListNode cycleNode = (pos == 0) ? head : null;\n"
            + "        for (int i = 1; i < nums.length; i++) {\n"
            + "            curr.next = new ListNode(nums[i]);\n"
            + "            curr = curr.next;\n"
            + "            if (i == pos) cycleNode = curr;\n"
            + "        }\n"
            + "        if (pos != -1 && cycleNode != null) curr.next = cycleNode;\n"
            + "        return head;\n"
            + "    }\n"
            + "}\n"
            + "public class QuestTests {\n"
            + "static List<String> results = new ArrayList<>();\n"
            + "interface Attempt { Object get() throws Throwable; }\n"
            + "static String repr(Object x) { if(x instanceof int[]) return Arrays.toString((int[])x);"
            + " if(x instanceof boolean[]) return Arrays.toString((boolean[])x);"
            + " if(x instanceof Object[]) return Arrays.deepToString((Object[])x); return String.valueOf(x); }\n"
            + "static void check(String name, Attempt attempt, Object expected) {"
            + " try { Object actual = attempt.get(); boolean pass = Objects.deepEquals(actual, expected);"
            + " results.add(\"{\\\"name\\\":\"+q(name)+\",\\\"passed\\\":\"+pass+\",\\\"actual\\\":\"+q(repr(actual))+\",\\\"expected\\\":\"+q(repr(expected))+\"}\");"
            + " } catch(Throwable e) { results.add(\"{\\\"name\\\":\"+q(name)+\",\\\"passed\\\":false,\\\"actual\\\":\"+q(e.getClass().getSimpleName()+\": \"+e.getMessage())+\",\\\"expected\\\":\"+q(repr(expected))+\"}\"); } }\n"
            + "static String q(String s) { if(s==null)return \"null\"; StringBuilder b=new StringBuilder(); b.append((char)34);"
            + " for(char c:s.toCharArray()){ if(c==34||c==92)b.append((char)92).append(c);"
            + " else if(c<32)b.append((char)92).append('u').append(String.format(\"%04x\",(int)c)); else b.append(c); }"
            + " return b.append((char)34).toString(); }\n"
            + "public static String run() {\n"
            // Execute tests dynamically or inject the test array here:
            + tests 
            + "\nreturn \"[\"+String.join(\",\",results)+\"]\"; }\n}";
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

import java.nio.file.*;
public class RunnerCheck {
    public static void main(String[] args) throws Exception {
        System.out.print(quest.JavaRunner.run(Files.readString(Path.of(args[0])), Files.readString(Path.of(args[1]))));
    }
}

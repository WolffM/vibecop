/**
 * PMD test file - intentionally dirty code for Java code analysis
 * This file triggers various PMD rules
 */
package testfixtures;

import java.util.*;
import java.io.*;
import java.sql.*;

public class PmdIssues {

    // UnusedPrivateField
    private String unusedField = "never used";

    // AvoidFieldNameMatchingMethodName
    private String data;

    public String data() {
        return data;
    }

    // EmptyCatchBlock
    public void emptyCatch() {
        try {
            throw new IOException("test");
        } catch (IOException e) {
            // PMD: EmptyCatchBlock - empty catch block
        }
    }

    // AvoidPrintStackTrace
    public void printStackTraceUsage() {
        try {
            throw new Exception("error");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // UnusedLocalVariable
    public void unusedLocalVar() {
        int unusedVar = 42;
        System.out.println("hello");
    }

    // UnusedFormalParameter
    public void unusedParam(String param1, String unusedParam) {
        System.out.println(param1);
    }

    // AvoidDuplicateLiterals
    public void duplicateLiterals() {
        String s1 = "duplicate_string";
        String s2 = "duplicate_string";
        String s3 = "duplicate_string";
        String s4 = "duplicate_string";
    }

    // NullAssignment - assigning null to variable
    public void nullAssignment() {
        String s = "value";
        s = null;
    }

    // AvoidReassigningParameters
    public void reassignParam(String param) {
        param = "new value";
        System.out.println(param);
    }

    // UseEqualsToCompareStrings
    public boolean stringCompare(String a, String b) {
        return a == b;  // Should use .equals()
    }

    // AvoidUsingHardCodedIP
    public void hardcodedIp() {
        String server = "192.168.1.100";
    }

    // SystemPrintln - should use logger
    public void systemPrint() {
        System.out.println("Debug message");
        System.err.println("Error message");
    }

    // EmptyIfStmt
    public void emptyIf(boolean condition) {
        if (condition) {
            // empty
        }
    }

    // CollapsibleIfStatements
    public void collapsibleIf(boolean a, boolean b) {
        if (a) {
            if (b) {
                System.out.println("both true");
            }
        }
    }

    // AvoidInstantiatingObjectsInLoops
    public void objectsInLoop() {
        for (int i = 0; i < 100; i++) {
            String s = new String("value");
            System.out.println(s);
        }
    }

    // AvoidStringBufferField - StringBuffer/StringBuilder as field
    private StringBuffer buffer = new StringBuffer();

    // UseArrayListInsteadOfVector
    public void useVector() {
        Vector<String> v = new Vector<>();
        v.add("item");
    }

    // UselessParentheses
    public int uselessParens(int a, int b) {
        return ((a + b));
    }

    // SimplifyBooleanReturns
    public boolean simplifyBoolean(int x) {
        if (x > 0) {
            return true;
        } else {
            return false;
        }
    }

    // UnnecessaryReturn
    public void unnecessaryReturn() {
        System.out.println("done");
        return;
    }

    // SwitchStmtsShouldHaveDefault
    public void switchNoDefault(int x) {
        switch (x) {
            case 1:
                System.out.println("one");
                break;
            case 2:
                System.out.println("two");
                break;
        }
    }

    // AvoidCatchingThrowable
    public void catchThrowable() {
        try {
            risky();
        } catch (Throwable t) {
            System.out.println("caught");
        }
    }

    // AvoidCatchingNPE
    public void catchNpe() {
        try {
            String s = null;
            s.length();
        } catch (NullPointerException e) {
            System.out.println("NPE caught");
        }
    }

    // MethodNamingConventions - method should be lowercase
    public void BadMethodName() {
        System.out.println("bad name");
    }

    // ClassNamingConventions - inner class
    class badInnerClass {
        // should be PascalCase
    }

    // ConstantNamingConventions
    public static final String bad_constant = "value";  // should be SCREAMING_SNAKE_CASE

    // TooManyMethods (this class will have many methods)
    public void method1() {}
    public void method2() {}
    public void method3() {}
    public void method4() {}
    public void method5() {}
    public void method6() {}
    public void method7() {}
    public void method8() {}
    public void method9() {}
    public void method10() {}

    // CyclomaticComplexity - high complexity method
    public int complexMethod(int a, int b, int c, int d, int e) {
        if (a > 0) {
            if (b > 0) {
                if (c > 0) {
                    if (d > 0) {
                        if (e > 0) {
                            return 1;
                        } else {
                            return 2;
                        }
                    } else {
                        return 3;
                    }
                } else {
                    return 4;
                }
            } else {
                return 5;
            }
        } else {
            return 6;
        }
    }

    // CloseResource - resource not closed
    public void unclosedResource() throws Exception {
        Connection conn = DriverManager.getConnection("jdbc:h2:mem:test");
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT 1");
        // Resources not closed
    }

    // AvoidBranchingStatementAsLastInLoop
    public void branchAtEndOfLoop() {
        for (int i = 0; i < 10; i++) {
            System.out.println(i);
            continue;
        }
    }

    private void risky() throws Exception {
        throw new Exception("risky");
    }
}

// GodClass - class with too many responsibilities (simulated)
class GodClass {
    private String field1, field2, field3, field4, field5;
    private String field6, field7, field8, field9, field10;
    private int f1, f2, f3, f4, f5, f6, f7, f8, f9, f10;

    public void m1() { field1 = "1"; }
    public void m2() { field2 = "2"; }
    public void m3() { field3 = "3"; }
    public void m4() { field4 = "4"; }
    public void m5() { field5 = "5"; }
    public void m6() { field6 = "6"; }
    public void m7() { field7 = "7"; }
    public void m8() { field8 = "8"; }
    public void m9() { field9 = "9"; }
    public void m10() { field10 = "10"; }
}

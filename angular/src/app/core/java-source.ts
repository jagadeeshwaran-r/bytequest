// ByteQuest follows LeetCode-style Java conventions: commonly used java.util
// collections are available in Run and verified Submit without a manual import.
// Only the compiled/submitted copy is changed. The editor draft stays untouched.
const COLLECTIONS_IMPORT='import java.util.*;\n';
const EXPLICIT_WILDCARD=/^\s*import\s+java\.util\.\*\s*;/m;
const JAVA_PACKAGE=/^\s*package\s+[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*;/m;

export function prepareJavaForJudge(source:string):string{
  if(JAVA_PACKAGE.test(source))
    throw new Error('Remove the package declaration; ByteQuest Java solutions use the default package.');
  if(EXPLICIT_WILDCARD.test(source))return source;
  if(source.length+COLLECTIONS_IMPORT.length>60000)
    throw new Error('Keep your Java solution below 60,000 characters including standard imports.');
  return COLLECTIONS_IMPORT+source;
}

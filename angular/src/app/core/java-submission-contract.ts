// Pure Java-only verified submission contract. Never confuse browser Run
// with a server-accepted result (or a public-only suite with private tests).
export type SuiteScope='public'|'complete';
export interface JavaSubmissionProblem{
  readonly id:string;readonly revision:number|null;readonly hiddenCount:number;
}
export interface SubmissionNotes{
  readonly approach?:string;readonly timeComplexity?:string;readonly spaceComplexity?:string;
}
export interface SubmissionPayload {
  readonly action:'submission-create';
  readonly problemId:string;readonly revision:number;readonly language:'java';
  readonly source:string;readonly scope:SuiteScope;readonly nonce:string;
  readonly shared:true;readonly showcase:true;
  readonly approach:string;readonly timeComplexity:string;readonly spaceComplexity:string;
}
export interface RawVerdict {
  readonly accepted?:unknown;readonly status?:unknown;
  readonly verificationScope?:unknown;readonly message?:unknown;
  readonly submission?:{readonly id?:unknown;readonly runtime_ms?:unknown;readonly memory_bytes?:unknown};
  readonly passed?:unknown;readonly total?:unknown;
}
export interface VerifiedVerdict {
  readonly accepted:boolean;
  readonly scope:SuiteScope;
  readonly status:string;
  readonly message:string;
  readonly submissionId?:string;
  readonly passed?:number;
  readonly total?:number;
}

export function makeJavaSubmission(
  problem:JavaSubmissionProblem,source:string,scope:SuiteScope,
  nonce:string,notes:SubmissionNotes={}
):SubmissionPayload{
  if(!/^[a-z][a-z0-9-]{1,63}$/.test(problem.id))throw new Error('Invalid problem identifier.');
  if(!Number.isSafeInteger(problem.revision)||Number(problem.revision)<1)
    throw new Error('Reload the published problem before submitting; its revision is unavailable.');
  if(source.trim().length===0||source.length>60000)throw new Error('Enter a Java solution under 60,000 characters.');
  if(scope!=='public'&&scope!=='complete')throw new Error('Unsupported suite.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce))
    throw new Error('Invalid submission nonce.');
  const approach=notes.approach??'',timeComplexity=notes.timeComplexity??'',spaceComplexity=notes.spaceComplexity??'';
  if(approach.length>5000||timeComplexity.length>80||spaceComplexity.length>80)
    throw new Error('Shorten your explanation or complexity notes.');
  return {action:'submission-create',problemId:problem.id,revision:problem.revision as number,
    source,scope,language:'java',nonce,shared:true,showcase:true,
    approach:approach.trim(),timeComplexity:timeComplexity.trim(),spaceComplexity:spaceComplexity.trim()};
}
export function verifiedJavaVerdict(response:unknown,expected:SuiteScope):VerifiedVerdict{
  if(response===null||typeof response!=='object')throw new Error('Server returned an invalid verdict.');
  const v=response as RawVerdict;
  const status=typeof v.status==='string'?v.status:'invalid';
  const hasVerifiedScope=v.verificationScope==='public'||v.verificationScope==='complete';
  // Missing or malformed verification scope is not proof of full-suite success.
  const scope:SuiteScope=hasVerifiedScope?v.verificationScope as SuiteScope:expected;
  const submissionId=typeof v.submission?.id==='string'?v.submission.id:undefined;
  const accepted=v.accepted===true && status==='accepted' && hasVerifiedScope
    && scope===expected && !!submissionId;
  // Always fail closed for responses with inconsistent scopes, missing proof,
  // or execution failure. Never unlock content on a local test verdict.
  const message=typeof v.message==='string'?v.message.slice(0,500):
    accepted?'Server-verified acceptance recorded.':'The server did not record an accepted submission.';
  return {accepted,scope,status:accepted?'accepted':status,message,
    ...(submissionId?{submissionId}:{}),
    ...(Number.isSafeInteger(v.passed)?{passed:v.passed as number}:{}),
    ...(Number.isSafeInteger(v.total)?{total:v.total as number}:{})};
}

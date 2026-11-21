// Pure validation shared by Angular account writes and Java submissions.
// Never allow an apparently isolated staging UI to mutate the live ByteQuest project.
export interface StagingBackendConfig {
  readonly enabled:boolean;
  readonly apiUrl:string;
  readonly publishableKey:string;
}
const productionRef='zwubrziriuppkldrdoos';
export function validateStagingBackend(config:StagingBackendConfig):URL {
  if(!config||config.enabled!==true)
    throw new Error('Account changes are disabled until the separate test database is ready.');
  if(!config.apiUrl||!config.publishableKey)
    throw new Error('Staging backend credentials are incomplete.');
  let url:URL;
  try{url=new URL(config.apiUrl);}catch{throw new Error('Invalid staging API URL.');}
  const project=url.hostname.split('.')[0];
  if(url.protocol!=='https:'
    ||!/^[a-z0-9]{12,30}$/.test(project)
    ||url.hostname!==project+'.supabase.co'
    ||project===productionRef
    ||url.port||url.username||url.password||url.search||url.hash
    ||url.pathname!=='/functions/v1/bytequest-firebase'){
    throw new Error('Only a separate secure ByteQuest Supabase staging function may accept account changes.');
  }
  return url;
}

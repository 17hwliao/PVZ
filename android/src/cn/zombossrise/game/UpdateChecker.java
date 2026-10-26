package cn.zombossrise.game;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import javax.net.ssl.HttpsURLConnection;

/** Native-only, bounded reader for the fixed official release manifest. */
final class UpdateChecker {
 static final String REPOSITORY="https://github.com/17hwliao/PVZ/releases";
 static final String MANIFEST=REPOSITORY+"/latest/download/update-manifest.json";
 static final int MAX_BYTES=65536;
 private volatile boolean cancelled;
 private volatile HttpsURLConnection active;

 void cancel(){cancelled=true;HttpsURLConnection c=active;if(c!=null)c.disconnect();}
 private void alive(long deadline)throws Exception{if(cancelled||Thread.currentThread().isInterrupted())throw new Exception("更新检查已取消");if(System.nanoTime()>deadline)throw new Exception("更新检查超时，请稍后重试");}
 static URL checkedUrl(String value)throws Exception{
  URL u=new URL(value);String host=u.getHost().toLowerCase(Locale.ROOT);
  if(!"https".equals(u.getProtocol())||u.getUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443)||u.getRef()!=null||!(host.equals("github.com")||host.equals("release-assets.githubusercontent.com")||host.equals("objects.githubusercontent.com")))throw new Exception("更新地址不在官方允许范围");
  return u;
 }
 private String readManifest()throws Exception{
  long deadline=System.nanoTime()+25000000000L;URL url=checkedUrl(MANIFEST);
  for(int redirects=0;redirects<=3;redirects++){
   alive(deadline);HttpsURLConnection c=(HttpsURLConnection)url.openConnection();active=c;
   try{
    alive(deadline);
    c.setInstanceFollowRedirects(false);int remaining=(int)Math.max(1,(deadline-System.nanoTime())/1000000L);
    c.setConnectTimeout(Math.min(7000,remaining));c.setReadTimeout(Math.min(10000,remaining));c.setRequestProperty("Accept","application/json");c.setRequestProperty("Accept-Encoding","identity");c.setRequestProperty("User-Agent","ZombossRise-Android-Updater/1");
    int code=c.getResponseCode();alive(deadline);
    if(code==301||code==302||code==303||code==307||code==308){if(redirects==3)throw new Exception("更新地址跳转次数过多");String location=c.getHeaderField("Location");if(location==null||location.length()>8192)throw new Exception("更新地址跳转无效");url=checkedUrl(new URL(url,location).toExternalForm());continue;}
    if(code!=200)throw new Exception("更新服务暂不可用（HTTP "+code+"）");
    if(c.getContentLengthLong()>MAX_BYTES)throw new Exception("更新清单超过大小限制");
    String encoding=c.getContentEncoding();if(encoding!=null&&!"identity".equalsIgnoreCase(encoding))throw new Exception("更新清单编码不受支持");
    try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
     byte[] buf=new byte[4096];int n;
     while((n=in.read(buf))!=-1){alive(deadline);if(out.size()+n>MAX_BYTES)throw new Exception("更新清单超过大小限制");out.write(buf,0,n);int left=(int)Math.max(1,(deadline-System.nanoTime())/1000000L);c.setReadTimeout(Math.min(10000,left));}
     alive(deadline);return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(out.toByteArray())).toString();
    }
   }finally{active=null;c.disconnect();}
  }
  throw new Exception("更新地址无效");
 }
 static long integer(JSONObject o,String key,long min,long max)throws Exception{
  Object v=o.get(key);if(!(v instanceof Number))throw new Exception("更新清单数值无效");double d=((Number)v).doubleValue();long n=((Number)v).longValue();if(Double.isNaN(d)||Double.isInfinite(d)||d!=n||n<min||n>max)throw new Exception("更新清单数值超出范围");return n;
 }
 static String string(JSONObject o,String key)throws Exception{Object v=o.get(key);if(!(v instanceof String))throw new Exception("更新清单文字无效");return (String)v;}
 static int[] version(String value)throws Exception{
  if(!value.matches("(?:0|[1-9][0-9]{0,5})\\.(?:0|[1-9][0-9]{0,5})\\.(?:0|[1-9][0-9]{0,5})"))throw new Exception("更新版本号无效");String[] p=value.split("\\.");return new int[]{Integer.parseInt(p[0]),Integer.parseInt(p[1]),Integer.parseInt(p[2])};
 }
 static int compare(String a,String b)throws Exception{int[] av=version(a),bv=version(b);for(int i=0;i<3;i++)if(av[i]!=bv[i])return Integer.compare(av[i],bv[i]);return 0;}
 static JSONObject base(String installedVersion,long installedBuild,String requestId)throws Exception{
  return new JSONObject().put("status","error").put("platform","android").put("installedVersion",installedVersion).put("installedBuild",installedBuild).put("version",installedVersion).put("build",installedBuild).put("message","").put("downloadUrl","").put("releaseUrl",REPOSITORY+"/latest").put("sha256","").put("size",0).put("requestId",requestId);
 }
 static JSONObject failure(String installedVersion,long installedBuild,String requestId,String message){try{return base(installedVersion,installedBuild,requestId).put("message",message);}catch(Exception impossible){throw new IllegalStateException(impossible);}}
 static JSONObject validate(JSONObject manifest,String installedVersion,long installedBuild,String requestId)throws Exception{
  integer(manifest,"schemaVersion",1,1);if(!"stable".equals(string(manifest,"channel")))throw new Exception("更新通道不受支持");
  String latest=string(manifest,"version");version(latest);long build=integer(manifest,"build",1,Integer.MAX_VALUE);
  String notes=string(manifest,"notes");if(notes.length()>2000)throw new Exception("更新说明超过长度限制");
  String release=REPOSITORY+"/tag/v"+latest;if(!release.equals(string(manifest,"releaseUrl")))throw new Exception("更新发行页不属于官方版本");
  JSONObject platforms=manifest.getJSONObject("platforms"),android=null;
  for(String platform:new String[]{"android","windows-x64"}){
   JSONObject asset=platforms.getJSONObject(platform);String suffix=platform.equals("android")?"android.apk":"windows-x64.zip";
   String expected=REPOSITORY+"/download/v"+latest+"/ZombossRise-"+latest+"-"+suffix;
   if(!expected.equals(string(asset,"url")))throw new Exception("更新安装包地址不属于官方版本");
   integer(asset,"size",1,2147483648L);if(!string(asset,"sha256").matches("[a-fA-F0-9]{64}"))throw new Exception("更新安装包校验值无效");if(platform.equals("android"))android=asset;
  }
  int cmp=compare(latest,installedVersion);
  if(cmp<0||build<installedBuild||(cmp>0&&build<=installedBuild))throw new Exception("更新版本或构建号低于本机，已拒绝降级");
  boolean available=cmp>0||build>installedBuild;
  JSONObject result=base(installedVersion,installedBuild,requestId).put("status",available?"available":"current").put("version",latest).put("build",build).put("releaseUrl",release).put("message",available?(notes.isEmpty()?"发现新版，可以手动下载安装包。":notes):"当前已是最新版。");
  if(available)result.put("downloadUrl",string(android,"url")).put("size",integer(android,"size",1,2147483648L)).put("sha256",string(android,"sha256").toLowerCase(Locale.ROOT));
  return result;
 }
 JSONObject check(String installedVersion,long installedBuild,String requestId){
  try{return validate(new JSONObject(readManifest()),installedVersion,installedBuild,requestId);}catch(Exception e){String message=e.getMessage();if(message==null||!message.startsWith("更新"))message="更新检查失败，请确认网络后重试。";return failure(installedVersion,installedBuild,requestId,message);}
 }
}

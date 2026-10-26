package cn.zombossrise.game;

import org.json.JSONObject;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import javax.net.ssl.HttpsURLConnection;
import java.security.cert.Certificate;

/** Runs the production validator/network reader with Android's real JSON library and fake HTTPS transport. */
public final class UpdateCheckerFixture {
 private static int assertions;
 private static final ArrayDeque<Response> queue=new ArrayDeque<>();
 private static final List<FakeConnection> connections=new ArrayList<>();
 private interface Checked {void run()throws Exception;}
 private static void expect(boolean ok,String label){assertions++;if(!ok)throw new AssertionError(label);}
 private static void rejects(Checked fn,String label)throws Exception{boolean failed=false;try{fn.run();}catch(Exception expected){failed=true;}expect(failed,label);}
 private static JSONObject fixture(String version,int build)throws Exception{
  JSONObject p=new JSONObject();for(String platform:new String[]{"android","windows-x64"})p.put(platform,new JSONObject().put("url",UpdateChecker.REPOSITORY+"/download/v"+version+"/ZombossRise-"+version+"-"+(platform.equals("android")?"android.apk":"windows-x64.zip")).put("sha256",new String(new char[64]).replace('\0','A')).put("size",123456));
  return new JSONObject().put("schemaVersion",1).put("version",version).put("build",build).put("channel","stable").put("releaseUrl",UpdateChecker.REPOSITORY+"/tag/v"+version).put("notes","新章节\"\n与 UI \u2028").put("platforms",p);
 }
 private static JSONObject valid(JSONObject input)throws Exception{return UpdateChecker.validate(input,"0.7.0",700,"android-fixture");}
 private static final class Response {
  int code=200;String location,encoding;byte[] bytes;long length=-1;
  Response(byte[] b){bytes=b;}Response(String s)throws Exception{this(s.getBytes("UTF-8"));}
 }
 private static final class FakeConnection extends HttpsURLConnection {
  final Response response;boolean disconnected;int bytesRead;
  FakeConnection(URL url){super(url);response=queue.removeFirst();connections.add(this);}
  public void connect(){}public void disconnect(){disconnected=true;}public boolean usingProxy(){return false;}
  public String getCipherSuite(){return "fixture";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
  public int getResponseCode(){return response.code;}public long getContentLengthLong(){return response.length;}
  public String getContentEncoding(){return response.encoding;}public String getHeaderField(String name){return "Location".equals(name)?response.location:null;}
  public InputStream getInputStream(){return new ByteArrayInputStream(response.bytes){public synchronized int read(byte[] b,int off,int len){int n=super.read(b,off,len);if(n>0)bytesRead+=n;return n;}};}
 }
 private static JSONObject network(Response... responses){queue.clear();connections.clear();for(Response r:responses)queue.add(r);return new UpdateChecker().check("0.7.0",700,"network-fixture");}
 private static Response redirect(String target)throws Exception{Response r=new Response("");r.code=302;r.location=target;return r;}
 public static void main(String[] args)throws Exception{
  URL.setURLStreamHandlerFactory(protocol->"https".equals(protocol)?new URLStreamHandler(){protected URLConnection openConnection(URL u){return new FakeConnection(u);}}:null);
  JSONObject r=valid(fixture("0.7.0",700));expect("current".equals(r.getString("status")),"same identity current");expect(r.getString("downloadUrl").isEmpty(),"current has no download");
  r=valid(fixture("0.7.0",701));expect("available".equals(r.getString("status")),"build-only available");expect(r.getString("sha256").equals(new String(new char[64]).replace('\0','a')),"checksum normalized");expect("android-fixture".equals(r.getString("requestId")),"event request identity");
  expect("available".equals(valid(fixture("0.8.0",800)).getString("status")),"higher version/build available");
  rejects(()->valid(fixture("0.6.9",800)),"version downgrade");rejects(()->valid(fixture("0.8.0",699)),"build downgrade");rejects(()->valid(fixture("0.8.0",700)),"higher version needs higher build");rejects(()->valid(fixture("0.7.0",699)),"same version lower build");
  for(String v:new String[]{"00.7.0","0.7","0.7.0-beta","0.7.0/evil","1000000.0.0"," 0.7.0"})rejects(()->valid(fixture(v,800)),"invalid semver "+v);
  JSONObject m=fixture("0.8.0",800);m.put("build","800");final JSONObject numericString=m;rejects(()->valid(numericString),"numeric string rejected");m=fixture("0.8.0",800);m.put("build",800.5);final JSONObject fraction=m;rejects(()->valid(fraction),"fraction rejected");
  m=fixture("0.8.0",800);m.put("channel","preview");final JSONObject preview=m;rejects(()->valid(preview),"unrequested channel");
  m=fixture("0.8.0",800);m.put("releaseUrl",UpdateChecker.REPOSITORY+"/tag/v0.8.0?elsewhere");final JSONObject release=m;rejects(()->valid(release),"release exact repo tag");
  m=fixture("0.8.0",800);m.getJSONObject("platforms").getJSONObject("windows-x64").put("url","https://example.com/a.zip");final JSONObject otherAsset=m;rejects(()->valid(otherAsset),"other platform also validated");
  for(Object size:new Object[]{0,-1,2147483649L,1.5,"9"}){final JSONObject bad=fixture("0.8.0",800);bad.getJSONObject("platforms").getJSONObject("android").put("size",size);rejects(()->valid(bad),"bad asset size "+size);}
  m=fixture("0.8.0",800);m.getJSONObject("platforms").getJSONObject("android").put("sha256","x");final JSONObject sha=m;rejects(()->valid(sha),"bad hash");
  m=fixture("0.8.0",800);m.put("notes",new String(new char[2001]));final JSONObject notes=m;rejects(()->valid(notes),"bounded notes");
  for(String u:new String[]{"http://github.com/a","https://github.com.evil.example/a","https://user@github.com/a","https://github.com:444/a","https://objects.githubusercontent.com/a#x","https://example.com/a","file:///tmp/a"})rejects(()->UpdateChecker.checkedUrl(u),"blocked transport URL "+u);
  expect(UpdateChecker.checkedUrl("https://release-assets.githubusercontent.com/file?sig=fixture")!=null,"signed asset allowed");
  String body=fixture("0.8.0",800).toString();r=network(new Response(body));expect("available".equals(r.getString("status")),"real reader happy path");expect(connections.get(0).getConnectTimeout()<=7000&&connections.get(0).getReadTimeout()<=10000,"bounded timeouts");expect(!connections.get(0).getInstanceFollowRedirects(),"no automatic redirects");expect(connections.get(0).disconnected,"connection closed");
  r=network(redirect("https://release-assets.githubusercontent.com/manifest?sig=fixture"),new Response(body));expect("available".equals(r.getString("status"))&&connections.size()==2,"allowed manual redirect");
  r=network(redirect("https://evil.example/manifest"));expect("error".equals(r.getString("status"))&&connections.size()==1,"blocked redirect never fetched");
  r=network(redirect("http://github.com/manifest"));expect("error".equals(r.getString("status")),"redirect cannot downgrade TLS");
  r=network(redirect("/a"),redirect("/b"),redirect("/c"),redirect("/d"));expect("error".equals(r.getString("status"))&&connections.size()==4,"redirect bound");
  Response large=new Response(new byte[65537]);large.length=65537;r=network(large);expect("error".equals(r.getString("status"))&&connections.get(0).bytesRead==0,"content length rejected before reading");
  r=network(new Response(new byte[70000]));expect("error".equals(r.getString("status"))&&connections.get(0).bytesRead<=69632,"unknown length stream bounded");
  r=network(new Response(new byte[]{(byte)0xc3,0x28}));expect("error".equals(r.getString("status")),"malformed UTF8 rejected");
  Response gzip=new Response(body);gzip.encoding="gzip";expect("error".equals(network(gzip).getString("status")),"unexpected content encoding rejected");
  Response unavailable=new Response("");unavailable.code=503;expect("error".equals(network(unavailable).getString("status")),"service error");
  UpdateChecker cancelled=new UpdateChecker();cancelled.cancel();connections.clear();r=cancelled.check("0.7.0",700,"cancel-fixture");expect("error".equals(r.getString("status"))&&connections.isEmpty(),"cancelled never opens network");
  System.out.println("Android updater fixtures passed: "+assertions+" assertions (fake HTTPS, no external network)");
 }
}

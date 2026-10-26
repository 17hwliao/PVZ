package cn.zombossrise.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.os.Build;
import android.net.Uri;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.json.JSONObject;

public final class MainActivity extends Activity {
 private WebView web;
 private UpdatesBridge updates;
 private boolean trustedPage;
 private static final String HOST="appassets.androidplatform.net";
 private static boolean local(Uri uri){return uri!=null&&"https".equals(uri.getScheme())&&HOST.equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443)&&uri.getUserInfo()==null;}
 private static boolean gamePage(String url){
  if(url==null)return false;Uri uri=Uri.parse(url);if(!local(uri))return false;String path=uri.getPath();
  return "/index.html".equals(path)||"/terrain-campaign.html".equals(path)||"/rescue-design.html".equals(path)||"/comics.html".equals(path)||"/battle-atlas.html".equals(path)||"/almanac.html".equals(path);
 }
 private boolean trusted(){return trustedPage&&web!=null&&!isFinishing()&&!isDestroyed()&&gamePage(web.getUrl());}
 private static WebResourceResponse notFound(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new HashMap<>(),new ByteArrayInputStream(new byte[0]));}
 private static String mime(String file){if(file.endsWith(".html"))return "text/html";if(file.endsWith(".js"))return "application/javascript";if(file.endsWith(".css"))return "text/css";if(file.endsWith(".png"))return "image/png";if(file.endsWith(".webp"))return "image/webp";if(file.endsWith(".jpg"))return "image/jpeg";if(file.endsWith(".json"))return "application/json";if(file.endsWith(".ogg"))return "audio/ogg";if(file.endsWith(".ttf"))return "font/ttf";return "application/octet-stream";}
 private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);immersive();web=new WebView(this);setContentView(web);WebView.setWebContentsDebuggingEnabled(false);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);s.setSafeBrowsingEnabled(true);s.setSupportMultipleWindows(false);s.setJavaScriptCanOpenWindowsAutomatically(false);
  updates=new UpdatesBridge();web.addJavascriptInterface(updates,"PVZAndroidUpdates");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){return !req.isForMainFrame()||!gamePage(req.getUrl().toString());}
   @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){trustedPage=false;if(updates!=null)updates.invalidate();}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){
    Uri uri=req.getUrl();if(!local(uri)||!"GET".equals(req.getMethod()))return notFound();String file=uri.getPath();if(file==null||file.contains("..")||file.contains("\\")||file.indexOf(0)>=0||!file.startsWith("/"))return notFound();
    if(req.isForMainFrame()&&!gamePage(uri.toString()))return notFound();
    try{InputStream in=getAssets().open("web"+file);Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-cache");headers.put("X-Content-Type-Options","nosniff");headers.put("X-Frame-Options","DENY");
     // JavascriptInterface is exposed to every frame: deny child documents entirely.
     headers.put("Content-Security-Policy","frame-src 'none'; child-src 'none'; object-src 'none'; base-uri 'self'; connect-src 'none'; form-action 'none'");
     return new WebResourceResponse(mime(file),"UTF-8",200,"OK",headers,in);
    }catch(Exception e){return notFound();}
   }
   @Override public void onPageFinished(WebView v,String url){trustedPage=gamePage(url)&&gamePage(v.getUrl());if(trustedPage)v.evaluateJavascript("if(!window.HTMLDialogElement||!HTMLDialogElement.prototype.showModal||!window.CSS||!CSS.supports('font-size','1cqw')){document.body.textContent='系统 WebView 版本过旧，请更新 Android System WebView 或 Chrome 后重新打开游戏。';}",null);}
   @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail){trustedPage=false;if(updates!=null)updates.close();v.destroy();web=null;new AlertDialog.Builder(MainActivity.this).setTitle("显示组件已退出").setMessage("关卡进度已按检查点保存。请重新打开游戏继续。").setPositiveButton("关闭",(d,w)->finish()).setCancelable(false).show();return true;}
  });
  web.setWebChromeClient(new WebChromeClient());web.setDownloadListener((url,userAgent,contentDisposition,mimetype,contentLength)->{});
  if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->confirmExit());web.loadUrl("https://"+HOST+"/index.html");
 }
 public final class UpdatesBridge {
  private final ExecutorService worker=Executors.newSingleThreadExecutor();
  private long generation;
  private boolean closed;
  private UpdateChecker checker;
  private Future<?> pending;
  private String verifiedDownload="",latestRequestId="";
  private String installedVersion="";
  private long installedBuild;
  UpdatesBridge(){try{PackageInfo p=getPackageManager().getPackageInfo(getPackageName(),0);installedVersion=p.versionName;installedBuild=Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}catch(Exception ignored){/* A missing package identity must never enable updates. */}}
  synchronized void invalidate(){generation++;verifiedDownload="";latestRequestId="";if(checker!=null){checker.cancel();checker=null;}if(pending!=null){pending.cancel(true);pending=null;}}
  synchronized void close(){if(closed)return;closed=true;invalidate();worker.shutdownNow();}
  private synchronized boolean current(long token){return !closed&&token==generation;}
  @JavascriptInterface public String check(){
   final long token;final String id;
   synchronized(this){invalidate();token=generation;id="android-"+token;latestRequestId=id;if(closed)return id;}
   runOnUiThread(()->{
    if(!current(token)||!trusted())return;
    if(installedVersion==null||installedVersion.isEmpty()||installedBuild<1){publish(token,UpdateChecker.failure("unknown",0,id,"更新检查无法读取本机版本"));return;}
    synchronized(this){if(!current(token))return;checker=new UpdateChecker();final UpdateChecker task=checker;pending=worker.submit(()->{JSONObject result=task.check(installedVersion,installedBuild,id);runOnUiThread(()->publish(token,result));});}
   });return id;
  }
  private void publish(long token,JSONObject result){
   if(!current(token)||!trusted())return;
   synchronized(this){if(!current(token))return;verifiedDownload="available".equals(result.optString("status"))?result.optString("downloadUrl"):"";}
   String json=JSONObject.quote(result.toString()).replace("\u2028","\\u2028").replace("\u2029","\\u2029");
   web.evaluateJavascript("(function(){if(window!==window.top)return;window.dispatchEvent(new CustomEvent('pvz-update-result',{detail:JSON.parse("+json+")}));})();",null);
  }
  @JavascriptInterface public boolean openDownload(){
   final long token;final String url,id;
   synchronized(this){if(closed||verifiedDownload.isEmpty())return false;token=generation;url=verifiedDownload;id=latestRequestId;}
   runOnUiThread(()->{if(!current(token)||!trusted())return;try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE));}catch(Exception e){publish(token,UpdateChecker.failure(installedVersion,installedBuild,id,"更新下载链接未能打开，请检查系统浏览器后重试。"));}});return true;
  }
 }
 private void pauseGame(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('pvz-native-pause'))",null);}
 @Override protected void onPause(){pauseGame();if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}immersive();}
 @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
 private void confirmExit(){pauseGame();new AlertDialog.Builder(this).setTitle("退出僵王崛起？").setMessage("已解救同胞、来信和章节进度会保留。进行中的战斗下次从关卡开局重新集结。").setPositiveButton("退出",(d,w)->finish()).setNegativeButton("继续游戏",(d,w)->immersive()).show();}
 @Override public void onBackPressed(){confirmExit();}
 @Override protected void onDestroy(){trustedPage=false;if(updates!=null)updates.close();if(web!=null){web.removeJavascriptInterface("PVZAndroidUpdates");web.destroy();web=null;}super.onDestroy();}
}

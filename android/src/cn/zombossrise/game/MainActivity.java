package cn.zombossrise.game;
import android.app.Activity;
import android.app.AlertDialog;
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

public final class MainActivity extends Activity {
 private WebView web;
 private static final String HOST="appassets.androidplatform.net";
 private static boolean local(Uri uri){return "https".equals(uri.getScheme())&&HOST.equals(uri.getHost());}
 private static WebResourceResponse notFound(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new HashMap<>(),new ByteArrayInputStream(new byte[0]));}
 private static String mime(String file){if(file.endsWith(".html"))return "text/html";if(file.endsWith(".js"))return "application/javascript";if(file.endsWith(".css"))return "text/css";if(file.endsWith(".png"))return "image/png";if(file.endsWith(".jpg"))return "image/jpeg";if(file.endsWith(".json"))return "application/json";return "application/octet-stream";}
 private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);}
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);immersive();web=new WebView(this);setContentView(web);WebView.setWebContentsDebuggingEnabled(false);WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);s.setSafeBrowsingEnabled(true);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){return !local(req.getUrl());}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){Uri uri=req.getUrl();if(!local(uri))return notFound();String file=uri.getPath();if(file==null||file.contains("..")||file.contains("\\")||!file.startsWith("/"))return notFound();try{InputStream in=getAssets().open("web"+file);Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-cache");headers.put("X-Content-Type-Options","nosniff");return new WebResourceResponse(mime(file),"UTF-8",200,"OK",headers,in);}catch(Exception e){return notFound();}}
   @Override public void onPageFinished(WebView v,String url){v.evaluateJavascript("if(!window.HTMLDialogElement||!HTMLDialogElement.prototype.showModal||!window.CSS||!CSS.supports('font-size','1cqw')){document.body.textContent='系统 WebView 版本过旧，请更新 Android System WebView 或 Chrome 后重新打开游戏。';}",null);}
   @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail detail){web.destroy();web=null;new AlertDialog.Builder(MainActivity.this).setTitle("显示组件已退出").setMessage("关卡进度已按检查点保存。请重新打开游戏继续。").setPositiveButton("关闭",(d,w)->finish()).setCancelable(false).show();return true;}
  });web.setWebChromeClient(new WebChromeClient());if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->confirmExit());web.loadUrl("https://"+HOST+"/index.html");
 }
 private void pauseGame(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('pvz-native-pause'))",null);}
 @Override protected void onPause(){pauseGame();if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}immersive();}
 @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();}
 private void confirmExit(){pauseGame();new AlertDialog.Builder(this).setTitle("退出僵王崛起？").setMessage("已解救同胞、来信和章节进度会保留。进行中的战斗下次从关卡开局重新集结。").setPositiveButton("退出",(d,w)->finish()).setNegativeButton("继续游戏",(d,w)->immersive()).show();}
 @Override public void onBackPressed(){confirmExit();}
 @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
